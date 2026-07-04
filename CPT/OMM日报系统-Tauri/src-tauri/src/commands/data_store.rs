use rusqlite::Connection;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::command;

const SCHEMA_VERSION: i64 = 3;
const APPDATA_DIR_NAME: &str = "玉衡山科学院管理厅";
const LEGACY_APPDATA_DIR_NAME: &str = "OMM日报系统";

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DataStoreInfo {
    pub data_root: String,
    pub database_path: String,
    pub profiles_dir: String,
    pub logs_dir: String,
    pub backups_dir: String,
    pub manifests_dir: String,
    pub schema_version: i64,
    pub account_count: i64,
    pub known_sender_count: i64,
    pub measurement_person_count: i64,
    pub legacy_root: String,
    pub legacy_accounts_exists: bool,
    pub legacy_profiles_exists: bool,
    pub is_portable: bool,
}

fn portable_root_from_exe() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let exe_dir = exe.parent()?.to_path_buf();
    let has_portable_resources = exe_dir.join("resources").join("template.xlsx").is_file()
        && exe_dir
            .join("binaries")
            .join("generate_report.exe")
            .is_file();
    if has_portable_resources {
        return Some(exe_dir);
    }
    None
}

fn appdata_dir(name: &str) -> Option<PathBuf> {
    let appdata = std::env::var("APPDATA").ok()?;
    if appdata.is_empty() {
        return None;
    }
    Some(PathBuf::from(appdata).join(name))
}

fn copy_dir_missing(source: &Path, target: &Path) -> Result<(), String> {
    if !source.exists() {
        return Ok(());
    }
    if source.is_file() {
        if target.exists() {
            return Ok(());
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("无法创建迁移目录: {}", e))?;
        }
        fs::copy(source, target).map_err(|e| format!("无法迁移旧数据文件: {}", e))?;
        return Ok(());
    }

    fs::create_dir_all(target).map_err(|e| format!("无法创建迁移目录: {}", e))?;
    for entry in fs::read_dir(source).map_err(|e| format!("无法读取旧数据目录: {}", e))? {
        let entry = entry.map_err(|e| format!("无法读取旧数据项: {}", e))?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if source_path.is_dir() {
            copy_dir_missing(&source_path, &target_path)?;
        } else if source_path.is_file() && !target_path.exists() {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("无法创建迁移目录: {}", e))?;
            }
            fs::copy(&source_path, &target_path)
                .map_err(|e| format!("无法迁移旧数据文件: {}", e))?;
        }
    }
    Ok(())
}

fn migrate_legacy_appdata_dir(new_dir: &Path) -> Result<(), String> {
    let Some(legacy_dir) = appdata_dir(LEGACY_APPDATA_DIR_NAME) else {
        return Ok(());
    };
    if !legacy_dir.exists() || legacy_dir == new_dir {
        return Ok(());
    }
    copy_dir_missing(&legacy_dir, new_dir)
}

fn default_storage_base_dir() -> Result<PathBuf, String> {
    if let Some(portable_root) = portable_root_from_exe() {
        return Ok(portable_root);
    }
    if let Some(dir) = appdata_dir(APPDATA_DIR_NAME) {
        let _ = migrate_legacy_appdata_dir(&dir);
        fs::create_dir_all(&dir).map_err(|e| format!("无法创建应用数据目录: {}", e))?;
        return Ok(dir);
    }
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("无法获取程序路径: {}", e))?
        .parent()
        .ok_or("无法获取程序目录")?
        .to_path_buf();
    Ok(exe_dir)
}

pub fn data_root() -> Result<PathBuf, String> {
    if let Ok(root) = std::env::var("OMM_DATA_ROOT") {
        if !root.trim().is_empty() {
            let root = PathBuf::from(root);
            fs::create_dir_all(&root).map_err(|e| format!("无法创建数据目录: {}", e))?;
            return ensure_data_subdirs(root);
        }
    }
    let root = default_storage_base_dir()?.join("data");
    ensure_data_subdirs(root)
}

