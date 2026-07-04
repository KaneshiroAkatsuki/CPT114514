use super::data_store;
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;

const MEASUREMENT_SEED_VERSION: i64 = 1;

const MEASUREMENT_PEOPLE_SEED: &[(&str, &str, &str, &str)] = &[
    ("禹欣", "ordinary", "", "OMM 普通员工"),
    ("何淑畅", "ordinary", "", "OMM 普通员工"),
    ("赵亚琪", "ordinary", "", "OMM 普通员工"),
    ("卫阳", "ordinary", "", "OMM 普通员工"),
    ("王业陈", "ordinary", "", "OMM 普通员工"),
    ("金志豪", "ordinary", "", "OMM 普通员工"),
    ("于晚杰", "ordinary", "", "OMM 普通员工"),
    ("王卓越", "ordinary", "", "OMM 普通员工"),
    ("郑家午", "ordinary", "", "OMM 普通员工"),
    ("付成坤", "ordinary", "", "OMM 普通员工"),
    ("李晓冉", "ordinary", "", "OMM 普通员工"),
    (
        "魏则元",
        "ordinary",
        "魏泽元",
        "OMM 普通员工；魏泽元为历史误写别名",
    ),
    ("王婷", "manager", "", "班长/管理人员，不计入普通 OMM 员工"),
    (
        "陈跃进",
        "manager",
        "",
        "班长/管理人员，不计入普通 OMM 员工",
    ),
    (
        "蒋金潘",
        "extra",
        "",
        "历史命名中出现的量测人员，避免误识别为送测人",
    ),
    (
        "张婉茹",
        "extra",
        "",
        "历史命名中出现的量测人员，避免误识别为送测人",
    ),
];

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MeasurementPerson {
    pub id: String,
    pub name: String,
    pub normalized_name: String,
    pub role: String,
    pub aliases: Vec<String>,
    pub source: String,
    pub note: String,
    pub enabled: bool,
    pub usage_count: i64,
    pub first_seen_at: String,
    pub last_seen_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MeasurementPeoplePayload {
    pub ordinary: Vec<String>,
    pub managers: Vec<String>,
    pub extra: Vec<String>,
    pub names: Vec<String>,
    pub aliases: BTreeMap<String, String>,
}

fn now_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn normalize_name(name: &str) -> String {
    name.trim()
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .collect::<String>()
        .to_lowercase()
}

fn person_id(normalized_name: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(normalized_name.as_bytes());
    let digest = hasher.finalize();
    let hex = digest[..8]
        .iter()
        .map(|byte| format!("{:02x}", byte))
        .collect::<String>();
    format!("measurement-{}", hex)
}

fn parse_aliases(raw: &str) -> Vec<String> {
    raw.split(|ch| ch == ',' || ch == '，' || ch == ';' || ch == '；')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .collect()
}

fn aliases_to_json(aliases: &[String]) -> String {
    serde_json::to_string(aliases).unwrap_or_else(|_| "[]".to_string())
}

fn aliases_from_json(raw: &str) -> Vec<String> {
    serde_json::from_str::<Vec<String>>(raw).unwrap_or_else(|_| parse_aliases(raw))
}

fn is_valid_name(name: &str) -> bool {
    let value = name.trim();
    if value.is_empty() {
        return false;
    }
    let rejected = [
        "送测", "对标", "检测", "测试", "尺寸", "日期", "时间", "机台", "模号", "CMM", "OMM",
        "CNC", "AOI", "#",
    ];
    if rejected.iter().any(|token| value.contains(token)) {
        return false;
    }
    let char_count = value.chars().count();
    (2..=20).contains(&char_count)
        && value
            .chars()
            .all(|ch| ('\u{4e00}'..='\u{9fff}').contains(&ch) || ch.is_ascii_alphabetic())
}

fn normalize_role(role: &str) -> String {
    match role {
        "manager" | "extra" => role.to_string(),
        _ => "ordinary".to_string(),
    }
}

fn row_to_person(row: &Row<'_>) -> rusqlite::Result<MeasurementPerson> {
    let aliases_json: String = row.get(4)?;
    Ok(MeasurementPerson {
        id: row.get(0)?,
        name: row.get(1)?,
        normalized_name: row.get(2)?,
        role: row.get(3)?,
        aliases: aliases_from_json(&aliases_json),
        source: row.get(5)?,
        note: row.get(6)?,
        enabled: row.get::<_, i64>(7)? != 0,
        usage_count: row.get(8)?,
        first_seen_at: row.get(9)?,
        last_seen_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

pub fn ensure_measurement_people_seed(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS measurement_people (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            normalized_name TEXT NOT NULL UNIQUE,
            role TEXT NOT NULL DEFAULT 'ordinary',
            aliases_json TEXT NOT NULL DEFAULT '[]',
            source TEXT NOT NULL DEFAULT 'user',
            note TEXT NOT NULL DEFAULT '',
            enabled INTEGER NOT NULL DEFAULT 1,
            usage_count INTEGER NOT NULL DEFAULT 0,
            first_seen_at TEXT NOT NULL DEFAULT (strftime('%s','now')),
            last_seen_at TEXT NOT NULL DEFAULT (strftime('%s','now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%s','now'))
        );

        CREATE INDEX IF NOT EXISTS idx_measurement_people_enabled_role
            ON measurement_people(enabled, role, name);
        "#,
    )
    .map_err(|e| format!("无法初始化测量人库: {}", e))?;

    let seeded_version = conn
        .query_row(
            "SELECT value FROM app_meta WHERE key = 'measurement_people_seed_version'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| format!("无法读取测量人库版本: {}", e))?
        .and_then(|value| value.parse::<i64>().ok())
        .unwrap_or(0);
    if seeded_version >= MEASUREMENT_SEED_VERSION {
        return Ok(());
    }

    let now = now_string();
    for (name, role, aliases, note) in MEASUREMENT_PEOPLE_SEED {
        let normalized = normalize_name(name);
        if normalized.is_empty() {
            continue;
        }
        let id = person_id(&normalized);
        let aliases = aliases_to_json(&parse_aliases(aliases));
        conn.execute(
            r#"
            INSERT INTO measurement_people (
                id, name, normalized_name, role, aliases_json, source, note, enabled,
                usage_count, first_seen_at, last_seen_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, 'seed', ?6, 1, 0, ?7, ?7, ?7)
            ON CONFLICT(normalized_name) DO NOTHING
            "#,
            params![id, name, normalized, role, aliases, note, now],
        )
        .map_err(|e| format!("无法写入测量人种子: {}", e))?;
    }

    conn.execute(
        r#"
        INSERT INTO app_meta (key, value, updated_at)
        VALUES ('measurement_people_seed_version', ?1, strftime('%s','now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        "#,
        params![MEASUREMENT_SEED_VERSION.to_string()],
    )
    .map_err(|e| format!("无法更新测量人库版本: {}", e))?;
    Ok(())
}

pub fn active_measurement_people_payload() -> Result<MeasurementPeoplePayload, String> {
    let conn = data_store::open_database()?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, name, normalized_name, role, aliases_json, source, note, enabled,
                   usage_count, first_seen_at, last_seen_at, updated_at
            FROM measurement_people
            WHERE enabled = 1
            ORDER BY role ASC, name ASC
            "#,
        )
        .map_err(|e| format!("无法读取测量人库: {}", e))?;
    let rows = stmt
        .query_map([], row_to_person)
        .map_err(|e| format!("无法读取测量人库: {}", e))?;

    let mut payload = MeasurementPeoplePayload {
        ordinary: Vec::new(),
        managers: Vec::new(),
        extra: Vec::new(),
        names: Vec::new(),
        aliases: BTreeMap::new(),
    };
    for row in rows {
        let person = row.map_err(|e| format!("无法解析测量人条目: {}", e))?;
        payload.names.push(person.name.clone());
        match person.role.as_str() {
            "manager" => payload.managers.push(person.name.clone()),
            "extra" => payload.extra.push(person.name.clone()),
            _ => payload.ordinary.push(person.name.clone()),
        }
        for alias in person.aliases {
            payload.aliases.insert(alias, person.name.clone());
        }
    }
    Ok(payload)
}

pub fn measurement_person_count() -> Result<i64, String> {
    let conn = data_store::open_database()?;
    conn.query_row(
        "SELECT COUNT(*) FROM measurement_people WHERE enabled = 1",
        [],
        |row| row.get(0),
    )
    .map_err(|e| format!("无法读取测量人库数量: {}", e))
}

fn load_person_by_id(conn: &Connection, id: &str) -> Result<MeasurementPerson, String> {
    conn.query_row(
        r#"
        SELECT id, name, normalized_name, role, aliases_json, source, note, enabled,
               usage_count, first_seen_at, last_seen_at, updated_at
        FROM measurement_people
        WHERE id = ?1
        "#,
        params![id],
        row_to_person,
    )
    .map_err(|e| format!("无法读取测量人条目: {}", e))
}

#[command]
pub async fn load_measurement_people(
    include_disabled: Option<bool>,
) -> Result<Vec<MeasurementPerson>, String> {
    let conn = data_store::open_database()?;
    let where_clause = if include_disabled.unwrap_or(false) {
        "1 = 1"
    } else {
        "enabled = 1"
    };
    let sql = format!(
        r#"
        SELECT id, name, normalized_name, role, aliases_json, source, note, enabled,
               usage_count, first_seen_at, last_seen_at, updated_at
        FROM measurement_people
        WHERE {}
        ORDER BY role ASC, name ASC
        "#,
        where_clause
    );
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("无法读取测量人库: {}", e))?;
    let rows = stmt
        .query_map([], row_to_person)
        .map_err(|e| format!("无法读取测量人库: {}", e))?;
    let mut people = Vec::new();
    for row in rows {
        people.push(row.map_err(|e| format!("无法解析测量人条目: {}", e))?);
    }
    Ok(people)
}

#[command]
pub async fn upsert_measurement_person(
    name: String,
    role: Option<String>,
    aliases: Option<Vec<String>>,
    note: Option<String>,
) -> Result<MeasurementPerson, String> {
    let clean_name = name.trim();
    if !is_valid_name(clean_name) {
        return Err(
            "测量人姓名格式不可信，请输入 2-20 个中文或字母，不能包含 CMM/OMM/#/机台等非姓名词。"
                .to_string(),
        );
    }
    let normalized = normalize_name(clean_name);
    let id = person_id(&normalized);
    let role = normalize_role(&role.unwrap_or_else(|| "ordinary".to_string()));
    let aliases = aliases_to_json(&aliases.unwrap_or_default());
    let note = note.unwrap_or_default();
    let now = now_string();
    let conn = data_store::open_database()?;
    conn.execute(
        r#"
        INSERT INTO measurement_people (
            id, name, normalized_name, role, aliases_json, source, note, enabled,
            usage_count, first_seen_at, last_seen_at, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, 'user', ?6, 1, 0, ?7, ?7, ?7)
        ON CONFLICT(normalized_name) DO UPDATE SET
            name = excluded.name,
            role = excluded.role,
            aliases_json = excluded.aliases_json,
            note = CASE WHEN excluded.note <> '' THEN excluded.note ELSE measurement_people.note END,
            enabled = 1,
            source = CASE WHEN measurement_people.source = 'seed' THEN 'seed+edited' ELSE measurement_people.source END,
            updated_at = excluded.updated_at
        "#,
        params![id, clean_name, normalized, role, aliases, note, now],
    )
    .map_err(|e| format!("无法保存测量人: {}", e))?;
    let existing_id: String = conn
        .query_row(
            "SELECT id FROM measurement_people WHERE normalized_name = ?1",
            params![normalized],
            |row| row.get(0),
        )
        .map_err(|e| format!("无法读取已保存测量人: {}", e))?;
    load_person_by_id(&conn, &existing_id)
}

#[command]
pub async fn delete_measurement_person(id: String) -> Result<(), String> {
    let conn = data_store::open_database()?;
    conn.execute(
        r#"
        UPDATE measurement_people
        SET enabled = 0,
            source = CASE WHEN source = 'seed' THEN 'seed+deleted' ELSE source END,
            updated_at = strftime('%s','now')
        WHERE id = ?1
        "#,
        params![id],
    )
    .map_err(|e| format!("无法删除测量人: {}", e))?;
    Ok(())
}
