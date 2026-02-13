use std::path::PathBuf;
use std::sync::Mutex;
use tokio::sync::watch;

/// Shared application state, managed by Tauri
pub struct AppState {
    pub weights_folder: Mutex<Option<String>>,
    pub sdcpp_folder: Mutex<Option<String>>,
    pub sdcpp_device_type: Mutex<String>,
    pub outputs_folder: Mutex<Option<String>>,
    /// Cancel signal for generate process
    pub generate_cancel: Mutex<Option<watch::Sender<bool>>>,
    /// Cancel signal for video generate process
    pub video_generate_cancel: Mutex<Option<watch::Sender<bool>>>,
    /// Cancel signal for download operations
    pub download_cancel: Mutex<Option<watch::Sender<bool>>>,
    /// HuggingFace mirror ID
    pub hf_mirror_id: Mutex<String>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            weights_folder: Mutex::new(None),
            sdcpp_folder: Mutex::new(None),
            sdcpp_device_type: Mutex::new("cpu".to_string()),
            outputs_folder: Mutex::new(None),
            generate_cancel: Mutex::new(None),
            video_generate_cancel: Mutex::new(None),
            download_cancel: Mutex::new(None),
            hf_mirror_id: Mutex::new("huggingface".to_string()),
        }
    }
}

/// Get the application's run path (where the exe is located)
pub fn get_run_path() -> PathBuf {
    std::env::current_exe()
        .map(|p| p.parent().unwrap_or(&p).to_path_buf())
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_default())
}

/// Get the default models folder path
pub fn get_default_models_folder() -> PathBuf {
    get_run_path().join("models")
}

/// Get active models folder path (custom weights folder has priority)
pub fn get_active_models_folder(weights_folder: Option<&str>) -> PathBuf {
    match weights_folder {
        Some(folder) if !folder.trim().is_empty() => PathBuf::from(folder),
        _ => get_default_models_folder(),
    }
}

/// Get model-groups.json path under active models folder
pub fn get_model_groups_path(weights_folder: Option<&str>) -> PathBuf {
    get_active_models_folder(weights_folder).join("model-groups.json")
}

/// Get the default SD.cpp folder path
pub fn get_default_sdcpp_folder() -> PathBuf {
    get_run_path().join("engines").join("sdcpp")
}

/// Get the default outputs folder path
pub fn get_default_outputs_folder() -> PathBuf {
    get_run_path().join("outputs")
}

/// Get the FFmpeg executable path
pub fn get_ffmpeg_path() -> PathBuf {
    get_run_path().join("engines").join("ffmpeg").join("bin").join(
        if cfg!(target_os = "windows") { "ffmpeg.exe" } else { "ffmpeg" }
    )
}

/// Resolve a model path (relative to models folder or absolute)
pub fn resolve_model_path(model_path: &str, base_folder: &str) -> String {
    let path = std::path::Path::new(model_path);
    if path.is_absolute() {
        model_path.to_string()
    } else {
        let full_path = std::path::Path::new(base_folder).join(model_path);
        // Use 'dunce' if we want to ensure we don't have the UNC prefix when absolute
        dunce::simplified(&full_path).to_string_lossy().to_string()
    }
}
