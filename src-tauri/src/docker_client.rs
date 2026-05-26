use bollard::Docker;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, Result};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DockerConnectionInfo {
    pub connected: bool,
    pub socket_path: String,
    pub docker_version: String,
    pub api_version: String,
}

/// 指定された Unix socket path で Docker に接続し、バージョン情報を取得する
pub async fn connect_and_verify(socket_path: &str) -> Result<DockerConnectionInfo> {
    // socket ファイルの存在チェック
    if !std::path::Path::new(socket_path).exists() {
        return Err(AppError::SocketNotFound(socket_path.to_string()));
    }

    let docker = Docker::connect_with_unix(socket_path, 30, bollard::API_DEFAULT_VERSION)
        .map_err(|e| AppError::DockerApiError(e.to_string()))?;

    let version = docker.version().await.map_err(|e| {
        // 接続拒否の場合は ColimaNotRunning として扱う
        let msg = e.to_string();
        if msg.contains("Connection refused")
            || msg.contains("No such file or directory")
            || msg.contains("connect: connection refused")
        {
            AppError::ColimaNotRunning
        } else {
            AppError::DockerApiError(msg)
        }
    })?;

    let docker_version = version
        .version
        .unwrap_or_else(|| "unknown".to_string());

    let api_version = version
        .api_version
        .unwrap_or_else(|| "unknown".to_string());

    Ok(DockerConnectionInfo {
        connected: true,
        socket_path: socket_path.to_string(),
        docker_version,
        api_version,
    })
}

/// Docker クライアントを生成する（接続済み確認済みを前提としない）
pub fn create_client(socket_path: &str) -> Result<Docker> {
    Docker::connect_with_unix(socket_path, 30, bollard::API_DEFAULT_VERSION)
        .map_err(|e| AppError::DockerApiError(e.to_string()))
}
