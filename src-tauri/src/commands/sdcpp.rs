use crate::state::{self, AppState};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;
use tokio::time::{timeout, Duration};

use super::weights::WeightFile;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SDCppRelease {
    pub tag_name: String,
    pub name: String,
    pub published_at: String,
    pub assets: Vec<SDCppReleaseAsset>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SDCppReleaseAsset {
    pub name: String,
    pub size: u64,
    pub download_url: String,
    pub device_type: String,
    pub cpu_variant: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MirrorSource {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub mirror_type: String,
    pub url: String,
    pub proxy_api: bool,
    pub builtin: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MirrorTestResult {
    pub mirror_id: String,
    pub latency: Option<f64>,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SDCppDownloadProgress {
    pub stage: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed: f64,
    pub file_name: String,
    pub error: Option<String>,
}

/// Initialize default SD.cpp folder
#[tauri::command]
pub async fn sdcpp_init_default_folder(state: State<'_, AppState>) -> Result<String, String> {
    let folder = state::get_default_sdcpp_folder();
    if !folder.exists() {
        std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    }
    let path_str = folder.to_string_lossy().to_string();
    *state.sdcpp_folder.lock().unwrap() = Some(path_str.clone());
    Ok(path_str)
}

/// Get the SD.cpp engine folder
#[tauri::command]
pub async fn sdcpp_get_folder(state: State<'_, AppState>) -> Result<Option<String>, String> {
    Ok(state.sdcpp_folder.lock().unwrap().clone())
}

/// Check if a folder exists
#[tauri::command]
pub async fn sdcpp_check_folder(value: String) -> Result<bool, String> {
    Ok(Path::new(&value).is_dir())
}

/// Set the SD.cpp engine folder path
#[tauri::command]
pub async fn sdcpp_set_folder(value: String, state: State<'_, AppState>) -> Result<bool, String> {
    let path = Path::new(&value);
    if !path.is_dir() {
        return Ok(false);
    }
    *state.sdcpp_folder.lock().unwrap() = Some(value);
    Ok(true)
}

/// Set the device type
#[tauri::command]
pub async fn sdcpp_set_device(value: String, state: State<'_, AppState>) -> Result<bool, String> {
    *state.sdcpp_device_type.lock().unwrap() = value;
    Ok(true)
}

/// Get the device type
#[tauri::command]
pub async fn sdcpp_get_device(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state.sdcpp_device_type.lock().unwrap().clone())
}

/// List files in the SD.cpp engine folder
#[tauri::command]
pub async fn sdcpp_list_files(
    folder: String,
    device_type: String,
) -> Result<serde_json::Value, String> {
    let device_folder = Path::new(&folder).join(&device_type);
    let mut files = Vec::new();

    if device_folder.is_dir() {
        let entries = std::fs::read_dir(&device_folder).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_file() {
                let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
                let modified = metadata
                    .modified()
                    .map(|t| {
                        t.duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as u64
                    })
                    .unwrap_or(0);

                files.push(WeightFile {
                    name: path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string(),
                    size: metadata.len(),
                    path: path.to_string_lossy().to_string(),
                    modified,
                });
            }
        }
    }

    // Try to get version from sd cli
    let version = get_sdcpp_version(&device_folder).await;

    Ok(serde_json::json!({
        "files": files,
        "version": version
    }))
}

async fn get_sdcpp_version(device_folder: &Path) -> Option<String> {
    let candidates: &[&str] = if cfg!(target_os = "windows") {
        &["sd.exe", "sd-cli.exe", "sd_server.exe", "sd-server.exe"]
    } else {
        &["sd", "sd-cli", "sd_server", "sd-server"]
    };

    for candidate in candidates {
        let exe_path = device_folder.join(candidate);
        if !exe_path.exists() {
            continue;
        }

        let output = timeout(
            Duration::from_secs(5),
            tokio::process::Command::new(&exe_path).arg("--version").output(),
        )
        .await
        .ok()?
        .ok()?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        let combined = format!("{}\n{}", stdout, stderr);

        if let Some(line) = extract_version_line(&combined) {
            return Some(line);
        }
    }

    for text_name in ["stable-diffusion.cpp.txt", "ggml.txt"] {
        let text_path = device_folder.join(text_name);
        if !text_path.exists() {
            continue;
        }
        if let Ok(content) = std::fs::read_to_string(text_path) {
            if let Some(line) = extract_version_line(&content) {
                return Some(line);
            }
        }
    }

    None
}

fn extract_version_line(content: &str) -> Option<String> {
    content
        .lines()
        .map(str::trim)
        .find(|line| {
            !line.is_empty()
                && (line.to_ascii_lowercase().contains("version")
                    || line.to_ascii_lowercase().contains("stable-diffusion.cpp")
                    || line.starts_with('v'))
        })
        .map(|line| line.to_string())
}

/// Export an engine file via save dialog
#[tauri::command]
pub async fn sdcpp_download_file(value: String, app: AppHandle) -> Result<bool, String> {
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

/// Delete an engine file
#[tauri::command]
pub async fn sdcpp_delete_file(value: String) -> Result<bool, String> {
    let path = Path::new(&value);
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Fetch releases from GitHub
#[tauri::command]
pub async fn sdcpp_fetch_releases(
    _mirror_id: Option<String>,
    count: Option<u32>,
) -> Result<Vec<SDCppRelease>, String> {
    let count = count.unwrap_or(5);
    let api_url = format!(
        "https://api.github.com/repos/leejet/stable-diffusion.cpp/releases?per_page={}",
        count
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&api_url)
        .header("User-Agent", "HelloUI")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let releases: Vec<serde_json::Value> = response.json().await.map_err(|e| e.to_string())?;

    let result: Vec<SDCppRelease> = releases
        .into_iter()
        .map(|r| {
            let assets: Vec<SDCppReleaseAsset> = r["assets"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .map(|a| {
                    let name = a["name"].as_str().unwrap_or("").to_string();
                    let device_type = classify_asset_device(&name);
                    let cpu_variant = classify_cpu_variant(&name);

                    SDCppReleaseAsset {
                        name,
                        size: a["size"].as_u64().unwrap_or(0),
                        download_url: a["browser_download_url"]
                            .as_str()
                            .unwrap_or("")
                            .to_string(),
                        device_type,
                        cpu_variant,
                    }
                })
                .filter(|asset| is_asset_compatible_with_current_system(asset))
                .collect();

            SDCppRelease {
                tag_name: r["tag_name"].as_str().unwrap_or("").to_string(),
                name: r["name"].as_str().unwrap_or("").to_string(),
                published_at: r["published_at"].as_str().unwrap_or("").to_string(),
                assets,
            }
        })
        .filter(|release| !release.assets.is_empty())
        .collect();

    Ok(result)
}

fn is_asset_compatible_with_current_system(asset: &SDCppReleaseAsset) -> bool {
    let lower = asset.name.to_ascii_lowercase();

    if !is_platform_compatible(&lower) {
        return false;
    }

    if !is_arch_compatible(&lower) {
        return false;
    }

    if asset.device_type == "cpu" && !is_cpu_variant_supported(asset.cpu_variant.as_deref()) {
        return false;
    }

    true
}

fn is_platform_compatible(asset_name: &str) -> bool {
    let mentions_windows = asset_name.contains("win") || asset_name.contains("windows");
    let mentions_linux = asset_name.contains("linux") || asset_name.contains("ubuntu");
    let mentions_macos = asset_name.contains("mac") || asset_name.contains("darwin") || asset_name.contains("osx");

    if !(mentions_windows || mentions_linux || mentions_macos) {
        return true;
    }

    (cfg!(target_os = "windows") && mentions_windows)
        || (cfg!(target_os = "linux") && mentions_linux)
        || (cfg!(target_os = "macos") && mentions_macos)
}

fn is_arch_compatible(asset_name: &str) -> bool {
    let mentions_x64 = asset_name.contains("x64") || asset_name.contains("x86_64") || asset_name.contains("amd64");
    let mentions_arm64 = asset_name.contains("arm64") || asset_name.contains("aarch64");
    let mentions_x86 = asset_name.contains("x86") || asset_name.contains("i686") || asset_name.contains("386");

    if !(mentions_x64 || mentions_arm64 || mentions_x86) {
        return true;
    }

    match std::env::consts::ARCH {
        "x86_64" => mentions_x64,
        "aarch64" => mentions_arm64,
        "x86" => mentions_x86,
        _ => true,
    }
}

fn is_cpu_variant_supported(cpu_variant: Option<&str>) -> bool {
    match cpu_variant {
        None => true,
        Some("noavx") => true,
        Some("avx") => {
            #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
            {
                std::is_x86_feature_detected!("avx")
            }
            #[cfg(not(any(target_arch = "x86", target_arch = "x86_64")))]
            {
                true
            }
        }
        Some("avx2") => {
            #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
            {
                std::is_x86_feature_detected!("avx2")
            }
            #[cfg(not(any(target_arch = "x86", target_arch = "x86_64")))]
            {
                true
            }
        }
        Some("avx512") => {
            #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
            {
                std::is_x86_feature_detected!("avx512f")
            }
            #[cfg(not(any(target_arch = "x86", target_arch = "x86_64")))]
            {
                true
            }
        }
        Some(_) => true,
    }
}

fn classify_asset_device(name: &str) -> String {
    let lower = name.to_lowercase();
    if lower.contains("cuda") && !lower.contains("cudart") {
        "cuda".to_string()
    } else if lower.contains("cudart") {
        "cudart".to_string()
    } else if lower.contains("vulkan") {
        "vulkan".to_string()
    } else if lower.contains("cpu")
        || lower.contains("avx")
        || lower.contains("noavx")
        || lower.ends_with(".zip")
    {
        "cpu".to_string()
    } else {
        "unknown".to_string()
    }
}

fn classify_cpu_variant(name: &str) -> Option<String> {
    let lower = name.to_lowercase();
    if lower.contains("avx512") {
        Some("avx512".to_string())
    } else if lower.contains("avx2") {
        Some("avx2".to_string())
    } else if lower.contains("noavx") {
        Some("noavx".to_string())
    } else if lower.contains("avx") {
        Some("avx".to_string())
    } else {
        None
    }
}

/// Download and install an engine
#[tauri::command]
pub async fn sdcpp_download_engine(
    asset: SDCppReleaseAsset,
    _release: SDCppRelease,
    _mirror_id: Option<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let sdcpp_folder = state
        .sdcpp_folder
        .lock()
        .unwrap()
        .clone()
        .ok_or("SD.cpp folder not set")?;

    let device_folder = Path::new(&sdcpp_folder).join(&asset.device_type);
    std::fs::create_dir_all(&device_folder).map_err(|e| e.to_string())?;

    let download_url = asset.download_url.clone();
    let zip_path = device_folder.join(&asset.name);

    // Download the file
    let client = reqwest::Client::new();
    let response = client
        .get(&download_url)
        .header("User-Agent", "HelloUI")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let total_bytes = response.content_length().unwrap_or(0);
    let mut downloaded_bytes: u64 = 0;

    let mut file = std::fs::File::create(&zip_path).map_err(|e| e.to_string())?;

    use futures::StreamExt;
    use std::io::Write;
    let mut stream = response.bytes_stream();
    let start_time = std::time::Instant::now();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded_bytes += chunk.len() as u64;

        let elapsed = start_time.elapsed().as_secs_f64();
        let speed = if elapsed > 0.0 {
            downloaded_bytes as f64 / elapsed
        } else {
            0.0
        };

        let _ = app.emit(
            "sdcpp:download-progress",
            SDCppDownloadProgress {
                stage: "downloading".to_string(),
                downloaded_bytes,
                total_bytes,
                speed,
                file_name: asset.name.clone(),
                error: None,
            },
        );
    }

    drop(file);

    // Extract the ZIP
    let _ = app.emit(
        "sdcpp:download-progress",
        SDCppDownloadProgress {
            stage: "extracting".to_string(),
            downloaded_bytes: total_bytes,
            total_bytes,
            speed: 0.0,
            file_name: asset.name.clone(),
            error: None,
        },
    );

    extract_zip(&zip_path, &device_folder)?;

    // Clean up the zip file
    let _ = std::fs::remove_file(&zip_path);

    let _ = app.emit(
        "sdcpp:download-progress",
        SDCppDownloadProgress {
            stage: "done".to_string(),
            downloaded_bytes: total_bytes,
            total_bytes,
            speed: 0.0,
            file_name: asset.name.clone(),
            error: None,
        },
    );

    Ok(serde_json::json!({ "success": true }))
}

fn extract_zip(zip_path: &Path, dest: &Path) -> Result<(), String> {
    let file = std::fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let out_path = dest.join(entry.mangled_name());

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut outfile = std::fs::File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut outfile).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

/// Cancel engine download
#[tauri::command]
pub async fn sdcpp_cancel_download(state: State<'_, AppState>) -> Result<bool, String> {
    if let Some(cancel) = state.download_cancel.lock().unwrap().take() {
        let _ = cancel.send(true);
    }
    Ok(true)
}

/// Get list of mirror sources (internal helper)
fn get_mirrors_list() -> Result<Vec<MirrorSource>, String> {
    let builtin_mirrors = vec![
        MirrorSource {
            id: "github".to_string(),
            name: "GitHub (Official)".to_string(),
            mirror_type: "github".to_string(),
            url: "https://github.com".to_string(),
            proxy_api: false,
            builtin: true,
        },
        MirrorSource {
            id: "ghfast".to_string(),
            name: "GHFast".to_string(),
            mirror_type: "proxy".to_string(),
            url: "https://ghfast.top".to_string(),
            proxy_api: false,
            builtin: true,
        },
    ];

    let mut mirrors = builtin_mirrors;
    let custom_path = state::get_run_path().join("custom-mirrors.json");
    if custom_path.exists() {
        if let Ok(data) = std::fs::read_to_string(&custom_path) {
            if let Ok(custom) = serde_json::from_str::<Vec<MirrorSource>>(&data) {
                mirrors.extend(custom);
            }
        }
    }

    Ok(mirrors)
}

/// Get mirror sources
#[tauri::command]
pub async fn sdcpp_get_mirrors() -> Result<Vec<MirrorSource>, String> {
    get_mirrors_list()
}

/// Add a custom mirror source
#[tauri::command]
pub async fn sdcpp_add_mirror(
    name: String,
    mirror_type: String,
    url: String,
    proxy_api: bool,
) -> Result<MirrorSource, String> {
    let mirror = MirrorSource {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        mirror_type,
        url,
        proxy_api,
        builtin: false,
    };

    let custom_path = state::get_run_path().join("custom-mirrors.json");
    let mut mirrors: Vec<MirrorSource> = if custom_path.exists() {
        let data = std::fs::read_to_string(&custom_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };

    mirrors.push(mirror.clone());
    let json = serde_json::to_string_pretty(&mirrors).map_err(|e| e.to_string())?;
    std::fs::write(&custom_path, json).map_err(|e| e.to_string())?;

    Ok(mirror)
}

/// Remove a custom mirror source
#[tauri::command]
pub async fn sdcpp_remove_mirror(value: String) -> Result<bool, String> {
    let custom_path = state::get_run_path().join("custom-mirrors.json");
    if !custom_path.exists() {
        return Ok(false);
    }

    let data = std::fs::read_to_string(&custom_path).map_err(|e| e.to_string())?;
    let mut mirrors: Vec<MirrorSource> = serde_json::from_str(&data).unwrap_or_default();
    let original_len = mirrors.len();
    mirrors.retain(|m| m.id != value);

    if mirrors.len() < original_len {
        let json = serde_json::to_string_pretty(&mirrors).map_err(|e| e.to_string())?;
        std::fs::write(&custom_path, json).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Test all mirrors for latency
#[tauri::command]
pub async fn sdcpp_test_mirrors() -> Result<Vec<MirrorTestResult>, String> {
    let mirrors = get_mirrors_list()?;
    let mut results = Vec::new();

    for mirror in &mirrors {
        let test_url = if mirror.mirror_type == "github" {
            "https://api.github.com".to_string()
        } else {
            mirror.url.clone()
        };

        let start = std::time::Instant::now();
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?;

        match client.head(&test_url).send().await {
            Ok(_) => {
                let latency = start.elapsed().as_millis() as f64;
                results.push(MirrorTestResult {
                    mirror_id: mirror.id.clone(),
                    latency: Some(latency),
                    success: true,
                    error: None,
                });
            }
            Err(e) => {
                results.push(MirrorTestResult {
                    mirror_id: mirror.id.clone(),
                    latency: None,
                    success: false,
                    error: Some(e.to_string()),
                });
            }
        }
    }

    Ok(results)
}

/// Auto-select the fastest mirror
#[tauri::command]
pub async fn sdcpp_auto_select_mirror() -> Result<MirrorSource, String> {
    let mirrors = get_mirrors_list()?;
    let results = sdcpp_test_mirrors().await?;

    let best = results
        .iter()
        .filter(|r| r.success)
        .min_by(|a, b| {
            a.latency
                .unwrap_or(f64::MAX)
                .partial_cmp(&b.latency.unwrap_or(f64::MAX))
                .unwrap_or(std::cmp::Ordering::Equal)
        });

    match best {
        Some(result) => mirrors
            .into_iter()
            .find(|m| m.id == result.mirror_id)
            .ok_or("No matching mirror found".to_string()),
        None => Err("All mirrors failed".to_string()),
    }
}
