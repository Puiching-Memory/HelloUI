use std::path::PathBuf;
use std::sync::Mutex;
use tokio::sync::watch;

pub const DEFAULT_CHUNK_SIZE_MB: usize = 10;
pub const DEFAULT_MAX_CONCURRENT_CHUNKS: usize = 4;

#[derive(Debug, Clone)]
pub struct DownloadConfig {
    pub chunk_size_mb: usize,
    pub max_concurrent_chunks: usize,
}

impl Default for DownloadConfig {
    fn default() -> Self {
        Self {
            chunk_size_mb: DEFAULT_CHUNK_SIZE_MB,
            max_concurrent_chunks: DEFAULT_MAX_CONCURRENT_CHUNKS,
        }
    }
}

pub struct AppState {
    pub weights_folder: Mutex<Option<String>>,
    pub sdcpp_folder: Mutex<Option<String>>,
    pub sdcpp_device_type: Mutex<String>,
    pub outputs_folder: Mutex<Option<String>>,
    pub generate_cancel: Mutex<Option<watch::Sender<bool>>>,
    pub video_generate_cancel: Mutex<Option<watch::Sender<bool>>>,
    pub download_cancel: Mutex<Option<watch::Sender<bool>>>,
    pub hf_mirror_id: Mutex<String>,
    pub download_config: Mutex<DownloadConfig>,
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
            download_config: Mutex::new(DownloadConfig::default()),
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
        dunce::simplified(&full_path).to_string_lossy().to_string()
    }
}

/// Resolve a model file path within a model group folder
/// If the path is already absolute, return as-is
/// If the path contains path separators, treat as relative to models folder
/// Otherwise, treat as filename within the group's folder
pub fn resolve_model_path_in_group(model_path: &str, models_folder: &str, group_folder: &str) -> String {
    let path = std::path::Path::new(model_path);
    if path.is_absolute() {
        model_path.to_string()
    } else if model_path.contains('/') || model_path.contains('\\') {
        let full_path = std::path::Path::new(models_folder).join(model_path);
        dunce::simplified(&full_path).to_string_lossy().to_string()
    } else {
        let full_path = std::path::Path::new(models_folder).join(group_folder).join(model_path);
        dunce::simplified(&full_path).to_string_lossy().to_string()
    }
}
