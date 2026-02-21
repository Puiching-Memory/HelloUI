use crate::state::{self, AppState, DownloadConfig};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncSeekExt, AsyncWriteExt};
use tokio::sync::Semaphore;

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

struct DownloadState {
    downloaded: AtomicU64,
    total: u64,
    start_time: std::time::Instant,
}

async fn download_chunk(
    client: &reqwest::Client,
    url: &str,
    dest_path: &std::path::Path,
    start: u64,
    end: u64,
    download_state: Arc<DownloadState>,
    cancel_rx: tokio::sync::watch::Receiver<bool>,
) -> Result<(), String> {
    let range = format!("bytes={}-{}", start, end);
    let response = client
        .get(url)
        .header("Range", range)
        .header("User-Agent", "HelloUI")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() && response.status() != reqwest::StatusCode::PARTIAL_CONTENT
    {
        return Err(format!("HTTP {}: chunk download failed", response.status()));
    }

    let mut stream = response.bytes_stream();
    let mut file = tokio::fs::OpenOptions::new()
        .write(true)
        .open(dest_path)
        .await
        .map_err(|e| e.to_string())?;

    file.seek(tokio::io::SeekFrom::Start(start))
        .await
        .map_err(|e| e.to_string())?;

    let mut cancel_rx = cancel_rx;

    loop {
        if *cancel_rx.borrow() {
            return Err("cancelled".to_string());
        }

        tokio::select! {
            chunk = stream.next() => {
                match chunk {
                    Some(Ok(data)) => {
                        file.write_all(&data).await.map_err(|e| e.to_string())?;
                        download_state.downloaded.fetch_add(data.len() as u64, Ordering::SeqCst);
                    }
                    Some(Err(e)) => {
                        return Err(e.to_string());
                    }
                    None => break,
                }
            }
            _ = cancel_rx.changed() => {
                return Err("cancelled".to_string());
            }
        }
    }

    file.flush().await.map_err(|e| e.to_string())?;
    Ok(())
}

fn get_resume_position(part_path: &std::path::Path, total_size: u64) -> u64 {
    if !part_path.exists() {
        return 0;
    }

    if let Ok(metadata) = std::fs::metadata(part_path) {
        let size = metadata.len();
        if size > 8 && size == total_size + 8 {
            if let Ok(mut file) = std::fs::File::open(part_path) {
                use std::io::{Read, Seek, SeekFrom};
                if file.seek(SeekFrom::Start(total_size)).is_ok() {
                    let mut buf = [0u8; 8];
                    if file.read_exact(&mut buf).is_ok() {
                        return u64::from_le_bytes(buf);
                    }
                }
            }
        }
    }
    0
}

fn save_resume_position(part_path: &std::path::Path, position: u64, total_size: u64) -> Result<(), String> {
    use std::io::{Seek, SeekFrom, Write};
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .open(part_path)
        .map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(total_size))
        .map_err(|e| e.to_string())?;
    file.write_all(&position.to_le_bytes())
        .map_err(|e| e.to_string())?;
    file.flush().map_err(|e| e.to_string())?;
    Ok(())
}

