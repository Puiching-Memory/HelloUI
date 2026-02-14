mod commands;
mod state;

use state::AppState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // system
            commands::system::app_get_version,
            commands::system::get_available_engines,
            commands::system::devtools_toggle,
            commands::system::aliyun_api_call,
            // dialog
            commands::dialog::dialog_open_image,
            commands::dialog::edit_image_select_file,
            commands::dialog::edit_image_read_image_base64,
            // weights
            commands::weights::weights_init_default_folder,
            commands::weights::weights_check_folder,
            commands::weights::weights_set_folder,
            commands::weights::weights_get_folder,
            commands::weights::weights_list_files,
            commands::weights::weights_select_file,
            commands::weights::weights_download_file,
            commands::weights::weights_delete_file,
            // sdcpp
            commands::sdcpp::sdcpp_init_default_folder,
            commands::sdcpp::sdcpp_get_folder,
            commands::sdcpp::sdcpp_check_folder,
            commands::sdcpp::sdcpp_set_folder,
            commands::sdcpp::sdcpp_set_device,
            commands::sdcpp::sdcpp_get_device,
            commands::sdcpp::sdcpp_list_files,
            commands::sdcpp::sdcpp_download_file,
            commands::sdcpp::sdcpp_delete_file,
            commands::sdcpp::sdcpp_fetch_releases,
            commands::sdcpp::sdcpp_download_engine,
            commands::sdcpp::sdcpp_cancel_download,
            commands::sdcpp::sdcpp_get_mirrors,
            commands::sdcpp::sdcpp_add_mirror,
            commands::sdcpp::sdcpp_remove_mirror,
            commands::sdcpp::sdcpp_test_mirrors,
            commands::sdcpp::sdcpp_auto_select_mirror,
            // model groups
            commands::model_groups::model_groups_list,
            commands::model_groups::model_groups_create,
            commands::model_groups::model_groups_update,
            commands::model_groups::model_groups_delete,
            commands::model_groups::model_groups_get,
            commands::model_groups::model_groups_select_folder,
            commands::model_groups::model_groups_import,
            commands::model_groups::model_groups_build_and_export,
            // model download
            commands::model_download::models_get_hf_mirror,
            commands::model_download::models_set_hf_mirror,
            commands::model_download::models_download_group_files,
            commands::model_download::models_cancel_download,
            commands::model_download::models_check_files,
            // generate
            commands::generate::generate_start,
            commands::generate::generate_cancel,
            // video generate
            commands::video_generate::generate_video_start,
            commands::video_generate::generate_video_cancel,
            // generated images
            commands::generated_images::generated_images_list,
            commands::generated_images::generated_images_download,
            commands::generated_images::generated_images_delete,
            commands::generated_images::generated_images_get_preview,
            commands::generated_images::generated_images_get_video_data,
            commands::generated_images::generated_images_batch_download,
            // perfect pixel
            commands::perfect_pixel::perfect_pixel_select_image,
            commands::perfect_pixel::perfect_pixel_read_image,
            commands::perfect_pixel::perfect_pixel_save,
        ])
        .register_asynchronous_uri_scheme_protocol("media", |_ctx, request, responder| {
            // Custom protocol handler for loading local media files
            std::thread::spawn(move || {
                let uri = request.uri().to_string();
                let file_path = uri.strip_prefix("media://").unwrap_or("");
                let file_path = urlencoding::decode(file_path)
                    .unwrap_or_else(|_| std::borrow::Cow::Borrowed(file_path));

                let mut path = file_path.to_string();

                // Windows path normalization
                if cfg!(target_os = "windows") {
                    if path.starts_with('/') {
                        path = path[1..].to_string();
                    }
                }

                match std::fs::read(&path) {
                    Ok(data) => {
                        let mime = if path.ends_with(".mp4") {
                            "video/mp4"
                        } else if path.ends_with(".avi") {
                            "video/avi"
                        } else if path.ends_with(".png") {
                            "image/png"
                        } else if path.ends_with(".jpg") || path.ends_with(".jpeg") {
                            "image/jpeg"
                        } else if path.ends_with(".webp") {
                            "image/webp"
                        } else {
                            "application/octet-stream"
                        };
                        responder.respond(
                            tauri::http::Response::builder()
                                .header("Content-Type", mime)
                                .header("Access-Control-Allow-Origin", "*")
                                .body(data)
                                .unwrap(),
                        );
                    }
                    Err(e) => {
                        responder.respond(
                            tauri::http::Response::builder()
                                .status(404)
                                .body(format!("File not found: {}", e).into_bytes())
                                .unwrap(),
                        );
                    }
                }
            });
        })
        .setup(|app| {
            // Initialize default folders on startup
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = commands::weights::init_default_folders(&app_handle).await {
                    eprintln!("Failed to init default folders: {}", e);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
