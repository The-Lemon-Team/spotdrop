mod commands;
mod config;
mod server;

use config::{load_config, SharedConfig};
use std::sync::{Arc, Mutex};
use tauri::tray::TrayIconBuilder;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = load_config();
    let port = config.port;
    let shared_config: SharedConfig = Arc::new(Mutex::new(config));

    // Spawn embedded Axum HTTP server in background
    let srv_config = shared_config.clone();
    tauri::async_runtime::spawn(async move {
        let app = server::create_router(srv_config);
        let addr = format!("127.0.0.1:{}", port);
        match tokio::net::TcpListener::bind(&addr).await {
            Ok(listener) => {
                println!("[SpotDrop Server] Listening on http://{}", addr);
                if let Err(e) = axum::serve(listener, app).await {
                    eprintln!("[SpotDrop Server] Server error: {}", e);
                }
            }
            Err(e) => {
                eprintln!("[SpotDrop Server] Failed to bind to {}: {}", addr, e);
            }
        }
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(shared_config)
        .invoke_handler(tauri::generate_handler![
            commands::get_app_config,
            commands::update_app_config,
            commands::pick_cache_folder
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
