use bollard::container::{ListContainersOptions, LogsOptions, RemoveContainerOptions, RestartContainerOptions, StartContainerOptions, StopContainerOptions};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::colima;
use crate::docker_client;
use crate::error::{AppError, Result};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationResult {
    pub success: bool,
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ContainerPort {
    pub private_port: u16,
    pub public_port: Option<u16>,
    pub port_type: String,
    pub ip: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ContainerSummary {
    pub id: String,
    pub names: Vec<String>,
    pub image: String,
    pub state: String,
    pub status: String,
    pub created: i64,
    pub ports: Vec<ContainerPort>,
    pub labels: HashMap<String, String>,
}

/// コンテナ一覧を取得する
///
/// `all=true` で停止中コンテナも含む
pub async fn list_containers(all: bool) -> Result<Vec<ContainerSummary>> {
    let socket_path = colima::resolve_socket_path(None);

    if !std::path::Path::new(&socket_path).exists() {
        return Err(AppError::SocketNotFound(socket_path));
    }

    let docker = docker_client::create_client(&socket_path)?;

    let options = ListContainersOptions::<String> {
        all,
        ..Default::default()
    };

    let containers = docker
        .list_containers(Some(options))
        .await
        .map_err(|e| AppError::DockerApiError(e.to_string()))?;

    let result = containers
        .into_iter()
        .map(|c| {
            let id = c.id.unwrap_or_default();
            let names = c.names.unwrap_or_default();
            let image = c.image.unwrap_or_default();
            let state = c.state.unwrap_or_default();
            let status = c.status.unwrap_or_default();
            let created = c.created.unwrap_or(0);
            let labels = c.labels.unwrap_or_default();

            let ports = c
                .ports
                .unwrap_or_default()
                .into_iter()
                .map(|p| ContainerPort {
                    private_port: p.private_port,
                    public_port: p.public_port.map(|v| v as u16),
                    port_type: p.typ.map(|t| t.to_string()).unwrap_or_else(|| "tcp".to_string()),
                    ip: p.ip,
                })
                .collect();

            ContainerSummary {
                id,
                names,
                image,
                state,
                status,
                created,
                ports,
                labels,
            }
        })
        .collect();

    Ok(result)
}

pub async fn start_container(container_id: &str) -> Result<OperationResult> {
    let socket_path = colima::resolve_socket_path(None);

    if !std::path::Path::new(&socket_path).exists() {
        return Err(AppError::SocketNotFound(socket_path));
    }

    let docker = docker_client::create_client(&socket_path)?;

    docker
        .start_container(container_id, None::<StartContainerOptions<String>>)
        .await
        .map_err(|e| AppError::DockerApiError(e.to_string()))?;

    Ok(OperationResult {
        success: true,
        message: None,
    })
}

pub async fn stop_container(container_id: &str) -> Result<OperationResult> {
    let socket_path = colima::resolve_socket_path(None);

    if !std::path::Path::new(&socket_path).exists() {
        return Err(AppError::SocketNotFound(socket_path));
    }

    let docker = docker_client::create_client(&socket_path)?;

    docker
        .stop_container(container_id, None::<StopContainerOptions>)
        .await
        .map_err(|e| AppError::DockerApiError(e.to_string()))?;

    Ok(OperationResult {
        success: true,
        message: None,
    })
}

pub async fn restart_container(container_id: &str) -> Result<OperationResult> {
    let socket_path = colima::resolve_socket_path(None);

    if !std::path::Path::new(&socket_path).exists() {
        return Err(AppError::SocketNotFound(socket_path));
    }

    let docker = docker_client::create_client(&socket_path)?;

    docker
        .restart_container(container_id, None::<RestartContainerOptions>)
        .await
        .map_err(|e| AppError::DockerApiError(e.to_string()))?;

    Ok(OperationResult {
        success: true,
        message: None,
    })
}

pub async fn remove_container(container_id: &str, force: bool) -> Result<OperationResult> {
    let socket_path = colima::resolve_socket_path(None);

    if !std::path::Path::new(&socket_path).exists() {
        return Err(AppError::SocketNotFound(socket_path));
    }

    let docker = docker_client::create_client(&socket_path)?;

    docker
        .remove_container(
            container_id,
            Some(RemoveContainerOptions {
                force,
                ..Default::default()
            }),
        )
        .await
        .map_err(|e| AppError::DockerApiError(e.to_string()))?;

    Ok(OperationResult {
        success: true,
        message: None,
    })
}

/// コンテナログを取得する
///
/// tail: 末尾から取得する行数
pub async fn get_container_logs(container_id: &str, tail: u32) -> Result<String> {
    let socket_path = colima::resolve_socket_path(None);

    if !std::path::Path::new(&socket_path).exists() {
        return Err(AppError::SocketNotFound(socket_path));
    }

    let docker = docker_client::create_client(&socket_path)?;

    let options = LogsOptions::<String> {
        stdout: true,
        stderr: true,
        follow: false,
        timestamps: false,
        tail: tail.to_string(),
        ..Default::default()
    };

    let stream = docker.logs(container_id, Some(options));

    let chunks: Vec<_> = stream.collect().await;

    let mut lines = Vec::with_capacity(chunks.len());
    for chunk in chunks {
        match chunk {
            Ok(output) => {
                let bytes = match output {
                    bollard::container::LogOutput::StdOut { message } => message,
                    bollard::container::LogOutput::StdErr { message } => message,
                    bollard::container::LogOutput::StdIn { message } => message,
                    bollard::container::LogOutput::Console { message } => message,
                };
                let text = String::from_utf8_lossy(&bytes).into_owned();
                // 末尾の改行を除去してから push（結合時に改行を付与するため）
                lines.push(text.trim_end_matches('\n').to_string());
            }
            Err(e) => return Err(AppError::DockerApiError(e.to_string())),
        }
    }

    Ok(lines.join("\n"))
}
