use tauri::Manager;

pub mod commands;
pub mod sidecar;

use commands::config::AppConfig;
use sidecar::SidecarManager;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    pub sidecar: SidecarManager,
    pub config: Mutex<AppConfig>,
    /// 内置打包模板的绝对路径（dev 模式指向源码 resources/，打包后指向 resource_dir）
    pub bundled_template_path: Mutex<Option<PathBuf>>,
    /// 用户自定义模板存放目录（通常 = config_dir）
    pub user_template_dir: Mutex<PathBuf>,
    /// Tauri resource_dir，用于生产模式查找 sidecar 与资源
    pub resource_dir: Mutex<Option<PathBuf>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            sidecar: SidecarManager::new(),
            config: Mutex::new(AppConfig::new()),
            bundled_template_path: Mutex::new(None),
            user_template_dir: Mutex::new(
                std::env::current_exe()
                    .ok()
                    .and_then(|p| p.parent().map(|d| d.to_path_buf()))
                    .unwrap_or_else(|| PathBuf::from(".")),
            ),
            resource_dir: Mutex::new(None),
        }
    }
}

/// 在 dev 模式下，资源文件位于 <project>/src-tauri/resources/；
/// 打包后位于 resource_dir()。
/// 便携版（直接运行 exe）位于 exe 同级的 resources/ 目录。
fn resolve_bundled_template(app: &tauri::AppHandle) -> Option<PathBuf> {
    // 1. 打包模式：resource_dir/resources/template.xlsx
    if let Ok(rd) = app.path().resource_dir() {
        let p = rd.join("resources").join("template.xlsx");
        if p.is_file() {
            return Some(p);
        }
        // 部分 Tauri 版本会把 resources/* 直接平铺到 resource_dir
        let p2 = rd.join("template.xlsx");
        if p2.is_file() {
            return Some(p2);
        }
    }
    // 1b. 便携版回退：exe 同级 resources/template.xlsx
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            let p = exe_dir.join("resources").join("template.xlsx");
            if p.is_file() {
                return Some(p);
            }
            // 也尝试 exe 同级直接放 template.xlsx
            let p2 = exe_dir.join("template.xlsx");
            if p2.is_file() {
                return Some(p2);
            }
        }
    }
    // 2. Dev 模式：从 CARGO_MANIFEST_DIR 推导
    let manifest_dir = option_env!("CARGO_MANIFEST_DIR").map(PathBuf::from);
    if let Some(md) = manifest_dir {
        let p = md.join("resources").join("template.xlsx");
        if p.is_file() {
            return Some(p);
        }
    }
    // 3. 从 current_dir 推导（src-tauri 或其父目录）
    if let Ok(cwd) = std::env::current_dir() {
        for base in [cwd.clone(), cwd.join("src-tauri")] {
            let p = base.join("resources").join("template.xlsx");
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

/// 计算用户模板存放目录：优先用 config_dir，否则 exe 同级目录
fn resolve_user_template_dir(config: &AppConfig) -> PathBuf {
    if let Ok(dir) = config.effective_config_dir() {
        return dir;
    }
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."))
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Get main window and show it after setup
            if let Some(window) = app.get_webview_window("main") {
                window.show().unwrap();
            }

            // Resolve bundled template path and user template dir, store in AppState
            let bundled = resolve_bundled_template(app.handle());
            if let Some(ref p) = bundled {
                println!("[setup] bundled template: {}", p.display());
            } else {
                println!("[setup] WARNING: bundled template not found");
            }
            let resource_dir = app.path().resource_dir().ok();
            if let Some(ref rd) = resource_dir {
                println!("[setup] resource_dir: {}", rd.display());
            }
            let state: tauri::State<AppState> = app.state();
            *state.bundled_template_path.lock().unwrap() = bundled;
            *state.resource_dir.lock().unwrap() = resource_dir;
            let user_dir = resolve_user_template_dir(&state.config.lock().unwrap());
            *state.user_template_dir.lock().unwrap() = user_dir;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::sidecar::sidecar_parse_folders,
            commands::sidecar::sidecar_generate,
            commands::sidecar::sidecar_preview,
            commands::sidecar::sidecar_get_template_info,
            commands::sidecar::sidecar_replace_template,
            commands::sidecar::sidecar_reset_template,
            commands::sidecar::get_template_paths,
            commands::file::select_folder,
            commands::file::open_folder,
            commands::file::list_date_folders,
            commands::file::list_child_folders,
            commands::file::select_xlsx_file,
            commands::config::load_config,
            commands::config::load_config_with_info,
            commands::config::save_config,
            commands::config::migrate_config,
            commands::config::sync_config_state,
            commands::config::load_recognition_rules,
            commands::config::save_recognition_rules,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
