use super::data_store;
use rand::RngCore;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;

const ACCOUNT_STORE_VERSION: i64 = 1;
const ADMIN_ID: &str = "kaneshiro";
const ADMIN_NICKNAME: &str = "Kaneshiro";
const ADMIN_REAL_NAME: &str = "禹欣";
const ADMIN_INITIAL_PIN: &str = "114514";
const VISITOR_ID: &str = "guest_yuchengshan";
const VISITOR_NICKNAME: &str = "御馔津";
const VISITOR_REAL_NAME: &str = "禹承山";
const VISITOR_INITIAL_PIN: &str = "114514";
const HASH_ROUNDS: usize = 100_000;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AccountRole {
    Admin,
    Guest,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DisplayNameMode {
    Nickname,
    RealName,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AccountRecord {
    pub id: String,
    pub nickname: String,
    pub real_name: String,
    pub role: AccountRole,
    pub pin_salt: String,
    pub pin_hash: String,
    #[serde(default = "default_display_name_mode")]
    pub display_name_mode: DisplayNameMode,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PublicAccount {
    pub id: String,
    pub nickname: String,
    pub real_name: String,
    pub role: AccountRole,
    pub display_name_mode: DisplayNameMode,
    pub display_name: String,
    pub must_change_pin: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct AccountStore {
    pub version: i64,
    pub accounts: Vec<AccountRecord>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct AccountSessionFile {
    pub current_account_id: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
pub struct AccountsInfo {
    pub accounts: Vec<PublicAccount>,
    pub current_account: Option<PublicAccount>,
    pub storage_root: String,
}

#[derive(Serialize, Debug, Clone)]
pub struct AccountSession {
    pub account: PublicAccount,
    pub profile_dir: String,
}

fn default_display_name_mode() -> DisplayNameMode {
    DisplayNameMode::Nickname
}

fn now_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

pub fn account_storage_root() -> Result<PathBuf, String> {
    data_store::data_root()
}

pub fn profile_dir_for_account(account_id: &str) -> Result<PathBuf, String> {
    let dir = data_store::profile_dir_for_account(account_id)?;
    migrate_legacy_profile_if_needed(account_id, &dir)?;
    Ok(dir)
}

pub fn current_profile_config_path() -> Result<Option<PathBuf>, String> {
    let session = read_session()?;
    if let Some(account_id) = session.current_account_id {
        return Ok(Some(
            profile_dir_for_account(&account_id)?.join("config.json"),
        ));
    }
    Ok(None)
}

pub fn current_account_record() -> Result<Option<AccountRecord>, String> {
    let session = read_session()?;
    let Some(account_id) = session.current_account_id else {
        return Ok(None);
    };
    let store = read_store()?;
    Ok(store
        .accounts
        .into_iter()
        .find(|account| account.id == account_id))
}

fn to_hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>()
}

fn hash_pin(pin: &str, salt: &[u8]) -> String {
    let mut current = Vec::new();
    current.extend_from_slice(salt);
    current.extend_from_slice(pin.as_bytes());
    for _ in 0..HASH_ROUNDS {
        let mut hasher = Sha256::new();
        hasher.update(&current);
        hasher.update(salt);
        hasher.update(pin.as_bytes());
        current = hasher.finalize().to_vec();
    }
    to_hex(&current)
}

fn new_pin_hash(pin: &str) -> (String, String) {
    let mut salt = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt);
    (to_hex(&salt), hash_pin(pin, &salt))
}

fn constant_time_eq(a: &str, b: &str) -> bool {
    let ab = a.as_bytes();
    let bb = b.as_bytes();
    if ab.len() != bb.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in ab.iter().zip(bb.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

fn verify_pin(account: &AccountRecord, pin: &str) -> bool {
    let salt = parse_hex(&account.pin_salt);
    match salt {
        Some(salt) => constant_time_eq(&hash_pin(pin, &salt), &account.pin_hash),
        None => false,
    }
}

fn parse_hex(value: &str) -> Option<Vec<u8>> {
    if value.len() % 2 != 0 {
        return None;
    }
    let mut out = Vec::with_capacity(value.len() / 2);
    let chars: Vec<char> = value.chars().collect();
    for pair in chars.chunks(2) {
        let hi = pair[0].to_digit(16)?;
        let lo = pair[1].to_digit(16)?;
        out.push(((hi << 4) + lo) as u8);
    }
    Some(out)
}

fn normalize_login(value: &str) -> String {
    value.split_whitespace().collect::<String>().to_lowercase()
}

fn sanitize_id(value: &str) -> String {
    let mut out = String::new();
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
        } else if ch == '-' || ch == '_' {
            out.push(ch);
        }
    }
    if out.is_empty() {
        format!("user_{}", now_string())
    } else {
        out
    }
}

fn validate_pin(pin: &str) -> Result<(), String> {
    let value = pin.trim();
    if !(4..=6).contains(&value.len()) || !value.chars().all(|c| c.is_ascii_digit()) {
        return Err("PIN 必须是 4 到 6 位数字。".to_string());
    }
    Ok(())
}

fn public_account(account: &AccountRecord) -> PublicAccount {
    let display_name = match account.display_name_mode {
        DisplayNameMode::RealName => account.real_name.clone(),
        DisplayNameMode::Nickname => account.nickname.clone(),
    };
    PublicAccount {
        id: account.id.clone(),
        nickname: account.nickname.clone(),
        real_name: account.real_name.clone(),
        role: account.role.clone(),
        display_name_mode: account.display_name_mode.clone(),
        display_name,
        must_change_pin: account.id == ADMIN_ID && verify_pin(account, ADMIN_INITIAL_PIN),
    }
}

fn admin_account() -> AccountRecord {
    let (pin_salt, pin_hash) = new_pin_hash(ADMIN_INITIAL_PIN);
    AccountRecord {
        id: ADMIN_ID.to_string(),
        nickname: ADMIN_NICKNAME.to_string(),
        real_name: ADMIN_REAL_NAME.to_string(),
        role: AccountRole::Admin,
        pin_salt,
        pin_hash,
        display_name_mode: DisplayNameMode::Nickname,
        created_at: now_string(),
    }
}

fn visitor_account() -> AccountRecord {
    let (pin_salt, pin_hash) = new_pin_hash(VISITOR_INITIAL_PIN);
    AccountRecord {
        id: VISITOR_ID.to_string(),
        nickname: VISITOR_NICKNAME.to_string(),
        real_name: VISITOR_REAL_NAME.to_string(),
        role: AccountRole::Guest,
        pin_salt,
        pin_hash,
        display_name_mode: DisplayNameMode::Nickname,
        created_at: now_string(),
    }
}

fn has_account_identity(store: &AccountStore, id: &str, nickname: &str, real_name: &str) -> bool {
    let id_norm = normalize_login(id);
    let nickname_norm = normalize_login(nickname);
    let real_name_norm = normalize_login(real_name);
    store.accounts.iter().any(|account| {
        normalize_login(&account.id) == id_norm
            || normalize_login(&account.nickname) == nickname_norm
            || normalize_login(&account.real_name) == real_name_norm
            || normalize_login(&account.nickname) == real_name_norm
            || normalize_login(&account.real_name) == nickname_norm
    })
}

fn role_to_db(role: &AccountRole) -> &'static str {
    match role {
        AccountRole::Admin => "admin",
        AccountRole::Guest => "guest",
    }
}

fn role_from_db(value: &str) -> AccountRole {
    match value {
        "admin" => AccountRole::Admin,
        _ => AccountRole::Guest,
    }
}

fn display_mode_to_db(mode: &DisplayNameMode) -> &'static str {
    match mode {
        DisplayNameMode::Nickname => "nickname",
        DisplayNameMode::RealName => "real_name",
    }
}

fn display_mode_from_db(value: &str) -> DisplayNameMode {
    match value {
        "real_name" => DisplayNameMode::RealName,
        _ => DisplayNameMode::Nickname,
    }
}

fn read_store_from_database() -> Result<AccountStore, String> {
    let conn = data_store::open_database()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, nickname, real_name, role, pin_salt, pin_hash, display_name_mode, created_at
             FROM accounts
             ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, created_at, id",
        )
        .map_err(|e| format!("无法读取账户数据库: {}", e))?;
    let rows = stmt
        .query_map([], |row| {
            let role: String = row.get(3)?;
            let display_name_mode: String = row.get(6)?;
            Ok(AccountRecord {
                id: row.get(0)?,
                nickname: row.get(1)?,
                real_name: row.get(2)?,
                role: role_from_db(&role),
                pin_salt: row.get(4)?,
                pin_hash: row.get(5)?,
                display_name_mode: display_mode_from_db(&display_name_mode),
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("无法查询账户数据库: {}", e))?;

    let mut accounts = Vec::new();
    for row in rows {
        accounts.push(row.map_err(|e| format!("无法解析账户数据库: {}", e))?);
    }
    Ok(AccountStore {
        version: ACCOUNT_STORE_VERSION,
        accounts,
    })
}

fn write_store_to_database(store: &AccountStore) -> Result<(), String> {
    let mut conn = data_store::open_database()?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("无法开启账户数据库事务: {}", e))?;
    tx.execute("DELETE FROM accounts", [])
        .map_err(|e| format!("无法更新账户数据库: {}", e))?;
    for account in &store.accounts {
        tx.execute(
            "INSERT INTO accounts
             (id, nickname, real_name, role, pin_salt, pin_hash, display_name_mode, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, strftime('%s','now'))",
            params![
                account.id,
                account.nickname,
                account.real_name,
                role_to_db(&account.role),
                account.pin_salt,
                account.pin_hash,
                display_mode_to_db(&account.display_name_mode),
                account.created_at,
            ],
        )
        .map_err(|e| format!("无法写入账户数据库: {}", e))?;
    }
    tx.commit()
        .map_err(|e| format!("无法保存账户数据库事务: {}", e))
}

fn read_legacy_store() -> Result<Option<AccountStore>, String> {
    let path = data_store::legacy_accounts_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("无法读取旧账户文件: {}", e))?;
    let mut store = serde_json::from_str::<AccountStore>(&content).unwrap_or_default();
    store.version = ACCOUNT_STORE_VERSION;
    Ok(Some(store))
}

fn read_session_from_database() -> Result<Option<AccountSessionFile>, String> {
    let conn = data_store::open_database()?;
    let current_account_id = conn
        .query_row(
            "SELECT current_account_id FROM account_session WHERE id = 1",
            [],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .map_err(|e| format!("无法读取登录状态数据库: {}", e))?;
    Ok(current_account_id.map(|current_account_id| AccountSessionFile { current_account_id }))
}

fn write_session_to_database(session: &AccountSessionFile) -> Result<(), String> {
    let conn = data_store::open_database()?;
    conn.execute(
        "INSERT INTO account_session (id, current_account_id, updated_at)
         VALUES (1, ?1, strftime('%s','now'))
         ON CONFLICT(id) DO UPDATE SET
           current_account_id = excluded.current_account_id,
           updated_at = excluded.updated_at",
        params![session.current_account_id],
    )
    .map_err(|e| format!("无法写入登录状态数据库: {}", e))?;
    Ok(())
}

fn read_legacy_session() -> Result<Option<AccountSessionFile>, String> {
    let path = data_store::legacy_session_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("无法读取旧登录状态: {}", e))?;
    Ok(Some(
        serde_json::from_str::<AccountSessionFile>(&content).unwrap_or_default(),
    ))
}

fn copy_profile_file_if_missing(
    legacy_dir: &PathBuf,
    new_dir: &PathBuf,
    file_name: &str,
) -> Result<(), String> {
    let source = legacy_dir.join(file_name);
    let target = new_dir.join(file_name);
    if source.is_file() && !target.exists() {
        fs::copy(&source, &target).map_err(|e| {
            format!(
                "无法迁移旧账户配置 {} -> {}: {}",
                source.display(),
                target.display(),
                e
            )
        })?;
    }
    Ok(())
}

fn migrate_legacy_profile_if_needed(account_id: &str, new_dir: &PathBuf) -> Result<(), String> {
    let legacy_dir = data_store::legacy_profile_dir_for_account(account_id)?;
    if !legacy_dir.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(new_dir).map_err(|e| format!("无法创建账户配置目录: {}", e))?;
    copy_profile_file_if_missing(&legacy_dir, new_dir, "config.json")?;
    copy_profile_file_if_missing(&legacy_dir, new_dir, "recognition-rules.json")?;
    Ok(())
}

fn read_store() -> Result<AccountStore, String> {
    let mut store = read_store_from_database()?;
    if store.accounts.is_empty() {
        if let Some(legacy_store) = read_legacy_store()? {
            if !legacy_store.accounts.is_empty() {
                store = legacy_store;
                write_store_to_database(&store)?;
            }
        }
    }

    store.version = ACCOUNT_STORE_VERSION;
    let mut changed = false;
    if !store.accounts.iter().any(|account| account.id == ADMIN_ID) {
        store.accounts.insert(0, admin_account());
        changed = true;
    }
    if !has_account_identity(&store, VISITOR_ID, VISITOR_NICKNAME, VISITOR_REAL_NAME) {
        store.accounts.push(visitor_account());
        changed = true;
    }
    if changed {
        write_store_to_database(&store)?;
    }
    Ok(store)
}

fn write_store(store: &AccountStore) -> Result<(), String> {
    write_store_to_database(store)
}

fn read_session() -> Result<AccountSessionFile, String> {
    if let Some(session) = read_session_from_database()? {
        return Ok(session);
    }
    if let Some(legacy_session) = read_legacy_session()? {
        if legacy_session.current_account_id.is_some() {
            write_session_to_database(&legacy_session)?;
            return Ok(legacy_session);
        }
    }
    Ok(AccountSessionFile::default())
}

fn write_session(session: &AccountSessionFile) -> Result<(), String> {
    write_session_to_database(session)
}

fn find_account_by_login<'a>(store: &'a AccountStore, login: &str) -> Option<&'a AccountRecord> {
    let needle = normalize_login(login);
    store.accounts.iter().find(|account| {
        normalize_login(&account.id) == needle
            || normalize_login(&account.nickname) == needle
            || normalize_login(&account.real_name) == needle
    })
}

