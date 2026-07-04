use super::data_store;
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;

const HISTORY_SEED_VERSION: i64 = 2;

const HISTORY_SEED_SENDERS: &[(&str, i64)] = &[
    ("陆为美", 36),
    ("刘前程", 30),
    ("周琳", 23),
    ("张若男", 23),
    ("李乐", 23),
    ("李善贞", 22),
    ("彭姝梨", 20),
    ("刘子豪", 17),
    ("高露露", 16),
    ("刘艳丽", 15),
    ("吉坡小康", 15),
    ("王学召", 15),
    ("弋正豪", 12),
    ("谭文慧", 12),
    ("高昆", 12),
    ("岑昌", 11),
    ("李佳欣", 11),
    ("甘文清", 11),
    ("宋刚", 10),
    ("杨梦凡", 10),
    ("陈方园", 10),
    ("张志霖", 9),
    ("张颖龙", 9),
    ("张元庆", 9),
    ("彭立娜", 9),
    ("朱文婷", 9),
    ("闵车", 9),
    ("文昊", 8),
    ("童泽瑞", 8),
    ("丰波", 7),
    ("朱青", 7),
    ("程红丽", 7),
    ("阚广松", 7),
    ("陈大勇", 7),
    ("任雪", 6),
    ("段连奇", 5),
    ("叶家亮", 4),
    ("李东", 4),
    ("毛雪", 4),
    ("王同同", 4),
    ("钱相", 4),
    ("马嘉奇", 3),
    ("孙宇辉", 3),
    ("尤国钧", 3),
    ("李雨倩", 3),
    ("闵乐", 3),
    ("阔广松", 3),
    ("陈方圆", 3),
    ("刘流", 2),
    ("周珍强", 2),
    ("彭丽娜", 2),
    ("杜金于", 2),
    ("秦宇轩", 2),
    ("蒋伟", 2),
    ("马永刚", 2),
    ("李天阳", 1),
];

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KnownSender {
    pub id: String,
    pub name: String,
    pub normalized_name: String,
    pub source: String,
    pub note: String,
    pub enabled: bool,
    pub usage_count: i64,
    pub first_seen_at: String,
    pub last_seen_at: String,
    pub updated_at: String,
    pub sample_folder: String,
}

fn now_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn normalize_sender_name(name: &str) -> String {
    name.trim()
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .collect::<String>()
        .to_lowercase()
}

fn sender_id(normalized_name: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(normalized_name.as_bytes());
    let digest = hasher.finalize();
    let hex = digest[..8]
        .iter()
        .map(|byte| format!("{:02x}", byte))
        .collect::<String>();
    format!("sender-{}", hex)
}

fn is_valid_sender_name(name: &str) -> bool {
    let value = name.trim();
    if value.is_empty() {
        return false;
    }
    let rejected = [
        "送测", "量测", "人员", "对标", "焊接", "检测", "测试", "尺寸", "日期", "时间", "工单",
        "机台", "模号", "手量", "CMM", "OMM", "CNC", "AOI",
    ];
    if rejected.iter().any(|token| value.contains(token)) {
        return false;
    }
    let char_count = value.chars().count();
    if !(2..=20).contains(&char_count) {
        return false;
    }
    let has_name_char = value
        .chars()
        .any(|ch| ('\u{4e00}'..='\u{9fff}').contains(&ch) || ch.is_ascii_alphabetic());
    has_name_char
        && value.chars().all(|ch| {
            ('\u{4e00}'..='\u{9fff}').contains(&ch)
                || ch.is_ascii_alphanumeric()
                || ch == '.'
                || ch == '-'
                || ch == '_'
        })
}

fn row_to_sender(row: &Row<'_>) -> rusqlite::Result<KnownSender> {
    Ok(KnownSender {
        id: row.get(0)?,
        name: row.get(1)?,
        normalized_name: row.get(2)?,
        source: row.get(3)?,
        note: row.get(4)?,
        enabled: row.get::<_, i64>(5)? != 0,
        usage_count: row.get(6)?,
        first_seen_at: row.get(7)?,
        last_seen_at: row.get(8)?,
        updated_at: row.get(9)?,
        sample_folder: row.get(10)?,
    })
}

