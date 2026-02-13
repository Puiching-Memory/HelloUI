use tauri::{AppHandle, Manager};

/// Get the application version
#[tauri::command]
pub fn app_get_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
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