async fn download_file_parallel(
    app: &AppHandle,
    client: &reqwest::Client,
    url: &str,
    dest_path: &std::path::Path,
    file_name: &str,
    total_files: u32,
    current_file_index: u32,
    cancel_rx: tokio::sync::watch::Receiver<bool>,
    config: &DownloadConfig,
) -> Result<(), String> {
    let head_response = client
        .head(url)
        .header("User-Agent", "HelloUI")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !head_response.status().is_success() {
        return Err(format!(
            "HTTP {}: HEAD request failed for {}",
            head_response.status(),
            url
        ));
    }

    let total_bytes = head_response
        .content_length()
        .ok_or("Cannot determine file size")?;

    let accepts_range = head_response
        .headers()
        .get("accept-ranges")
        .map(|v| v.to_str().unwrap_or("") == "bytes")
        .unwrap_or(false);

    let part_path = dest_path.with_extension("part");
    let chunk_size_bytes = (config.chunk_size_mb * 1024 * 1024) as u64;

    if !accepts_range || total_bytes < chunk_size_bytes {
        return download_file_sequential(
            app,
            client,
            url,
            dest_path,
            file_name,
            total_files,
            current_file_index,
            cancel_rx,
        )
        .await;
    }

    let resume_pos = get_resume_position(&part_path, total_bytes);
    if resume_pos > 0 {
        let _ = app.emit(
            "models:download-progress",
            ModelDownloadProgress {
                stage: "resuming".to_string(),
                downloaded_bytes: resume_pos,
                total_bytes,
                speed: 0.0,
                file_name: file_name.to_string(),
                total_files,
                current_file_index,
                error: None,
            },
        );
    }

    if resume_pos >= total_bytes {
        std::fs::rename(&part_path, dest_path).map_err(|e| e.to_string())?;
        return Ok(());
    }

    if resume_pos == 0 && part_path.exists() {
        std::fs::remove_file(&part_path).ok();
    }

    if !part_path.exists() {
        let file = std::fs::File::create(&part_path).map_err(|e| e.to_string())?;
        file.set_len(total_bytes + 8)
            .map_err(|e| e.to_string())?;
    }

    let download_state = Arc::new(DownloadState {
        downloaded: AtomicU64::new(resume_pos),
        total: total_bytes,
        start_time: std::time::Instant::now(),
    });

    let semaphore = Arc::new(Semaphore::new(config.max_concurrent_chunks));
    let mut handles = Vec::new();

    let mut current_pos = resume_pos;

    while current_pos < total_bytes {
        let start = current_pos;
        let end = std::cmp::min(start + chunk_size_bytes - 1, total_bytes - 1);

        let permit = semaphore.clone().acquire_owned().await.map_err(|e| e.to_string())?;
        let client = client.clone();
        let url = url.to_string();
        let dest_path = dest_path.to_path_buf();
        let state = download_state.clone();
        let cancel = cancel_rx.clone();

        let handle = tokio::spawn(async move {
            let result =
                download_chunk(&client, &url, &dest_path, start, end, state, cancel).await;
            drop(permit);
            result
        });

        handles.push(handle);
        current_pos = end + 1;
    }

    let progress_handle = {
        let app = app.clone();
        let state = download_state.clone();
        let file_name = file_name.to_string();
        let cancel = cancel_rx.clone();

        tokio::spawn(async move {
            let mut last_downloaded = resume_pos;
            loop {
                if *cancel.borrow() {
                    break;
                }

                let downloaded = state.downloaded.load(Ordering::SeqCst);
                if downloaded != last_downloaded {
                    let elapsed = state.start_time.elapsed().as_secs_f64();
                    let speed = if elapsed > 0.0 {
                        downloaded as f64 / elapsed
                    } else {
                        0.0
                    };

                    let _ = app.emit(
                        "models:download-progress",
                        ModelDownloadProgress {
                            stage: "downloading".to_string(),
                            downloaded_bytes: downloaded,
                            total_bytes: state.total,
                            speed,
                            file_name: file_name.clone(),
                            total_files,
                            current_file_index,
                            error: None,
                        },
                    );

                    last_downloaded = downloaded;
                }

                if downloaded >= state.total {
                    break;
                }

                tokio::time::sleep(std::time::Duration::from_millis(200)).await;
            }
        })
    };

    let mut last_committed = resume_pos;

    for handle in handles {
        match handle.await {
            Ok(Ok(())) => {}
            Ok(Err(e)) => {
                if e == "cancelled" {
                    let downloaded = download_state.downloaded.load(Ordering::SeqCst);
                    save_resume_position(&part_path, downloaded, total_bytes).ok();
                    return Err("cancelled".to_string());
                }
                return Err(e);
            }
            Err(e) => return Err(e.to_string()),
        }

        let downloaded = download_state.downloaded.load(Ordering::SeqCst);
        if downloaded > last_committed {
            save_resume_position(&part_path, downloaded, total_bytes).ok();
            last_committed = downloaded;
        }
    }

    progress_handle.abort();

    let mut file = tokio::fs::OpenOptions::new()
        .write(true)
        .open(&part_path)
        .await
        .map_err(|e| e.to_string())?;
    file.set_len(total_bytes).await.map_err(|e| e.to_string())?;
    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);

    tokio::fs::rename(&part_path, dest_path)
        .await
        .map_err(|e| e.to_string())?;

    let actual_size = tokio::fs::metadata(dest_path)
        .await
        .map_err(|e| e.to_string())?
        .len();
    if actual_size != total_bytes {
        tokio::fs::remove_file(dest_path).await.ok();
        return Err(format!(
            "文件大小不匹配: 期望 {} 字节, 实际 {} 字节。下载可能不完整，请重试。",
            total_bytes, actual_size
        ));
    }

    mark_file_verified(dest_path, total_bytes)?;

    Ok(())
}

