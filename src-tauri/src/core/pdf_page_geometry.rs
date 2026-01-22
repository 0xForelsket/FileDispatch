use std::collections::HashSet;

use anyhow::{anyhow, Result};
use lopdf::{Document, Object, ObjectId};

use crate::core::pdf_coords::{PageGeometry, PdfBox};

pub fn extract_page_geometry(doc: &Document, page_id: ObjectId) -> Result<PageGeometry> {
    let crop = resolve_inherited_box(doc, page_id, b"CropBox")?;
    let media = resolve_inherited_box(doc, page_id, b"MediaBox")?;
    let crop_box = crop.or(media).ok_or_else(|| anyhow!("Missing MediaBox"))?;

    let rotate = resolve_inherited_number(doc, page_id, b"Rotate")?.unwrap_or(0.0);
    let rotate_cw_degrees = normalize_rotate_cw_degrees(rotate)?;

    Ok(PageGeometry {
        crop_box,
        rotate_cw_degrees,
    })
}

fn resolve_inherited_box(doc: &Document, start_id: ObjectId, key: &[u8]) -> Result<Option<PdfBox>> {
    let obj = resolve_inherited_object(doc, start_id, key)?;
    match obj {
        None => Ok(None),
        Some(Object::Array(arr)) => Ok(Some(array_to_pdf_box(&arr)?)),
        Some(other) => Err(anyhow!(
            "Invalid {} value type: expected array, got {:?}",
            String::from_utf8_lossy(key),
            other.type_name()
        )),
    }
}

fn resolve_inherited_number(
    doc: &Document,
    start_id: ObjectId,
    key: &[u8],
) -> Result<Option<f64>> {
    let obj = resolve_inherited_object(doc, start_id, key)?;
    match obj {
        None => Ok(None),
        Some(Object::Integer(v)) => Ok(Some(v as f64)),
        Some(Object::Real(v)) => Ok(Some(f64::from(v))),
        Some(other) => Err(anyhow!(
            "Invalid {} value type: expected number, got {:?}",
            String::from_utf8_lossy(key),
            other.type_name()
        )),
    }
}

fn resolve_inherited_object(
    doc: &Document,
    start_id: ObjectId,
    key: &[u8],
) -> Result<Option<Object>> {
    let mut current = start_id;
    let mut seen = HashSet::<ObjectId>::new();

    loop {
        if !seen.insert(current) {
            return Err(anyhow!(
                "Cycle detected while resolving {}",
                String::from_utf8_lossy(key)
            ));
        }

        let obj = doc.get_object(current)?;
        let dict = obj.as_dict().map_err(|_| anyhow!("Invalid page tree object"))?;

        if let Ok(value) = dict.get(key) {
            return Ok(Some(value.clone()));
        }

        let parent = dict
            .get(b"Parent")
            .ok()
            .and_then(|p| p.as_reference().ok());
        match parent {
            Some(parent_id) => current = parent_id,
            None => return Ok(None),
        }
    }
}

fn array_to_pdf_box(arr: &[Object]) -> Result<PdfBox> {
    if arr.len() < 4 {
        return Err(anyhow!("Invalid box array length"));
    }

    let x0 = obj_to_f64(&arr[0])?;
    let y0 = obj_to_f64(&arr[1])?;
    let x1 = obj_to_f64(&arr[2])?;
    let y1 = obj_to_f64(&arr[3])?;

    Ok(PdfBox {
        x0: x0 as f32,
        y0: y0 as f32,
        x1: x1 as f32,
        y1: y1 as f32,
    })
}

fn obj_to_f64(obj: &Object) -> Result<f64> {
    match obj {
        Object::Integer(val) => Ok(*val as f64),
        Object::Real(val) => Ok(f64::from(*val)),
        _ => Err(anyhow!("Invalid numeric value")),
    }
}

fn normalize_rotate_cw_degrees(rotate: f64) -> Result<u32> {
    let rotate_i = rotate.round() as i32;
    let mut norm = rotate_i % 360;
    if norm < 0 {
        norm += 360;
    }

    match norm {
        0 | 90 | 180 | 270 => Ok(norm as u32),
        _ => Err(anyhow!("Unsupported /Rotate value: {rotate_i}")),
    }
}

