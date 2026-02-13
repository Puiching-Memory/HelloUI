use crate::state::{self, AppState};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WeightFile {
    pub name: String,
    pub size: u64,
    pub path: String,
    pub modified: u64,
}

/// Initialize default folders on app startup
pub async fn init_default_folders(app: &tauri::AppHandle) -> Result<(), String> {
    let models_folder = state::get_default_models_folder();
    let sdcpp_folder = state::get_default_sdcpp_folder();
    let outputs_folder = state::get_default_outputs_folder();

    for folder in [&models_folder, &outputs_folder] {
        if !folder.exists() {
            std::fs::create_dir_all(folder).map_err(|e| e.to_string())?;
        }
    }

    let state = app.state::<AppState>();
    *state.weights_folder.lock().unwrap() = Some(models_folder.to_string_lossy().to_string());
    *state.sdcpp_folder.lock().unwrap() = Some(sdcpp_folder.to_string_lossy().to_string());
    *state.outputs_folder.lock().unwrap() = Some(outputs_folder.to_string_lossy().to_string());

    Ok(())
}

/// Initialize the default models folder
#[tauri::command]
pub async fn weights_init_default_folder(state: State<'_, AppState>) -> Result<String, String> {
    let folder = state::get_default_models_folder();
    if !folder.exists() {
        std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    }
    let path_str = folder.to_string_lossy().to_string();
    *state.weights_folder.lock().unwrap() = Some(path_str.clone());
    Ok(path_str)
}

/// Check if a folder exists
#[tauri::command]
pub async fn weights_check_folder(value: String) -> Result<bool, String> {
    Ok(Path::new(&value).is_dir())
}

/// Set the weights folder path
#[tauri::command]
pub async fn weights_set_folder(value: String, state: State<'_, AppState>) -> Result<bool, String> {
    let path = Path::new(&value);
    if !path.is_dir() {
        return Ok(false);
    }
    *state.weights_folder.lock().unwrap() = Some(value);
    Ok(true)
}

/// Get the weights folder path
#[tauri::command]
pub async fn weights_get_folder(state: State<'_, AppState>) -> Result<Option<String>, String> {
    Ok(state.weights_folder.lock().unwrap().clone())
}

/// Recursively list files in a folder
#[tauri::command]
pub async fn weights_list_files(value: String) -> Result<Vec<WeightFile>, String> {
    let base_path = Path::new(&value);
    if !base_path.is_dir() {
        return Ok(vec![]);
    }

    let mut files = Vec::new();
    list_files_recursive(base_path, base_path, &mut files)?;
    files.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(files)
}

fn list_files_recursive(
    dir: &Path,
    base: &Path,
    files: &mut Vec<WeightFile>,
) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            list_files_recursive(&path, base, files)?;
        } else {
            let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
            let modified = metadata
                .modified()
                .map(|t| {
                    t.duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64
                })
                .unwrap_or(0);

            let rel_path = path
                .strip_prefix(base)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| path.to_string_lossy().to_string());

            files.push(WeightFile {
                name: rel_path.clone(),
                size: metadata.len(),
                path: path.to_string_lossy().to_string(),
                modified,
            });
        }
    }
    Ok(())
}

/// Open file dialog to select a weight file
#[tauri::command]
pub async fn weights_select_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter(
            "Model Files",
            &["safetensors", "gguf", "ckpt", "pt", "pth", "bin"],
        )
        .blocking_pick_file();

    Ok(file.and_then(|f| f.into_path().ok()).map(|p| p.to_string_lossy().to_string()))
}

/// Export (download) a weight file via save dialog
#[tauri::command]
pub async fn weights_download_file(value: String, app: tauri::AppHandle) -> Result<bool, String> {
    let src_path = Path::new(&value);
    if !src_path.exists() {
        return Err("Source file not found".to_string());
    }

    let file_name = src_path
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
            std::fs::copy(src_path, dest_path.as_path().unwrap()).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}

/// Delete a weight file
#[tauri::command]
pub async fn weights_delete_file(value: String) -> Result<bool, String> {
    let path = Path::new(&value);
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}