fn ensure_data_subdirs(root: PathBuf) -> Result<PathBuf, String> {
    fs::create_dir_all(root.join("profiles"))
        .map_err(|e| format!("无法创建账户配置目录: {}", e))?;
    fs::create_dir_all(root.join("logs").join("personal-cleaner"))
        .map_err(|e| format!("无法创建日志目录: {}", e))?;
    fs::create_dir_all(root.join("backups").join("personal-cleaner"))
        .map_err(|e| format!("无法创建备份目录: {}", e))?;
    fs::create_dir_all(root.join("manifests"))
        .map_err(|e| format!("无法创建 manifest 目录: {}", e))?;
    Ok(root)
}

pub fn legacy_omm_root() -> Result<PathBuf, String> {
    Ok(default_storage_base_dir()?.join(".omm"))
}

pub fn database_path() -> Result<PathBuf, String> {
    Ok(data_root()?.join("omm.db"))
}

pub fn profiles_dir() -> Result<PathBuf, String> {
    Ok(data_root()?.join("profiles"))
}

pub fn logs_dir() -> Result<PathBuf, String> {
    let dir = data_root()?.join("logs");
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建日志目录: {}", e))?;
    Ok(dir)
}

pub fn backups_dir() -> Result<PathBuf, String> {
    let dir = data_root()?.join("backups");
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建备份目录: {}", e))?;
    Ok(dir)
}

pub fn manifests_dir() -> Result<PathBuf, String> {
    let dir = data_root()?.join("manifests");
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建 manifest 目录: {}", e))?;
    Ok(dir)
}

pub fn personal_cleaner_log_dir() -> Result<PathBuf, String> {
    let dir = logs_dir()?.join("personal-cleaner");
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建个人清理日志目录: {}", e))?;
    Ok(dir)
}

pub fn personal_cleaner_backup_dir() -> Result<PathBuf, String> {
    let dir = backups_dir()?.join("personal-cleaner");
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建个人清理备份目录: {}", e))?;
    Ok(dir)
}

pub fn sanitize_id(value: &str) -> String {
    let mut out = String::new();
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
        } else if ch == '-' || ch == '_' {
            out.push(ch);
        }
    }
    if out.is_empty() {
        "user".to_string()
    } else {
        out
    }
}

pub fn profile_dir_for_account(account_id: &str) -> Result<PathBuf, String> {
    let dir = profiles_dir()?.join(sanitize_id(account_id));
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建账户配置目录: {}", e))?;
    Ok(dir)
}

pub fn legacy_accounts_path() -> Result<PathBuf, String> {
    Ok(legacy_omm_root()?.join("accounts").join("accounts.json"))
}

pub fn legacy_session_path() -> Result<PathBuf, String> {
    Ok(legacy_omm_root()?.join("accounts").join("session.json"))
}

pub fn legacy_profile_dir_for_account(account_id: &str) -> Result<PathBuf, String> {
    Ok(legacy_omm_root()?
        .join("profiles")
        .join(sanitize_id(account_id)))
}

