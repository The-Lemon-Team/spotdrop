use crate::config::SharedConfig;
use axum::{
    body::Body,
    extract::{Path as AxumPath, Query, State},
    http::{header, Request, Response, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use futures_util::TryStreamExt;
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};
use tower::ServiceExt;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::fs::ServeFile;

// Compile-time embedded pre-bundled Bandita Library files
static EMBEDDED_YOUR_LIBRARY: &str = include_str!("../../../defaults/default/YourLibrary.json");
static EMBEDDED_PLAYLIST1: &str = include_str!("../../../defaults/default/Playlist1.json");
static EMBEDDED_PROFILE: &str = include_str!("../../../defaults/default/profile.json");

#[derive(Deserialize)]
pub struct StreamQuery {
    #[serde(rename = "videoId")]
    pub video_id: Option<String>,
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
    pub limit: Option<u32>,
}

pub fn create_router(config: SharedConfig) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/api/stream", get(handle_stream))
        .route("/api/search", get(handle_search))
        .route("/api/profiles", get(handle_profiles_list))
        .route("/api/profiles/{id}", get(handle_profile_detail))
        .route("/api/profiles/{id}/library", get(handle_profile_library))
        .route(
            "/api/profiles/{id}/playlists",
            get(handle_profile_playlists).post(handle_save_playlists),
        )
        .route("/api/offline-status", get(handle_offline_status))
        .route(
            "/api/config",
            get(handle_get_config).post(handle_update_config),
        )
        .route("/api/auth/verify", get(handle_auth_verify))
        .layer(cors)
        .with_state(config)
}

fn find_cached_audio_file(base_dir: &str, video_id: &str) -> Option<PathBuf> {
    let clean_dir = crate::config::strip_unc_prefix(base_dir);
    let extensions = ["webm", "mp3", "m4a", "ogg", "opus"];
    for ext in extensions {
        let file_path = Path::new(&clean_dir).join(format!("{}.{}", video_id, ext));
        if file_path.exists() && file_path.is_file() {
            return Some(file_path);
        }
    }
    None
}

async fn handle_stream(
    State(config): State<SharedConfig>,
    Query(query): Query<StreamQuery>,
    req: Request<Body>,
) -> Response<Body> {
    let video_id = match query.video_id {
        Some(ref id) if !id.trim().is_empty() => id.trim(),
        _ => {
            return Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .body(Body::from(r#"{"error":"Missing videoId parameter"}"#))
                .unwrap();
        }
    };

    let (cache_dir, defaults_dir, gateway_url) = {
        let cfg = config.lock().unwrap();
        (cfg.cache_dir.clone(), cfg.defaults_dir.clone(), cfg.gateway_url.clone())
    };

    // 1. Check user-configured cache_dir
    let mut local_file = find_cached_audio_file(&cache_dir, video_id);

    // 2. Fallback to defaults_dir/default/audio
    if local_file.is_none() {
        let fallback_audio_dir = Path::new(&defaults_dir).join("default").join("audio");
        local_file = find_cached_audio_file(&fallback_audio_dir.to_string_lossy(), video_id);
    }

    // 3. If local file exists, serve it with native Range request support
    if let Some(file_path) = local_file {
        let serve = ServeFile::new(file_path);
        match serve.oneshot(req).await {
            Ok(mut resp) => {
                resp.headers_mut().insert(
                    header::ACCESS_CONTROL_ALLOW_ORIGIN,
                    axum::http::HeaderValue::from_static("*"),
                );
                resp.headers_mut().insert(
                    header::ACCEPT_RANGES,
                    axum::http::HeaderValue::from_static("bytes"),
                );
                return resp.map(Body::new);
            }
            Err(_) => {
                return Response::builder()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .body(Body::from("Failed to serve local file"))
                    .unwrap();
            }
        }
    }

    // 4. Fallback to bandita-gateway in Docker
    let target_url = format!("{}/api/v1/youtube/stream/{}?type=audio", gateway_url.trim_end_matches('/'), video_id);
    let client = reqwest::Client::new();
    let mut builder = client.get(&target_url);

    // Forward Range header if present
    if let Some(range_val) = req.headers().get(header::RANGE) {
        builder = builder.header(header::RANGE, range_val.clone());
    }

    match builder.send().await {
        Ok(proxy_resp) => {
            let status = StatusCode::from_u16(proxy_resp.status().as_u16())
                .unwrap_or(StatusCode::OK);

            let mut resp_builder = Response::builder().status(status);

            // Forward relevant audio headers
            for (name, value) in proxy_resp.headers() {
                let name_str = name.as_str().to_lowercase();
                if name_str == "content-type"
                    || name_str == "content-range"
                    || name_str == "content-length"
                    || name_str == "accept-ranges"
                {
                    resp_builder = resp_builder.header(name, value);
                }
            }

            resp_builder = resp_builder.header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*");

            let stream = proxy_resp.bytes_stream().map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e));
            resp_builder.body(Body::from_stream(stream)).unwrap()
        }
        Err(err) => Response::builder()
            .status(StatusCode::BAD_GATEWAY)
            .body(Body::from(format!(
                r#"{{"error":"Failed to connect to gateway at {}","details":"{}"}}"#,
                target_url, err
            )))
            .unwrap(),
    }
}

