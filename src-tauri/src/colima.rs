use std::path::PathBuf;

use crate::container_service::OperationResult;
use crate::error::AppError;

/// Docker socket の検出優先順位:
/// 1. 引数 socket_path が Some の場合はそれを使用
/// 2. ~/.colima/default/docker.sock
/// 3. DOCKER_HOST 環境変数
/// 4. /var/run/docker.sock
pub fn resolve_socket_path(socket_path: Option<String>) -> String {
    // 1. 明示的に指定された path
    if let Some(path) = socket_path {
        return path;
    }

    // 2. ~/.colima/default/docker.sock
    if let Some(home) = dirs::home_dir() {
        let colima_sock = home.join(".colima").join("default").join("docker.sock");
        if colima_sock.exists() {
            return colima_sock.to_string_lossy().into_owned();
        }
    }

    // 3. DOCKER_HOST 環境変数
    if let Ok(docker_host) = std::env::var("DOCKER_HOST") {
        // "unix:///path/to/docker.sock" 形式から path を抽出
        let path = docker_host
            .strip_prefix("unix://")
            .unwrap_or(&docker_host)
            .to_string();
        if PathBuf::from(&path).exists() {
            return path;
        }
    }

    // 4. /var/run/docker.sock (フォールバック)
    "/var/run/docker.sock".to_string()
}

/// ~/.colima/{profile}/docker.sock のパスを返す
pub fn colima_profile_socket(profile: &str) -> Option<PathBuf> {
    dirs::home_dir().map(|home| {
        home.join(".colima").join(profile).join("docker.sock")
    })
}

/// ~/.colima/ 以下のプロファイル名（サブディレクトリ名）を一覧で返す
///
/// .colima/ が存在しない場合は空 Vec を返す
pub fn list_colima_profiles() -> Result<Vec<String>, AppError> {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return Ok(vec![]),
    };

    let colima_dir = home.join(".colima");
    if !colima_dir.exists() {
        return Ok(vec![]);
    }

    let entries = std::fs::read_dir(&colima_dir)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let mut profiles = Vec::new();
    for entry in entries.flatten() {
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            if let Some(name) = entry.file_name().to_str() {
                // `.` で始まる隠しディレクトリは除外する
                if name.starts_with('.') {
                    continue;
                }
                profiles.push(name.to_string());
            }
        }
    }

    profiles.sort();
    Ok(profiles)
}

/// 指定プロファイルで `colima start` を実行する
pub async fn colima_start(profile: Option<String>) -> Result<OperationResult, AppError> {
    let profile_arg = profile.unwrap_or_else(|| "default".to_string());
    let mut cmd = tokio::process::Command::new("colima");
    if profile_arg == "default" {
        cmd.arg("start");
    } else {
        cmd.args(["start", "--profile", &profile_arg]);
    }
    let output = cmd
        .output()
        .await
        .map_err(|e| AppError::CommandFailed(e.to_string()))?;

    if output.status.success() {
        Ok(OperationResult { success: true, message: None })
    } else {
        Ok(OperationResult {
            success: false,
            message: Some(String::from_utf8_lossy(&output.stderr).to_string()),
        })
    }
}

/// 指定プロファイルで `colima stop` を実行する
pub async fn colima_stop(profile: Option<String>) -> Result<OperationResult, AppError> {
    let profile_arg = profile.unwrap_or_else(|| "default".to_string());
    let mut cmd = tokio::process::Command::new("colima");
    if profile_arg == "default" {
        cmd.arg("stop");
    } else {
        cmd.args(["stop", "--profile", &profile_arg]);
    }
    let output = cmd
        .output()
        .await
        .map_err(|e| AppError::CommandFailed(e.to_string()))?;

    if output.status.success() {
        Ok(OperationResult { success: true, message: None })
    } else {
        Ok(OperationResult {
            success: false,
            message: Some(String::from_utf8_lossy(&output.stderr).to_string()),
        })
    }
}
