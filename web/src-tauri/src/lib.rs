mod commands;
mod config;
mod server;

use config::{load_config, SharedConfig};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

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

    let is_quitting = Arc::new(AtomicBool::new(false));
    let is_quitting_for_window = is_quitting.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(shared_config)
        .invoke_handler(tauri::generate_handler![
            commands::get_app_config,
            commands::update_app_config,
            commands::pick_cache_folder
        ])
        .on_window_event(move |window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if !is_quitting_for_window.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Create Tray Menu
            let show_item = MenuItem::with_id(app, "show", "Открыть SpotDrop", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &separator, &quit_item])?;

            let is_quitting_for_tray = is_quitting.clone();

            let mut tray_builder = TrayIconBuilder::with_id("main-tray")
                .tooltip("SpotDrop")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app_handle, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            is_quitting_for_tray.store(true, Ordering::SeqCst);
                            app_handle.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        }
                        | TrayIconEvent::DoubleClick {
                            button: MouseButton::Left,
                            ..
                        } => {
                            let app_handle = tray.app_handle();
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                });

            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }

            tray_builder.build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
