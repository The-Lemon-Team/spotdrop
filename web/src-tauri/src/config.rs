use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub cache_dir: String,
    pub defaults_dir: String,
    pub gateway_url: String,
    pub port: u16,
}

impl Default for AppConfig {
    fn default() -> Self {
        let defaults_dir = resolve_defaults_dir();
        let cache_dir = resolve_default_cache_dir(&defaults_dir);
        Self {
            cache_dir,
            defaults_dir,
            gateway_url: "http://127.0.0.1:3055".to_string(),
            port: 3003,
        }
    }
}

pub type SharedConfig = Arc<Mutex<AppConfig>>;

pub fn strip_unc_prefix(path: &str) -> String {
    if let Some(stripped) = path.strip_prefix(r"\\?\") {
        stripped.to_string()
    } else {
        path.to_string()
    }
}

pub fn resolve_defaults_dir() -> String {
    // 1. Walk up from current executable directory
    if let Ok(exe_path) = std::env::current_exe() {
        let mut curr = exe_path.parent();
        while let Some(parent) = curr {
            let candidate = parent.join("defaults");
            if candidate.exists() && candidate.is_dir() {
                if let Ok(canonical) = fs::canonicalize(&candidate) {
                    return strip_unc_prefix(&canonical.to_string_lossy());
                }
                return strip_unc_prefix(&candidate.to_string_lossy());
            }
            curr = parent.parent();
        }
    }

    // 2. Check candidates relative to working directory or repo root
    let candidates = [
        "../../../../defaults",
        "../../../defaults",
        "../../defaults",
        "../defaults",
        "./defaults",
        "defaults",
        r"C:\Users\Ilege\projects\spotdrop\defaults",
    ];

    for candidate in candidates {
        let p = Path::new(candidate);
        if p.exists() && p.is_dir() {
            if let Ok(canonical) = fs::canonicalize(p) {
                return strip_unc_prefix(&canonical.to_string_lossy());
            }
            return strip_unc_prefix(candidate);
        }
    }

    r"C:\Users\Ilege\projects\spotdrop\defaults".to_string()
}

pub fn resolve_default_cache_dir(defaults_dir: &str) -> String {
    let audio_path = Path::new(defaults_dir).join("default").join("audio");
    if audio_path.exists() && audio_path.is_dir() {
        if let Ok(canonical) = fs::canonicalize(&audio_path) {
            return strip_unc_prefix(&canonical.to_string_lossy());
        }
        return strip_unc_prefix(&audio_path.to_string_lossy());
    }

    let direct_known = Path::new(r"C:\Users\Ilege\projects\spotdrop\defaults\default\audio");
    if direct_known.exists() && direct_known.is_dir() {
        return direct_known.to_string_lossy().to_string();
    }

    strip_unc_prefix(&audio_path.to_string_lossy())
}

pub fn get_config_file_path() -> Option<PathBuf> {
    dirs::config_dir().map(|p| p.join("spotdrop").join("config.json"))
}

pub fn load_config() -> AppConfig {
    let default = AppConfig::default();
    if let Some(path) = get_config_file_path() {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(mut loaded) = serde_json::from_str::<AppConfig>(&content) {
                    // Check if loaded cache_dir is broken (e.g. relative "../defaults" or non-existent)
                    let cache_path = Path::new(&loaded.cache_dir);
                    if loaded.cache_dir.is_empty()
                        || loaded.cache_dir.starts_with("..")
                        || !cache_path.exists()
                    {
                        loaded.cache_dir = default.cache_dir.clone();
                    }

                    let def_path = Path::new(&loaded.defaults_dir);
                    if loaded.defaults_dir.is_empty()
                        || loaded.defaults_dir.starts_with("..")
                        || !def_path.exists()
                    {
                        loaded.defaults_dir = default.defaults_dir.clone();
                    }

                    if loaded.gateway_url.is_empty() {
                        loaded.gateway_url = default.gateway_url;
                    }
                    if loaded.port == 0 {
                        loaded.port = default.port;
                    }
                    return loaded;
                }
            }
        }
    }
    default
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
    if let Some(path) = get_config_file_path() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        fs::write(&path, content).map_err(|e| e.to_string())?;
    }
    Ok(())
}
