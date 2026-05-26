use bollard::container::ListContainersOptions;
use bollard::models::MountPointTypeEnum;
use bollard::volume::{ListVolumesOptions, PruneVolumesOptions};
use std::collections::HashMap;

use crate::colima;
use crate::container_service::OperationResult;
use crate::docker_client;
use crate::error::{AppError, Result};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeSummary {
    pub name: String,
    pub driver: String,
    pub mountpoint: String,
    pub used_by_containers: Vec<String>,
}

/// Volume 一覧を取得し、各 Volume を使用しているコンテナ名を付与する
pub async fn list_volumes() -> Result<Vec<VolumeSummary>> {
    let socket_path = colima::resolve_socket_path(None);

    if !std::path::Path::new(&socket_path).exists() {
        return Err(AppError::SocketNotFound(socket_path));
    }

    let docker = docker_client::create_client(&socket_path)?;

    let volume_list = docker
        .list_volumes(None::<ListVolumesOptions<String>>)
        .await
        .map_err(|e| AppError::DockerApiError(e.to_string()))?;

    let volumes = volume_list.volumes.unwrap_or_default();

    let containers = docker
        .list_containers(Some(ListContainersOptions::<String> {
            all: true,
            ..Default::default()
        }))
        .await
        .map_err(|e| AppError::DockerApiError(e.to_string()))?;

    // Volume 名 → 使用しているコンテナ名リスト のマップを構築する
    let mut volume_to_containers: HashMap<String, Vec<String>> = HashMap::new();

    for container in &containers {
        let container_name = container
            .names
            .as_ref()
            .and_then(|names| names.first())
            .map(|n| n.trim_start_matches('/').to_string())
            .unwrap_or_default();

        if let Some(mounts) = &container.mounts {
            for mount in mounts {
                // type が "volume" のマウントのみ対象にする
                if mount.typ != Some(MountPointTypeEnum::VOLUME) {
                    continue;
                }
                if let Some(vol_name) = &mount.name {
                    volume_to_containers
                        .entry(vol_name.clone())
                        .or_default()
                        .push(container_name.clone());
                }
            }
        }
    }

    let result = volumes
        .into_iter()
        .map(|v| {
            let used_by_containers = volume_to_containers
                .get(&v.name)
                .cloned()
                .unwrap_or_default();
            VolumeSummary {
                name: v.name,
                driver: v.driver,
                mountpoint: v.mountpoint,
                used_by_containers,
            }
        })
        .collect();

    Ok(result)
}

/// 指定した Volume を削除する
pub async fn remove_volume(name: &str) -> Result<OperationResult> {
    let socket_path = colima::resolve_socket_path(None);

    if !std::path::Path::new(&socket_path).exists() {
        return Err(AppError::SocketNotFound(socket_path));
    }

    let docker = docker_client::create_client(&socket_path)?;

    match docker.remove_volume(name, None).await {
        Ok(_) => Ok(OperationResult {
            success: true,
            message: None,
        }),
        Err(e) => Ok(OperationResult {
            success: false,
            message: Some(e.to_string()),
        }),
    }
}

/// 未使用の Volume を一括削除する（prune）
pub async fn prune_volumes() -> Result<OperationResult> {
    let socket_path = colima::resolve_socket_path(None);

    if !std::path::Path::new(&socket_path).exists() {
        return Err(AppError::SocketNotFound(socket_path));
    }

    let docker = docker_client::create_client(&socket_path)?;

    match docker.prune_volumes(None::<PruneVolumesOptions<String>>).await {
        Ok(_) => Ok(OperationResult {
            success: true,
            message: None,
        }),
        Err(e) => Ok(OperationResult {
            success: false,
            message: Some(e.to_string()),
        }),
    }
}