fn ensure_unique_account(
    store: &AccountStore,
    nickname: &str,
    real_name: &str,
) -> Result<(), String> {
    let nickname_norm = normalize_login(nickname);
    let real_name_norm = normalize_login(real_name);
    if store.accounts.iter().any(|account| {
        normalize_login(&account.nickname) == nickname_norm
            || normalize_login(&account.real_name) == nickname_norm
            || normalize_login(&account.nickname) == real_name_norm
            || normalize_login(&account.real_name) == real_name_norm
    }) {
        return Err("昵称或真实姓名已存在。".to_string());
    }
    Ok(())
}

fn make_unique_id(store: &AccountStore, nickname: &str, real_name: &str) -> String {
    let base = sanitize_id(if nickname.trim().is_empty() {
        real_name
    } else {
        nickname
    });
    let mut candidate = base.clone();
    let mut suffix = 2;
    while store.accounts.iter().any(|account| account.id == candidate) {
        candidate = format!("{}_{}", base, suffix);
        suffix += 1;
    }
    candidate
}

#[command]
pub async fn load_accounts() -> Result<AccountsInfo, String> {
    let store = read_store()?;
    let session = read_session()?;
    let current_account = session
        .current_account_id
        .as_ref()
        .and_then(|id| store.accounts.iter().find(|account| &account.id == id))
        .map(public_account);
    Ok(AccountsInfo {
        accounts: store.accounts.iter().map(public_account).collect(),
        current_account,
        storage_root: account_storage_root()?.to_string_lossy().to_string(),
    })
}

