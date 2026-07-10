use crate::AppState;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{command, State};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ParseFoldersRequest {
    pub base_dir: String,
    pub operator_name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GenerateRequest {
    pub base_dir: String,
    pub records: Vec<serde_json::Value>,
    pub settings: serde_json::Value,
}

/// 根据当前 AppConfig 重新计算用户模板存放目录。
fn current_user_template_dir(state: &State<AppState>) -> PathBuf {
    let config = state.config.lock().unwrap().clone();
    config
        .effective_config_dir()
        .map(PathBuf::from)
        .unwrap_or_else(|_| state.user_template_dir.lock().unwrap().clone())
}

/// 收集需要注入给 sidecar 的环境变量：
/// - YX_BUNDLED_TEMPLATE: 内置打包模板路径（最终兜底）
/// - YX_USER_TEMPLATE_DIR: 用户自定义模板存放目录
fn collect_sidecar_envs(state: &State<AppState>) -> Vec<(&'static str, String)> {
    let mut envs: Vec<(&'static str, String)> = Vec::new();
    if let Some(ref p) = *state.bundled_template_path.lock().unwrap() {
        envs.push(("YX_BUNDLED_TEMPLATE", p.to_string_lossy().to_string()));
    }
    let user_dir = current_user_template_dir(state);
    envs.push((
        "YX_USER_TEMPLATE_DIR",
        user_dir.to_string_lossy().to_string(),
    ));
    // 用户模板文件（如果之前已替换过）
    let user_file = user_dir.join("user_template.xlsx");
    if user_file.is_file() {
        envs.push(("YX_USER_TEMPLATE", user_file.to_string_lossy().to_string()));
    }
    envs
}

fn ensure_sidecar_started(state: &State<AppState>) -> Result<(), String> {
    // Try to send a ping command to check if sidecar is alive
    let ping = serde_json::json!({
        "command": "ping"
    });

    match state.sidecar.send_command(&ping.to_string()) {
        Ok(response) => {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&response) {
                if parsed
                    .get("success")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false)
                {
                    return Ok(());
                }
            }
            // Sidecar responded but not correctly, restart
            start_sidecar(state)?;
            // 启动后等待 sidecar 就绪（PyInstaller onefile 首次解压可能需要几秒）
            wait_sidecar_ready(state)
        }
        Err(_) => {
            // Sidecar not running, start it
            start_sidecar(state)?;
            // 启动后等待 sidecar 就绪
            wait_sidecar_ready(state)
        }
    }
}

/// 启动 sidecar 后重试 ping，最多等待 15 秒。
/// PyInstaller onefile exe 首次运行需要解压到临时目录，可能耗时数秒。
fn wait_sidecar_ready(state: &State<AppState>) -> Result<(), String> {
    let ping = serde_json::json!({ "command": "ping" });
    for _ in 0..30 {
        std::thread::sleep(std::time::Duration::from_millis(500));
        match state.sidecar.send_command(&ping.to_string()) {
            Ok(response) => {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&response) {
                    if parsed
                        .get("success")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false)
                    {
                        return Ok(());
                    }
                }
            }
            Err(_) => {
                // sidecar 还没就绪，继续等待
            }
        }
    }
    Err("Sidecar 启动超时（15秒内未响应 ping）。请检查 generate_report.exe 是否存在。".to_string())
}

fn start_sidecar(state: &State<AppState>) -> Result<(), String> {
    let resource_dir = state.resource_dir.lock().unwrap().clone();
    let (program, args) = crate::sidecar::find_sidecar_path(resource_dir.as_deref())
        .map_err(|e| format!("Failed to find sidecar: {}", e))?;

    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let envs = collect_sidecar_envs(state);
    state
        .sidecar
        .start_with_envs(&program, &args_ref, &envs)
        .map_err(|e| format!("Failed to start sidecar: {}", e))
}

