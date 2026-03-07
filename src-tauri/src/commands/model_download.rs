use crate::state::{self, AppState, DownloadConfig};
use hf_hub::{
    api::tokio::{Api as HfApi, ApiBuilder as HfApiBuilder, Progress as HfProgress},
    Cache as HfCache,
    Repo,
};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

const VERIFIED_EXTENSION: &str = "verified";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadConfigResponse {
    pub chunk_size_mb: usize,
    pub max_concurrent_chunks: usize,
}

impl From<DownloadConfig> for DownloadConfigResponse {
    fn from(config: DownloadConfig) -> Self {
        Self {
            chunk_size_mb: config.chunk_size_mb,
            max_concurrent_chunks: config.max_concurrent_chunks,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadConfigRequest {
    pub chunk_size_mb: Option<usize>,
    pub max_concurrent_chunks: Option<usize>,
}

#[tauri::command]
pub async fn models_get_download_config(state: State<'_, AppState>) -> Result<DownloadConfigResponse, String> {
    let config = state.download_config.lock().unwrap().clone();
    Ok(DownloadConfigResponse::from(config))
}

#[tauri::command]
pub async fn models_set_download_config(
    state: State<'_, AppState>,
    config: DownloadConfigRequest,
) -> Result<DownloadConfigResponse, String> {
    let mut current = state.download_config.lock().unwrap();
    
    if let Some(chunk_size_mb) = config.chunk_size_mb {
        if chunk_size_mb < 1 || chunk_size_mb > 100 {
            return Err("chunk_size_mb must be between 1 and 100".to_string());
        }
        current.chunk_size_mb = chunk_size_mb;
    }
    
    if let Some(max_concurrent_chunks) = config.max_concurrent_chunks {
        if max_concurrent_chunks < 1 || max_concurrent_chunks > 16 {
            return Err("max_concurrent_chunks must be between 1 and 16".to_string());
        }
        current.max_concurrent_chunks = max_concurrent_chunks;
    }
    
    Ok(DownloadConfigResponse::from(current.clone()))
}

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

#[tauri::command]
pub async fn models_get_hf_mirror(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state.hf_mirror_id.lock().unwrap().clone())
}

fn get_verified_path(file_path: &std::path::Path) -> std::path::PathBuf {
    let ext = file_path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    file_path.with_extension(format!("{}.{}", ext, VERIFIED_EXTENSION))
}

fn mark_file_verified(file_path: &std::path::Path, expected_size: u64) -> Result<(), String> {
    let verified_path = get_verified_path(file_path);
    let content = serde_json::json!({
        "expectedSize": expected_size,
        "verifiedAt": chrono::Utc::now().to_rfc3339()
    });
    std::fs::write(&verified_path, content.to_string()).map_err(|e| e.to_string())?;
    Ok(())
}

fn is_file_verified(file_path: &std::path::Path) -> bool {
    get_verified_path(file_path).exists()
}

fn get_verified_expected_size(file_path: &std::path::Path) -> Option<u64> {
    let verified_path = get_verified_path(file_path);
    if !verified_path.exists() {
        return None;
    }
    let content = std::fs::read_to_string(&verified_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    json["expectedSize"].as_u64()
}

#[tauri::command]
pub async fn models_set_hf_mirror(
    state: State<'_, AppState>,
    value: String,
) -> Result<bool, String> {
    *state.hf_mirror_id.lock().unwrap() = value;
    Ok(true)
}

struct HfProgressState {
    app: AppHandle,
    file_name: String,
    total_files: u32,
    current_file_index: u32,
    start_time: std::time::Instant,
    downloaded_bytes: AtomicU64,
    total_bytes: AtomicU64,
    last_emit_at: Mutex<std::time::Instant>,
}

#[derive(Clone)]
struct HfProgressReporter {
    inner: Arc<HfProgressState>,
}

impl HfProgressReporter {
    fn new(app: AppHandle, file_name: String, total_files: u32, current_file_index: u32) -> Self {
        Self {
            inner: Arc::new(HfProgressState {
                app,
                file_name,
                total_files,
                current_file_index,
                start_time: std::time::Instant::now(),
                downloaded_bytes: AtomicU64::new(0),
                total_bytes: AtomicU64::new(0),
                last_emit_at: Mutex::new(
                    std::time::Instant::now() - std::time::Duration::from_millis(250),
                ),
            }),
        }
    }

    fn emit(&self, downloaded_bytes: u64, total_bytes: u64, force: bool) {
        let now = std::time::Instant::now();
        {
            let mut last_emit_at = self.inner.last_emit_at.lock().unwrap();
            if !force
                && now.duration_since(*last_emit_at) < std::time::Duration::from_millis(200)
                && (total_bytes == 0 || downloaded_bytes < total_bytes)
            {
                return;
            }
            *last_emit_at = now;
        }

        let elapsed = self.inner.start_time.elapsed().as_secs_f64();
        let speed = if elapsed > 0.0 {
            downloaded_bytes as f64 / elapsed
        } else {
            0.0
        };

        let _ = self.inner.app.emit(
            "models:download-progress",
            ModelDownloadProgress {
                stage: "downloading".to_string(),
                downloaded_bytes,
                total_bytes,
                speed,
                file_name: self.inner.file_name.clone(),
                total_files: self.inner.total_files,
                current_file_index: self.inner.current_file_index,
                error: None,
            },
        );
    }
}

impl HfProgress for HfProgressReporter {
    async fn init(&mut self, size: usize, _filename: &str) {
        self.inner.total_bytes.store(size as u64, Ordering::SeqCst);
        self.inner.downloaded_bytes.store(0, Ordering::SeqCst);
        self.emit(0, size as u64, true);
    }

    async fn update(&mut self, size: usize) {
        let downloaded_bytes = self
            .inner
            .downloaded_bytes
            .fetch_add(size as u64, Ordering::SeqCst)
            + size as u64;
        let total_bytes = self.inner.total_bytes.load(Ordering::SeqCst);
        self.emit(downloaded_bytes, total_bytes, false);
    }

    async fn finish(&mut self) {
        let total_bytes = self.inner.total_bytes.load(Ordering::SeqCst);
        self.inner
            .downloaded_bytes
            .store(total_bytes, Ordering::SeqCst);
        self.emit(total_bytes, total_bytes, true);
    }
}

fn get_hf_endpoint(mirror_id: &str) -> String {
    match mirror_id {
        "hf-mirror" => "https://hf-mirror.com",
        _ => "https://huggingface.co",
    }
    .to_string()
}

fn get_hf_cache_dir(models_folder: &str) -> PathBuf {
    Path::new(models_folder).join(".hf-cache")
}

fn create_hf_api(
    models_folder: &str,
    mirror_id: &str,
    download_config: &DownloadConfig,
) -> Result<HfApi, String> {
    let cache_dir = get_hf_cache_dir(models_folder);
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    let chunk_size = download_config.chunk_size_mb.saturating_mul(1024 * 1024);

    HfApiBuilder::new()
        .with_progress(false)
        .with_endpoint(get_hf_endpoint(mirror_id))
        .with_cache_dir(cache_dir)
        .with_max_files(download_config.max_concurrent_chunks.max(1))
        .with_chunk_size((chunk_size > 0).then_some(chunk_size))
        .build()
        .map_err(|e| format!("Failed to create hf-hub client: {e}"))
}

fn get_cached_hf_file(models_folder: &str, repo: &str, file: &str) -> Option<PathBuf> {
    let cache = HfCache::new(get_hf_cache_dir(models_folder));
    cache.repo(Repo::model(repo.to_string())).get(file)
}

async fn get_remote_file_size(api: &HfApi, repo: &str, file: &str) -> Result<u64, String> {
    let api_repo = api.repo(Repo::model(repo.to_string()));
    let metadata = api
        .metadata(&api_repo.url(file))
        .await
        .map_err(|e| format!("Failed to fetch remote file metadata: {e}"))?;
    Ok(metadata.size() as u64)
}

async fn materialize_downloaded_file(source_path: &Path, dest_path: &Path) -> Result<(), String> {
    if dest_path.exists() {
        tokio::fs::remove_file(dest_path)
            .await
            .map_err(|e| e.to_string())?;
    }

    if std::fs::hard_link(source_path, dest_path).is_ok() {
        return Ok(());
    }

    tokio::fs::copy(source_path, dest_path)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_family = "unix")]
mod file_lock {
    use std::fs::File;
    use std::os::unix::io::AsRawFd;

    pub fn lock_file(file: &File) -> i32 {
        unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) }
    }

