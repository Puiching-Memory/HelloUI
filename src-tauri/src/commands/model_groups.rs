use crate::state;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelGroup {
    pub id: String,
    pub name: String,
    pub task_type: Option<String>,
    pub sd_model: Option<String>,
    pub diffusion_model: Option<String>,
    pub high_noise_sd_model: Option<String>,
    pub vae_model: Option<String>,
    pub llm_model: Option<String>,
    pub clip_l_model: Option<String>,
    pub t5xxl_model: Option<String>,
    pub clip_vision_model: Option<String>,
    pub hf_files: Option<Vec<serde_json::Value>>,
    pub default_steps: Option<u32>,
    pub default_cfg_scale: Option<f64>,
    pub default_width: Option<u32>,
    pub default_height: Option<u32>,
    pub default_sampling_method: Option<String>,
    pub default_scheduler: Option<String>,
    pub default_seed: Option<i64>,
    pub default_flow_shift: Option<f64>,
    pub default_high_noise_steps: Option<u32>,
    pub default_high_noise_cfg_scale: Option<f64>,
    pub default_high_noise_sampling_method: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
}

fn get_model_groups_path(state: &State<'_, state::AppState>) -> std::path::PathBuf {
    let weights_folder = state.weights_folder.lock().unwrap().clone();
    state::get_model_groups_path(weights_folder.as_deref())
}

