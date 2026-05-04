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
    pub baidu_app_id: String,
    pub baidu_key: String,
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
            mock_mode: false,
            baidu_app_id: String::new(),
            baidu_key: String::new(),
        }
    }
}

// ========== Language code mapping: our code → Baidu code ==========

fn to_baidu_lang(code: &str) -> &str {
    match code {
        "auto" => "auto",
        "zh-Hans" | "zh" => "zh",
        "en" => "en",
        "ja" => "jp",
        "ko" => "kor",
        "fr" => "fra",
        "de" => "de",
        "es" => "spa",
        "ru" => "ru",
        "pt" => "pt",
        "it" => "it",
        "ar" => "ara",
        "th" => "th",
        "vi" => "vie",
        _ => code,
    }
}

fn from_baidu_lang(code: &str) -> &str {
    match code {
        "zh" => "zh-Hans",
        "en" => "en",
        "jp" => "ja",
        "kor" => "ko",
        "fra" => "fr",
        "de" => "de",
        "spa" => "es",
        "ru" => "ru",
        "pt" => "pt",
        "it" => "it",
        "ara" => "ar",
        "th" => "th",
        "vie" => "vi",
        _ => code,
    }
}

// ========== Character-set language detection ==========

fn contains_japanese(text: &str) -> bool {
    text.chars()
        .any(|c| ('\u{3040}'..='\u{309F}').contains(&c) || ('\u{30A0}'..='\u{30FF}').contains(&c))
}

fn contains_korean(text: &str) -> bool {
    text.chars()
        .any(|c| ('\u{AC00}'..='\u{D7AF}').contains(&c) || ('\u{1100}'..='\u{11FF}').contains(&c))
}

fn detect_language(text: &str) -> (&str, f64) {
    if text.trim().is_empty() {
        return ("en", 1.0);
    }
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
        // Check Japanese first — Japanese text often contains Kanji (shared with Chinese),
        // but Hiragana/Katakana confirms it's Japanese
        if contains_japanese(text) {
            return ("ja", 0.9);
        }
        if contains_korean(text) {
            return ("ko", 0.9);
        }
        return ("zh-Hans", 0.9);
    }
    ("en", 0.9)
}

/// Determine default target language
pub fn default_target_lang(source_lang: &str) -> &str {
    if source_lang == "zh-Hans" || source_lang == "zh" {
        "en"
    } else {
        "zh-Hans"
    }
}

// ========== Mock translation ==========

fn mock_translate(text: &str, from: &str, to: &str) -> TranslationResult {
    let detected = detect_language(text);
    let source_lang = if from == "auto" || from.is_empty() {
        detected.0.to_string()
    } else {
        from.to_string()
    };
    let target = if to == "auto" || to.is_empty() {
        default_target_lang(&source_lang).to_string()
    } else {
        to.to_string()
    };

    // Simple lookup table
    let pairs: &[(&str, &str)] = &[
        ("你好", "Hello"),
        ("谢谢", "Thank you"),
        ("再见", "Goodbye"),
        ("早上好", "Good morning"),
        ("晚安", "Good night"),
        ("对不起", "Sorry"),
        ("没关系", "No problem"),
        ("欢迎", "Welcome"),
        ("Hello", "你好"),
        ("Thank you", "谢谢"),
        ("Goodbye", "再见"),
        ("Good morning", "早上好"),
        ("Good night", "晚安"),
        ("Sorry", "对不起"),
        ("Welcome", "欢迎"),
    ];

    for (src, tgt) in pairs {
        if text.eq_ignore_ascii_case(src) {
            if (source_lang.starts_with("zh") && target == "en")
                || (source_lang == "en" && target.starts_with("zh"))
            {
                return TranslationResult {
                    translated_text: tgt.to_string(),
                    detected_language: source_lang,
                    detected_language_score: detected.1,
                };
            }
        }
    }

    TranslationResult {
        translated_text: format!("[{} → {}] {}", source_lang, target, text),
        detected_language: source_lang,
        detected_language_score: detected.1,
    }
}

// ========== Baidu Translate API ==========

fn md5_hex(input: &str) -> String {
    use std::fmt::Write;
    let digest = md5::compute(input.as_bytes());
    let mut s = String::with_capacity(32);
    for byte in digest.0 {
        write!(&mut s, "{:02x}", byte).unwrap();
    }
    s
}

async fn baidu_translate(
    text: &str,
    from: &str,
    to: &str,
    app_id: &str,
    key: &str,
) -> Result<TranslationResult, String> {
    let client = reqwest::Client::new();
    let baidu_from = to_baidu_lang(from);
    let baidu_to = to_baidu_lang(to);
    let salt = rand::random::<u32>().to_string();

    // Sign = MD5(appid + q + salt + key)
    let sign_input = format!("{}{}{}{}", app_id, text, salt, key);
    let sign = md5_hex(&sign_input);

    let resp = client
        .post("https://fanyi-api.baidu.com/api/trans/vip/translate")
        .form(&[
            ("q", text),
            ("from", baidu_from),
            ("to", baidu_to),
            ("appid", app_id),
            ("salt", &salt),
            ("sign", &sign),
        ])
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let body = resp.text().await.map_err(|e| format!("Read error: {}", e))?;

    let json: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| format!("Parse error: {} — body: {}", e, body))?;

    // Check for Baidu API error
    if let Some(err_code) = json.get("error_code") {
        let err_msg = json.get("error_msg").and_then(|v| v.as_str()).unwrap_or("unknown");
        return Err(format!("Baidu API error {}: {}", err_code, err_msg));
    }

    let from_lang = json["from"]
        .as_str()
        .unwrap_or("unknown");
    let detected = from_baidu_lang(from_lang).to_string();
    let translated = json["trans_result"][0]["dst"]
        .as_str()
        .unwrap_or("")
        .to_string();

    Ok(TranslationResult {
        translated_text: translated,
        detected_language: detected,
        detected_language_score: 1.0,
    })
}

// ========== Main translate entry ==========

pub async fn translate(
    text: String,
    from: String,
    mut to: String,
    mock_mode: bool,
    baidu_app_id: String,
    baidu_key: String,
) -> Result<TranslationResult, String> {
    if text.trim().is_empty() {
        return Ok(TranslationResult {
            translated_text: String::new(),
            detected_language: String::new(),
            detected_language_score: 0.0,
        });
    }

    // Determine target language if auto
    if to == "auto" || to.is_empty() {
        let detected = detect_language(&text);
        to = default_target_lang(detected.0).to_string();
    }

    let can_use_baidu = !baidu_app_id.is_empty() && !baidu_key.is_empty();

    if mock_mode || !can_use_baidu {
        Ok(mock_translate(&text, &from, &to))
    } else {
        baidu_translate(&text, &from, &to, &baidu_app_id, &baidu_key).await
    }
}
