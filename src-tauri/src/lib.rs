mod colima;
mod compose_service;
mod container_service;
mod docker_client;
mod error;
mod image_service;
mod volume_service;

use container_service::{ContainerSummary, OperationResult};
use docker_client::DockerConnectionInfo;
use error::AppError;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

/// Docker 接続確認コマンド
///
/// socket_path が None の場合は colima::resolve_socket_path で自動検出する。
#[tauri::command]
async fn check_docker_connection(
    socket_path: Option<String>,
) -> Result<DockerConnectionInfo, AppError> {
    let path = colima::resolve_socket_path(socket_path);
    docker_client::connect_and_verify(&path).await
}

/// コンテナ一覧取得コマンド
///
/// all=true で停止中コンテナも含む
#[tauri::command]
async fn list_containers(all: bool) -> Result<Vec<ContainerSummary>, AppError> {
    container_service::list_containers(all).await
}

#[tauri::command]
async fn start_container(container_id: String) -> Result<OperationResult, AppError> {
    container_service::start_container(&container_id).await
}

#[tauri::command]
async fn stop_container(container_id: String) -> Result<OperationResult, AppError> {
    container_service::stop_container(&container_id).await
}

#[tauri::command]
async fn restart_container(container_id: String) -> Result<OperationResult, AppError> {
    container_service::restart_container(&container_id).await
}

#[tauri::command]
async fn remove_container(container_id: String, force: bool) -> Result<OperationResult, AppError> {
    container_service::remove_container(&container_id, force).await
}

#[tauri::command]
async fn get_container_logs(container_id: String, tail: u32) -> Result<String, AppError> {
    container_service::get_container_logs(&container_id, tail).await
}

#[tauri::command]
async fn list_images() -> Result<Vec<image_service::ImageSummary>, AppError> {
    image_service::list_images().await
}

#[tauri::command]
async fn pull_image(image: String) -> Result<OperationResult, AppError> {
    image_service::pull_image(&image).await
}

#[tauri::command]
async fn remove_image(id_or_name: String, force: bool) -> Result<OperationResult, AppError> {
    image_service::remove_image(&id_or_name, force).await
}

#[tauri::command]
async fn list_compose_projects() -> Result<Vec<compose_service::ComposeProject>, AppError> {
    compose_service::list_compose_projects().await
}

#[tauri::command]
async fn compose_up(working_dir: String) -> Result<OperationResult, AppError> {
    compose_service::compose_up(&working_dir).await
}

#[tauri::command]
async fn compose_stop(working_dir: String) -> Result<OperationResult, AppError> {
    compose_service::compose_stop(&working_dir).await
}

#[tauri::command]
async fn compose_down(working_dir: String) -> Result<OperationResult, AppError> {
    compose_service::compose_down(&working_dir).await
}

#[tauri::command]
async fn compose_restart(working_dir: String) -> Result<OperationResult, AppError> {
    compose_service::compose_restart(&working_dir).await
}

#[tauri::command]
async fn list_volumes() -> Result<Vec<volume_service::VolumeSummary>, AppError> {
    volume_service::list_volumes().await
}

#[tauri::command]
async fn remove_volume(name: String) -> Result<OperationResult, AppError> {
    volume_service::remove_volume(&name).await
}

#[tauri::command]
async fn prune_volumes() -> Result<OperationResult, AppError> {
    volume_service::prune_volumes().await
}

#[tauri::command]
fn list_colima_profiles() -> Result<Vec<String>, AppError> {
    colima::list_colima_profiles()
}

#[tauri::command]
fn resolve_socket_for_profile(profile: String) -> Result<String, AppError> {
    colima::colima_profile_socket(&profile)
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| AppError::SocketNotFound("ホームディレクトリが取得できません".to_string()))
}

#[tauri::command]
async fn colima_start(profile: Option<String>) -> Result<OperationResult, AppError> {
    colima::colima_start(profile).await
}

#[tauri::command]
async fn colima_stop(profile: Option<String>) -> Result<OperationResult, AppError> {
    colima::colima_stop(profile).await
}

