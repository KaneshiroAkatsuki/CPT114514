use super::{accounts, data_store};
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{command, AppHandle, Manager, State};

#[derive(Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PersonalCleanerOptions {
    pub dry_run: bool,
    pub clean_edge: bool,
    pub keep_passwords_autofill: bool,
    pub clear_site_preferences: bool,
    pub reset_edge: bool,
    pub clear_bookmarks: bool,
    pub clear_extensions: bool,
    pub clear_microsoft_account: bool,
    pub close_adobi_processes: bool,
    pub clear_windows_notifications: bool,
    pub clear_screenshots: bool,
    pub screenshot_window_start: Option<String>,
    pub screenshot_window_end: Option<String>,
    pub screenshot_window_label: Option<String>,
    pub clear_clipboard_history: bool,
    pub clear_opencode_shortcuts: bool,
    pub clear_private_browser_history: bool,
    pub clean_private_browser: bool,
    pub backup_private_browser: bool,
    #[serde(default)]
    pub keep_wifi_prefixes: Vec<String>,
    #[serde(default)]
    pub forget_wifi_profiles: bool,
    #[serde(default)]
    pub forget_wifi_patterns: Vec<String>,
    #[serde(default)]
    pub connect_company_wifi: bool,
    #[serde(default)]
    pub company_wifi_ssid: String,
    pub skip_backup: bool,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersonalCleanerRunInfo {
    pub run_id: String,
    pub script_path: String,
    pub log_path: String,
    pub summary_path: String,
    pub launched: bool,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersonalCleanerLogInfo {
    pub log: String,
    pub done: bool,
    pub summary: Option<serde_json::Value>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersonalCleanerProcessCandidate {
    pub pid: u32,
    pub name: String,
    pub path: String,
    pub kind: String,
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn resolve_cleaner_script(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(
            resource_dir
                .join("resources")
                .join("tools")
                .join("edge-cleaner")
                .join("clean-edge.ps1"),
        );
        candidates.push(
            resource_dir
                .join("tools")
                .join("edge-cleaner")
                .join("clean-edge.ps1"),
        );
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            candidates.push(
                exe_dir
                    .join("resources")
                    .join("tools")
                    .join("edge-cleaner")
                    .join("clean-edge.ps1"),
            );
            candidates.push(
                exe_dir
                    .join("tools")
                    .join("edge-cleaner")
                    .join("clean-edge.ps1"),
            );
        }
    }

    if let Some(manifest_dir) = option_env!("CARGO_MANIFEST_DIR") {
        candidates.push(
            PathBuf::from(manifest_dir)
                .join("resources")
                .join("tools")
                .join("edge-cleaner")
                .join("clean-edge.ps1"),
        );
    }

    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(
            cwd.join("src-tauri")
                .join("resources")
                .join("tools")
                .join("edge-cleaner")
                .join("clean-edge.ps1"),
        );
        candidates.push(
            cwd.join("resources")
                .join("tools")
                .join("edge-cleaner")
                .join("clean-edge.ps1"),
        );
    }

    candidates.into_iter().find(|p| p.is_file())
}

fn effective_log_dir(state: &State<AppState>) -> Result<PathBuf, String> {
    let _guard = state
        .config
        .lock()
        .map_err(|_| "无法读取配置状态".to_string())?;
    data_store::personal_cleaner_log_dir()
}

fn effective_backup_dir(state: &State<AppState>) -> Result<PathBuf, String> {
    let _guard = state
        .config
        .lock()
        .map_err(|_| "无法读取配置状态".to_string())?;
    Ok(PathBuf::from(
        r"C:\Program Files\Adobe\Acrobat DC\Bin\OMM日报系统备份\cleaner-backups",
    ))
}

fn require_admin_account() -> Result<(), String> {
    let account = accounts::current_account_record()?
        .ok_or_else(|| "请先登录管理员账户后再使用个人清理中心。".to_string())?;
    if !matches!(account.role, accounts::AccountRole::Admin) {
        return Err("个人清理中心仅允许管理员账户使用。".to_string());
    }
    Ok(())
}

fn push_switch(args: &mut Vec<String>, enabled: bool, name: &str) {
    if enabled {
        args.push(name.to_string());
    }
}

