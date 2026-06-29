use crate::AppState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{State, command};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct AppConfig {
    pub work_dir: String,
    pub output_dir: String,
    pub src_output: bool,
    pub leave_strategy: Option<String>,
    pub enable_hand: Option<bool>,
    pub enable_other: Option<bool>,
    pub shift_default: Option<String>,
    pub complex_default: String,
    pub operator_name: String,
    pub config_dir: Option<String>,
    pub config_dir_ever_set: Option<bool>,
    /// 特殊大件物品列表（如烧结盘），每件耗时固定，不参与 tpp 缩放
    /// 格式: [{"name": "烧结盘", "minutes": 8}]
    #[serde(default)]
    pub special_items: Vec<SpecialItem>,
    /// 手量单次最大时长（分钟），默认 120
    #[serde(default = "default_hand_max")]
    pub hand_max: Option<f64>,
    /// 其他事务单次最大时长（分钟），默认 90
    #[serde(default = "default_other_max")]
    pub other_max: Option<f64>,
    /// 每件耗时下限（分钟）
    #[serde(default)]
    pub tpp_min: Option<f64>,
    /// 每件耗时上限（分钟）
    #[serde(default)]
    pub tpp_max: Option<f64>,
    /// 包间休息时长（分钟）
    #[serde(default)]
    pub pkg_rest: Option<i64>,
    /// 识别补充规则文件名或路径，默认与 config.json 同目录的 recognition-rules.json
    #[serde(default)]
    pub recognition_rules_path: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct SpecialItem {
    pub name: String,
    /// 每件测量耗时（分钟）
    #[serde(default = "default_minutes")]
    pub minutes: f64,
}

fn default_minutes() -> f64 {
    8.0
}

fn default_hand_max() -> Option<f64> {
    Some(120.0)
}

fn default_other_max() -> Option<f64> {
    Some(90.0)
}

fn portable_root_from_exe() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let exe_dir = exe.parent()?.to_path_buf();

    // Portable package layout:
    // OMM日报系统.exe
    // binaries/generate_report.exe
    // resources/template.xlsx
    let has_portable_resources = exe_dir.join("resources").join("template.xlsx").is_file()
        && exe_dir.join("binaries").join("generate_report.exe").is_file();
    if has_portable_resources {
        return Some(exe_dir);
    }

    None
}

impl AppConfig {
    pub fn new() -> Self {
        Self::default()
    }

    // Suppress unused old config_path method - now using effective_config_path
    #[allow(dead_code)]
    fn config_path() -> Result<PathBuf, String> {
        // Default to EXE directory (constraint: config file defaults to same directory as program/EXE)
        let exe_dir = std::env::current_exe()
            .map_err(|e| format!("Failed to get exe path: {}", e))?
            .parent()
            .ok_or("Failed to get exe directory")?
            .to_path_buf();
        Ok(exe_dir.join("config.json"))
    }

    /// Get the effective config directory (custom or default)
    ///
    /// 优先级：
    /// 1. 用户显式指定的 config_dir
    /// 2. %APPDATA%\OMM日报系统（用户级目录，无需管理员权限，正式安装后稳定可写）
    /// 3. exe 同级目录（dev 模式或便携版回退）
    pub fn effective_config_dir(&self) -> Result<PathBuf, String> {
        // 1. 用户显式指定
        if let Some(ref dir) = self.config_dir {
            if !dir.is_empty() {
                let path = PathBuf::from(dir);
                if path.is_dir() {
                    return Ok(path);
                }
            }
        }

        // 2. %APPDATA%\OMM日报系统（Windows 用户级 AppData 目录）
        if let Ok(appdata) = std::env::var("APPDATA") {
            if !appdata.is_empty() {
                let appdata_dir = PathBuf::from(&appdata).join("OMM日报系统");
                // 尝试创建目录（首次运行）；已存在则忽略
                let _ = fs::create_dir_all(&appdata_dir);
                if appdata_dir.is_dir() {
                    // 验证可写：尝试创建一个临时文件
                    let probe = appdata_dir.join(".write_probe");
                    if fs::File::create(&probe).is_ok() {
                        let _ = fs::remove_file(&probe);
                        return Ok(appdata_dir);
                    }
                }
            }
        }

        // 3. 回退到 exe 同级目录（dev 模式或便携版）
        let exe_dir = std::env::current_exe()
            .map_err(|e| format!("Failed to get exe path: {}", e))?
            .parent()
            .ok_or("Failed to get exe directory")?
            .to_path_buf();
        Ok(exe_dir)
    }

    /// Get the effective config file path
    pub fn effective_config_path(&self) -> Result<PathBuf, String> {
        let dir = self.effective_config_dir()?;
        Ok(dir.join("config.json"))
    }