pub fn ensure_known_senders_seed(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS known_senders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            normalized_name TEXT NOT NULL UNIQUE,
            source TEXT NOT NULL DEFAULT 'user',
            note TEXT NOT NULL DEFAULT '',
            enabled INTEGER NOT NULL DEFAULT 1,
            usage_count INTEGER NOT NULL DEFAULT 0,
            first_seen_at TEXT NOT NULL DEFAULT (strftime('%s','now')),
            last_seen_at TEXT NOT NULL DEFAULT (strftime('%s','now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%s','now')),
            sample_folder TEXT NOT NULL DEFAULT ''
        );

        CREATE INDEX IF NOT EXISTS idx_known_senders_enabled_updated
            ON known_senders(enabled, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_known_senders_last_seen
            ON known_senders(last_seen_at DESC);
        "#,
    )
    .map_err(|e| format!("无法初始化送测人词库: {}", e))?;

    let seeded_version = conn
        .query_row(
            "SELECT value FROM app_meta WHERE key = 'known_senders_seed_version'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| format!("无法读取送测人词库版本: {}", e))?
        .and_then(|value| value.parse::<i64>().ok())
        .unwrap_or(0);
    if seeded_version >= HISTORY_SEED_VERSION {
        return Ok(());
    }

    let now = now_string();
    for (name, count) in HISTORY_SEED_SENDERS {
        let normalized = normalize_sender_name(name);
        if normalized.is_empty() {
            continue;
        }
        let id = sender_id(&normalized);
        conn.execute(
            r#"
            INSERT INTO known_senders (
                id, name, normalized_name, source, note, enabled, usage_count,
                first_seen_at, last_seen_at, updated_at, sample_folder
            )
            VALUES (?1, ?2, ?3, 'history_seed', '桌面6月/7月历史资料扫描种子', 1, ?4, ?5, ?5, ?5, '')
            ON CONFLICT(normalized_name) DO NOTHING
            "#,
            params![id, name, normalized, count, now],
        )
        .map_err(|e| format!("无法写入送测人历史种子: {}", e))?;
    }

    conn.execute(
        r#"
        INSERT INTO app_meta (key, value, updated_at)
        VALUES ('known_senders_seed_version', ?1, strftime('%s','now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        "#,
        params![HISTORY_SEED_VERSION.to_string()],
    )
    .map_err(|e| format!("无法更新送测人词库版本: {}", e))?;
    Ok(())
}

pub fn active_known_sender_names() -> Result<Vec<String>, String> {
    let conn = data_store::open_database()?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT name
            FROM known_senders
            WHERE enabled = 1
            ORDER BY length(name) DESC, usage_count DESC, last_seen_at DESC, name ASC
            "#,
        )
        .map_err(|e| format!("无法读取送测人词库: {}", e))?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("无法读取送测人词库: {}", e))?;
    let mut names = Vec::new();
    for row in rows {
        names.push(row.map_err(|e| format!("无法解析送测人词库: {}", e))?);
    }
    Ok(names)
}

pub fn known_sender_count() -> Result<i64, String> {
    let conn = data_store::open_database()?;
    conn.query_row(
        "SELECT COUNT(*) FROM known_senders WHERE enabled = 1",
        [],
        |row| row.get(0),
    )
    .map_err(|e| format!("无法读取送测人词库数量: {}", e))
}

fn load_sender_by_id(conn: &Connection, id: &str) -> Result<KnownSender, String> {
    conn.query_row(
        r#"
        SELECT id, name, normalized_name, source, note, enabled, usage_count,
               first_seen_at, last_seen_at, updated_at, sample_folder
        FROM known_senders
        WHERE id = ?1
        "#,
        params![id],
        row_to_sender,
    )
    .map_err(|e| format!("无法读取送测人条目: {}", e))
}

#[command]
pub async fn load_known_senders(
    sort_by: Option<String>,
    descending: Option<bool>,
    include_disabled: Option<bool>,
) -> Result<Vec<KnownSender>, String> {
    let conn = data_store::open_database()?;
    let sort = match sort_by.unwrap_or_else(|| "lastSeenAt".to_string()).as_str() {
        "name" => "name",
        "usageCount" => "usage_count",
        "firstSeenAt" => "first_seen_at",
        "updatedAt" => "updated_at",
        _ => "last_seen_at",
    };
    let direction = if descending.unwrap_or(true) {
        "DESC"
    } else {
        "ASC"
    };
    let where_clause = if include_disabled.unwrap_or(false) {
        "1 = 1"
    } else {
        "enabled = 1"
    };
    let sql = format!(
        r#"
        SELECT id, name, normalized_name, source, note, enabled, usage_count,
               first_seen_at, last_seen_at, updated_at, sample_folder
        FROM known_senders
        WHERE {}
        ORDER BY {} {}, name ASC
        "#,
        where_clause, sort, direction
    );
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("无法读取送测人词库: {}", e))?;
    let rows = stmt
        .query_map([], row_to_sender)
        .map_err(|e| format!("无法读取送测人词库: {}", e))?;
    let mut senders = Vec::new();
    for row in rows {
        senders.push(row.map_err(|e| format!("无法解析送测人条目: {}", e))?);
    }
    Ok(senders)
}

