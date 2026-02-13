use crate::state::{self, AppState};
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GenerateProgress {
    pub progress: serde_json::Value,
    pub image: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CliOutput {
    #[serde(rename = "type")]
    pub output_type: String,
    pub text: String,
}

fn resolve_sdcpp_executable(device_folder: &Path) -> Option<std::path::PathBuf> {
    let candidates: &[&str] = if cfg!(target_os = "windows") {
        &["sd.exe", "sd-cli.exe", "sd_server.exe", "sd-server.exe"]
    } else {
        &["sd", "sd-cli", "sd_server", "sd-server"]
    };

    candidates
        .iter()
        .map(|name| device_folder.join(name))
        .find(|path| path.exists())
}

fn resolve_model_path_with_fallback(model_path: &str, primary_base_folder: &str) -> String {
    let path = Path::new(model_path);
    if path.is_absolute() {
        return model_path.to_string();
    }

    let mut base_candidates: Vec<PathBuf> = Vec::new();
    if !primary_base_folder.trim().is_empty() {
        base_candidates.push(PathBuf::from(primary_base_folder));
    }

    if let Ok(current_dir) = std::env::current_dir() {
        base_candidates.push(current_dir.join("models"));
    }

    let workspace_models = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.join("models"));
    if let Some(workspace_models) = workspace_models {
        base_candidates.push(workspace_models);
    }

    for base in base_candidates {
        let candidate = base.join(model_path);
        if candidate.exists() {
            // Use 'dunce' to canonicalize without the Windows UNC prefix (\\?\)
            if let Ok(canonical) = dunce::canonicalize(&candidate) {
                return canonical.to_string_lossy().to_string();
            }
            return candidate.to_string_lossy().to_string();
        }
    }

    state::resolve_model_path(model_path, primary_base_folder)
}

