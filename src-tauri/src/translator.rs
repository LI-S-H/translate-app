use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranslationResult {
    pub translated_text: String,
    pub detected_language: String,
    pub detected_language_score: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub source_lang: String,
    pub target_lang: String,
    pub always_on_top: bool,
    pub theme: String,
    pub shortcut: String,
    pub window_width: f64,
    pub window_height: f64,
    pub auto_start: bool,
    pub mock_mode: bool,
    pub api_key: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            source_lang: "auto".into(),
            target_lang: "en".into(),
            always_on_top: true,
            theme: "light".into(),
            shortcut: "Ctrl+Shift+T".into(),
            window_width: 620.0,
            window_height: 380.0,
            auto_start: false,
            mock_mode: true,
            api_key: String::new(),
        }
    }
}

/// Detect if text contains Chinese characters (simple heuristic)
fn contains_chinese(text: &str) -> bool {
    text.chars().any(|c| {
        ('\u{4E00}'..='\u{9FFF}').contains(&c)
            || ('\u{3400}'..='\u{4DBF}').contains(&c)
            || ('\u{F900}'..='\u{FAFF}').contains(&c)
    })
}

/// Detect if text contains Japanese-specific characters (Hiragana, Katakana)
fn contains_japanese(text: &str) -> bool {
    text.chars()
        .any(|c| ('\u{3040}'..='\u{309F}').contains(&c) || ('\u{30A0}'..='\u{30FF}').contains(&c))
}

/// Detect if text contains Korean characters
fn contains_korean(text: &str) -> bool {
    text.chars()
        .any(|c| ('\u{AC00}'..='\u{D7AF}').contains(&c) || ('\u{1100}'..='\u{11FF}').contains(&c))
}

/// Simple language detection based on character sets
fn detect_language(text: &str) -> (&str, f64) {
    if text.trim().is_empty() {
        return ("en", 1.0);
    }

    // Check if text has any CJK characters vs ASCII letters count
    let ascii_letters = text.chars().filter(|c| c.is_ascii_alphabetic()).count();
    let cjk_chars = text
        .chars()
        .filter(|c| {
            ('\u{4E00}'..='\u{9FFF}').contains(c)
                || ('\u{3400}'..='\u{4DBF}').contains(c)
                || ('\u{3040}'..='\u{30FF}').contains(c)
                || ('\u{AC00}'..='\u{D7AF}').contains(c)
        })
        .count();

    if cjk_chars > 0 && cjk_chars >= ascii_letters {
        if contains_japanese(text) && !contains_chinese(text) {
            return ("ja", 0.9);
        }
        if contains_korean(text) && !contains_chinese(text) && !contains_japanese(text) {
            return ("ko", 0.9);
        }
        return ("zh-Hans", 0.9);
    }

    ("en", 0.9)
}

/// Mock translation lookup table (zh ↔ en common phrases)
fn mock_lookup(text: &str, from: &str, to: &str) -> Option<String> {
    let pairs: &[(&str, &str, &str)] = &[
        ("你好", "zh-Hans", "Hello"),
        ("谢谢", "zh-Hans", "Thank you"),
        ("再见", "zh-Hans", "Goodbye"),
        ("早上好", "zh-Hans", "Good morning"),
        ("晚安", "zh-Hans", "Good night"),
        ("对不起", "zh-Hans", "Sorry"),
        ("没关系", "zh-Hans", "No problem"),
        ("欢迎", "zh-Hans", "Welcome"),
        ("Hello", "en", "你好"),
        ("Thank you", "en", "谢谢"),
        ("Goodbye", "en", "再见"),
        ("Good morning", "en", "早上好"),
        ("Good night", "en", "晚安"),
        ("Sorry", "en", "对不起"),
        ("Welcome", "en", "欢迎"),
    ];

    let normalized_from = if from == "auto" || from.is_empty() {
        "auto"
    } else {
        from
    };

    for (src_text, src_lang, tgt_text) in pairs {
        if text.eq_ignore_ascii_case(src_text) {
            if normalized_from == "auto" || src_lang == &from {
                if to == "en" && tgt_text == &"Hello"
                    || to == "zh-Hans" && tgt_text == &"你好"
                    || to == *src_lang
                {
                    continue;
                }
                // For auto mode, check if the pair direction matches
                if normalized_from == "auto" {
                    // If input matches the src, return the translation
                    return Some(tgt_text.to_string());
                } else if *src_lang == from {
                    if *tgt_text == "你好" && to == "zh-Hans" {
                        return Some(tgt_text.to_string());
                    }
                    if *tgt_text != "你好" && to == "en" {
                        return Some(tgt_text.to_string());
                    }
                    if *tgt_text == "你好" && to == "en" {
                        continue;
                    }
                    return Some(tgt_text.to_string());
                }
            }
        }
    }
    None
}