async fn handle_search(
    State(config): State<SharedConfig>,
    Query(query): Query<SearchQuery>,
) -> Response<Body> {
    let q = match query.q {
        Some(ref s) if !s.trim().is_empty() => s.trim(),
        _ => {
            return Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .body(Body::from(r#"{"error":"Query parameter 'q' is required"}"#))
                .unwrap();
        }
    };

    let limit = query.limit.unwrap_or(10);
    let gateway_url = {
        let cfg = config.lock().unwrap();
        cfg.gateway_url.clone()
    };

    let target_url = format!(
        "{}/api/v1/youtube/search?q={}&type=video&limit={}",
        gateway_url.trim_end_matches('/'),
        urlencoding_encode(q),
        limit
    );

    let client = reqwest::Client::new();
    match client.get(&target_url).send().await {
        Ok(resp) => {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                // Adapt bandita-gateway { results: [...] } to spotdrop { candidates: [...] }
                let candidates = json.get("results").cloned().unwrap_or(serde_json::json!([]));
                let output = serde_json::json!({
                    "candidates": candidates
                });
                return Response::builder()
                    .header(header::CONTENT_TYPE, "application/json")
                    .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                    .body(Body::from(output.to_string()))
                    .unwrap();
            }
            Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .body(Body::from(r#"{"error":"Invalid response from gateway"}"#))
                .unwrap()
        }
        Err(err) => Response::builder()
            .status(StatusCode::BAD_GATEWAY)
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Body::from(format!(
                r#"{{"error":"Gateway offline ({})","candidates":[]}}"#,
                err
            )))
            .unwrap(),
    }
}

fn urlencoding_encode(s: &str) -> String {
    url::form_urlencoded::byte_serialize(s.as_bytes()).collect()
}

async fn handle_profiles_list(State(_config): State<SharedConfig>) -> impl IntoResponse {
    let list = serde_json::json!({
        "profiles": [
            {
                "id": "bandita",
                "name": "Bandita Library",
                "avatarEmoji": "🎧",
                "description": "Коллекция с 1,600+ треками и локальным аудио-кэшем",
                "isMaster": true,
                "cacheAudio": true,
                "url": "/p/bandita"
            }
        ]
    });
    Json(list)
}

async fn handle_profile_detail(
    State(config): State<SharedConfig>,
    AxumPath(id): AxumPath<String>,
) -> impl IntoResponse {
    let is_master = id == "bandita" || id == "default" || id == "profile_default";
    let defaults_dir = {
        let cfg = config.lock().unwrap();
        cfg.defaults_dir.clone()
    };

    let p_path = Path::new(&defaults_dir).join("default").join("profile.json");
    if is_master {
        if p_path.exists() {
            if let Ok(content) = fs::read_to_string(&p_path) {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                    return Json(parsed);
                }
            }
        }
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(EMBEDDED_PROFILE) {
            return Json(parsed);
        }
    }

    Json(serde_json::json!({
        "id": if is_master { "bandita" } else { &id },
        "name": if is_master { "Bandita Library" } else { &id },
        "avatarEmoji": if is_master { "🎧" } else { "🎵" },
        "isMaster": is_master,
        "cacheAudio": is_master,
        "hasLibrary": true,
        "hasPlaylists": true
    }))
}

async fn handle_profile_library(
    State(config): State<SharedConfig>,
    AxumPath(_id): AxumPath<String>,
) -> Response<Body> {
    let defaults_dir = {
        let cfg = config.lock().unwrap();
        cfg.defaults_dir.clone()
    };

    let f_path = Path::new(&defaults_dir).join("default").join("YourLibrary.json");
    if f_path.exists() {
        if let Ok(content) = fs::read_to_string(&f_path) {
            return Response::builder()
                .header(header::CONTENT_TYPE, "application/json")
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(Body::from(content))
                .unwrap();
        }
    }

    // Fallback to embedded compile-time YourLibrary.json
    Response::builder()
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Body::from(EMBEDDED_YOUR_LIBRARY))
        .unwrap()
}