/// Start image generation
#[tauri::command]
pub async fn generate_start(
    value: serde_json::Value,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let device_type = value["deviceType"].as_str().unwrap_or("cpu");
    let prompt = value["prompt"].as_str().unwrap_or("");

    // Get SD.cpp executable path
    let sdcpp_folder = state
        .sdcpp_folder
        .lock()
        .unwrap()
        .clone()
        .ok_or("SD.cpp folder not set")?;

    let device_folder = Path::new(&sdcpp_folder).join(device_type);
    let exe_path = resolve_sdcpp_executable(&device_folder).ok_or_else(|| {
        format!(
            "SD.cpp executable not found in: {} (expected one of: sd/sd-cli/sd_server/sd-server)",
            device_folder.display()
        )
    })?;

    // Get output path
    let outputs_folder = state
        .outputs_folder
        .lock()
        .unwrap()
        .clone()
        .unwrap_or_else(|| state::get_default_outputs_folder().to_string_lossy().to_string());

    std::fs::create_dir_all(&outputs_folder).map_err(|e| e.to_string())?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let output_path = Path::new(&outputs_folder).join(format!("generated_{}.png", timestamp));

    // Build CLI arguments
    let args = build_generate_args(&value, &state, &output_path)?;

    // Set up cancellation
    let (cancel_tx, mut cancel_rx) = tokio::sync::watch::channel(false);
    *state.generate_cancel.lock().unwrap() = Some(cancel_tx);

    // Preview image handling
    let preview_path = output_path.with_extension("preview.png");

    // Spawn process
    let mut child = tokio::process::Command::new(&exe_path)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to start process: {}", e))?;

    let stderr_lines: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
    let stdout_lines: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));

    let pid = child.id();

    // Setup preview watcher
    let preview_path_clone = preview_path.clone();
    let app_clone = app.clone();
    let preview_task = tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(500));
        loop {
            interval.tick().await;
            if preview_path_clone.exists() {
                if let Ok(data) = tokio::fs::read(&preview_path_clone).await {
                    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                    let data_url = format!("data:image/png;base64,{}", b64);
                    let _ = app_clone.emit("generate:preview-update", serde_json::json!({
                        "previewImage": data_url
                    }));
                }
            }
        }
    });

    // Read stdout
    let stdout = child.stdout.take();
    let app_stdout = app.clone();
    let stdout_lines_clone = Arc::clone(&stdout_lines);
    let stdout_task = tokio::spawn(async move {
        if let Some(stdout) = stdout {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                // Parse progress from stdout
                if line.contains('%') || line.contains("step") || line.contains("Step") {
                    let _ = app_stdout.emit(
                        "generate:progress",
                        GenerateProgress {
                            progress: serde_json::json!(line.clone()),
                            image: None,
                        },
                    );
                }

                let _ = app_stdout.emit(
                    "generate:cli-output",
                    CliOutput {
                        output_type: "stdout".to_string(),
                        text: line.clone(),
                    },
                );

                if let Ok(mut captured) = stdout_lines_clone.lock() {
                    captured.push(line);
                    if captured.len() > 200 {
                        captured.drain(0..100);
                    }
                }
            }
        }
    });

    // Read stderr
    let stderr = child.stderr.take();
    let app_stderr = app.clone();
    let stderr_lines_clone = Arc::clone(&stderr_lines);
    let stderr_task = tokio::spawn(async move {
        if let Some(stderr) = stderr {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                // stderr also contains progress info for sd.cpp
                if line.contains('%') || line.contains("step") || line.contains("Step") {
                    let _ = app_stderr.emit(
                        "generate:progress",
                        GenerateProgress {
                            progress: serde_json::json!(line.clone()),
                            image: None,
                        },
                    );
                }

                let _ = app_stderr.emit(
                    "generate:cli-output",
                    CliOutput {
                        output_type: "stderr".to_string(),
                        text: line.clone(),
                    },
                );

                if let Ok(mut captured) = stderr_lines_clone.lock() {
                    captured.push(line);
                    if captured.len() > 200 {
                        captured.drain(0..100);
                    }
                }
            }
        }
    });

    let start = std::time::Instant::now();

    // Wait for process completion or cancellation
    let exit_status = tokio::select! {
        status = child.wait() => status.map_err(|e| e.to_string())?,
        _ = cancel_rx.changed() => {
            // Kill process
            let _ = child.kill().await;
            if cfg!(target_os = "windows") {
                if let Some(pid) = pid {
                    let _ = tokio::process::Command::new("taskkill")
                        .args(&["/F", "/T", "/PID", &pid.to_string()])
                        .output()
                        .await;
                }
            }
            preview_task.abort();
            return Ok(serde_json::json!({
                "success": false,
                "error": "cancelled"
            }));
        }
    };

    let duration = start.elapsed().as_millis() as u64;

    // Stop preview watcher
    preview_task.abort();

    // Clean up preview file
    let _ = tokio::fs::remove_file(&preview_path).await;

    // Wait for output reading to complete
    let _ = stdout_task.await;
    let _ = stderr_task.await;

    if !exit_status.success() {
        let stderr_tail = stderr_lines
            .lock()
            .ok()
            .map(|lines| {
                lines
                    .iter()
                    .rev()
                    .take(10)
                    .cloned()
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rev()
                    .collect::<Vec<_>>()
                    .join("\\n")
            })
            .unwrap_or_default();
        let stdout_tail = stdout_lines
            .lock()
            .ok()
            .map(|lines| {
                lines
                    .iter()
                    .rev()
                    .take(10)
                    .cloned()
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rev()
                    .collect::<Vec<_>>()
                    .join("\\n")
            })
            .unwrap_or_default();

        let detail = if !stderr_tail.trim().is_empty() {
            stderr_tail
        } else {
            stdout_tail
        };

        return Ok(serde_json::json!({
            "success": false,
            "error": if detail.trim().is_empty() {
                format!("Process exited with code: {:?}", exit_status.code())
            } else {
                format!("Process exited with code: {:?}\\n{}", exit_status.code(), detail)
            }
        }));
    }

    // Read output image
    if output_path.exists() {
        let image_data = tokio::fs::read(&output_path)
            .await
            .map_err(|e| e.to_string())?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&image_data);
        let data_url = format!("data:image/png;base64,{}", b64);

        // Save metadata
        let metadata_path = output_path.with_extension("json");
        let metadata = serde_json::json!({
            "prompt": prompt,
            "negativePrompt": value.get("negativePrompt"),
            "steps": value.get("steps"),
            "cfgScale": value.get("cfgScale"),
            "width": value.get("width"),
            "height": value.get("height"),
            "seed": value.get("seed"),
            "samplingMethod": value.get("samplingMethod"),
            "scheduler": value.get("scheduler"),
            "deviceType": device_type,
            "groupId": value.get("groupId"),
            "type": "generate",
            "mediaType": "image",
            "duration": duration,
            "generatedAt": chrono::Utc::now().to_rfc3339(),
        });
        let _ = tokio::fs::write(
            &metadata_path,
            serde_json::to_string_pretty(&metadata).unwrap_or_default(),
        )
        .await;

        Ok(serde_json::json!({
            "success": true,
            "image": data_url,
            "imagePath": output_path.to_string_lossy(),
            "duration": duration
        }))
    } else {
        Ok(serde_json::json!({
            "success": false,
            "error": "Output image not found after generation"
        }))
    }
}

