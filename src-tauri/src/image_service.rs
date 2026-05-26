use bollard::image::{CreateImageOptions, ListImagesOptions, RemoveImageOptions};
use futures_util::StreamExt;

use crate::colima;
use crate::container_service::OperationResult;
use crate::docker_client;
use crate::error::{AppError, Result};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageSummary {
    pub id: String,
    pub repo_tags: Vec<String>,
    pub created: i64,
    pub size: i64,
}

pub async fn list_images() -> Result<Vec<ImageSummary>> {
    let socket_path = colima::resolve_socket_path(None);

    if !std::path::Path::new(&socket_path).exists() {
        return Err(AppError::SocketNotFound(socket_path));
    }

    let docker = docker_client::create_client(&socket_path)?;

    let images = docker
        .list_images(None::<ListImagesOptions<String>>)
        .await
        .map_err(|e| AppError::DockerApiError(e.to_string()))?;

    let result = images
        .into_iter()
        .map(|img| ImageSummary {
            id: img.id,
            repo_tags: img.repo_tags,
            created: img.created,
            size: img.size,
        })
        .collect();

    Ok(result)
}

pub async fn pull_image(image: &str) -> Result<OperationResult> {
    let socket_path = colima::resolve_socket_path(None);

    if !std::path::Path::new(&socket_path).exists() {
        return Err(AppError::SocketNotFound(socket_path));
    }

    let docker = docker_client::create_client(&socket_path)?;

    let parts: Vec<&str> = image.splitn(2, ':').collect();
    let name = parts[0];
    let tag = parts.get(1).copied().unwrap_or("latest");

    let mut stream = docker.create_image(
        Some(CreateImageOptions {
            from_image: name,
            tag,
            ..Default::default()
        }),
        None,
        None,
    );

    // ストリームを末尾まで consume しないと pull が完了しない
    while let Some(item) = stream.next().await {
        item.map_err(|e| AppError::DockerApiError(e.to_string()))?;
    }

    Ok(OperationResult {
        success: true,
        message: None,
    })
}

pub async fn remove_image(id_or_name: &str, force: bool) -> Result<OperationResult> {
    let socket_path = colima::resolve_socket_path(None);

    if !std::path::Path::new(&socket_path).exists() {
        return Err(AppError::SocketNotFound(socket_path));
    }

    let docker = docker_client::create_client(&socket_path)?;

    docker
        .remove_image(
            id_or_name,
            Some(RemoveImageOptions {
                force,
                ..Default::default()
            }),
            None,
        )
        .await
        .map_err(|e| AppError::DockerApiError(e.to_string()))?;

    Ok(OperationResult {
        success: true,
        message: None,
    })
}
