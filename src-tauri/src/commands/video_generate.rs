use crate::state::{self, AppState};
use std::path::Path;
use std::process::Stdio;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};

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

/// Start video generation
#[tauri::command]
pub async fn generate_video_start(
    value: serde_json::Value,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let device_type = value["deviceType"].as_str().unwrap_or("cpu");
    let prompt = value["prompt"].as_str().unwrap_or("");
    let mode = value["mode"].as_str().unwrap_or("text2video");

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
        .unwrap_or_else(|| {
            state::get_default_outputs_folder()
                .to_string_lossy()
                .to_string()
        });

    std::fs::create_dir_all(&outputs_folder).map_err(|e| e.to_string())?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    // SD.cpp outputs video as an avi file initially
    let output_avi_path = Path::new(&outputs_folder).join(format!("generated_{}.avi", timestamp));
    let output_mp4_path = Path::new(&outputs_folder).join(format!("generated_{}.mp4", timestamp));

    // Build CLI arguments for video
    let args = build_video_args(&value, &state, &output_avi_path)?;

    // Setup cancellation
    let (cancel_tx, mut cancel_rx) = tokio::sync::watch::channel(false);
    *state.video_generate_cancel.lock().unwrap() = Some(cancel_tx);

    // Spawn process
    let mut child = tokio::process::Command::new(&exe_path)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to start process: {}", e))?;

    let pid = child.id();

    // Read stdout
    let stdout = child.stdout.take();
    let app_stdout = app.clone();
    let stdout_task = tokio::spawn(async move {
        if let Some(stdout) = stdout {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if line.contains('%') || line.contains("step") || line.contains("Step") {
                    let _ = app_stdout.emit(
                        "generate-video:progress",
                        serde_json::json!({ "progress": line }),
                    );
                }
                let _ = app_stdout.emit(
                    "generate-video:cli-output",
                    serde_json::json!({ "type": "stdout", "text": line }),
                );
            }
        }
    });

    // Read stderr
    let stderr = child.stderr.take();
    let app_stderr = app.clone();
    let stderr_task = tokio::spawn(async move {
        if let Some(stderr) = stderr {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if line.contains('%') || line.contains("step") || line.contains("Step") {
                    let _ = app_stderr.emit(
                        "generate-video:progress",
                        serde_json::json!({ "progress": line }),
                    );
                }
                let _ = app_stderr.emit(
                    "generate-video:cli-output",
                    serde_json::json!({ "type": "stderr", "text": line }),
                );
            }
        }
    });

    let start = std::time::Instant::now();

    // Wait for process
    let exit_status = tokio::select! {
        status = child.wait() => status.map_err(|e| e.to_string())?,
        _ = cancel_rx.changed() => {
            let _ = child.kill().await;
            if cfg!(target_os = "windows") {
                if let Some(pid) = pid {
                    let _ = tokio::process::Command::new("taskkill")
                        .args(&["/F", "/T", "/PID", &pid.to_string()])
                        .output()
                        .await;
                }
            }
            return Ok(serde_json::json!({ "success": false, "error": "cancelled" }));
        }
    };

    let _ = stdout_task.await;
    let _ = stderr_task.await;

    if !exit_status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": format!("Process exited with code: {:?}", exit_status.code())
        }));
    }

    // Convert AVI to MP4 using FFmpeg
    let ffmpeg_path = state::get_ffmpeg_path();
    let mut final_video_path = output_avi_path.clone();

    if output_avi_path.exists() && ffmpeg_path.exists() {
        let ffmpeg_result = tokio::process::Command::new(&ffmpeg_path)
            .args(&[
                "-i",
                &output_avi_path.to_string_lossy(),
                "-c:v",
                "libx264",
                "-preset",
                "fast",
                "-crf",
                "23",
                "-y",
                &output_mp4_path.to_string_lossy(),
            ])
            .output()
            .await;

        if let Ok(output) = ffmpeg_result {
            if output.status.success() && output_mp4_path.exists() {
                let _ = tokio::fs::remove_file(&output_avi_path).await;
                final_video_path = output_mp4_path.clone();
            }
        }
    }

    let duration = start.elapsed().as_millis() as u64;

    // Save metadata
    let metadata_path = final_video_path.with_extension("json");
    let metadata = serde_json::json!({
        "prompt": prompt,
        "negativePrompt": value.get("negativePrompt"),
        "steps": value.get("steps"),
        "cfgScale": value.get("cfgScale"),
        "width": value.get("width"),
        "height": value.get("height"),
        "seed": value.get("seed"),
        "mode": mode,
        "deviceType": device_type,
        "groupId": value.get("groupId"),
        "type": "video",
        "mediaType": "video",
        "duration": duration,
        "generatedAt": chrono::Utc::now().to_rfc3339(),
    });
    let _ = tokio::fs::write(
        &metadata_path,
        serde_json::to_string_pretty(&metadata).unwrap_or_default(),
    )
    .await;

    if final_video_path.exists() {
        let video_url = format!(
            "media://{}",
            urlencoding::encode(&final_video_path.to_string_lossy())
        );

        Ok(serde_json::json!({
            "success": true,
            "video": video_url,
            "videoPath": final_video_path.to_string_lossy(),
            "duration": duration
        }))
    } else {
        Ok(serde_json::json!({
            "success": false,
            "error": "Output video not found after generation"
        }))
    }
}