    pub fn unlock_file(file: &File) -> i32 {
        unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_UN) }
    }
}

#[cfg(target_family = "windows")]
mod file_lock {
    use std::fs::File;
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Foundation::HANDLE;
    use windows_sys::Win32::Storage::FileSystem::{LockFile, UnlockFile};

    pub fn lock_file(file: &File) -> i32 {
        unsafe {
            let res = LockFile(
                file.as_raw_handle() as HANDLE,
                0,
                0,
                !0,
                !0,
            );
            // Normalize to Unix convention: 0 = success, non-zero = failure
            // Windows LockFile returns TRUE (non-zero) on success, FALSE (0) on failure
            if res != 0 { 0 } else { -1 }
        }
    }

    pub fn unlock_file(file: &File) -> i32 {
        unsafe {
            let res = UnlockFile(file.as_raw_handle() as HANDLE, 0, 0, !0, !0);
            if res != 0 { 0 } else { -1 }
        }
    }
}

struct FileLockGuard {
    file: std::fs::File,
}

impl FileLockGuard {
    fn new(path: &std::path::Path) -> Result<Self, String> {
        let file = std::fs::File::create(path).map_err(|e| e.to_string())?;
        let mut res = file_lock::lock_file(&file);
        for _ in 0..5 {
            if res == 0 {
                break;
            }
            std::thread::sleep(std::time::Duration::from_secs(1));
            res = file_lock::lock_file(&file);
        }
        if res != 0 {
            return Err(format!("Failed to acquire lock for {:?}", path));
        }
        Ok(Self { file })
    }
}