/// Cancel image generation
#[tauri::command]
pub async fn generate_cancel(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    if let Some(cancel) = state.generate_cancel.lock().unwrap().take() {
        let _ = cancel.send(true);
        Ok(serde_json::json!({ "success": true, "message": "Generation cancelled" }))
    } else {
        Ok(serde_json::json!({ "success": false, "error": "No generation in progress" }))
    }
}

fn build_generate_args(
    params: &serde_json::Value,
    state: &State<'_, AppState>,
    output_path: &Path,
) -> Result<Vec<String>, String> {
    let mut args = Vec::new();

    let weights_folder = state
        .weights_folder
        .lock()
        .unwrap()
        .clone()
        .unwrap_or_default();

    let mut model_paths_injected = false;
    // 独立扩散模型（如 Z-Image），使用 --diffusion-model
    if let Some(diff_model) = params["diffusionModel"].as_str() {
        if !diff_model.is_empty() {
            let resolved = resolve_model_path_with_fallback(diff_model, &weights_folder);
            args.push("--diffusion-model".to_string());
            args.push(resolved);
            model_paths_injected = true;
        }
    }
    // 完整 SD 模型，使用 -m
    if let Some(sd_model) = params["sdModel"].as_str() {
        if !sd_model.is_empty() {
            let resolved = resolve_model_path_with_fallback(sd_model, &weights_folder);
            args.push("-m".to_string());
            args.push(resolved);
            model_paths_injected = true;
        }
    }
    if let Some(vae) = params["vaeModel"].as_str() {
        if !vae.is_empty() {
            let resolved = resolve_model_path_with_fallback(vae, &weights_folder);
            args.push("--vae".to_string());
            args.push(resolved);
        }
    }
    if let Some(llm) = params["llmModel"].as_str() {
        if !llm.is_empty() {
            let resolved = resolve_model_path_with_fallback(llm, &weights_folder);
            args.push("--llm".to_string());
            args.push(resolved);
        }
    }
    if let Some(clip_l) = params["clipLModel"].as_str() {
        if !clip_l.is_empty() {
            let resolved = resolve_model_path_with_fallback(clip_l, &weights_folder);
            args.push("--clip_l".to_string());
            args.push(resolved);
        }
    }
    if let Some(t5xxl) = params["t5xxlModel"].as_str() {
        if !t5xxl.is_empty() {
            let resolved = resolve_model_path_with_fallback(t5xxl, &weights_folder);
            args.push("--t5xxl".to_string());
            args.push(resolved);
        }
    }

    // Model paths
    if !model_paths_injected {
        if let Some(group_id) = params["groupId"].as_str() {
        // Load model group to get model paths
        let groups_path = state::get_model_groups_path(Some(&weights_folder));
        if groups_path.exists() {
            let data = std::fs::read_to_string(&groups_path).map_err(|e| e.to_string())?;
            let groups: Vec<serde_json::Value> =
                serde_json::from_str(&data).map_err(|e| e.to_string())?;
            if let Some(group) = groups.iter().find(|g| g["id"].as_str() == Some(group_id)) {
                // 独立扩散模型（如 Z-Image）使用 --diffusion-model
                if let Some(diff_model) = group["diffusionModel"].as_str() {
                    if !diff_model.is_empty() {
                        let resolved = resolve_model_path_with_fallback(diff_model, &weights_folder);
                        args.push("--diffusion-model".to_string());
                        args.push(resolved);
                    }
                }
                // 完整 SD 模型使用 -m
                if let Some(sd_model) = group["sdModel"].as_str() {
                    let resolved = resolve_model_path_with_fallback(sd_model, &weights_folder);
                    args.push("-m".to_string());
                    args.push(resolved);
                }
                if let Some(vae) = group["vaeModel"].as_str() {
                    if !vae.is_empty() {
                        let resolved = resolve_model_path_with_fallback(vae, &weights_folder);
                        args.push("--vae".to_string());
                        args.push(resolved);
                    }
                }
                if let Some(llm) = group["llmModel"].as_str() {
                    if !llm.is_empty() {
                        let resolved = resolve_model_path_with_fallback(llm, &weights_folder);
                        args.push("--llm".to_string());
                        args.push(resolved);
                    }
                }
                if let Some(clip_l) = group["clipLModel"].as_str() {
                    if !clip_l.is_empty() {
                        let resolved = resolve_model_path_with_fallback(clip_l, &weights_folder);
                        args.push("--clip_l".to_string());
                        args.push(resolved);
                    }
                }
                if let Some(t5xxl) = group["t5xxlModel"].as_str() {
                    if !t5xxl.is_empty() {
                        let resolved = resolve_model_path_with_fallback(t5xxl, &weights_folder);
                        args.push("--t5xxl".to_string());
                        args.push(resolved);
                    }
                }
            }
        }
    }
    }

    // Prompt
    if let Some(prompt) = params["prompt"].as_str() {
        if !prompt.is_empty() {
            args.push("-p".to_string());
            args.push(prompt.to_string());
        }
    }

    // Negative prompt
    if let Some(neg) = params["negativePrompt"].as_str() {
        if !neg.is_empty() {
            args.push("-n".to_string());
            args.push(neg.to_string());
        }
    }

    // Image dimensions
    if let Some(w) = params["width"].as_u64() {
        args.push("-W".to_string());
        args.push(w.to_string());
    }
    if let Some(h) = params["height"].as_u64() {
        args.push("-H".to_string());
        args.push(h.to_string());
    }

    // Steps
    if let Some(steps) = params["steps"].as_u64() {
        args.push("--steps".to_string());
        args.push(steps.to_string());
    }

    // CFG scale
    if let Some(cfg) = params["cfgScale"].as_f64() {
        args.push("--cfg-scale".to_string());
        args.push(cfg.to_string());
    }

    // Seed
    if let Some(seed) = params["seed"].as_i64() {
        args.push("-s".to_string());
        args.push(seed.to_string());
    }

    // Sampling method
    if let Some(method) = params["samplingMethod"].as_str() {
        if !method.is_empty() {
            args.push("--sampling-method".to_string());
            args.push(method.to_string());
        }
    }

    // Scheduler
    if let Some(sched) = params["scheduler"].as_str() {
        if !sched.is_empty() {
            args.push("--scheduler".to_string());
            args.push(sched.to_string());
        }
    }

    // Batch count
    if let Some(batch) = params["batchCount"].as_u64() {
        if batch > 1 {
            args.push("-b".to_string());
            args.push(batch.to_string());
        }
    }

    // Threads
    if let Some(threads) = params["threads"].as_u64() {
        args.push("-t".to_string());
        args.push(threads.to_string());
    }

    // Boolean flags
    if params["verbose"].as_bool() == Some(true) {
        args.push("-v".to_string());
    }
    if params["color"].as_bool() == Some(true) {
        args.push("--color".to_string());
    }
    if params["offloadToCpu"].as_bool() == Some(true) {
        args.push("--offload-to-cpu".to_string());
    }
    if params["diffusionFa"].as_bool() == Some(true) {
        args.push("--diffusion-fa".to_string());
    }
    if params["controlNetCpu"].as_bool() == Some(true) {
        args.push("--control-net-cpu".to_string());
    }
    if params["clipOnCpu"].as_bool() == Some(true) {
        args.push("--clip-on-cpu".to_string());
    }
    if params["vaeOnCpu"].as_bool() == Some(true) {
        args.push("--vae-on-cpu".to_string());
    }
    if params["diffusionConvDirect"].as_bool() == Some(true) {
        args.push("--diffusion-conv-direct".to_string());
    }
    if params["vaeConvDirect"].as_bool() == Some(true) {
        args.push("--vae-conv-direct".to_string());
    }
    if params["vaeTiling"].as_bool() == Some(true) {
        args.push("--vae-tiling".to_string());
    }

    // Preview
    if let Some(preview) = params["preview"].as_str() {
        if !preview.is_empty() {
            args.push("--preview".to_string());
            args.push(preview.to_string());
        }
    }
    if let Some(preview_interval) = params["previewInterval"].as_u64() {
        args.push("--preview-interval".to_string());
        args.push(preview_interval.to_string());
    }

    // Input image for img2img
    if let Some(input) = params["inputImage"].as_str() {
        if !input.is_empty() {
            args.push("-i".to_string());
            args.push(input.to_string());
        }
    }

    // Output path
    args.push("-o".to_string());
    args.push(output_path.to_string_lossy().to_string());

    Ok(args)
}