/// アプリケーションの起動エントリポイント（lib から呼ばれる）
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            setup_tray(app)?;
            #[cfg(target_os = "macos")]
            set_dock_icon();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_docker_connection,
            list_containers,
            start_container,
            stop_container,
            restart_container,
            remove_container,
            get_container_logs,
            list_images,
            pull_image,
            remove_image,
            list_compose_projects,
            compose_up,
            compose_stop,
            compose_down,
            compose_restart,
            list_volumes,
            remove_volume,
            prune_volumes,
            list_colima_profiles,
            resolve_socket_for_profile,
            colima_start,
            colima_stop,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                tauri::async_runtime::block_on(async {
                    let _ = colima::colima_stop(None).await;
                });
            }
        });
}

/// メニューバー（System Tray）のセットアップ
fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let status_item = Arc::new(MenuItem::with_id(
        app,
        "status",
        "✕ Disconnected",
        false,
        None::<&str>,
    )?);
    let running_item = Arc::new(MenuItem::with_id(
        app,
        "running",
        "-- running",
        false,
        None::<&str>,
    )?);
    let separator1 = PredefinedMenuItem::separator(app)?;
    let open_item = MenuItem::with_id(app, "open", "Open Colima Manager", true, None::<&str>)?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            status_item.as_ref(),
            running_item.as_ref(),
            &separator1,
            &open_item,
            &separator2,
            &quit_item,
        ],
    )?;

    const ICON_PNG: &[u8] = include_bytes!("../icons/tray-icon.png");
    let tray_icon = tauri::image::Image::from_bytes(ICON_PNG)?;

    let _tray = TrayIconBuilder::with_id("main")
        .icon(tray_icon)
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("Colima Desktop")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    // 起動時に接続状態を非同期で更新する
    let app_handle = app.handle().clone();
    let status_item_clone = Arc::clone(&status_item);
    let running_item_clone = Arc::clone(&running_item);

    tauri::async_runtime::spawn(async move {
        // 起動時に Colima を自動起動（既起動時は即座に終了するので副作用なし）
        let _ = colima::colima_start(None).await;
        refresh_tray_status(&app_handle, &status_item_clone, &running_item_clone).await;
    });

    Ok(())
}

/// Tray メニューの接続状態を更新する
async fn refresh_tray_status(
    app: &tauri::AppHandle,
    status_item: &MenuItem<tauri::Wry>,
    running_item: &MenuItem<tauri::Wry>,
) {
    let socket_path = colima::resolve_socket_path(None);

    match docker_client::connect_and_verify(&socket_path).await {
        Ok(info) => {
            let running_count = get_running_container_count(&socket_path).await;

            if let Some(tray) = app.tray_by_id("main") {
                let _ = tray.set_tooltip(Some(&format!(
                    "Colima Desktop — Connected ({})",
                    info.docker_version
                )));
            }

            let _ = status_item.set_text("● Connected");
            let _ = running_item.set_text(&format!("{} running", running_count));
        }
        Err(_) => {
            if let Some(tray) = app.tray_by_id("main") {
                let _ = tray.set_tooltip(Some("Colima Desktop — Disconnected"));
            }
            let _ = status_item.set_text("✕ Disconnected");
            let _ = running_item.set_text("-- running");
        }
    }
}

/// 実行中コンテナ数を取得する（失敗時は 0 を返す）
async fn get_running_container_count(socket_path: &str) -> usize {
    use bollard::container::ListContainersOptions;
    use std::collections::HashMap;

    let Ok(docker) = docker_client::create_client(socket_path) else {
        return 0;
    };

    let mut filters = HashMap::new();
    filters.insert("status", vec!["running"]);

    let options = ListContainersOptions {
        all: false,
        filters,
        ..Default::default()
    };

    docker
        .list_containers(Some(options))
        .await
        .map(|list| list.len())
        .unwrap_or(0)
}

/// macOS の Dock アイコンを実行時にセット（dev モードでバンドルなしでも表示される）
#[cfg(target_os = "macos")]
fn set_dock_icon() {
    const ICON: &[u8] = include_bytes!("../icons/icon.icns");
    unsafe {
        use objc::runtime::Object;
        use objc::{class, msg_send, sel, sel_impl};

        let ns_data: *mut Object = msg_send![
            class!(NSData),
            dataWithBytes: ICON.as_ptr() as *const std::ffi::c_void
            length: ICON.len()
        ];
        let ns_image: *mut Object = msg_send![class!(NSImage), alloc];
        let ns_image: *mut Object = msg_send![ns_image, initWithData: ns_data];
        let ns_app: *mut Object = msg_send![class!(NSApplication), sharedApplication];
        let _: () = msg_send![ns_app, setApplicationIconImage: ns_image];
    }
}