fn build_script_args(
    script_path: &Path,
    log_path: &Path,
    summary_path: &Path,
    backup_root: &Path,
    options: &PersonalCleanerOptions,
) -> Vec<String> {
    let edge_module_enabled = options.clean_edge
        || options.clear_site_preferences
        || options.reset_edge
        || options.clear_bookmarks
        || options.clear_extensions
        || options.clear_microsoft_account;

    let mut args = vec![
        "-NoProfile".to_string(),
        "-ExecutionPolicy".to_string(),
        "Bypass".to_string(),
        "-File".to_string(),
        script_path.to_string_lossy().to_string(),
        "-NoMenu".to_string(),
        "-LogPath".to_string(),
        log_path.to_string_lossy().to_string(),
        "-JsonSummaryPath".to_string(),
        summary_path.to_string_lossy().to_string(),
        "-BackupRoot".to_string(),
        backup_root.to_string_lossy().to_string(),
    ];

    push_switch(&mut args, options.dry_run, "-DryRun");
    push_switch(&mut args, !edge_module_enabled, "-SkipEdgeCleaning");
    push_switch(
        &mut args,
        edge_module_enabled && !options.clean_edge && !options.reset_edge,
        "-SkipStandardEdgeCleaning",
    );
    push_switch(&mut args, options.skip_backup, "-SkipBackup");
    if options.keep_passwords_autofill {
        args.push("-KeepPasswords".to_string());
        args.push("-KeepAutofill".to_string());
    }
    push_switch(
        &mut args,
        options.clear_site_preferences,
        "-ClearSitePreferences",
    );
    push_switch(&mut args, options.reset_edge, "-ResetEdge");
    push_switch(&mut args, options.clear_bookmarks, "-ClearBookmarks");
    push_switch(&mut args, options.clear_extensions, "-ClearExtensions");
    push_switch(
        &mut args,
        options.clear_microsoft_account,
        "-ClearMicrosoftAccount",
    );
    push_switch(
        &mut args,
        options.close_adobi_processes,
        "-CloseAdobiProcesses",
    );
    push_switch(
        &mut args,
        options.clear_windows_notifications,
        "-ClearWindowsNotifications",
    );
    if options.clear_screenshots {
        if let (Some(start), Some(end)) = (
            options.screenshot_window_start.as_deref(),
            options.screenshot_window_end.as_deref(),
        ) {
            args.push("-ClearScreenshots".to_string());
            args.push("-ClearScreenshotsFrom".to_string());
            args.push(start.trim().to_string());
            args.push("-ClearScreenshotsTo".to_string());
            args.push(end.trim().to_string());
            if let Some(label) = options.screenshot_window_label.as_deref() {
                if !label.trim().is_empty() {
                    args.push("-ClearScreenshotsLabel".to_string());
                    args.push(label.trim().to_string());
                }
            }
        }
    }
    push_switch(
        &mut args,
        options.clear_clipboard_history,
        "-ClearClipboardHistory",
    );
    push_switch(
        &mut args,
        options.clear_opencode_shortcuts,
        "-ClearOpencodeShortcuts",
    );
    push_switch(
        &mut args,
        options.clear_private_browser_history,
        "-ClearPrivateBrowserHistory",
    );
    push_switch(
        &mut args,
        options.clean_private_browser,
        "-CleanPrivateBrowser",
    );
    push_switch(
        &mut args,
        options.clean_private_browser && !options.backup_private_browser,
        "-SkipPrivateBrowserBackup",
    );

    let prefixes: Vec<String> = options
        .keep_wifi_prefixes
        .iter()
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .take(12)
        .map(|p| p.to_string())
        .collect();
    if !prefixes.is_empty() {
        args.push("-KeepWifiPrefixes".to_string());
        args.push(prefixes.join(","));
    }
    let forget_wifi_patterns: Vec<String> = options
        .forget_wifi_patterns
        .iter()
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .take(12)
        .map(|p| p.to_string())
        .collect();
    if options.forget_wifi_profiles && !forget_wifi_patterns.is_empty() {
        args.push("-ForgetWifiPatterns".to_string());
        args.push(forget_wifi_patterns.join(","));
    }
    let company_wifi_ssid = options.company_wifi_ssid.trim();
    if options.connect_company_wifi && !company_wifi_ssid.is_empty() {
        args.push("-ConnectCompanyWifi".to_string());
        args.push("-CompanyWifiSsid".to_string());
        args.push(company_wifi_ssid.to_string());
    }

    args
}

fn quote_for_windows_command_line(arg: &str) -> String {
    if arg.is_empty() {
        return "\"\"".to_string();
    }
    let needs_quotes = arg.chars().any(|c| c.is_whitespace() || c == '"');
    if !needs_quotes {
        return arg.to_string();
    }
    let escaped = arg.replace('"', "\\\"");
    format!("\"{}\"", escaped)
}

fn ps_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn parse_process_candidates(json: &str) -> Result<Vec<PersonalCleanerProcessCandidate>, String> {
    let trimmed = json.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let value = serde_json::from_str::<serde_json::Value>(trimmed)
        .map_err(|e| format!("无法解析进程预览结果: {}", e))?;
    let values = match value {
        serde_json::Value::Array(items) => items,
        serde_json::Value::Null => Vec::new(),
        other => vec![other],
    };

    let mut candidates = Vec::new();
    for item in values {
        let pid = item
            .get("pid")
            .and_then(|v| v.as_u64())
            .unwrap_or(0)
            .min(u32::MAX as u64) as u32;
        let name = item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let path = item
            .get("path")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let kind = item
            .get("kind")
            .and_then(|v| v.as_str())
            .unwrap_or("Process")
            .to_string();

        if pid > 0 && !name.is_empty() {
            candidates.push(PersonalCleanerProcessCandidate {
                pid,
                name,
                path,
                kind,
            });
        }
    }

    candidates.sort_by(|a, b| a.kind.cmp(&b.kind).then(a.name.cmp(&b.name)).then(a.pid.cmp(&b.pid)));
    Ok(candidates)
}