#[cfg(test)]
mod tests {
    use lopdf::{dictionary, Document, Object};

    use super::extract_page_geometry;

    fn make_doc_with_page_tree(
        pages_extra: lopdf::Dictionary,
        page_extra: lopdf::Dictionary,
    ) -> (Document, lopdf::ObjectId) {
        let mut doc = Document::with_version("1.5");

        let pages_id = doc.new_object_id();
        let page_id = doc.new_object_id();

        let mut pages_dict = dictionary! {
            "Type" => "Pages",
            "Kids" => vec![Object::Reference(page_id)],
            "Count" => Object::Integer(1),
        };
        pages_dict.extend(&pages_extra);
        doc.objects.insert(pages_id, Object::Dictionary(pages_dict));

        let mut page_dict = dictionary! {
            "Type" => "Page",
            "Parent" => Object::Reference(pages_id),
        };
        page_dict.extend(&page_extra);
        doc.objects.insert(page_id, Object::Dictionary(page_dict));

        let catalog_id = doc.new_object_id();
        let catalog_dict = dictionary! {
            "Type" => "Catalog",
            "Pages" => Object::Reference(pages_id),
        };
        doc.objects
            .insert(catalog_id, Object::Dictionary(catalog_dict));
        doc.trailer.set("Root", Object::Reference(catalog_id));

        (doc, page_id)
    }

    #[test]
    fn uses_media_box_when_no_crop_box() {
        let (doc, page_id) = make_doc_with_page_tree(
            dictionary! {},
            dictionary! {
                "MediaBox" => vec![
                    Object::Integer(0),
                    Object::Integer(0),
                    Object::Integer(200),
                    Object::Integer(100),
                ],
            },
        );

        let geom = extract_page_geometry(&doc, page_id).unwrap();
        assert_eq!(geom.crop_box.x0, 0.0);
        assert_eq!(geom.crop_box.y0, 0.0);
        assert_eq!(geom.crop_box.x1, 200.0);
        assert_eq!(geom.crop_box.y1, 100.0);
        assert_eq!(geom.rotate_cw_degrees, 0);
    }

    #[test]
    fn prefers_crop_box_over_media_box() {
        let (doc, page_id) = make_doc_with_page_tree(
            dictionary! {},
            dictionary! {
                "MediaBox" => vec![
                    Object::Integer(0),
                    Object::Integer(0),
                    Object::Integer(200),
                    Object::Integer(100),
                ],
                "CropBox" => vec![
                    Object::Integer(10),
                    Object::Integer(20),
                    Object::Integer(110),
                    Object::Integer(220),
                ],
            },
        );

        let geom = extract_page_geometry(&doc, page_id).unwrap();
        assert_eq!(geom.crop_box.x0, 10.0);
        assert_eq!(geom.crop_box.y0, 20.0);
        assert_eq!(geom.crop_box.x1, 110.0);
        assert_eq!(geom.crop_box.y1, 220.0);
    }

    #[test]
    fn reads_rotate_from_page() {
        let (doc, page_id) = make_doc_with_page_tree(
            dictionary! {},
            dictionary! {
                "MediaBox" => vec![
                    Object::Integer(0),
                    Object::Integer(0),
                    Object::Integer(200),
                    Object::Integer(100),
                ],
                "Rotate" => Object::Integer(90),
            },
        );

        let geom = extract_page_geometry(&doc, page_id).unwrap();
        assert_eq!(geom.rotate_cw_degrees, 90);
    }

    #[test]
    fn inherits_media_box_and_rotate_from_pages_node() {
        let (doc, page_id) = make_doc_with_page_tree(
            dictionary! {
                "MediaBox" => vec![
                    Object::Integer(0),
                    Object::Integer(0),
                    Object::Integer(612),
                    Object::Integer(792),
                ],
                "Rotate" => Object::Integer(270),
            },
            dictionary! {},
        );

        let geom = extract_page_geometry(&doc, page_id).unwrap();
        assert_eq!(geom.crop_box.x1, 612.0);
        assert_eq!(geom.crop_box.y1, 792.0);
        assert_eq!(geom.rotate_cw_degrees, 270);
    }
}
