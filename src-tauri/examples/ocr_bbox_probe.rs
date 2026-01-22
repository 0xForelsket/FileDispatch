use std::path::PathBuf;
use std::time::Duration;

use anyhow::{anyhow, Result};
use image::{Rgb, RgbImage};
use imageproc::drawing::draw_text_mut;
use oar_ocr::prelude::*;

fn main() -> Result<()> {
    let arg1 = std::env::args().nth(1);
    let image_path = match arg1.as_deref() {
        Some("--generate") => generate_test_image()?,
        Some(p) => PathBuf::from(p),
        None => {
            return Err(anyhow!(
                "Usage: cargo run -p file-dispatch --example ocr_bbox_probe -- (--generate | <image_path>)"
            ));
        }
    };

    let base = PathBuf::from("src-tauri/resources/ocr");
    let det = base.join("pp-ocrv5_mobile_det.onnx");
    let rec = base.join("en_pp-ocrv5_mobile_rec.onnx");
    let dict = base.join("ppocrv5_en_dict.txt");

    let ocr = OAROCRBuilder::new(det, rec, dict)
        .return_word_box(true)
        .build()?;

    let image = load_image(&image_path)?;
    let results = ocr.predict(vec![image.clone()])?;

    let result = results
        .get(0)
        .ok_or_else(|| anyhow!("OCR produced no results"))?;

    println!(
        "Image: {} ({}x{})",
        image_path.display(),
        image.width(),
        image.height()
    );
    println!("Text regions: {}", result.text_regions.len());

    for (i, region) in result.text_regions.iter().take(5).enumerate() {
        let text = region.text.as_deref().unwrap_or("<none>");
        let conf = region.confidence.unwrap_or(0.0);
        let bb = &region.bounding_box;
        println!(
            "[{i}] conf={conf:.3} bbox=[x:{:.1}..{:.1} y:{:.1}..{:.1}] text={:?}",
            bb.x_min(),
            bb.x_max(),
            bb.y_min(),
            bb.y_max(),
            text
        );

        if let Some(word_boxes) = region.word_boxes.as_ref() {
            for (j, wb) in word_boxes.iter().take(5).enumerate() {
                println!(
                    "  - wb[{j}] [x:{:.1}..{:.1} y:{:.1}..{:.1}]",
                    wb.x_min(),
                    wb.x_max(),
                    wb.y_min(),
                    wb.y_max()
                );
            }
        }
    }

    // Keep process alive briefly when run via some IDEs, so stdout flushes consistently.
    std::thread::sleep(Duration::from_millis(10));
    Ok(())
}

fn generate_test_image() -> Result<PathBuf> {
    let mut img = RgbImage::from_pixel(900, 600, Rgb([255, 255, 255]));
    let font = load_system_font()?;

    draw_text_mut(
        &mut img,
        Rgb([0, 0, 0]),
        40,
        40,
        ab_glyph::PxScale::from(90.0),
        &font,
        "TOP",
    );
    draw_text_mut(
        &mut img,
        Rgb([0, 0, 0]),
        40,
        380,
        ab_glyph::PxScale::from(90.0),
        &font,
        "BOTTOM",
    );

    let out = std::env::temp_dir().join("filedispatch_ocr_bbox_probe.png");
    img.save(&out)?;
    Ok(out)
}

fn load_system_font() -> Result<ab_glyph::FontArc> {
    let candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ];

    for path in candidates {
        let bytes = std::fs::read(path);
        if let Ok(bytes) = bytes {
            if let Ok(font) = ab_glyph::FontArc::try_from_vec(bytes) {
                return Ok(font);
            }
        }
    }

    Err(anyhow!("No usable system TTF font found in common locations"))
}
