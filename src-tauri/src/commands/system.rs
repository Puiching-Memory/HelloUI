use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
#[cfg(debug_assertions)]
use tauri::Manager;

use crate::state::{get_default_sdcpp_folder, AppState};

/// Get the application version
#[tauri::command]
pub fn app_get_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AvailableEngine {
    pub device_type: String,
    pub cpu_variant: Option<String>,
    pub label: String,
}

fn check_engine_exists(folder: &PathBuf, executables: &[&str]) -> bool {
    if !folder.exists() {
        return false;
    }
    for exe in executables {
        if folder.join(exe).exists() {
            return true;
        }
    }
    false
}

fn get_cpu_variant_label(variant: &str) -> String {
    match variant {
        "avx2" => "CPU (AVX2)".to_string(),
        "avx512" => "CPU (AVX-512)".to_string(),
        "avx" => "CPU (AVX)".to_string(),
        "noavx" => "CPU (无AVX)".to_string(),
        _ => "CPU".to_string(),
    }
}

/// Get available inference engines (CUDA, Vulkan, CPU variants)
#[tauri::command]
pub async fn system_get_available_engines(state: State<'_, AppState>) -> Result<Vec<AvailableEngine>, String> {
    let mut available: Vec<AvailableEngine> = Vec::new();

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

    let executables = if cfg!(target_os = "windows") {
        &["sd-cli.exe", "sd.exe", "sd_server.exe", "sd-server.exe"][..]
    } else {
        &["sd-cli", "sd", "sd_server", "sd-server"][..]
    };

    let cpu_variant_folders = [
        ("cpu-avx2", Some("avx2")),
        ("cpu-avx512", Some("avx512")),
        ("cpu-avx", Some("avx")),
        ("cpu-noavx", Some("noavx")),
        ("cpu", None),
    ];

    for (folder_name, variant) in cpu_variant_folders.iter() {
        let variant_folder = sdcpp_folder.join(folder_name);
        if check_engine_exists(&variant_folder, executables) {
            let label = match variant {
                Some(v) => get_cpu_variant_label(v),
                None => "CPU".to_string(),
            };
            available.push(AvailableEngine {
                device_type: "cpu".to_string(),
                cpu_variant: variant.map(|s| s.to_string()),
                label,
            });
        }
    }

    let other_devices = [
        ("cuda", "CUDA"),
        ("vulkan", "Vulkan"),
        ("rocm", "ROCm"),
    ];
    for (device, label) in other_devices.iter() {
        let device_folder = sdcpp_folder.join(device);
        if check_engine_exists(&device_folder, executables) {
            available.push(AvailableEngine {
                device_type: device.to_string(),
                cpu_variant: None,
                label: label.to_string(),
            });
        }
    }

    Ok(available)
}

/// Toggle DevTools
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