#[command]
pub async fn sidecar_parse_folders(
    state: State<'_, AppState>,
    base_dir: String,
    operator_name: String,
) -> Result<serde_json::Value, String> {
    ensure_sidecar_started(&state)?;
    let known_senders = crate::commands::known_senders::active_known_sender_names()
        .map_err(|e| format!("送测人库读取失败: {}", e))?;
    let measurement_people =
        crate::commands::measurement_people::active_measurement_people_payload()
            .map_err(|e| format!("测量人库读取失败: {}", e))?;

    let cmd = serde_json::json!({
        "command": "parse_folders",
        "params": {
            "base_dir": base_dir,
            "operator_name": operator_name,
            "known_senders": known_senders,
            "measurement_people": measurement_people
        }
    });

    let response = state
        .sidecar
        .send_command(&cmd.to_string())
        .map_err(|e| format!("Sidecar error: {}", e))?;

    serde_json::from_str(&response).map_err(|e| format!("Failed to parse response: {}", e))
}

#[command]
pub async fn sidecar_generate(
    state: State<'_, AppState>,
    base_dir: String,
    records: Vec<serde_json::Value>,
    mut settings: serde_json::Value,
) -> Result<serde_json::Value, String> {
    ensure_sidecar_started(&state)?;
    if let Some(obj) = settings.as_object_mut() {
        obj.insert(
            "known_senders".to_string(),
            serde_json::json!(crate::commands::known_senders::active_known_sender_names()
                .map_err(|e| format!("送测人库读取失败: {}", e))?),
        );
        obj.insert(
            "measurement_people".to_string(),
            serde_json::json!(
                crate::commands::measurement_people::active_measurement_people_payload()
                    .map_err(|e| format!("测量人库读取失败: {}", e))?
            ),
        );
    }

    let cmd = serde_json::json!({
        "command": "generate",
        "params": {
            "base_dir": base_dir,
            "records": records,
            "settings": settings
        }
    });

    let response = state
        .sidecar
        .send_command(&cmd.to_string())
        .map_err(|e| format!("Sidecar error: {}", e))?;

    serde_json::from_str(&response).map_err(|e| format!("Failed to parse response: {}", e))
}

#[command]
pub async fn sidecar_preview(
    state: State<'_, AppState>,
    base_dir: String,
    records: Vec<serde_json::Value>,
    mut settings: serde_json::Value,
) -> Result<serde_json::Value, String> {
    ensure_sidecar_started(&state)?;
    if let Some(obj) = settings.as_object_mut() {
        obj.insert(
            "known_senders".to_string(),
            serde_json::json!(crate::commands::known_senders::active_known_sender_names()
                .map_err(|e| format!("送测人库读取失败: {}", e))?),
        );
        obj.insert(
            "measurement_people".to_string(),
            serde_json::json!(
                crate::commands::measurement_people::active_measurement_people_payload()
                    .map_err(|e| format!("测量人库读取失败: {}", e))?
            ),
        );
    }

    let cmd = serde_json::json!({
        "command": "preview",
        "params": {
            "base_dir": base_dir,
            "records": records,
            "settings": settings
        }
    });

    let response = state
        .sidecar
        .send_command(&cmd.to_string())
        .map_err(|e| format!("Sidecar error: {}", e))?;

    serde_json::from_str(&response).map_err(|e| format!("Failed to parse response: {}", e))
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TemplateInfo {
    pub path: Option<String>,
    pub exists: bool,
    pub source: Option<String>,
}

/// 查询当前生效的模板信息
#[command]
pub async fn sidecar_get_template_info(state: State<'_, AppState>) -> Result<TemplateInfo, String> {
    ensure_sidecar_started(&state)?;

    let cmd = serde_json::json!({ "command": "get_template_info" });
    let response = state
        .sidecar
        .send_command(&cmd.to_string())
        .map_err(|e| format!("Sidecar error: {}", e))?;
    let parsed: serde_json::Value =
        serde_json::from_str(&response).map_err(|e| format!("Failed to parse response: {}", e))?;

    if !parsed
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(parsed
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown error")
            .to_string());
    }

    let data = parsed
        .get("data")
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    Ok(TemplateInfo {
        path: data
            .get("path")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        exists: data
            .get("exists")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        source: data
            .get("source")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    })
}

