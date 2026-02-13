use crate::state;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::Path;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedImageInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: u64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    #[serde(rename = "type")]
    pub gen_type: Option<String>,
    pub media_type: Option<String>,
    pub prompt: Option<String>,
    pub negative_prompt: Option<String>,
    pub steps: Option<u32>,
    pub cfg_scale: Option<f64>,
    pub device_type: Option<String>,
    pub group_id: Option<String>,
    pub group_name: Option<String>,
    pub model_path: Option<String>,
    pub vae_model_path: Option<String>,
    pub llm_model_path: Option<String>,
    pub sampling_method: Option<String>,
    pub scheduler: Option<String>,
    pub seed: Option<i64>,
    pub batch_count: Option<u32>,
    pub threads: Option<u32>,
    pub preview_method: Option<String>,
    pub preview_interval: Option<u32>,
    pub preview_image: Option<String>,
    pub verbose: Option<bool>,
    pub command_line: Option<String>,
    pub generated_at: Option<String>,
    pub duration: Option<u64>,
}

/// List all generated images/videos
#[tauri::command]
pub async fn generated_images_list() -> Result<Vec<GeneratedImageInfo>, String> {
    let outputs_folder = state::get_default_outputs_folder();
    if !outputs_folder.is_dir() {
        return Ok(vec![]);
    }

    let mut images = Vec::new();
    let entries = std::fs::read_dir(&outputs_folder).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        // Only process image/video files
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if !["png", "jpg", "jpeg", "webp", "mp4", "avi"].contains(&ext.as_str()) {
            continue;
        }

        let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
        let modified = metadata
            .modified()
            .map(|t| {
                t.duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64
            })
            .unwrap_or(0);

        let media_type = if ["mp4", "avi"].contains(&ext.as_str()) {
            Some("video".to_string())
        } else {
            Some("image".to_string())
        };

        // Try to load metadata JSON
        let json_path = path.with_extension("json");
        let mut info = GeneratedImageInfo {
            name: name.clone(),
            path: path.to_string_lossy().to_string(),
            size: metadata.len(),
            modified,
            width: None,
            height: None,
            gen_type: None,
            media_type,
            prompt: None,
            negative_prompt: None,
            steps: None,
            cfg_scale: None,
            device_type: None,
            group_id: None,
            group_name: None,
            model_path: None,
            vae_model_path: None,
            llm_model_path: None,
            sampling_method: None,
            scheduler: None,
            seed: None,
            batch_count: None,
            threads: None,
            preview_method: None,
            preview_interval: None,
            preview_image: None,
            verbose: None,
            command_line: None,
            generated_at: None,
            duration: None,
        };

        if json_path.exists() {
            if let Ok(json_data) = std::fs::read_to_string(&json_path) {
                if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&json_data) {
                    info.prompt = meta["prompt"].as_str().map(|s| s.to_string());
                    info.negative_prompt = meta["negativePrompt"].as_str().map(|s| s.to_string());
                    info.steps = meta["steps"].as_u64().map(|v| v as u32);
                    info.cfg_scale = meta["cfgScale"].as_f64();
                    info.device_type = meta["deviceType"].as_str().map(|s| s.to_string());
                    info.group_id = meta["groupId"].as_str().map(|s| s.to_string());
                    info.group_name = meta["groupName"].as_str().map(|s| s.to_string());
                    info.sampling_method = meta["samplingMethod"].as_str().map(|s| s.to_string());
                    info.scheduler = meta["scheduler"].as_str().map(|s| s.to_string());
                    info.seed = meta["seed"].as_i64();
                    info.gen_type = meta["type"].as_str().map(|s| s.to_string());
                    info.generated_at = meta["generatedAt"].as_str().map(|s| s.to_string());
                    info.duration = meta["duration"].as_u64();
                    info.width = meta["width"].as_u64().map(|v| v as u32);
                    info.height = meta["height"].as_u64().map(|v| v as u32);
                }
            }
        }

        images.push(info);
    }

    // Sort by modified time descending
    images.sort_by(|a, b| b.modified.cmp(&a.modified));

    Ok(images)
}

/// Export (download) a generated image via save dialog
#[tauri::command]
pub async fn generated_images_download(
    value: String,
    app: AppHandle,
) -> Result<bool, String> {
    let src = Path::new(&value);
    if !src.exists() {
        return Err("File not found".to_string());
    }

    let file_name = src
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file");

    let dest = app
        .dialog()
        .file()
        .set_file_name(file_name)
        .blocking_save_file();

    match dest {
        Some(dest_path) => {
            std::fs::copy(src, dest_path.as_path().unwrap()).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}

/// Delete a generated image/video and its metadata
#[tauri::command]
pub async fn generated_images_delete(value: String) -> Result<bool, String> {
    let path = Path::new(&value);
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    // Also delete metadata JSON
    let json_path = Path::new(&value).with_extension("json");
    if json_path.exists() {
        let _ = std::fs::remove_file(&json_path);
    }
    Ok(true)
}

/// Get preview image as base64
#[tauri::command]
pub async fn generated_images_get_preview(value: String) -> Result<String, String> {
    let path = Path::new(&value);
    if !path.exists() {
        return Err("File not found".to_string());
    }

    let data = std::fs::read(path).map_err(|e| e.to_string())?;

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();

    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        _ => "image/png",
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:{};base64,{}", mime, b64))
}

/// Get video data as bytes array
#[tauri::command]
pub async fn generated_images_get_video_data(
    value: String,
) -> Result<serde_json::Value, String> {
    let path = Path::new(&value);
    if !path.exists() {
        return Err("File not found".to_string());
    }

    let data = std::fs::read(path).map_err(|e| e.to_string())?;

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mp4")
        .to_lowercase();

    let mime_type = match ext.as_str() {
        "mp4" => "video/mp4",
        "avi" => "video/avi",
        "webm" => "video/webm",
        _ => "video/mp4",
    };

    Ok(serde_json::json!({
        "data": data,
        "mimeType": mime_type
    }))
}

/// Batch download generated images as ZIP
#[tauri::command]
pub async fn generated_images_batch_download(
    value: Vec<String>,
    app: AppHandle,
) -> Result<serde_json::Value, String> {
    if value.is_empty() {
        return Err("No files selected".to_string());
    }

    // Ask for save location
    let dest = app
        .dialog()
        .file()
        .set_file_name("images.zip")
        .add_filter("ZIP", &["zip"])
        .blocking_save_file();

    let dest_path = match dest {
        Some(p) => p.into_path().map_err(|_| "Invalid path".to_string())?.to_string_lossy().to_string(),
        None => {
            return Ok(serde_json::json!({ "success": false, "canceled": true }));
        }
    };

    // Create ZIP archive
    let file = std::fs::File::create(&dest_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    for file_path in &value {
        let path = Path::new(file_path);
        if !path.exists() {
            continue;
        }

        let file_name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let data = std::fs::read(path).map_err(|e| e.to_string())?;
        zip.start_file(&file_name, options)
            .map_err(|e| e.to_string())?;
        zip.write_all(&data).map_err(|e| e.to_string())?;
    }

    zip.finish().map_err(|e| e.to_string())?;

    let zip_size = std::fs::metadata(&dest_path)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(serde_json::json!({
        "success": true,
        "zipPath": dest_path,
        "size": zip_size
    }))
}