#[command]
pub async fn login_account(login: String, pin: String) -> Result<AccountSession, String> {
    let store = read_store()?;
    let account = find_account_by_login(&store, &login).ok_or("未找到账户。".to_string())?;
    if !verify_pin(account, pin.trim()) {
        return Err("PIN 不正确。".to_string());
    }
    write_session(&AccountSessionFile {
        current_account_id: Some(account.id.clone()),
    })?;
    let profile_dir = profile_dir_for_account(&account.id)?;
    Ok(AccountSession {
        account: public_account(account),
        profile_dir: profile_dir.to_string_lossy().to_string(),
    })
}

#[command]
pub async fn register_account(
    nickname: String,
    real_name: String,
    pin: String,
) -> Result<AccountSession, String> {
    let nickname = nickname.trim();
    let real_name = real_name.trim();
    if nickname.is_empty() || real_name.is_empty() {
        return Err("昵称和真实姓名都不能为空。".to_string());
    }
    validate_pin(&pin)?;

    let mut store = read_store()?;
    ensure_unique_account(&store, nickname, real_name)?;
    let id = make_unique_id(&store, nickname, real_name);
    let (pin_salt, pin_hash) = new_pin_hash(pin.trim());
    let account = AccountRecord {
        id: id.clone(),
        nickname: nickname.to_string(),
        real_name: real_name.to_string(),
        role: AccountRole::Guest,
        pin_salt,
        pin_hash,
        display_name_mode: DisplayNameMode::Nickname,
        created_at: now_string(),
    };
    store.accounts.push(account.clone());
    write_store(&store)?;
    write_session(&AccountSessionFile {
        current_account_id: Some(id),
    })?;
    let profile_dir = profile_dir_for_account(&account.id)?;
    Ok(AccountSession {
        account: public_account(&account),
        profile_dir: profile_dir.to_string_lossy().to_string(),
    })
}

