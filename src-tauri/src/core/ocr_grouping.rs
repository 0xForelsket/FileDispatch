use crate::core::ocr_geometry::{Rect, TextLine, WordBox};

pub fn group_words_into_lines(mut words: Vec<WordBox>) -> Vec<TextLine> {
    if words.is_empty() {
        return Vec::new();
    }

    words.sort_by(|a, b| {
        let ay = a.bbox.y + a.bbox.height / 2.0;
        let by = b.bbox.y + b.bbox.height / 2.0;
        ay.partial_cmp(&by)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                a.bbox
                    .x
                    .partial_cmp(&b.bbox.x)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
    });

    let y_tolerance = compute_y_tolerance(&words);

    #[derive(Clone)]
    struct LineAcc {
        y_center: f32,
        words: Vec<WordBox>,
    }

    let mut lines: Vec<LineAcc> = Vec::new();

    for word in words {
        let word_center_y = word.bbox.y + word.bbox.height / 2.0;

        let mut best_idx: Option<usize> = None;
        let mut best_dist = f32::INFINITY;

        for (idx, line) in lines.iter().enumerate() {
            let dist = (line.y_center - word_center_y).abs();
            if dist <= y_tolerance && dist < best_dist {
                best_dist = dist;
                best_idx = Some(idx);
            }
        }

        match best_idx {
            Some(idx) => {
                let line = &mut lines[idx];
                let new_count = (line.words.len() + 1) as f32;
                line.y_center = (line.y_center * (new_count - 1.0) + word_center_y) / new_count;
                line.words.push(word);
            }
            None => lines.push(LineAcc {
                y_center: word_center_y,
                words: vec![word],
            }),
        }
    }

    lines.sort_by(|a, b| {
        a.y_center
            .partial_cmp(&b.y_center)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    lines.into_iter()
        .map(|mut line| {
            line.words.sort_by(|a, b| {
                a.bbox
                    .x
                    .partial_cmp(&b.bbox.x)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
            let bbox = union_rects(line.words.iter().map(|w| w.bbox));
            let text = join_words(&line.words);
            TextLine {
                text,
                bbox,
                words: line.words,
            }
        })
        .collect()
}

fn compute_y_tolerance(words: &[WordBox]) -> f32 {
    let mut heights: Vec<f32> = words.iter().map(|w| w.bbox.height).collect();
    heights.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median = heights[heights.len() / 2].max(1.0);
    (median * 0.6).max(6.0)
}

fn union_rects(rects: impl Iterator<Item = Rect>) -> Rect {
    let mut min_x = f32::INFINITY;
    let mut min_y = f32::INFINITY;
    let mut max_x = f32::NEG_INFINITY;
    let mut max_y = f32::NEG_INFINITY;

    for r in rects {
        min_x = min_x.min(r.x);
        min_y = min_y.min(r.y);
        max_x = max_x.max(r.x + r.width);
        max_y = max_y.max(r.y + r.height);
    }

    if !min_x.is_finite() || !min_y.is_finite() || !max_x.is_finite() || !max_y.is_finite() {
        return Rect {
            x: 0.0,
            y: 0.0,
            width: 0.0,
            height: 0.0,
        };
    }

    Rect {
        x: min_x,
        y: min_y,
        width: (max_x - min_x).max(0.0),
        height: (max_y - min_y).max(0.0),
    }
}

fn join_words(words: &[WordBox]) -> String {
    let mut out = String::new();
    for (idx, word) in words.iter().enumerate() {
        if idx > 0 && should_insert_space(words[idx - 1].text.as_str(), word.text.as_str()) {
            out.push(' ');
        }
        out.push_str(&word.text);
    }
    out
}

fn should_insert_space(prev: &str, next: &str) -> bool {
    // CJK text is typically not space-delimited.
    if contains_cjk(prev) || contains_cjk(next) {
        return false;
    }
    true
}

fn contains_cjk(s: &str) -> bool {
    s.chars().any(is_cjk)
}

fn is_cjk(ch: char) -> bool {
    matches!(ch as u32,
        0x4E00..=0x9FFF  // CJK Unified Ideographs
        | 0x3400..=0x4DBF // CJK Unified Ideographs Extension A
        | 0x20000..=0x2A6DF // Extension B
        | 0x2A700..=0x2B73F // Extension C
        | 0x2B740..=0x2B81F // Extension D
        | 0x2B820..=0x2CEAF // Extension E/F
        | 0xF900..=0xFAFF // CJK Compatibility Ideographs
    )
}

#[cfg(test)]
mod tests {
    use super::group_words_into_lines;
    use crate::core::ocr_geometry::{Rect, WordBox};

    #[test]
    fn groups_words_into_two_lines() {
        let words = vec![
            WordBox {
                text: "Hello".to_string(),
                confidence: 0.9,
                bbox: Rect {
                    x: 10.0,
                    y: 10.0,
                    width: 50.0,
                    height: 12.0,
                },
            },
            WordBox {
                text: "world".to_string(),
                confidence: 0.9,
                bbox: Rect {
                    x: 70.0,
                    y: 11.0,
                    width: 50.0,
                    height: 12.0,
                },
            },
            WordBox {
                text: "Second".to_string(),
                confidence: 0.9,
                bbox: Rect {
                    x: 10.0,
                    y: 40.0,
                    width: 60.0,
                    height: 12.0,
                },
            },
            WordBox {
                text: "line".to_string(),
                confidence: 0.9,
                bbox: Rect {
                    x: 80.0,
                    y: 39.0,
                    width: 30.0,
                    height: 12.0,
                },
            },
        ];

        let lines = group_words_into_lines(words);
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].text, "Hello world");
        assert_eq!(lines[1].text, "Second line");
        assert_eq!(lines[0].words.len(), 2);
        assert_eq!(lines[1].words.len(), 2);
    }
}

