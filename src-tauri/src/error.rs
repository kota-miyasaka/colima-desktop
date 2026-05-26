use thiserror::Error;

#[derive(Debug, Error)]
#[allow(dead_code)]
pub enum AppError {
    #[error("Colima が起動しているか確認してください。`colima start`")]
    ColimaNotRunning,

    #[error("Docker socket が見つかりません。設定済み path: {0}")]
    SocketNotFound(String),

    #[error("Docker Engine API の呼び出しに失敗しました。{0}")]
    DockerApiError(String),

    #[error("コンテナ操作に失敗しました。対象: {name} 操作: {op} 理由: {message}")]
    ContainerOperationFailed {
        name: String,
        op: String,
        message: String,
    },

    #[error("Colima start/stop に失敗しました。{0}")]
    ColimaCliError(String),

    #[error("コマンド実行に失敗しました。{0}")]
    CommandFailed(String),

    #[error("内部エラー: {0}")]
    Internal(String),
}

impl From<bollard::errors::Error> for AppError {
    fn from(e: bollard::errors::Error) -> Self {
        use bollard::errors::Error as BollardError;
        match &e {
            BollardError::IOError { err } if err.kind() == std::io::ErrorKind::ConnectionRefused => {
                AppError::ColimaNotRunning
            }
            BollardError::IOError { err }
                if err.kind() == std::io::ErrorKind::NotFound =>
            {
                AppError::SocketNotFound(e.to_string())
            }
            _ => AppError::DockerApiError(e.to_string()),
        }
    }
}

// Tauri コマンドの戻り値として使えるよう serde::Serialize を実装
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
