use crate::state::{self, AppState};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelDownloadProgress {
    pub stage: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed: f64,
    pub file_name: String,
    pub total_files: u32,
    pub current_file_index: u32,
    pub error: Option<String>,
}

/// Get the current HuggingFace mirror setting
#[tauri::command]
pub async fn models_get_hf_mirror(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state.hf_mirror_id.lock().unwrap().clone())
}

/// Set the HuggingFace mirror
#[tauri::command]
pub async fn models_set_hf_mirror(
    state: State<'_, AppState>,
    value: String,
) -> Result<bool, String> {
    *state.hf_mirror_id.lock().unwrap() = value;
    Ok(true)
}

/// Download model files for a group from HuggingFace
#[tauri::command]
pub async fn models_download_group_files(
    app: AppHandle,
    state: State<'_, AppState>,
    group_id: String,
    mirror_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let models_folder = state
        .weights_folder
        .lock()
        .unwrap()
        .clone()
        .unwrap_or_else(|| state::get_default_models_folder().to_string_lossy().to_string());

    // Load model group
    let groups_path = state::get_model_groups_path(Some(&models_folder));
    if !groups_path.exists() {
        return Err("Model groups file not found".to_string());
    }
    let data = std::fs::read_to_string(&groups_path).map_err(|e| e.to_string())?;
    let groups: Vec<serde_json::Value> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    let group = groups
        .iter()
        .find(|g| g["id"].as_str() == Some(&group_id))
        .ok_or("Model group not found")?;

    let hf_files = group["hfFiles"]
        .as_array()
        .ok_or("No HF files defined for this group")?;

    if hf_files.is_empty() {
        return Ok(serde_json::json!({ "success": true }));
    }

    // Determine target folder based on sdModel path
    let target_folder = if let Some(sd_model) = group["sdModel"].as_str() {
        let abs_path = Path::new(&models_folder).join(sd_model);
        abs_path
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| {
                Path::new(&models_folder)
                    .join(&group_id)
                    .to_string_lossy()
                    .to_string()
            })
    } else {
        let name = group["name"].as_str().unwrap_or(&group_id);
        Path::new(&models_folder)
            .join(name)
            .to_string_lossy()
            .to_string()
    };

    let mirror = mirror_id.unwrap_or_else(|| state.hf_mirror_id.lock().unwrap().clone());
    let base_url = match mirror.as_str() {
        "hf-mirror" => "https://hf-mirror.com",
        _ => "https://huggingface.co",
    };

    let (cancel_tx, mut cancel_rx) = tokio::sync::watch::channel(false);
    *state.download_cancel.lock().unwrap() = Some(cancel_tx);

    let client = reqwest::Client::new();
    let total_files = hf_files.len() as u32;

    for (index, file_ref) in hf_files.iter().enumerate() {
        let repo = file_ref["repo"].as_str().unwrap_or("");
        let file = file_ref["file"].as_str().unwrap_or("");
        let save_path = file_ref["savePath"].as_str().unwrap_or(file);
        let dest_path = Path::new(&target_folder).join(save_path);

        // Skip if file already exists
        if dest_path.exists() {
            continue;
        }

        if let Some(parent) = dest_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let url = format!("{}/{}/resolve/main/{}", base_url, repo, file);

        let response = client
            .get(&url)
            .header("User-Agent", "HelloUI")
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            return Err(format!("HTTP {}: download failed for {}", response.status(), file));
        }

        let total_bytes = response.content_length().unwrap_or(0);
        let mut downloaded_bytes: u64 = 0;
        let mut out_file = std::fs::File::create(&dest_path).map_err(|e| e.to_string())?;
        let mut stream = response.bytes_stream();
        let start_time = std::time::Instant::now();

        // Check if already cancelled before starting
        if *cancel_rx.borrow() {
            drop(out_file);
            let _ = std::fs::remove_file(&dest_path);
            return Ok(serde_json::json!({ "success": false, "error": "cancelled" }));
        }

        loop {
            tokio::select! {
                chunk = stream.next() => {
                    match chunk {
                        Some(Ok(data)) => {
                            use std::io::Write;
                            out_file.write_all(&data).map_err(|e| e.to_string())?;
                            downloaded_bytes += data.len() as u64;

                            let elapsed = start_time.elapsed().as_secs_f64();
                            let speed = if elapsed > 0.0 { downloaded_bytes as f64 / elapsed } else { 0.0 };

                            let _ = app.emit("models:download-progress", ModelDownloadProgress {
                                stage: "downloading".to_string(),
                                downloaded_bytes,
                                total_bytes,
                                speed,
                                file_name: file.to_string(),
                                total_files,
                                current_file_index: (index + 1) as u32,
                                error: None,
                            });
                        }
                        Some(Err(e)) => {
                            return Err(e.to_string());
                        }
                        None => break,
                    }
                }
                _ = cancel_rx.changed() => {
                    drop(out_file);
                    let _ = std::fs::remove_file(&dest_path);
                    return Ok(serde_json::json!({ "success": false, "error": "cancelled" }));
                }
            }
        }
    }

    let _ = app.emit(
        "models:download-progress",
        ModelDownloadProgress {
            stage: "done".to_string(),
            downloaded_bytes: 0,
            total_bytes: 0,
            speed: 0.0,
            file_name: String::new(),
            total_files,
            current_file_index: total_files,
            error: None,
        },
    );

    Ok(serde_json::json!({ "success": true }))
}

/// Cancel ongoing download
#[tauri::command]
pub async fn models_cancel_download(state: State<'_, AppState>) -> Result<bool, String> {
    if let Some(cancel) = state.download_cancel.lock().unwrap().take() {
        let _ = cancel.send(true);
    }
    Ok(true)
}

/// Check if model files exist for a group
#[tauri::command]
pub async fn models_check_files(
    state: State<'_, AppState>,
    group_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    let models_folder = state
        .weights_folder
        .lock()
        .unwrap()
        .clone()
        .unwrap_or_else(|| state::get_default_models_folder().to_string_lossy().to_string());

    let groups_path = state::get_model_groups_path(Some(&models_folder));
    if !groups_path.exists() {
        return Ok(vec![]);
    }
    let data = std::fs::read_to_string(&groups_path).map_err(|e| e.to_string())?;
    let groups: Vec<serde_json::Value> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    let group = groups
        .iter()
        .find(|g| g["id"].as_str() == Some(&group_id))
        .ok_or("Model group not found")?;

    let hf_files = match group["hfFiles"].as_array() {
        Some(files) => files,
        None => return Ok(vec![]),
    };

    // Determine target folder
    let target_folder = if let Some(sd_model) = group["sdModel"].as_str() {
        let abs_path = Path::new(&models_folder).join(sd_model);
        abs_path
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| {
                Path::new(&models_folder)
                    .join(&group_id)
                    .to_string_lossy()
                    .to_string()
            })
    } else {
        let name = group["name"].as_str().unwrap_or(&group_id);
        Path::new(&models_folder)
            .join(name)
            .to_string_lossy()
            .to_string()
    };

    let results: Vec<serde_json::Value> = hf_files
        .iter()
        .map(|file_ref| {
            let file = file_ref["file"].as_str().unwrap_or("");
            let save_path = file_ref["savePath"].as_str().unwrap_or(file);
            let full_path = Path::new(&target_folder).join(save_path);
            let exists = full_path.exists();
            let size = if exists {
                std::fs::metadata(&full_path).map(|m| m.len()).ok()
            } else {
                None
            };
            serde_json::json!({
                "file": file,
                "exists": exists,
                "size": size
            })
        })
        .collect();

    Ok(results)
}