#[command]
pub async fn upsert_known_sender(
    name: String,
    source: Option<String>,
    sample_folder: Option<String>,
    note: Option<String>,
) -> Result<KnownSender, String> {
    let clean_name = name.trim();
    if !is_valid_sender_name(clean_name) {
        return Err("送测人姓名格式不可信，请输入 2-20 个中文、字母或数字组合，不能包含 CMM/OMM/手量/量测等非送测词。".to_string());
    }
    let normalized = normalize_sender_name(clean_name);
    let id = sender_id(&normalized);
    let source = source.unwrap_or_else(|| "user".to_string());
    let sample_folder = sample_folder.unwrap_or_default();
    let note = note.unwrap_or_default();
    let now = now_string();
    let conn = data_store::open_database()?;
    conn.execute(
        r#"
        INSERT INTO known_senders (
            id, name, normalized_name, source, note, enabled, usage_count,
            first_seen_at, last_seen_at, updated_at, sample_folder
        )
        VALUES (?1, ?2, ?3, ?4, ?5, 1, 1, ?6, ?6, ?6, ?7)
        ON CONFLICT(normalized_name) DO UPDATE SET
            name = excluded.name,
            enabled = 1,
            usage_count = known_senders.usage_count + 1,
            last_seen_at = excluded.last_seen_at,
            updated_at = excluded.updated_at,
            sample_folder = CASE
                WHEN excluded.sample_folder <> '' THEN excluded.sample_folder
                ELSE known_senders.sample_folder
            END,
            note = CASE
                WHEN excluded.note <> '' THEN excluded.note
                ELSE known_senders.note
            END,
            source = CASE
                WHEN known_senders.source = 'history_seed' AND excluded.source = 'review'
                THEN 'history_seed+review'
                WHEN excluded.source <> '' THEN excluded.source
                ELSE known_senders.source
            END
        "#,
        params![id, clean_name, normalized, source, note, now, sample_folder],
    )
    .map_err(|e| format!("无法保存送测人: {}", e))?;
    let existing_id: String = conn
        .query_row(
            "SELECT id FROM known_senders WHERE normalized_name = ?1",
            params![normalized],
            |row| row.get(0),
        )
        .map_err(|e| format!("无法读取已保存送测人: {}", e))?;
    load_sender_by_id(&conn, &existing_id)
}

#[command]
pub async fn update_known_sender(
    id: String,
    name: String,
    note: Option<String>,
    enabled: Option<bool>,
) -> Result<KnownSender, String> {
    let clean_name = name.trim();
    if !is_valid_sender_name(clean_name) {
        return Err("送测人姓名格式不可信，请输入 2-20 个中文、字母或数字组合，不能包含 CMM/OMM/手量/量测等非送测词。".to_string());
    }
    let normalized = normalize_sender_name(clean_name);
    let conn = data_store::open_database()?;
    let exists = conn
        .query_row(
            "SELECT id FROM known_senders WHERE normalized_name = ?1 AND id <> ?2",
            params![normalized, id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| format!("无法检查送测人重名: {}", e))?;
    if exists.is_some() {
        return Err("送测人词库中已存在同名条目。".to_string());
    }
    conn.execute(
        r#"
        UPDATE known_senders
        SET name = ?2,
            normalized_name = ?3,
            note = ?4,
            enabled = ?5,
            source = CASE WHEN source = 'history_seed' THEN 'history_seed+edited' ELSE source END,
            updated_at = strftime('%s','now')
        WHERE id = ?1
        "#,
        params![
            id,
            clean_name,
            normalized,
            note.unwrap_or_default(),
            if enabled.unwrap_or(true) { 1 } else { 0 },
        ],
    )
    .map_err(|e| format!("无法更新送测人: {}", e))?;
    load_sender_by_id(&conn, &id)
}

#[command]
pub async fn delete_known_sender(id: String) -> Result<(), String> {
    let conn = data_store::open_database()?;
    conn.execute(
        r#"
        UPDATE known_senders
        SET enabled = 0,
            source = CASE WHEN source = 'history_seed' THEN 'history_seed+deleted' ELSE source END,
            updated_at = strftime('%s','now')
        WHERE id = ?1
        "#,
        params![id],
    )
    .map_err(|e| format!("无法删除送测人: {}", e))?;
    Ok(())
}