impl Drop for FileLockGuard {
    fn drop(&mut self) {
        file_lock::unlock_file(&self.file);
    }
}

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

    let group_folder = group["folder"].as_str().unwrap_or_else(|| {
        group["name"].as_str().unwrap_or(&group_id)
    });
    let target_folder = Path::new(&models_folder)
        .join(group_folder)
        .to_string_lossy()
        .to_string();

    let mirror = mirror_id.unwrap_or_else(|| state.hf_mirror_id.lock().unwrap().clone());
    let download_config = state.download_config.lock().unwrap().clone();
    let hf_api = create_hf_api(&models_folder, &mirror, &download_config)?;

    let (cancel_tx, cancel_rx) = tokio::sync::watch::channel(false);
    *state.download_cancel.lock().unwrap() = Some(cancel_tx);

    let total_files = hf_files.len() as u32;

    for (index, file_ref) in hf_files.iter().enumerate() {
        let repo = file_ref["repo"].as_str().unwrap_or("");
        let file = file_ref["file"].as_str().unwrap_or("");
        let save_path = file_ref["savePath"].as_str().unwrap_or(file);
        let dest_path = Path::new(&target_folder).join(save_path);

        if dest_path.exists() {
            continue;
        }

        if let Some(parent) = dest_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let lock_path = dest_path.with_extension("lock");
        let _lock = match FileLockGuard::new(&lock_path) {
            Ok(l) => l,
            Err(e) => {
                if dest_path.exists() {
                    continue;
                }
                return Err(e);
            }
        };

        if dest_path.exists() {
            continue;
        }

        if *cancel_rx.borrow() {
            return Ok(serde_json::json!({ "success": false, "error": "cancelled" }));
        }

        let max_retries = 3;
        let mut last_error = String::new();
        let mut succeeded = false;
        let current_file_index = (index + 1) as u32;

        for attempt in 0..max_retries {
            if attempt > 0 {
                // Wait before retrying to avoid hammering the remote endpoint.
                let delay = std::time::Duration::from_secs(2u64.pow(attempt as u32));
                let _ = app.emit(
                    "models:download-progress",
                    ModelDownloadProgress {
                        stage: "downloading".to_string(),
                        downloaded_bytes: 0,
                        total_bytes: -1i64 as u64,
                        speed: 0.0,
                        file_name: format!("{} (retry {}/{})", file, attempt, max_retries - 1),
                        total_files,
                        current_file_index,
                        error: None,
                    },
                );
                tokio::time::sleep(delay).await;

                // Remove any incomplete local file before retrying.
                if dest_path.exists() {
                    std::fs::remove_file(&dest_path).ok();
                }
                let part_path = dest_path.with_extension("part");
                if part_path.exists() {
                    std::fs::remove_file(&part_path).ok();
                }
            }

            let result = async {
                if *cancel_rx.borrow() {
                    return Err("cancelled".to_string());
                }

                let downloaded_path = match get_cached_hf_file(&models_folder, repo, file) {
                    Some(path) => path,
                    None => {
                        let api_repo = hf_api.repo(Repo::model(repo.to_string()));
                        let progress = HfProgressReporter::new(
                            app.clone(),
                            file.to_string(),
                            total_files,
                            current_file_index,
                        );

                        api_repo
                            .download_with_progress(file, progress)
                            .await
                            .map_err(|e| e.to_string())?
                    }
                };

                materialize_downloaded_file(&downloaded_path, &dest_path).await?;
                let actual_size = tokio::fs::metadata(&dest_path)
                    .await
                    .map_err(|e| e.to_string())?
                    .len();
                mark_file_verified(&dest_path, actual_size)?;
                Ok::<(), String>(())
            }
            .await;

            match result {
                Ok(()) => {
                    succeeded = true;
                    break;
                }
                Err(e) => {
                    if e == "cancelled" {
                        std::fs::remove_file(&lock_path).ok();
                        return Ok(serde_json::json!({ "success": false, "error": "cancelled" }));
                    }
                    last_error = e;
                    // Keep retrying until the retry budget is exhausted.
                }
            }
        }

        std::fs::remove_file(&lock_path).ok();

        if !succeeded {
            return Err(format!("Download failed after {} retries: {}", max_retries - 1, last_error));
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

#[tauri::command]
pub async fn models_cancel_download(state: State<'_, AppState>) -> Result<bool, String> {
    if let Some(cancel) = state.download_cancel.lock().unwrap().take() {
        let _ = cancel.send(true);
    }
    Ok(true)
}

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

    let group_folder = group["folder"].as_str().unwrap_or_else(|| {
        group["name"].as_str().unwrap_or(&group_id)
    });
    let target_folder = Path::new(&models_folder)
        .join(group_folder)
        .to_string_lossy()
        .to_string();

    let results: Vec<serde_json::Value> = hf_files
        .iter()
        .map(|file_ref| {
            let file = file_ref["file"].as_str().unwrap_or("");
            let save_path = file_ref["savePath"].as_str().unwrap_or(file);
            let full_path = Path::new(&target_folder).join(save_path);
            let exists = full_path.exists();
            let size = if exists {
                std::fs::metadata(&full_path).ok().map(|m| m.len())
            } else {
                None
            };
            let verified = if exists { is_file_verified(&full_path) } else { false };
            let expected_size = if exists { get_verified_expected_size(&full_path) } else { None };
            serde_json::json!({
                "file": file,
                "savePath": save_path,
                "exists": exists,
                "size": size,
                "verified": verified,
                "expectedSize": expected_size
            })
        })
        .collect();

    Ok(results)
}

#[tauri::command]
pub async fn models_verify_file(
    state: State<'_, AppState>,
    group_id: String,
    file_path: String,
) -> Result<serde_json::Value, String> {
    let models_folder = state
        .weights_folder
        .lock()
        .unwrap()
        .clone()
        .unwrap_or_else(|| state::get_default_models_folder().to_string_lossy().to_string());

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

    let group_folder = group["folder"].as_str().unwrap_or_else(|| {
        group["name"].as_str().unwrap_or(&group_id)
    });
    let target_folder = Path::new(&models_folder)
        .join(group_folder)
        .to_string_lossy()
        .to_string();

    let hf_file = hf_files
        .iter()
        .find(|f| {
            let file = f["file"].as_str().unwrap_or("");
            let save_path = f["savePath"].as_str().unwrap_or(file);
            save_path == file_path || file == file_path
        })
        .ok_or("File not found in group")?;

    let repo = hf_file["repo"].as_str().unwrap_or("");
    let file = hf_file["file"].as_str().unwrap_or("");
    let save_path = hf_file["savePath"].as_str().unwrap_or(file);
    let full_path = Path::new(&target_folder).join(save_path);

    if !full_path.exists() {
        return Err("File does not exist".to_string());
    }

    let mirror = state.hf_mirror_id.lock().unwrap().clone();
    let download_config = state.download_config.lock().unwrap().clone();
    let hf_api = create_hf_api(&models_folder, &mirror, &download_config)?;
    let expected_size = get_remote_file_size(&hf_api, repo, file).await?;

    let actual_size = std::fs::metadata(&full_path)
        .map_err(|e| e.to_string())?
        .len();

    if actual_size != expected_size {
        return Err(format!(
            "File size mismatch: expected {} bytes, got {} bytes",
            expected_size, actual_size
        ));
    }

    mark_file_verified(&full_path, expected_size)?;

    Ok(serde_json::json!({
        "success": true,
        "expectedSize": expected_size,
        "actualSize": actual_size
    }))
}

#[tauri::command]
pub async fn models_delete_file(
    state: State<'_, AppState>,
    group_id: String,
    file_path: String,
) -> Result<bool, String> {
    let models_folder = state
        .weights_folder
        .lock()
        .unwrap()
        .clone()
        .unwrap_or_else(|| state::get_default_models_folder().to_string_lossy().to_string());

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

    let group_folder = group["folder"].as_str().unwrap_or_else(|| {
        group["name"].as_str().unwrap_or(&group_id)
    });
    let target_folder = Path::new(&models_folder)
        .join(group_folder)
        .to_string_lossy()
        .to_string();

    let full_path = Path::new(&target_folder).join(&file_path);

    if !full_path.exists() {
        return Ok(true);
    }

    let verified_path = get_verified_path(&full_path);
    if verified_path.exists() {
        std::fs::remove_file(&verified_path).map_err(|e| e.to_string())?;
    }

    std::fs::remove_file(&full_path).map_err(|e| e.to_string())?;

    Ok(true)
}

#[tauri::command]
pub async fn models_clear_verified(
    state: State<'_, AppState>,
    group_id: String,
) -> Result<bool, String> {
    let models_folder = state
        .weights_folder
        .lock()
        .unwrap()
        .clone()
        .unwrap_or_else(|| state::get_default_models_folder().to_string_lossy().to_string());

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

    let group_folder = group["folder"].as_str().unwrap_or_else(|| {
        group["name"].as_str().unwrap_or(&group_id)
    });
    let target_folder = Path::new(&models_folder)
        .join(group_folder)
        .to_string_lossy()
        .to_string();

    for file_ref in hf_files {
        let file = file_ref["file"].as_str().unwrap_or("");
        let save_path = file_ref["savePath"].as_str().unwrap_or(file);
        let full_path = Path::new(&target_folder).join(save_path);
        
        let verified_path = get_verified_path(&full_path);
        if verified_path.exists() {
            std::fs::remove_file(&verified_path).map_err(|e| e.to_string())?;
        }
    }

    Ok(true)
}
