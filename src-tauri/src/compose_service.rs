use bollard::container::ListContainersOptions;
use std::collections::HashMap;

use crate::colima;
use crate::container_service::OperationResult;
use crate::docker_client;
use crate::error::{AppError, Result};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComposeService {
    pub name: String,
    pub container_id: String,
    pub state: String,
    pub status: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComposeProject {
    pub name: String,
    pub working_dir: String,
    pub config_files: String,
    pub services: Vec<ComposeService>,
}

/// Docker Compose プロジェクト一覧を取得する
///
/// コンテナの labels から compose メタデータを読み取り、
/// プロジェクト名でグルーピングして返す
pub async fn list_compose_projects() -> Result<Vec<ComposeProject>> {
    let socket_path = colima::resolve_socket_path(None);

    if !std::path::Path::new(&socket_path).exists() {
        return Err(AppError::SocketNotFound(socket_path));
    }

    let docker = docker_client::create_client(&socket_path)?;

    let containers = docker
        .list_containers(Some(ListContainersOptions::<String> {
            all: true,
            ..Default::default()
        }))
        .await
        .map_err(|e| AppError::DockerApiError(e.to_string()))?;

    let mut projects: HashMap<String, ComposeProject> = HashMap::new();

    for c in containers {
        let labels = c.labels.unwrap_or_default();

        // compose.project ラベルがないコンテナは除外
        let project_name = match labels.get("com.docker.compose.project") {
            Some(v) => v.clone(),
            None => continue,
        };

        let service_name = labels
            .get("com.docker.compose.service")
            .cloned()
            .unwrap_or_default();
        let working_dir = labels
            .get("com.docker.compose.project.working_dir")
            .cloned()
            .unwrap_or_default();
        let config_files = labels
            .get("com.docker.compose.project.config_files")
            .cloned()
            .unwrap_or_default();

        let service = ComposeService {
            name: service_name,
            container_id: c.id.unwrap_or_default(),
            state: c.state.unwrap_or_default(),
            status: c.status.unwrap_or_default(),
        };

        let project = projects.entry(project_name.clone()).or_insert_with(|| ComposeProject {
            name: project_name,
            working_dir,
            config_files,
            services: Vec::new(),
        });

        project.services.push(service);
    }

    let mut result: Vec<ComposeProject> = projects.into_values().collect();
    // 安定したソートのためプロジェクト名でソート
    result.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(result)
}

pub async fn compose_up(working_dir: &str) -> Result<OperationResult> {
    let output = tokio::process::Command::new(crate::colima::find_binary("docker"))
        .env("PATH", crate::colima::enriched_path())
        .args(["compose", "up", "-d"])
        .current_dir(working_dir)
        .output()
        .await
        .map_err(|e| AppError::CommandFailed(e.to_string()))?;

    if output.status.success() {
        Ok(OperationResult {
            success: true,
            message: None,
        })
    } else {
        Ok(OperationResult {
            success: false,
            message: Some(String::from_utf8_lossy(&output.stderr).to_string()),
        })
    }
}

pub async fn compose_stop(working_dir: &str) -> Result<OperationResult> {
    let output = tokio::process::Command::new(crate::colima::find_binary("docker"))
        .env("PATH", crate::colima::enriched_path())
        .args(["compose", "stop"])
        .current_dir(working_dir)
        .output()
        .await
        .map_err(|e| AppError::CommandFailed(e.to_string()))?;

    if output.status.success() {
        Ok(OperationResult {
            success: true,
            message: None,
        })
    } else {
        Ok(OperationResult {
            success: false,
            message: Some(String::from_utf8_lossy(&output.stderr).to_string()),
        })
    }
}

pub async fn compose_down(working_dir: &str) -> Result<OperationResult> {
    let output = tokio::process::Command::new(crate::colima::find_binary("docker"))
        .env("PATH", crate::colima::enriched_path())
        .args(["compose", "down"])
        .current_dir(working_dir)
        .output()
        .await
        .map_err(|e| AppError::CommandFailed(e.to_string()))?;

    if output.status.success() {
        Ok(OperationResult {
            success: true,
            message: None,
        })
    } else {
        Ok(OperationResult {
            success: false,
            message: Some(String::from_utf8_lossy(&output.stderr).to_string()),
        })
    }
}

pub async fn compose_restart(working_dir: &str) -> Result<OperationResult> {
    let output = tokio::process::Command::new(crate::colima::find_binary("docker"))
        .env("PATH", crate::colima::enriched_path())
        .args(["compose", "restart"])
        .current_dir(working_dir)
        .output()
        .await
        .map_err(|e| AppError::CommandFailed(e.to_string()))?;

    if output.status.success() {
        Ok(OperationResult {
            success: true,
            message: None,
        })
    } else {
        Ok(OperationResult {
            success: false,
            message: Some(String::from_utf8_lossy(&output.stderr).to_string()),
        })
    }
}
