use base64::Engine;
use std::path::Path;
use tauri_plugin_dialog::DialogExt;

/// Open file dialog for image selection
#[tauri::command]
pub async fn dialog_open_image(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg", "webp", "bmp", "gif"])
        .blocking_pick_file();

    Ok(file.and_then(|f| f.into_path().ok()).map(|p| p.to_string_lossy().to_string()))
}

/// Open file dialog for edit image file selection
#[tauri::command]
pub async fn edit_image_select_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg", "webp", "bmp", "gif"])
        .blocking_pick_file();

    Ok(file.and_then(|f| f.into_path().ok()).map(|p| p.to_string_lossy().to_string()))
}

/// Read an image file and return it as a base64 data URL
#[tauri::command]
pub async fn edit_image_read_image_base64(value: String) -> Result<String, String> {
    let path = Path::new(&value);

    if !path.exists() {
        return Err(format!("File not found: {}", value));
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
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        _ => "image/png",
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:{};base64,{}", mime, b64))
}