/// Cancel video generation
#[tauri::command]
pub async fn generate_video_cancel(state: State<'_, AppState>) -> Result<bool, String> {
    if let Some(cancel) = state.video_generate_cancel.lock().unwrap().take() {
        let _ = cancel.send(true);
    }
    Ok(true)
}

fn build_video_args(
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

    // Model paths from group
    if let Some(group_id) = params["groupId"].as_str() {
        let groups_path = state::get_model_groups_path(Some(&weights_folder));
        if groups_path.exists() {
            let data = std::fs::read_to_string(&groups_path).map_err(|e| e.to_string())?;
            let groups: Vec<serde_json::Value> =
                serde_json::from_str(&data).map_err(|e| e.to_string())?;
            if let Some(group) = groups.iter().find(|g| g["id"].as_str() == Some(group_id)) {
                if let Some(sd_model) = group["sdModel"].as_str() {
                    let resolved = state::resolve_model_path(sd_model, &weights_folder);
                    args.push("-m".to_string());
                    args.push(resolved);
                }
                if let Some(vae) = group["vaeModel"].as_str() {
                    if !vae.is_empty() {
                        args.push("--vae".to_string());
                        args.push(state::resolve_model_path(vae, &weights_folder));
                    }
                }
                if let Some(llm) = group["llmModel"].as_str() {
                    if !llm.is_empty() {
                        args.push("--clip_l".to_string());
                        args.push(state::resolve_model_path(llm, &weights_folder));
                    }
                }
                if let Some(clip_vision) = group["clipVisionModel"].as_str() {
                    if !clip_vision.is_empty() {
                        args.push("--clip-vision".to_string());
                        args.push(state::resolve_model_path(clip_vision, &weights_folder));
                    }
                }
                if let Some(t5xxl) = group["t5xxlModel"].as_str() {
                    if !t5xxl.is_empty() {
                        args.push("--t5xxl".to_string());
                        args.push(state::resolve_model_path(t5xxl, &weights_folder));
                    }
                }
                if let Some(high_noise) = group["highNoiseSdModel"].as_str() {
                    if !high_noise.is_empty() {
                        args.push("--high-noise-model".to_string());
                        args.push(state::resolve_model_path(high_noise, &weights_folder));
                    }
                }
            }
        }
    }

    // Mode
    let mode = params["mode"].as_str().unwrap_or("text2video");
    args.push("--mode".to_string());
    args.push(mode.to_string());

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

    // Dimensions
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

    // Flow shift
    if let Some(flow) = params["flowShift"].as_f64() {
        args.push("--flow-shift".to_string());
        args.push(flow.to_string());
    }

    // High noise parameters
    if let Some(steps) = params["highNoiseSteps"].as_u64() {
        args.push("--high-noise-steps".to_string());
        args.push(steps.to_string());
    }
    if let Some(cfg) = params["highNoiseCfgScale"].as_f64() {
        args.push("--high-noise-cfg-scale".to_string());
        args.push(cfg.to_string());
    }
    if let Some(method) = params["highNoiseSamplingMethod"].as_str() {
        if !method.is_empty() {
            args.push("--high-noise-sampling-method".to_string());
            args.push(method.to_string());
        }
    }

    // Init image for i2v
    if let Some(init) = params["initImage"].as_str() {
        if !init.is_empty() {
            args.push("-i".to_string());
            args.push(init.to_string());
        }
    }

    // Boolean flags
    if params["verbose"].as_bool() == Some(true) {
        args.push("-v".to_string());
    }
    if params["offloadToCpu"].as_bool() == Some(true) {
        args.push("--offload-to-cpu".to_string());
    }
    if params["clipOnCpu"].as_bool() == Some(true) {
        args.push("--clip-on-cpu".to_string());
    }
    if params["vaeOnCpu"].as_bool() == Some(true) {
        args.push("--vae-on-cpu".to_string());
    }
    if params["vaeTiling"].as_bool() == Some(true) {
        args.push("--vae-tiling".to_string());
    }

    // Output
    args.push("-o".to_string());
    args.push(output_path.to_string_lossy().to_string());

    Ok(args)
}