    /// Get the effective recognition rules file path.
    pub fn effective_recognition_rules_path(&self) -> Result<PathBuf, String> {
        let dir = self.effective_config_dir()?;
        let configured = self
            .recognition_rules_path
            .as_deref()
            .filter(|p| !p.trim().is_empty())
            .unwrap_or("recognition-rules.json");
        let path = PathBuf::from(configured);
        if path.is_absolute() {
            Ok(path)
        } else {
            Ok(dir.join(path))
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ConfigLoadInfo {
    pub config: AppConfig,
    pub source: String,
    pub path: String,
    pub duplicate_paths: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct StationAliasRule {
    pub alias: String,
    pub station: String,
    pub default_test_type: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct ProductAliasRule {
    pub pattern: String,
    pub product: String,
    pub station: Option<String>,
    pub note: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct WeldingRule {
    pub pattern: String,
    pub product: String,
    pub note: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct SinterPlateRule {
    pub pattern: String,
    pub products: Vec<String>,
    pub note: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RecognitionRules {
    pub version: i64,
    pub updated_at: Option<String>,
    #[serde(default)]
    pub station_aliases: Vec<StationAliasRule>,
    #[serde(default)]
    pub product_aliases: Vec<ProductAliasRule>,
    #[serde(default)]
    pub ignored_tokens: Vec<String>,
    #[serde(default)]
    pub welding_rules: Vec<WeldingRule>,
    #[serde(default)]
    pub sinter_plate_rules: Vec<SinterPlateRule>,
}

impl Default for RecognitionRules {
    fn default() -> Self {
        Self {
            version: 1,
            updated_at: None,
            station_aliases: vec![],
            product_aliases: vec![],
            ignored_tokens: vec![],
            welding_rules: vec![],
            sinter_plate_rules: vec![],
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RecognitionRulesLoadInfo {
    pub rules: RecognitionRules,
    pub path: String,
    pub exists: bool,
}

fn find_all_portable_configs(root: &Path) -> Vec<PathBuf> {
    fn visit(dir: &Path, depth: usize, found: &mut Vec<(usize, PathBuf)>) {
        if depth > 5 {
            return;
        }
        let entries = match fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(_) => return,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if path.file_name().and_then(|s| s.to_str()) == Some("config.json") {
                    found.push((depth, path));
                }
            } else if path.is_dir() {
                visit(&path, depth + 1, found);
            }
        }
    }

    let mut found = Vec::new();
    visit(root, 0, &mut found);
    found.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(&b.1)));
    found.into_iter().map(|(_, path)| path).collect()
}

#[command]
pub async fn load_config() -> Result<AppConfig, String> {
    let result = load_config_with_info().await?;
    Ok(result.config)
}

#[command]
pub async fn load_config_with_info() -> Result<ConfigLoadInfo, String> {
    let default_config = AppConfig::new();

    // 便携版优先：如果便携版目录（含子目录）里已有 config.json，
    // 直接使用该配置，并把 config_dir 指向它所在目录，确保后续保存仍写回便携版。
    if let Some(portable_root) = portable_root_from_exe() {
        let portable_configs = find_all_portable_configs(&portable_root);
        if let Some(first) = portable_configs.first() {
            if let Ok(content) = fs::read_to_string(first) {
                if let Ok(mut config) = serde_json::from_str::<AppConfig>(&content) {
                    if let Some(parent) = first.parent() {
                        config.config_dir = Some(parent.to_string_lossy().to_string());
                    }
                    config.config_dir_ever_set = Some(true);
                    return Ok(ConfigLoadInfo {
                        config,
                        source: "portable".to_string(),
                        path: first.to_string_lossy().to_string(),
                        duplicate_paths: portable_configs.into_iter().map(|p| p.to_string_lossy().to_string()).skip(1).collect(),
                    });
                }
            }
        }
    }

    let path = default_config.effective_config_path()?;
    
    if path.exists() {
        // 正常路径：从默认目录（AppData）读取
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read config: {}", e))?;
        let mut config: AppConfig = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse config: {}", e))?;

        // If config_dir was previously set, try to load from that location
        if let Some(ref dir) = config.config_dir {
            if !dir.is_empty() {
                let custom_path = PathBuf::from(dir).join("config.json");
                if custom_path.exists() {
                    let custom_content = fs::read_to_string(&custom_path)
                        .map_err(|e| format!("Failed to read config from custom dir: {}", e))?;
                    config = serde_json::from_str(&custom_content)
                        .map_err(|e| format!("Failed to parse config from custom dir: {}", e))?;
                    return Ok(ConfigLoadInfo {
                        config,
                        source: "custom".to_string(),
                        path: custom_path.to_string_lossy().to_string(),
                        duplicate_paths: vec![],
                    });
                }
            }
        }
        return Ok(ConfigLoadInfo {
            config,
            source: "appdata".to_string(),
            path: path.to_string_lossy().to_string(),
            duplicate_paths: vec![],
        });
    }

    // 回退查找：AppData 没有配置文件时，尝试从 exe 同级目录读取旧配置
    // （升级场景：老版本配置写在 exe 目录，新版本默认改用 AppData）
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_parent) = exe.parent() {
            let legacy_path = exe_parent.join("config.json");
            if legacy_path.exists() {
                if let Ok(content) = fs::read_to_string(&legacy_path) {
                    if let Ok(mut legacy_config) = serde_json::from_str::<AppConfig>(&content) {
                        // 自动迁移：把旧配置写到新的 AppData 目录
                        // 清除旧的 config_dir 避免循环指向 exe 目录
                        let _ = save_config(AppConfig {
                            config_dir: None,
                            config_dir_ever_set: Some(true), // 标记已设置，避免再弹窗
                            ..legacy_config.clone()
                        }).await;
                        legacy_config.config_dir_ever_set = Some(true);
                        return Ok(ConfigLoadInfo {
                            config: legacy_config,
                            source: "legacy".to_string(),
                            path: legacy_path.to_string_lossy().to_string(),
                            duplicate_paths: vec![],
                        });
                    }
                }
            }
        }
    }
    
    Ok(ConfigLoadInfo {
        config: default_config,
        source: "default".to_string(),
        path: path.to_string_lossy().to_string(),
        duplicate_paths: vec![],
    })
}

#[command]
pub async fn save_config(config: AppConfig) -> Result<(), String> {
    let path = config.effective_config_path()?;
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write config: {}", e))?;
    
    Ok(())
}

#[command]
pub async fn migrate_config(
    state: State<'_, AppState>,
    config: AppConfig,
    new_dir: String,
    strategy: String,  // "copy" | "overwrite" | "load_existing"
) -> Result<AppConfig, String> {
    let new_path = PathBuf::from(&new_dir).join("config.json");
    let _current_path = config.effective_config_path()?;

    // Ensure target directory exists
    fs::create_dir_all(&new_dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    
    let result = match strategy.as_str() {
        "overwrite" => {
            // Copy current config to new location
            let content = serde_json::to_string_pretty(&config)
                .map_err(|e| format!("Failed to serialize config: {}", e))?;
            fs::write(&new_path, content)
                .map_err(|e| format!("Failed to write config: {}", e))?;
            AppConfig {
                config_dir: Some(new_dir),
                config_dir_ever_set: Some(true),
                ..config
            }
        }
        "load_existing" => {
            // Load config from new location
            if !new_path.exists() {
                return Err("No config file found at target location".to_string());
            }
            let content = fs::read_to_string(&new_path)
                .map_err(|e| format!("Failed to read config: {}", e))?;
            let loaded: AppConfig = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse config: {}", e))?;
            AppConfig {
                config_dir: Some(new_dir),
                config_dir_ever_set: Some(true),
                ..loaded
            }
        }
        "copy" | _ => {
            // Copy current config to new location
            if new_path.exists() {
                return Err("Config file already exists at target location".to_string());
            }
            let content = serde_json::to_string_pretty(&config)
                .map_err(|e| format!("Failed to serialize config: {}", e))?;
            fs::write(&new_path, content)
                .map_err(|e| format!("Failed to write config: {}", e))?;
            AppConfig {
                config_dir: Some(new_dir),
                config_dir_ever_set: Some(true),
                ..config
            }
        }
    };

    // Sync the in-memory state so user_template_dir is updated immediately
    *state.config.lock().unwrap() = result.clone();
    if let Ok(dir) = result.effective_config_dir() {
        *state.user_template_dir.lock().unwrap() = dir;
    }

    Ok(result)
}

/// 将前端加载/修改后的配置同步到 Rust AppState，确保后续 sidecar 环境变量
/// 和模板目录使用最新的配置目录。
#[command]
pub async fn sync_config_state(
    state: State<'_, AppState>,
    config: AppConfig,
) -> Result<String, String> {
    *state.config.lock().unwrap() = config.clone();
    let dir = config.effective_config_dir()
        .map_err(|e| format!("Failed to resolve config dir: {}", e))?;
    *state.user_template_dir.lock().unwrap() = dir.clone();
    Ok(dir.to_string_lossy().to_string())
}

#[command]
pub async fn load_recognition_rules(
    state: State<'_, AppState>,
) -> Result<RecognitionRulesLoadInfo, String> {
    let config = state.config.lock().unwrap().clone();
    let path = config.effective_recognition_rules_path()?;
    if !path.exists() {
        return Ok(RecognitionRulesLoadInfo {
            rules: RecognitionRules::default(),
            path: path.to_string_lossy().to_string(),
            exists: false,
        });
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read recognition rules: {}", e))?;
    let rules: RecognitionRules = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse recognition rules: {}", e))?;

    Ok(RecognitionRulesLoadInfo {
        rules,
        path: path.to_string_lossy().to_string(),
        exists: true,
    })
}

#[command]
pub async fn save_recognition_rules(
    state: State<'_, AppState>,
    mut rules: RecognitionRules,
) -> Result<RecognitionRulesLoadInfo, String> {
    let config = state.config.lock().unwrap().clone();
    let path = config.effective_recognition_rules_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create recognition rules directory: {}", e))?;
    }
    rules.version = if rules.version <= 0 { 1 } else { rules.version };
    let content = serde_json::to_string_pretty(&rules)
        .map_err(|e| format!("Failed to serialize recognition rules: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write recognition rules: {}", e))?;

    Ok(RecognitionRulesLoadInfo {
        rules,
        path: path.to_string_lossy().to_string(),
        exists: true,
    })
}
