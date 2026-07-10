use tauri::{command, AppHandle};
use serde::Serialize;

#[command]
pub async fn select_folder(
    app: AppHandle,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let mut dialog = app.dialog().file();
    if let Some(default_path) = default_path {
        let path = std::path::PathBuf::from(default_path);
        if path.is_dir() {
            dialog = dialog.set_directory(path);
        }
    }

    let path = dialog.blocking_pick_folder();

    match path {
        Some(path) => Ok(Some(path.to_string())),
        None => Ok(None),
    }
}

/// 弹出文件选择对话框，限定为 .xlsx 文件，用于「替换模板」功能
#[command]
pub async fn select_xlsx_file(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = app
        .dialog()
        .file()
        .add_filter("Excel 模板", &["xlsx"])
        .blocking_pick_file();

    match path {
        Some(path) => Ok(Some(path.to_string())),
        None => Ok(None),
    }
}

fn is_date_folder(name: &str) -> bool {
    let chars: Vec<char> = name.chars().collect();
    let mut i = 0;
    while i < chars.len() && chars[i].is_ascii_digit() {
        i += 1;
    }
    if i == 0 {
        return false;
    }
    if i >= chars.len() || chars[i] != '.' {
        return false;
    }
    i += 1;
    while i < chars.len() && chars[i].is_ascii_digit() {
        i += 1;
    }
    if i < chars.len() && matches!(chars[i], 'A' | 'B' | 'a' | 'b') {
        i += 1;
    }
    i == chars.len()
}

#[command]
pub fn list_date_folders(work_dir: String) -> Result<Vec<String>, String> {
    let path = std::path::Path::new(&work_dir);
    if !path.exists() || !path.is_dir() {
        return Ok(vec![]);
    }
    let mut folders = Vec::new();
    let entries = std::fs::read_dir(&path).map_err(|e| format!("无法读取目录: {}", e))?;
    for entry in entries {
        if let Ok(entry) = entry {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let name = entry.file_name().to_string_lossy().to_string();
                if is_date_folder(&name) {
                    folders.push(name);
                }
            }
        }
    }
    folders.sort();
    Ok(folders)
}

/// 列出指定目录的直接子文件夹名（不递归）。
#[command]
pub fn list_child_folders(path: String) -> Result<Vec<String>, String> {
    let p = std::path::Path::new(&path);
    if !p.exists() || !p.is_dir() {
        return Ok(vec![]);
    }
    let mut names = Vec::new();
    let entries = std::fs::read_dir(p).map_err(|e| format!("无法读取目录: {}", e))?;
    for entry in entries {
        if let Ok(entry) = entry {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                names.push(entry.file_name().to_string_lossy().to_string());
            }
        }
    }
    names.sort();
    Ok(names)
}

#[derive(Serialize)]
pub struct MovedFolderInfo {
    pub folder_name: String,
    pub source_path: String,
    pub target_path: String,
}

fn safe_unique_destination(target_dir: &std::path::Path, folder_name: &str) -> std::path::PathBuf {
    let mut candidate = target_dir.join(folder_name);
    if !candidate.exists() {
        return candidate;
    }
    for index in 1..=999 {
        let next_name = format!("{}-{}", folder_name, index);
        candidate = target_dir.join(next_name);
        if !candidate.exists() {
            return candidate;
        }
    }
    let fallback = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    target_dir.join(format!("{}-{}", folder_name, fallback))
}

#[command]
pub fn move_folders_to_shift_bucket(
    date_dir: String,
    folder_names: Vec<String>,
    shift: String,
) -> Result<Vec<MovedFolderInfo>, String> {
    if folder_names.is_empty() {
        return Ok(vec![]);
    }
    let shift = shift.trim().to_uppercase();
    if shift != "A" && shift != "B" {
        return Err("班次必须是 A 或 B".into());
    }
    let date_path = std::fs::canonicalize(&date_dir).map_err(|e| format!("日期目录无效: {}", e))?;
    if !date_path.is_dir() {
        return Err("日期目录不是有效文件夹".into());
    }
    let target_dir = date_path.join(format!("新建文件夹{}", shift));
    if target_dir.exists() && !target_dir.is_dir() {
        return Err(format!("目标位置已存在但不是文件夹: {}", target_dir.display()));
    }
    if !target_dir.exists() {
        std::fs::create_dir_all(&target_dir).map_err(|e| format!("无法创建目标文件夹: {}", e))?;
    }

    let mut moved = Vec::new();
    for raw_name in folder_names {
        let folder_name = raw_name.trim();
        if folder_name.is_empty() || folder_name == "." || folder_name == ".." {
            return Err("省略清单包含无效文件夹名".into());
        }
        let source = date_path.join(folder_name);
        let source_canonical = std::fs::canonicalize(&source)
            .map_err(|e| format!("源文件夹不存在或不可访问 {}: {}", folder_name, e))?;
        if !source_canonical.is_dir() {
            return Err(format!("源路径不是文件夹: {}", folder_name));
        }
        if source_canonical.parent() != Some(date_path.as_path()) {
            return Err(format!("只允许移动当前日期目录的直接子文件夹: {}", folder_name));
        }
        if source_canonical == target_dir {
            return Err(format!("不能移动目标文件夹本身: {}", folder_name));
        }

        let destination = safe_unique_destination(&target_dir, folder_name);
        std::fs::rename(&source_canonical, &destination)
            .map_err(|e| format!("移动 {} 失败: {}", folder_name, e))?;
        moved.push(MovedFolderInfo {
            folder_name: folder_name.to_string(),
            source_path: source_canonical.to_string_lossy().to_string(),
            target_path: destination.to_string_lossy().to_string(),
        });
    }

    Ok(moved)
}

#[command]
pub async fn open_folder(path: String) -> Result<(), String> {
    use std::process::Command;

    let p = std::path::Path::new(&path);
    // 如果传入的是文件路径，自动取其父目录
    let target = if p.is_file() {
        p.parent().ok_or("无法获取父目录")?
    } else {
        // 可能路径不存在（例如 canonicalize 前），尝试取父目录
        if p.extension().is_some() {
            p.parent().unwrap_or(p)
        } else {
            p
        }
    };

    // Validate that target is a real local directory
    let canonical = std::fs::canonicalize(target).map_err(|e| format!("无效路径: {}", e))?;
    if !canonical.is_dir() {
        return Err("路径不是有效目录".into());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&canonical)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&canonical)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&canonical)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}
