use super::data_store;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::command;

const BUILTIN_RULE_VERSION: i64 = 2;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DurationRuleMatcher {
    pub field: String,
    pub op: String,
    pub value: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DurationRuleDuration {
    pub mode: String,
    pub minutes: Option<f64>,
    pub min_minutes: Option<f64>,
    pub max_minutes: Option<f64>,
    pub package_minutes: Option<f64>,
    pub package_min_minutes: Option<f64>,
    pub package_max_minutes: Option<f64>,
    pub piece_minutes: Option<f64>,
    pub piece_min_minutes: Option<f64>,
    pub piece_max_minutes: Option<f64>,
    pub quantity_policy: Option<String>,
    pub compressible: Option<bool>,
    pub missing_quantity_policy: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DurationRule {
    pub id: String,
    pub builtin_key: Option<String>,
    pub name: String,
    pub enabled: bool,
    pub source: String,
    pub priority: i64,
    pub match_mode: String,
    pub matchers: Vec<DurationRuleMatcher>,
    pub duration: DurationRuleDuration,
    pub user_modified: bool,
    pub builtin_version: i64,
    pub deprecated: bool,
}

fn matcher(field: &str, op: &str, value: &str) -> DurationRuleMatcher {
    DurationRuleMatcher {
        field: field.to_string(),
        op: op.to_string(),
        value: value.to_string(),
    }
}

fn builtin_rules() -> Vec<DurationRule> {
    vec![
        DurationRule {
            id: "builtin-cnc-package".to_string(),
            builtin_key: Some("cnc.default.package".to_string()),
            name: "普通 CNC".to_string(),
            enabled: true,
            source: "builtin".to_string(),
            priority: 600,
            match_mode: "all".to_string(),
            matchers: vec![
                matcher("station", "equals", "CNC"),
                matcher("folder", "not_contains", "整形"),
            ],
            duration: DurationRuleDuration {
                mode: "per_package".to_string(),
                minutes: Some(30.0),
                min_minutes: Some(20.0),
                max_minutes: Some(30.0),
                package_minutes: None,
                package_min_minutes: None,
                package_max_minutes: None,
                piece_minutes: None,
                piece_min_minutes: None,
                piece_max_minutes: None,
                quantity_policy: Some("package_first".to_string()),
                compressible: Some(true),
                missing_quantity_policy: Some("allowed".to_string()),
            },
            user_modified: false,
            builtin_version: BUILTIN_RULE_VERSION,
            deprecated: false,
        },
        DurationRule {
            id: "builtin-zhengxing-cnc".to_string(),
            builtin_key: Some("cnc.zhengxing.max_package_piece".to_string()),
            name: "整形 CNC".to_string(),
            enabled: true,
            source: "builtin".to_string(),
            priority: 700,
            match_mode: "all".to_string(),
            matchers: vec![
                matcher("folder", "contains", "整形"),
                matcher("folder", "contains", "CNC"),
            ],
            duration: DurationRuleDuration {
                mode: "package_piece".to_string(),
                minutes: None,
                min_minutes: None,
                max_minutes: None,
                package_minutes: Some(30.0),
                package_min_minutes: Some(30.0),
                package_max_minutes: Some(30.0),
                piece_minutes: Some(5.0),
                piece_min_minutes: Some(5.0),
                piece_max_minutes: Some(5.0),
                quantity_policy: Some("max".to_string()),
                compressible: Some(false),
                missing_quantity_policy: Some("package_floor".to_string()),
            },
            user_modified: false,
            builtin_version: BUILTIN_RULE_VERSION,
            deprecated: false,
        },
        DurationRule {
            id: "builtin-sinter-plate".to_string(),
            builtin_key: Some("sinter.plate.per_piece".to_string()),
            name: "烧结盘".to_string(),
            enabled: true,
            source: "builtin".to_string(),
            priority: 500,
            match_mode: "any".to_string(),
            matchers: vec![
                matcher("folder", "contains", "烧结盘"),
                matcher("product", "contains", "烧结盘"),
                matcher("station", "contains", "烧结盘"),
            ],
            duration: DurationRuleDuration {
                mode: "per_piece".to_string(),
                minutes: Some(8.0),
                min_minutes: Some(8.0),
                max_minutes: Some(8.0),
                package_minutes: None,
                package_min_minutes: None,
                package_max_minutes: None,
                piece_minutes: None,
                piece_min_minutes: None,
                piece_max_minutes: None,
                quantity_policy: Some("piece_first".to_string()),
                compressible: Some(false),
                missing_quantity_policy: Some("one_piece".to_string()),
            },
            user_modified: false,
            builtin_version: BUILTIN_RULE_VERSION,
            deprecated: false,
        },
    ]
}

fn rule_json(rule: &DurationRule) -> Result<(String, String), String> {
    let match_json = serde_json::to_string(&rule.matchers)
        .map_err(|e| format!("无法序列化耗时规则匹配条件: {}", e))?;
    let duration_json = serde_json::to_string(&rule.duration)
        .map_err(|e| format!("无法序列化耗时规则模型: {}", e))?;
    Ok((match_json, duration_json))
}

fn insert_seed_rule(conn: &Connection, rule: &DurationRule) -> Result<(), String> {
    let (match_json, duration_json) = rule_json(rule)?;
    conn.execute(
        r#"
        INSERT INTO duration_rules (
            id, builtin_key, name, enabled, source, priority, match_mode,
            match_json, duration_json, user_modified, builtin_version, deprecated, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, strftime('%s','now'))
        ON CONFLICT(id) DO UPDATE SET
            builtin_key = excluded.builtin_key,
            name = CASE WHEN duration_rules.user_modified = 0 THEN excluded.name ELSE duration_rules.name END,
            enabled = CASE WHEN duration_rules.user_modified = 0 THEN excluded.enabled ELSE duration_rules.enabled END,
            source = excluded.source,
            priority = CASE WHEN duration_rules.user_modified = 0 THEN excluded.priority ELSE duration_rules.priority END,
            match_mode = CASE WHEN duration_rules.user_modified = 0 THEN excluded.match_mode ELSE duration_rules.match_mode END,
            match_json = CASE WHEN duration_rules.user_modified = 0 THEN excluded.match_json ELSE duration_rules.match_json END,
            duration_json = CASE WHEN duration_rules.user_modified = 0 THEN excluded.duration_json ELSE duration_rules.duration_json END,
            builtin_version = excluded.builtin_version,
            deprecated = 0,
            updated_at = strftime('%s','now')
        "#,
        params![
            rule.id,
            rule.builtin_key,
            rule.name,
            if rule.enabled { 1 } else { 0 },
            rule.source,
            rule.priority,
            rule.match_mode,
            match_json,
            duration_json,
            if rule.user_modified { 1 } else { 0 },
            rule.builtin_version,
            if rule.deprecated { 1 } else { 0 },
        ],
    )
    .map_err(|e| format!("无法写入内置耗时规则: {}", e))?;
    Ok(())
}

fn upsert_rule(conn: &Connection, rule: &DurationRule) -> Result<(), String> {
    let (match_json, duration_json) = rule_json(rule)?;
    conn.execute(
        r#"
        INSERT INTO duration_rules (
            id, builtin_key, name, enabled, source, priority, match_mode,
            match_json, duration_json, user_modified, builtin_version, deprecated, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, strftime('%s','now'))
        ON CONFLICT(id) DO UPDATE SET
            builtin_key = excluded.builtin_key,
            name = excluded.name,
            enabled = excluded.enabled,
            source = excluded.source,
            priority = excluded.priority,
            match_mode = excluded.match_mode,
            match_json = excluded.match_json,
            duration_json = excluded.duration_json,
            user_modified = excluded.user_modified,
            builtin_version = excluded.builtin_version,
            deprecated = excluded.deprecated,
            updated_at = strftime('%s','now')
        "#,
        params![
            rule.id,
            rule.builtin_key,
            rule.name,
            if rule.enabled { 1 } else { 0 },
            if rule.source.trim().is_empty() {
                "user"
            } else {
                rule.source.as_str()
            },
            rule.priority,
            rule.match_mode,
            match_json,
            duration_json,
            if rule.user_modified { 1 } else { 0 },
            rule.builtin_version,
            if rule.deprecated { 1 } else { 0 },
        ],
    )
    .map_err(|e| format!("无法保存耗时规则: {}", e))?;
    Ok(())
}

pub fn ensure_duration_rules_seed(conn: &Connection) -> Result<(), String> {
    let seeded_version = conn
        .query_row(
            "SELECT value FROM app_meta WHERE key = 'duration_rules_seed_version'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| format!("无法读取耗时规则版本: {}", e))?
        .and_then(|value| value.parse::<i64>().ok())
        .unwrap_or(0);
    if seeded_version >= BUILTIN_RULE_VERSION {
        return Ok(());
    }

    for rule in builtin_rules() {
        insert_seed_rule(conn, &rule)?;
    }
    conn.execute(
        r#"
        INSERT INTO app_meta (key, value, updated_at)
        VALUES ('duration_rules_seed_version', ?1, strftime('%s','now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        "#,
        params![BUILTIN_RULE_VERSION.to_string()],
    )
    .map_err(|e| format!("无法更新耗时规则版本: {}", e))?;
    Ok(())
}

#[command]
pub async fn load_duration_rules() -> Result<Vec<DurationRule>, String> {
    let conn = data_store::open_database()?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, builtin_key, name, enabled, source, priority, match_mode,
                   match_json, duration_json, user_modified, builtin_version, deprecated
            FROM duration_rules
            ORDER BY deprecated ASC, priority DESC, name ASC
            "#,
        )
        .map_err(|e| format!("无法读取耗时规则: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let match_json: String = row.get(7)?;
            let duration_json: String = row.get(8)?;
            let matchers =
                serde_json::from_str::<Vec<DurationRuleMatcher>>(&match_json).unwrap_or_default();
            let duration = serde_json::from_str::<DurationRuleDuration>(&duration_json).unwrap_or(
                DurationRuleDuration {
                    mode: "per_piece".to_string(),
                    minutes: Some(1.5),
                    min_minutes: Some(1.5),
                    max_minutes: Some(1.5),
                    package_minutes: None,
                    package_min_minutes: None,
                    package_max_minutes: None,
                    piece_minutes: None,
                    piece_min_minutes: None,
                    piece_max_minutes: None,
                    quantity_policy: Some("piece_first".to_string()),
                    compressible: Some(false),
                    missing_quantity_policy: Some("one_piece".to_string()),
                },
            );
            Ok(DurationRule {
                id: row.get(0)?,
                builtin_key: row.get(1)?,
                name: row.get(2)?,
                enabled: row.get::<_, i64>(3)? != 0,
                source: row.get(4)?,
                priority: row.get(5)?,
                match_mode: row.get(6)?,
                matchers,
                duration,
                user_modified: row.get::<_, i64>(9)? != 0,
                builtin_version: row.get(10)?,
                deprecated: row.get::<_, i64>(11)? != 0,
            })
        })
        .map_err(|e| format!("无法读取耗时规则: {}", e))?;

    let mut rules = Vec::new();
    for row in rows {
        rules.push(row.map_err(|e| format!("无法解析耗时规则: {}", e))?);
    }
    Ok(rules)
}

#[command]
pub async fn save_duration_rules(rules: Vec<DurationRule>) -> Result<Vec<DurationRule>, String> {
    let conn = data_store::open_database()?;
    conn.execute("DELETE FROM duration_rules WHERE source <> 'builtin'", [])
        .map_err(|e| format!("无法清理旧用户耗时规则: {}", e))?;
    for rule in rules.iter().filter(|rule| !rule.id.trim().is_empty()) {
        upsert_rule(&conn, rule)?;
    }
    load_duration_rules().await
}