#[command]
pub async fn logout_account() -> Result<(), String> {
    write_session(&AccountSessionFile {
        current_account_id: None,
    })
}

#[command]
pub async fn reset_account_pin(
    target_account_id: String,
    admin_pin: String,
    new_pin: String,
) -> Result<(), String> {
    validate_pin(&new_pin)?;
    let mut store = read_store()?;
    let admin = store
        .accounts
        .iter()
        .find(|account| account.role == AccountRole::Admin)
        .ok_or("未找到管理员账户。".to_string())?
        .clone();

    if target_account_id == admin.id {
        return Err("哼哼哼啊啊臭".to_string());
    }
    if !verify_pin(&admin, admin_pin.trim()) {
        return Err("管理员 PIN 不正确。".to_string());
    }
    let target = store
        .accounts
        .iter_mut()
        .find(|account| account.id == target_account_id)
        .ok_or("未找到要重置的账户。".to_string())?;
    let (pin_salt, pin_hash) = new_pin_hash(new_pin.trim());
    target.pin_salt = pin_salt;
    target.pin_hash = pin_hash;
    write_store(&store)
}

#[command]
pub async fn change_current_account_pin(
    current_pin: String,
    new_pin: String,
) -> Result<PublicAccount, String> {
    validate_pin(&current_pin)?;
    validate_pin(&new_pin)?;
    let session = read_session()?;
    let account_id = session.current_account_id.ok_or("尚未登录。".to_string())?;
    let mut store = read_store()?;
    let account = store
        .accounts
        .iter_mut()
        .find(|account| account.id == account_id)
        .ok_or("当前账户不存在。".to_string())?;
    if !verify_pin(account, current_pin.trim()) {
        return Err("当前 PIN 不正确。".to_string());
    }
    if verify_pin(account, new_pin.trim()) {
        return Err("新 PIN 不能和当前 PIN 相同。".to_string());
    }
    if account.id == ADMIN_ID && new_pin.trim() == ADMIN_INITIAL_PIN {
        return Err("管理员不能继续使用初始 PIN。".to_string());
    }
    let (pin_salt, pin_hash) = new_pin_hash(new_pin.trim());
    account.pin_salt = pin_salt;
    account.pin_hash = pin_hash;
    let public = public_account(account);
    write_store(&store)?;
    Ok(public)
}

#[command]
pub async fn set_current_account_display_mode(
    mode: DisplayNameMode,
) -> Result<PublicAccount, String> {
    let session = read_session()?;
    let account_id = session.current_account_id.ok_or("尚未登录。".to_string())?;
    let mut store = read_store()?;
    let account = store
        .accounts
        .iter_mut()
        .find(|account| account.id == account_id)
        .ok_or("当前账户不存在。".to_string())?;
    account.display_name_mode = mode;
    let public = public_account(account);
    write_store(&store)?;
    Ok(public)
}
