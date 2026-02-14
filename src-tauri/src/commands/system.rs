use std::path::PathBuf;

use tauri::{AppHandle, Manager, State};

use crate::state::{get_default_sdcpp_folder, AppState};

/// Get the application version
#[tauri::command]
pub fn app_get_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Get available inference engines (CUDA, Vulkan, CPU)
#[tauri::command]
pub async fn get_available_engines(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let mut available: Vec<String> = Vec::new();

    let sdcpp_folder = {
        let mut folder = state.sdcpp_folder.lock().unwrap();
        if folder.is_none() {
            let default_folder = get_default_sdcpp_folder();
            if !default_folder.exists() {
                let _ = std::fs::create_dir_all(&default_folder);
            }
            *folder = Some(default_folder.to_string_lossy().to_string());
        }
        folder.clone().map(PathBuf::from).unwrap_or_else(get_default_sdcpp_folder)
    };

    let candidates = ["cpu", "cuda", "vulkan", "rocm"];

    for device in candidates.iter() {
        let device_folder = sdcpp_folder.join(device);
        if device_folder.exists() {
            let executables = if cfg!(target_os = "windows") {
                &["sd.exe", "sd-cli.exe", "sd_server.exe", "sd-server.exe"][..]
            } else {
                &["sd", "sd-cli", "sd_server", "sd-server"][..]
            };

            for exe in executables {
                if device_folder.join(exe).exists() {
                    available.push(device.to_string());
                    break;
                }
            }
        }
    }

    Ok(available)
}

/// Toggle DevTools (development only)
#[tauri::command]
pub fn devtools_toggle(_app: AppHandle) -> Result<serde_json::Value, String> {
    #[cfg(debug_assertions)]
    {
        if let Some(window) = _app.get_webview_window("main") {
            if window.is_devtools_open() {
                window.close_devtools();
            } else {
                window.open_devtools();
            }
            return Ok(serde_json::json!({ "success": true, "isOpen": window.is_devtools_open() }));
        }
    }
    Ok(serde_json::json!({ "success": true }))
}

/// Proxy HTTP request (for Aliyun Tongyi API)
#[tauri::command]
pub async fn aliyun_api_call(
    method: String,
    url: String,
    headers: Option<std::collections::HashMap<String, String>>,
    body: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();

    let mut request = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        _ => return Err(format!("Unsupported HTTP method: {}", method)),
    };

    if let Some(hdrs) = headers {
        for (key, value) in hdrs {
            request = request.header(&key, &value);
        }
    }

    if let Some(body_data) = body {
        request = request.json(&body_data);
    }

    match request.send().await {
        Ok(response) => {
            let status = response.status().as_u16();
            let status_text = response.status().to_string();
            match response.json::<serde_json::Value>().await {
                Ok(data) => Ok(serde_json::json!({
                    "status": status,
                    "statusText": status_text,
                    "data": data
                })),
                Err(e) => Ok(serde_json::json!({
                    "status": status,
                    "statusText": status_text,
                    "error": e.to_string()
                })),
            }
        }
        Err(e) => Ok(serde_json::json!({
            "status": 0,
            "statusText": "Network Error",
            "error": e.to_string()
        })),
    }
}