pub fn open_database() -> Result<Connection, String> {
    let path = database_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("无法创建数据库目录: {}", e))?;
    }
    let conn = Connection::open(&path).map_err(|e| format!("无法打开本地数据库: {}", e))?;
    conn.busy_timeout(Duration::from_secs(10))
        .map_err(|e| format!("无法设置数据库等待时间: {}", e))?;
    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (strftime('%s','now'))
        );

        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            nickname TEXT NOT NULL,
            real_name TEXT NOT NULL,
            role TEXT NOT NULL,
            pin_salt TEXT NOT NULL,
            pin_hash TEXT NOT NULL,
            display_name_mode TEXT NOT NULL DEFAULT 'nickname',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (strftime('%s','now'))
        );

        CREATE TABLE IF NOT EXISTS account_session (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            current_account_id TEXT,
            updated_at TEXT NOT NULL DEFAULT (strftime('%s','now'))
        );

        CREATE TABLE IF NOT EXISTS account_settings (
            account_id TEXT PRIMARY KEY,
            settings_json TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (strftime('%s','now'))
        );

        CREATE TABLE IF NOT EXISTS recognition_rules (
            account_id TEXT PRIMARY KEY,
            rules_json TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (strftime('%s','now'))
        );

        CREATE TABLE IF NOT EXISTS package_manifests (
            id TEXT PRIMARY KEY,
            version TEXT NOT NULL,
            packaged_at TEXT NOT NULL,
            manifest_json TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (strftime('%s','now'))
        );

        CREATE TABLE IF NOT EXISTS duration_rules (
            id TEXT PRIMARY KEY,
            builtin_key TEXT,
            name TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            source TEXT NOT NULL DEFAULT 'user',
            priority INTEGER NOT NULL DEFAULT 100,
            match_mode TEXT NOT NULL DEFAULT 'all',
            match_json TEXT NOT NULL,
            duration_json TEXT NOT NULL,
            user_modified INTEGER NOT NULL DEFAULT 0,
            builtin_version INTEGER NOT NULL DEFAULT 1,
            deprecated INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT (strftime('%s','now'))
        );

        INSERT INTO app_meta (key, value, updated_at)
        VALUES ('schema_version', '3', strftime('%s','now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
        "#,
    )
    .map_err(|e| format!("无法初始化本地数据库: {}", e))?;
    crate::commands::duration_rules::ensure_duration_rules_seed(&conn)?;
    crate::commands::known_senders::ensure_known_senders_seed(&conn)?;
    crate::commands::measurement_people::ensure_measurement_people_seed(&conn)?;
    Ok(conn)
}

fn account_count() -> Result<i64, String> {
    let conn = open_database()?;
    conn.query_row("SELECT COUNT(*) FROM accounts", [], |row| row.get(0))
        .map_err(|e| format!("无法读取账户数量: {}", e))
}

#[command]
pub async fn get_data_store_info() -> Result<DataStoreInfo, String> {
    let data_root = data_root()?;
    let db_path = database_path()?;
    let profiles_dir = profiles_dir()?;
    let logs_dir = logs_dir()?;
    let backups_dir = backups_dir()?;
    let manifests_dir = manifests_dir()?;
    let legacy_root = legacy_omm_root()?;
    let legacy_accounts = legacy_accounts_path()?;
    let legacy_profiles = legacy_root.join("profiles");
    let account_count = account_count().unwrap_or(0);
    let known_sender_count = crate::commands::known_senders::known_sender_count().unwrap_or(0);
    let measurement_person_count =
        crate::commands::measurement_people::measurement_person_count().unwrap_or(0);

    Ok(DataStoreInfo {
        data_root: data_root.to_string_lossy().to_string(),
        database_path: db_path.to_string_lossy().to_string(),
        profiles_dir: profiles_dir.to_string_lossy().to_string(),
        logs_dir: logs_dir.to_string_lossy().to_string(),
        backups_dir: backups_dir.to_string_lossy().to_string(),
        manifests_dir: manifests_dir.to_string_lossy().to_string(),
        schema_version: SCHEMA_VERSION,
        account_count,
        known_sender_count,
        measurement_person_count,
        legacy_root: legacy_root.to_string_lossy().to_string(),
        legacy_accounts_exists: legacy_accounts.is_file(),
        legacy_profiles_exists: legacy_profiles.is_dir(),
        is_portable: portable_root_from_exe().is_some(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn creates_database_and_data_directories() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let root = std::env::temp_dir().join(format!("omm-data-store-test-{}", unique));
        std::env::set_var("OMM_DATA_ROOT", &root);

        let conn = open_database().expect("database opens");
        conn.execute(
            "INSERT INTO accounts
             (id, nickname, real_name, role, pin_salt, pin_hash, display_name_mode, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params!["test", "Test", "测试", "guest", "salt", "hash", "nickname", "1",],
        )
        .expect("account row inserts");

        assert!(database_path().expect("database path").is_file());
        assert!(profile_dir_for_account("test")
            .expect("profile dir")
            .is_dir());
        assert!(personal_cleaner_log_dir().expect("log dir").is_dir());
        assert!(personal_cleaner_backup_dir().expect("backup dir").is_dir());
        assert_eq!(account_count().expect("account count"), 1);

        std::env::remove_var("OMM_DATA_ROOT");
        let _ = fs::remove_dir_all(root);
    }
}
