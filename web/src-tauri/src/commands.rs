use crate::config::{AppConfig, SharedConfig};
use tauri::State;

#[tauri::command]
pub fn get_app_config(state: State<'_, SharedConfig>) -> AppConfig {
    state.lock().unwrap().clone()
}

#[tauri::command]
pub fn update_app_config(
    state: State<'_, SharedConfig>,
    cache_dir: Option<String>,
    gateway_url: Option<String>,
) -> Result<AppConfig, String> {
    let mut cfg = state.lock().unwrap();
    if let Some(c) = cache_dir {
        cfg.cache_dir = crate::config::strip_unc_prefix(&c.trim());
    }
    if let Some(g) = gateway_url {
        cfg.gateway_url = g.trim().to_string();
    }
    crate::config::save_config(&cfg)?;
    Ok(cfg.clone())
}

#[tauri::command]
pub async fn pick_cache_folder(_app: tauri::AppHandle) -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(|| {
        let folder = rfd::FileDialog::new()
            .set_title("Выберите папку с аудио-файлами (кэш)")
            .pick_folder();
        folder.map(|p| crate::config::strip_unc_prefix(&p.to_string_lossy()))
    })
    .await
    .map_err(|e| e.to_string())
}
