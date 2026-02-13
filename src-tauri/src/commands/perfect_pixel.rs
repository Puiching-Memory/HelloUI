use base64::Engine;
use std::path::Path;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

/// Select an image file
#[tauri::command]
pub async fn perfect_pixel_select_image(app: AppHandle) -> Result<Option<String>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg", "webp", "bmp"])
        .blocking_pick_file();

    Ok(file.and_then(|f| f.into_path().ok()).map(|p| p.to_string_lossy().to_string()))
}

/// Read an image as base64 data URL
#[tauri::command]
pub async fn perfect_pixel_read_image(value: String) -> Result<String, String> {
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
        "bmp" => "image/bmp",
        _ => "image/png",
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:{};base64,{}", mime, b64))
}

/// Save a processed image (from base64 data URL)
#[tauri::command]
pub async fn perfect_pixel_save(value: String, app: AppHandle) -> Result<serde_json::Value, String> {
    // Parse data URL
    let data_start = value.find(",").unwrap_or(0) + 1;
    let b64_data = &value[data_start..];

    let image_data = base64::engine::general_purpose::STANDARD
        .decode(b64_data)
        .map_err(|e| e.to_string())?;

    // Determine file extension from mime type
    let ext = if value.starts_with("data:image/jpeg") || value.starts_with("data:image/jpg") {
        "jpg"
    } else if value.starts_with("data:image/webp") {
        "webp"
    } else {
        "png"
    };

    let dest = app
        .dialog()
        .file()
        .set_file_name(&format!("perfect-pixel.{}", ext))
        .add_filter("Images", &[ext])
        .blocking_save_file();

    match dest {
        Some(dest_path) => {
            let path_str = dest_path.into_path().map_err(|_| "Invalid path".to_string())?.to_string_lossy().to_string();
            std::fs::write(&path_str, &image_data).map_err(|e| e.to_string())?;
            Ok(serde_json::json!({
                "success": true,
                "filePath": path_str
            }))
        }
        None => Ok(serde_json::json!({
            "success": false
        })),
    }
}