/// 替换模板：用户选择一个 xlsx 文件，复制到 user_template_dir 作为自定义模板
#[command]
pub async fn sidecar_replace_template(
    state: State<'_, AppState>,
    template_path: String,
) -> Result<TemplateInfo, String> {
    ensure_sidecar_started(&state)?;

    let cmd = serde_json::json!({
        "command": "replace_template",
        "params": { "template_path": template_path }
    });
    let response = state
        .sidecar
        .send_command(&cmd.to_string())
        .map_err(|e| format!("Sidecar error: {}", e))?;
    let parsed: serde_json::Value =
        serde_json::from_str(&response).map_err(|e| format!("Failed to parse response: {}", e))?;

    if !parsed
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(parsed
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown error")
            .to_string());
    }

    let data = parsed
        .get("data")
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    Ok(TemplateInfo {
        path: data
            .get("path")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        exists: data
            .get("path")
            .and_then(|v| v.as_str())
            .map(|s| std::path::Path::new(s).is_file())
            .unwrap_or(false),
        source: data
            .get("source")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    })
}

/// 重置模板：清除用户自定义模板，回退到内置/工作目录模板
#[command]
pub async fn sidecar_reset_template(state: State<'_, AppState>) -> Result<TemplateInfo, String> {
    ensure_sidecar_started(&state)?;

    let cmd = serde_json::json!({ "command": "reset_template" });
    let response = state
        .sidecar
        .send_command(&cmd.to_string())
        .map_err(|e| format!("Sidecar error: {}", e))?;
    let parsed: serde_json::Value =
        serde_json::from_str(&response).map_err(|e| format!("Failed to parse response: {}", e))?;

    if !parsed
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(parsed
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown error")
            .to_string());
    }

    let data = parsed
        .get("data")
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    let path = data
        .get("path")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    Ok(TemplateInfo {
        exists: path
            .as_ref()
            .map(|p| std::path::Path::new(p).is_file())
            .unwrap_or(false),
        path,
        source: None,
    })
}

/// 模板位置信息：当前生效模板 + 内置打包模板 + 用户自定义模板目录
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TemplatePaths {
    /// 当前生效的模板路径
    pub current_path: Option<String>,
    /// 当前生效模板来源: "user" | "workdir" | "bundled" | null
    pub current_source: Option<String>,
    /// 内置打包模板路径（resources/template.xlsx）
    pub bundled_path: Option<String>,
    /// 内置打包模板是否存在
    pub bundled_exists: bool,
    /// 用户自定义模板存放目录
    pub user_template_dir: String,
    /// 用户自定义模板文件路径（user_template.xlsx）
    pub user_template_path: Option<String>,
    /// 用户自定义模板是否存在
    pub user_template_exists: bool,
}

/// 返回所有模板相关路径，供前端「查看模板位置」功能使用。
#[command]
pub async fn get_template_paths(state: State<'_, AppState>) -> Result<TemplatePaths, String> {
    // 当前生效模板：通过 sidecar 查询
    let current_path: Option<String>;
    let current_source: Option<String>;
    if ensure_sidecar_started(&state).is_ok() {
        let cmd = serde_json::json!({ "command": "get_template_info" });
        if let Ok(response) = state.sidecar.send_command(&cmd.to_string()) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&response) {
                if parsed
                    .get("success")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false)
                {
                    let data = parsed
                        .get("data")
                        .cloned()
                        .unwrap_or(serde_json::Value::Null);
                    current_path = data
                        .get("path")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    current_source = data
                        .get("source")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                } else {
                    current_path = None;
                    current_source = None;
                }
            } else {
                current_path = None;
                current_source = None;
            }
        } else {
            current_path = None;
            current_source = None;
        }
    } else {
        current_path = None;
        current_source = None;
    }

    // 内置打包模板
    let bundled_path = state.bundled_template_path.lock().unwrap().clone();
    let bundled_path_str = bundled_path
        .as_ref()
        .map(|p| p.to_string_lossy().to_string());
    let bundled_exists = bundled_path_str
        .as_ref()
        .map(|p| std::path::Path::new(p).is_file())
        .unwrap_or(false);

    // 用户自定义模板目录和文件
    let user_dir = current_user_template_dir(&state);
    let user_dir_str = user_dir.to_string_lossy().to_string();
    let user_file = user_dir.join("user_template.xlsx");
    let user_file_str = user_file.to_string_lossy().to_string();
    let user_file_exists = user_file.is_file();

    Ok(TemplatePaths {
        current_path,
        current_source,
        bundled_path: bundled_path_str,
        bundled_exists,
        user_template_dir: user_dir_str,
        user_template_path: Some(user_file_str),
        user_template_exists: user_file_exists,
    })
}