#[command]
pub async fn preview_personal_cleaner_processes() -> Result<Vec<PersonalCleanerProcessCandidate>, String> {
    require_admin_account()?;

    let adobi_root = r"C:\Program Files\Adobe\Acrobat DC\Adobi";
    let script = format!(
        r#"
$adobiRoot = {adobi_root}
$items = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object {{
    $path = [string]$_.ExecutablePath
    $name = [string]$_.Name
    $isAdobi = -not [string]::IsNullOrWhiteSpace($path) -and $path.StartsWith($adobiRoot, [System.StringComparison]::OrdinalIgnoreCase)
    $isEdge = $name -ieq 'msedge.exe'
    $isCodex = ($name -match '(?i)codex') -or ((-not [string]::IsNullOrWhiteSpace($path)) -and (($path -match '(?i)(\\|/|^)codex(\\|/|\.|_|-|$| )') -or ($path -match '(?i)OpenAI\.Codex')))
    if ($isAdobi -or $isEdge -or $isCodex) {{
        $kind = if ($isCodex) {{ 'Codex' }} elseif ($isEdge) {{ 'Edge' }} else {{ 'Adobi' }}
        [ordered]@{{
            pid = [int]$_.ProcessId
            name = $name
            path = $path
            kind = $kind
        }}
    }}
}})
ConvertTo-Json -InputObject $items -Compress -Depth 4
"#,
        adobi_root = ps_single_quote(adobi_root)
    );

    let output = Command::new("powershell.exe")
        .arg("-NoProfile")
        .arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-Command")
        .arg(script)
        .output()
        .map_err(|e| format!("无法预览将关闭的进程: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "预览将关闭的进程失败。".to_string()
        } else {
            format!("预览将关闭的进程失败: {}", stderr)
        });
    }

    parse_process_candidates(&String::from_utf8_lossy(&output.stdout))
}

#[command]
pub async fn run_personal_cleaner(
    app: AppHandle,
    state: State<'_, AppState>,
    options: PersonalCleanerOptions,
) -> Result<PersonalCleanerRunInfo, String> {
    require_admin_account()?;

    let script_path = resolve_cleaner_script(&app).ok_or_else(|| {
        "未找到内置个人清理脚本 resources/tools/edge-cleaner/clean-edge.ps1".to_string()
    })?;
    let log_dir = effective_log_dir(&state)?;
    let backup_root = effective_backup_dir(&state)?;
    let run_id = format!("cleaner-{}", now_millis());
    let log_path = log_dir.join(format!("{}.log", run_id));
    let summary_path = log_dir.join(format!("{}.json", run_id));

    let script_args = build_script_args(&script_path, &log_path, &summary_path, &backup_root, &options);
    let argument_line = script_args
        .iter()
        .map(|arg| quote_for_windows_command_line(arg))
        .collect::<Vec<String>>()
        .join(" ");

    let command = format!(
        "Start-Process -FilePath {} -ArgumentList {} -Verb RunAs -WindowStyle Normal",
        ps_single_quote("powershell.exe"),
        ps_single_quote(&argument_line)
    );

    Command::new("powershell.exe")
        .arg("-NoProfile")
        .arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-Command")
        .arg(command)
        .spawn()
        .map_err(|e| format!("无法启动个人清理中心: {}", e))?;

    Ok(PersonalCleanerRunInfo {
        run_id,
        script_path: script_path.to_string_lossy().to_string(),
        log_path: log_path.to_string_lossy().to_string(),
        summary_path: summary_path.to_string_lossy().to_string(),
        launched: true,
    })
}

#[command]
pub async fn read_personal_cleaner_log(
    state: State<'_, AppState>,
    log_path: String,
    summary_path: String,
) -> Result<PersonalCleanerLogInfo, String> {
    require_admin_account()?;

    let log_dir = effective_log_dir(&state)?;
    for path in [&log_path, &summary_path] {
        let parent = Path::new(path)
            .parent()
            .ok_or_else(|| "日志路径无效".to_string())?;
        if parent != log_dir {
            return Err("只能读取个人清理中心日志目录中的文件".to_string());
        }
    }

    let log = fs::read_to_string(&log_path).unwrap_or_else(|_| {
        if Path::new(&log_path).exists() {
            "日志文件暂时不可读，可能正在写入中。".to_string()
        } else {
            "等待管理员权限确认或脚本启动...".to_string()
        }
    });

    let summary = fs::read_to_string(&summary_path)
        .ok()
        .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok());
    let done = summary.is_some();

    Ok(PersonalCleanerLogInfo { log, done, summary })
}
