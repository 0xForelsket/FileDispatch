use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct PdfBox {
    pub x0: f32,
    pub y0: f32,
    pub x1: f32,
    pub y1: f32,
}

impl PdfBox {
    pub fn width(self) -> f32 {
        self.x1 - self.x0
    }

    pub fn height(self) -> f32 {
        self.y1 - self.y0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct PageGeometry {
    /// Visible area users see; prefer CropBox when present, otherwise MediaBox.
    pub crop_box: PdfBox,
    /// Page rotation in degrees (typically 0/90/180/270). Treated as clockwise.
    pub rotate_cw_degrees: u32,
}

/// Map a point from OCR pixel coordinates (top-left origin) into PDF user-space points
/// (bottom-left origin), respecting CropBox and /Rotate.
///
/// Assumptions:
/// - OCR bboxes are in the bitmap coordinate system produced by PDFium rendering.
/// - PDFium rendering applies the page's intrinsic /Rotate to the raster output, so the OCR
///   coordinates are in "viewer space" (i.e., the rendered, rotated view).
/// - Therefore, mapping back into PDF user space requires applying the inverse of /Rotate.
///
/// Verified locally (2026-01-22):
/// - `src-tauri/examples/pdfium_rotate_probe.rs` shows `page.width()/height()` and the rendered
///   bitmap dimensions are already swapped for /Rotate 90 (rendered output is visually rotated).
/// - `src-tauri/examples/ocr_bbox_probe.rs --generate` shows OCR bounding boxes use a top-left
///   origin (y increases downward) in the input bitmap coordinate system.
pub fn ocr_pixel_to_pdf_point(
    pixel_x: f32,
    pixel_y: f32,
    render_width: f32,
    render_height: f32,
    geometry: PageGeometry,
) -> (f32, f32) {
    let (u, v) = normalize_pixel_to_unit(pixel_x, pixel_y, render_width, render_height);
    let (u, v) = flip_y_unit(u, v);

    // OCR coordinates are assumed to be in the "viewer space" (i.e., rotation applied by rendering).
    // Convert back into the PDF base coordinate system by applying the inverse of /Rotate.
    let (u, v) = rotate_unit_inverse(u, v, geometry.rotate_cw_degrees);

    (
        geometry.crop_box.x0 + u * geometry.crop_box.width(),
        geometry.crop_box.y0 + v * geometry.crop_box.height(),
    )
}

fn normalize_pixel_to_unit(
    pixel_x: f32,
    pixel_y: f32,
    render_width: f32,
    render_height: f32,
) -> (f32, f32) {
    if render_width <= 0.0 || render_height <= 0.0 {
        return (0.0, 0.0);
    }
    (pixel_x / render_width, pixel_y / render_height)
}

fn flip_y_unit(u: f32, v: f32) -> (f32, f32) {
    (u, 1.0 - v)
}

fn rotate_unit_inverse(u: f32, v: f32, rotate_cw_degrees: u32) -> (f32, f32) {
    match rotate_cw_degrees % 360 {
        0 => (u, v),
        90 => (1.0 - v, u),
        180 => (1.0 - u, 1.0 - v),
        270 => (v, 1.0 - u),
        _ => (u, v),
    }
}

#[cfg(test)]
mod tests {
    use super::{ocr_pixel_to_pdf_point, PageGeometry, PdfBox};

    fn assert_close(a: f32, b: f32) {
        let diff = (a - b).abs();
        assert!(
            diff < 0.01,
            "expected {a} ≈ {b} (diff {diff})"
        );
    }

    #[test]
    fn maps_top_left_pixel_to_top_left_pdf_for_unrotated_page() {
        let geom = PageGeometry {
            crop_box: PdfBox {
                x0: 0.0,
                y0: 0.0,
                x1: 612.0,
                y1: 792.0,
            },
            rotate_cw_degrees: 0,
        };

        // Match the CropBox aspect ratio (612x792 points).
        let (x, y) = ocr_pixel_to_pdf_point(0.0, 0.0, 612.0, 792.0, geom);
        assert_close(x, 0.0);
        assert_close(y, 792.0);
    }

    #[test]
    fn maps_top_left_pixel_to_bottom_left_pdf_for_90cw_page() {
        let geom = PageGeometry {
            crop_box: PdfBox {
                x0: 0.0,
                y0: 0.0,
                x1: 612.0,
                y1: 792.0,
            },
            rotate_cw_degrees: 90,
        };

        // For /Rotate 90, PDFium reports swapped page width/height, and the rendered bitmap is
        // in that rotated viewer space.
        let (x, y) = ocr_pixel_to_pdf_point(0.0, 0.0, 792.0, 612.0, geom);
        assert_close(x, 0.0);
        assert_close(y, 0.0);
    }

    #[test]
    fn maps_corners_consistently_for_90cw_page() {
        let geom = PageGeometry {
            crop_box: PdfBox {
                x0: 10.0,
                y0: 20.0,
                x1: 210.0,
                y1: 420.0,
            },
            rotate_cw_degrees: 90,
        };

        // top-left in rotated view -> bottom-left base
        // Base CropBox is 200x400 points; rotated view is 400x200.
        let (x1, y1) = ocr_pixel_to_pdf_point(0.0, 0.0, 200.0, 100.0, geom);
        assert_close(x1, 10.0);
        assert_close(y1, 20.0);

        // top-right in rotated view -> top-left base
        let (x2, y2) = ocr_pixel_to_pdf_point(200.0, 0.0, 200.0, 100.0, geom);
        assert_close(x2, 10.0);
        assert_close(y2, 420.0);

        // bottom-left in rotated view -> bottom-right base
        let (x3, y3) = ocr_pixel_to_pdf_point(0.0, 100.0, 200.0, 100.0, geom);
        assert_close(x3, 210.0);
        assert_close(y3, 20.0);
    }

    #[test]
    fn maps_center_point_with_crop_offset() {
        let geom = PageGeometry {
            crop_box: PdfBox {
                x0: 100.0,
                y0: 200.0,
                x1: 300.0,
                y1: 600.0,
            },
            rotate_cw_degrees: 0,
        };

        let (x, y) = ocr_pixel_to_pdf_point(50.0, 50.0, 100.0, 100.0, geom);
        assert_close(x, 200.0);
        assert_close(y, 400.0);
    }
}