async fn handle_profile_playlists(
    State(config): State<SharedConfig>,
    AxumPath(_id): AxumPath<String>,
) -> Response<Body> {
    let defaults_dir = {
        let cfg = config.lock().unwrap();
        cfg.defaults_dir.clone()
    };

    let f_path = Path::new(&defaults_dir).join("default").join("Playlist1.json");
    if f_path.exists() {
        if let Ok(content) = fs::read_to_string(&f_path) {
            return Response::builder()
                .header(header::CONTENT_TYPE, "application/json")
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(Body::from(content))
                .unwrap();
        }
    }

    // Fallback to embedded compile-time Playlist1.json
    Response::builder()
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Body::from(EMBEDDED_PLAYLIST1))
        .unwrap()
}

async fn handle_save_playlists(
    State(config): State<SharedConfig>,
    AxumPath(_id): AxumPath<String>,
    body: String,
) -> Response<Body> {
    let defaults_dir = {
        let cfg = config.lock().unwrap();
        cfg.defaults_dir.clone()
    };

    let f_path = Path::new(&defaults_dir).join("default").join("Playlist1.json");
    if let Some(parent) = f_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    match fs::write(&f_path, body) {
        Ok(_) => Response::builder()
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(r#"{"success":true}"#))
            .unwrap(),
        Err(e) => Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .body(Body::from(format!(r#"{{"error":"{}"}}"#, e)))
            .unwrap(),
    }
}

async fn handle_offline_status(State(config): State<SharedConfig>) -> impl IntoResponse {
    let (cache_dir, defaults_dir) = {
        let cfg = config.lock().unwrap();
        (cfg.cache_dir.clone(), cfg.defaults_dir.clone())
    };

    let mut count = 0;
    let mut total_bytes: u64 = 0;

    let scan_dir = |dir_path: &Path, count: &mut usize, total_bytes: &mut u64| {
        if let Ok(entries) = fs::read_dir(dir_path) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_file() {
                        let path = entry.path();
                        if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                            if matches!(ext, "webm" | "mp3" | "m4a" | "ogg" | "opus") {
                                *count += 1;
                                *total_bytes += meta.len();
                            }
                        }
                    }
                }
            }
        }
    };

    let clean_cache = crate::config::strip_unc_prefix(&cache_dir);
    scan_dir(Path::new(&clean_cache), &mut count, &mut total_bytes);

    if count == 0 {
        let clean_defaults = crate::config::strip_unc_prefix(&defaults_dir);
        let fallback_audio_dir = Path::new(&clean_defaults).join("default").join("audio");
        scan_dir(&fallback_audio_dir, &mut count, &mut total_bytes);
    }

    Json(serde_json::json!({
        "cachedCount": count,
        "totalSizeBytes": total_bytes,
        "cacheDir": cache_dir
    }))
}

async fn handle_get_config(State(config): State<SharedConfig>) -> impl IntoResponse {
    let cfg = config.lock().unwrap().clone();
    Json(cfg)
}

#[derive(Deserialize)]
pub struct UpdateConfigPayload {
    pub cache_dir: Option<String>,
    pub gateway_url: Option<String>,
}

async fn handle_update_config(
    State(config): State<SharedConfig>,
    Json(payload): Json<UpdateConfigPayload>,
) -> impl IntoResponse {
    let mut cfg = config.lock().unwrap();
    if let Some(c) = payload.cache_dir {
        cfg.cache_dir = c;
    }
    if let Some(g) = payload.gateway_url {
        cfg.gateway_url = g;
    }
    let _ = crate::config::save_config(&cfg);
    Json(cfg.clone())
}

async fn handle_auth_verify() -> impl IntoResponse {
    Json(serde_json::json!({
        "valid": true,
        "authRequired": false
    }))
}