fn load_model_groups(path: &Path) -> Result<Vec<ModelGroup>, String> {
    if !path.exists() {
        return Ok(vec![]);
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

fn save_model_groups(path: &Path, groups: &[ModelGroup]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(groups).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

/// List all model groups
#[tauri::command]
pub async fn model_groups_list(state: State<'_, state::AppState>) -> Result<Vec<ModelGroup>, String> {
    let path = get_model_groups_path(&state);
    load_model_groups(&path)
}

/// Create a new model group
#[tauri::command]
pub async fn model_groups_create(
    state: State<'_, state::AppState>,
    value: serde_json::Value,
) -> Result<ModelGroup, String> {
    let path = get_model_groups_path(&state);
    let mut groups = load_model_groups(&path)?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let mut group: ModelGroup = serde_json::from_value(value).map_err(|e| e.to_string())?;
    group.id = uuid::Uuid::new_v4().to_string();
    group.created_at = now;
    group.updated_at = now;

    groups.push(group.clone());
    save_model_groups(&path, &groups)?;

    Ok(group)
}

/// Update an existing model group
#[tauri::command]
pub async fn model_groups_update(
    state: State<'_, state::AppState>,
    id: String,
    updates: serde_json::Value,
) -> Result<ModelGroup, String> {
    let path = get_model_groups_path(&state);
    let mut groups = load_model_groups(&path)?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let group = groups
        .iter_mut()
        .find(|g| g.id == id)
        .ok_or("Model group not found")?;

    // Merge updates
    let mut group_json = serde_json::to_value(&*group).map_err(|e| e.to_string())?;
    if let (Some(base), Some(upd)) = (group_json.as_object_mut(), updates.as_object()) {
        for (key, val) in upd {
            base.insert(key.clone(), val.clone());
        }
    }
    group_json["updatedAt"] = serde_json::json!(now);

    let updated: ModelGroup = serde_json::from_value(group_json).map_err(|e| e.to_string())?;
    *group = updated.clone();
    save_model_groups(&path, &groups)?;

    Ok(updated)
}

/// Delete a model group
#[tauri::command]
pub async fn model_groups_delete(
    state: State<'_, state::AppState>,
    id: String,
    delete_files: Option<bool>,
) -> Result<bool, String> {
    let path = get_model_groups_path(&state);
    let mut groups = load_model_groups(&path)?;
    let original_len = groups.len();

    if delete_files.unwrap_or(false) {
        // Find the group and delete its folder
        if let Some(group) = groups.iter().find(|g| g.id == id) {
            let weights_folder = state.weights_folder.lock().unwrap().clone();
            let models_folder = state::get_active_models_folder(weights_folder.as_deref());
            let group_folder = models_folder.join(&group.id);
            if group_folder.exists() {
                let _ = std::fs::remove_dir_all(&group_folder);
            }
        }
    }

    groups.retain(|g| g.id != id);

    if groups.len() < original_len {
        save_model_groups(&path, &groups)?;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Get a model group by ID
#[tauri::command]
pub async fn model_groups_get(
    state: State<'_, state::AppState>,
    value: String,
) -> Result<Option<ModelGroup>, String> {
    let path = get_model_groups_path(&state);
    let groups = load_model_groups(&path)?;
    Ok(groups.into_iter().find(|g| g.id == value))
}

/// Open folder selection dialog
#[tauri::command]
pub async fn model_groups_select_folder(app: AppHandle) -> Result<Option<String>, String> {
    let folder = app.dialog().file().blocking_pick_folder();

    Ok(folder.and_then(|f| f.into_path().ok()).map(|p| p.to_string_lossy().to_string()))
}

/// Import a model group from a folder
#[tauri::command]
pub async fn model_groups_import(
    state: State<'_, state::AppState>,
    folder_path: String,
    target_folder: String,
    app: AppHandle,
) -> Result<serde_json::Value, String> {
    let src = Path::new(&folder_path);
    if !src.is_dir() {
        return Err("Source folder not found".to_string());
    }

    // Check for config.json in source
    let config_path = src.join("config.json");
    if !config_path.exists() {
        return Err("No config.json found in source folder".to_string());
    }

    let config_data = std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let config: serde_json::Value = serde_json::from_str(&config_data).map_err(|e| e.to_string())?;

    let group_name = config["name"].as_str().unwrap_or("Imported Group").to_string();
    let group_id = uuid::Uuid::new_v4().to_string();
    let dest = Path::new(&target_folder).join(&group_id);
    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;

    // Copy files with progress
    let entries: Vec<_> = walkdir_files(src)?;
    let total = entries.len();

    for (i, entry_path) in entries.iter().enumerate() {
        let rel = entry_path
            .strip_prefix(src)
            .map_err(|e| e.to_string())?;
        let dest_file = dest.join(rel);
        if let Some(parent) = dest_file.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::copy(entry_path, &dest_file).map_err(|e| e.to_string())?;

        let _ = app.emit(
            "model-groups:import-progress",
            serde_json::json!({
                "progress": ((i + 1) as f64 / total as f64 * 100.0) as u32,
                "copied": i + 1,
                "total": total,
                "fileName": rel.to_string_lossy()
            }),
        );
    }

    // Create model group entry
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let mut group_config = config.clone();
    if let Some(obj) = group_config.as_object_mut() {
        obj.insert("id".to_string(), serde_json::json!(group_id));
        obj.insert("createdAt".to_string(), serde_json::json!(now));
        obj.insert("updatedAt".to_string(), serde_json::json!(now));
    }

    let group: ModelGroup =
        serde_json::from_value(group_config).map_err(|e| e.to_string())?;

    let path = get_model_groups_path(&state);
    let mut groups = load_model_groups(&path)?;
    groups.push(group.clone());
    save_model_groups(&path, &groups)?;

    Ok(serde_json::json!({
        "success": true,
        "message": format!("Imported '{}'", group_name),
        "group": group
    }))
}

/// Build and export a model group
#[tauri::command]
pub async fn model_groups_build_and_export(
    value: serde_json::Value,
    app: AppHandle,
) -> Result<serde_json::Value, String> {
    let folder = app.dialog().file().blocking_pick_folder();

    let dest_folder = match folder {
        Some(f) => f.into_path().map_err(|_| "Invalid path".to_string())?.to_string_lossy().to_string(),
        None => return Ok(serde_json::json!({ "success": false, "error": "cancelled" })),
    };

    // Write config.json
    let config_json = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
    let dest = Path::new(&dest_folder);
    std::fs::write(dest.join("config.json"), config_json).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Exported successfully",
        "exportPath": dest_folder
    }))
}

fn walkdir_files(dir: &Path) -> Result<Vec<std::path::PathBuf>, String> {
    let mut files = Vec::new();
    walkdir_recursive(dir, &mut files)?;
    Ok(files)
}

fn walkdir_recursive(dir: &Path, files: &mut Vec<std::path::PathBuf>) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            walkdir_recursive(&path, files)?;
        } else {
            files.push(path);
        }
    }
    Ok(())
}
