use std::path::PathBuf;

use anyhow::{anyhow, Result};
use lopdf::dictionary;
use pdfium_render::prelude::{PdfRenderConfig, Pdfium};

fn main() -> Result<()> {
    let out_path = std::env::args()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::temp_dir().join("filedispatch_pdfium_rotate90_probe.pdf"));

    write_rotate90_test_pdf(&out_path)?;
    println!("Wrote test PDF: {}", out_path.display());

    let pdfium = load_pdfium()?;
    let document = pdfium.load_pdf_from_file(&out_path, None)?;

    for (index, page) in document.pages().iter().enumerate() {
        let rotation = page.rotation().ok();
        println!(
            "page[{index}]: page.width_pt={:.2} page.height_pt={:.2} page.rotation={rotation:?}",
            page.width().value,
            page.height().value
        );

        let bitmap = page.render_with_config(&PdfRenderConfig::new().set_target_width(400))?;
        let img = bitmap.as_image();
        println!("  render: bitmap={}x{}", img.width(), img.height());
    }

    Ok(())
}

fn write_rotate90_test_pdf(path: &PathBuf) -> Result<()> {
    let mut doc = lopdf::Document::with_version("1.5");

    let font_id = doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
    });

    let content = lopdf::content::Content {
        operations: vec![
            lopdf::content::Operation::new("BT", vec![]),
            lopdf::content::Operation::new(
                "Tf",
                vec![
                    lopdf::Object::Name(b"F1".to_vec()),
                    lopdf::Object::Integer(24),
                ],
            ),
            lopdf::content::Operation::new(
                "Td",
                vec![lopdf::Object::Integer(20), lopdf::Object::Integer(20)],
            ),
            lopdf::content::Operation::new(
                "Tj",
                vec![lopdf::Object::String(
                    b"Rotate90 probe".to_vec(),
                    lopdf::StringFormat::Literal,
                )],
            ),
            lopdf::content::Operation::new("ET", vec![]),
        ],
    };
    let content_stream = lopdf::Stream::new(lopdf::Dictionary::new(), content.encode()?);
    let content_id = doc.add_object(content_stream);

    let pages_id = doc.new_object_id();
    let page_id = doc.new_object_id();

    let resources = dictionary! {
        "Font" => dictionary! { "F1" => font_id },
    };

    let page_dict = dictionary! {
        "Type" => "Page",
        "Parent" => lopdf::Object::Reference(pages_id),
        "MediaBox" => vec![
            lopdf::Object::Integer(0),
            lopdf::Object::Integer(0),
            lopdf::Object::Integer(200),
            lopdf::Object::Integer(100),
        ],
        "Rotate" => lopdf::Object::Integer(90),
        "Contents" => lopdf::Object::Reference(content_id),
        "Resources" => resources,
    };
    doc.objects
        .insert(page_id, lopdf::Object::Dictionary(page_dict));

    let pages_dict = dictionary! {
        "Type" => "Pages",
        "Kids" => vec![lopdf::Object::Reference(page_id)],
        "Count" => lopdf::Object::Integer(1),
    };
    doc.objects
        .insert(pages_id, lopdf::Object::Dictionary(pages_dict));

    let catalog_id = doc.new_object_id();
    let catalog_dict = dictionary! {
        "Type" => "Catalog",
        "Pages" => lopdf::Object::Reference(pages_id),
    };
    doc.objects
        .insert(catalog_id, lopdf::Object::Dictionary(catalog_dict));

    doc.trailer.set("Root", lopdf::Object::Reference(catalog_id));
    doc.compress();
    doc.save(path)?;
    Ok(())
}

fn load_pdfium() -> Result<Pdfium> {
    let bindings = Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path("./"))
        .or_else(|_| Pdfium::bind_to_system_library())
        .map_err(|e| anyhow!("Failed to load PDFium: {e}"))?;
    Ok(Pdfium::new(bindings))
}