/// Mock translation using lookup table + directional pattern
fn mock_translate(text: &str, from: &str, to: &str) -> TranslationResult {
    let detected = detect_language(text);
    let source_lang = if from == "auto" || from.is_empty() {
        detected.0.to_string()
    } else {
        from.to_string()
    };

    // Try lookup first
    if let Some(result) = mock_lookup(text, &source_lang, to) {
        return TranslationResult {
            translated_text: result,
            detected_language: source_lang,
            detected_language_score: detected.1,
        };
    }

    // Pattern-based fallback
    let target = if to == "auto" || to.is_empty() {
        if source_lang == "zh-Hans" {
            "en"
        } else {
            "zh-Hans"
        }
    } else {
        to
    };

    let translated = format!("[{}→{}] {}", source_lang, target, text);

    TranslationResult {
        translated_text: translated,
        detected_language: source_lang,
        detected_language_score: detected.1,
    }
}

/// Real Microsoft Translator API call
async fn ms_translate(text: &str, from: &str, to: &str, api_key: &str) -> Result<TranslationResult, String> {
    let client = reqwest::Client::new();

    let mut url = "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0".to_string();
    url.push_str(&format!("&to={}", to));
    if !from.is_empty() && from != "auto" {
        url.push_str(&format!("&from={}", from));
    }

    let body = vec![serde_json::json!({"Text": text})];

    let resp = client
        .post(&url)
        .header("Ocp-Apim-Subscription-Key", api_key)
        .header("Content-Type", "application/json; charset=UTF-8")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let err_body = resp.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", status.as_u16(), err_body));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    let first = &json[0];
    let detected = first["detectedLanguage"]["language"]
        .as_str()
        .unwrap_or("unknown")
        .to_string();
    let score = first["detectedLanguage"]["score"]
        .as_f64()
        .unwrap_or(1.0);
    let translated = first["translations"][0]["text"]
        .as_str()
        .unwrap_or("")
        .to_string();

    Ok(TranslationResult {
        translated_text: translated,
        detected_language: detected,
        detected_language_score: score,
    })
}

/// Main translate function: mock or real API
pub async fn translate(text: String, from: String, mut to: String, mock_mode: bool, api_key: String) -> Result<TranslationResult, String> {
    if text.trim().is_empty() {
        return Ok(TranslationResult {
            translated_text: String::new(),
            detected_language: String::new(),
            detected_language_score: 0.0,
        });
    }

    // If target is auto/empty, determine default target based on detected source
    if to == "auto" || to.is_empty() {
        let detected = detect_language(&text);
        to = default_target_lang(detected.0).to_string();
    }

    if mock_mode || api_key.is_empty() {
        Ok(mock_translate(&text, &from, &to))
    } else {
        ms_translate(&text, &from, &to, &api_key).await
    }
}

/// Determine default target language based on detected source
pub fn default_target_lang(source_lang: &str) -> &str {
    if source_lang == "zh-Hans" || source_lang == "zh" {
        "en"
    } else {
        "zh-Hans"
    }
}