async fn download_file_sequential(
    app: &AppHandle,
    client: &reqwest::Client,
    url: &str,
    dest_path: &std::path::Path,
    file_name: &str,
    total_files: u32,
    current_file_index: u32,
    cancel_rx: tokio::sync::watch::Receiver<bool>,
) -> Result<(), String> {
    let response = client
        .get(url)
        .header("User-Agent", "HelloUI")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}: download failed\nURL: {}", response.status(), url));
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let mut downloaded_bytes: u64 = 0;
    let mut out_file = tokio::fs::File::create(dest_path)
        .await
        .map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();
    let start_time = std::time::Instant::now();
    let mut last_emit = std::time::Instant::now();
    let mut cancel_rx = cancel_rx;

    if *cancel_rx.borrow() {
        tokio::fs::remove_file(dest_path).await.ok();
        return Err("cancelled".to_string());
    }

    loop {
        tokio::select! {
            chunk = stream.next() => {
                match chunk {
                    Some(Ok(data)) => {
                        out_file.write_all(&data).await.map_err(|e| e.to_string())?;
                        downloaded_bytes += data.len() as u64;

                        // Throttle progress events to avoid overwhelming the WebView message queue
                        let now = std::time::Instant::now();
                        if now.duration_since(last_emit) >= std::time::Duration::from_millis(200)
                            || downloaded_bytes >= total_bytes
                        {
                            let elapsed = start_time.elapsed().as_secs_f64();
                            let speed = if elapsed > 0.0 { downloaded_bytes as f64 / elapsed } else { 0.0 };

                            let _ = app.emit("models:download-progress", ModelDownloadProgress {
                                stage: "downloading".to_string(),
                                downloaded_bytes,
                                total_bytes,
                                speed,
                                file_name: file_name.to_string(),
                                total_files,
                                current_file_index,
                                error: None,
                            });
                            last_emit = now;
                        }
                    }
                    Some(Err(e)) => {
                        return Err(e.to_string());
                    }
                    None => break,
                }
            }
            _ = cancel_rx.changed() => {
                drop(out_file);
                tokio::fs::remove_file(dest_path).await.ok();
                return Err("cancelled".to_string());
            }
        }
    }

    out_file.flush().await.map_err(|e| e.to_string())?;
    drop(out_file);

    if total_bytes > 0 {
        let actual_size = tokio::fs::metadata(dest_path)
            .await
            .map_err(|e| e.to_string())?
            .len();
        if actual_size != total_bytes {
            tokio::fs::remove_file(dest_path).await.ok();
            return Err(format!(
                "文件大小不匹配: 期望 {} 字节, 实际 {} 字节。下载可能不完整，请重试。",
                total_bytes, actual_size
            ));
        }
        mark_file_verified(dest_path, total_bytes)?;
    }

    Ok(())
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
    let base_url = match mirror.as_str() {
        "hf-mirror" => "https://hf-mirror.com",
        _ => "https://huggingface.co",
    };

    let (cancel_tx, cancel_rx) = tokio::sync::watch::channel(false);
    *state.download_cancel.lock().unwrap() = Some(cancel_tx);

    let client = reqwest::Client::new();
    let total_files = hf_files.len() as u32;
    let download_config = state.download_config.lock().unwrap().clone();

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

        let url = format!("{}/{}/resolve/main/{}", base_url, repo, file);

        if *cancel_rx.borrow() {
            return Ok(serde_json::json!({ "success": false, "error": "cancelled" }));
        }

        let result = download_file_parallel(
            &app,
            &client,
            &url,
            &dest_path,
            file,
            total_files,
            (index + 1) as u32,
            cancel_rx.clone(),
            &download_config,
        )
        .await;

        std::fs::remove_file(&lock_path).ok();

        if let Err(e) = result {
            if e == "cancelled" {
                return Ok(serde_json::json!({ "success": false, "error": "cancelled" }));
            }
            return Err(e);
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
    let base_url = match mirror.as_str() {
        "hf-mirror" => "https://hf-mirror.com",
        _ => "https://huggingface.co",
    };

    let url = format!("{}/{}/resolve/main/{}", base_url, repo, file);

    let client = reqwest::Client::new();
    
    let expected_size = {
        let head_response = client
            .head(&url)
            .header("User-Agent", "HelloUI")
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        if let Some(size) = head_response.headers().get("content-length") {
            size.to_str()
                .map_err(|_| "Invalid content-length header")?
                .parse::<u64>()
                .map_err(|_| "Failed to parse content-length")?
        } else {
            let range_response = client
                .get(&url)
                .header("User-Agent", "HelloUI")
                .header("Range", "bytes=0-0")
                .send()
                .await
                .map_err(|e| format!("HTTP request failed: {}", e))?;

            if let Some(content_range) = range_response.headers().get("content-range") {
                let range_str = content_range.to_str()
                    .map_err(|_| "Invalid content-range header")?;
                if let Some(total_size) = range_str.split('/').nth(1) {
                    total_size.parse::<u64>()
                        .map_err(|_| "Failed to parse content-range")?
                } else {
                    return Err("Cannot determine file size from content-range".to_string());
                }
            } else {
                return Err("Cannot determine expected file size".to_string());
            }
        }
    };

    let actual_size = std::fs::metadata(&full_path)
        .map_err(|e| e.to_string())?
        .len();

    if actual_size != expected_size {
        return Err(format!(
            "文件大小不匹配: 期望 {} 字节, 实际 {} 字节",
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
