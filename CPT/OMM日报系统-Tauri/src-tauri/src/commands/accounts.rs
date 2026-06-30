use rand::RngCore;
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

fn portable_root_from_exe() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let exe_dir = exe.parent()?.to_path_buf();
    let has_portable_resources = exe_dir.join("resources").join("template.xlsx").is_file()
        && exe_dir.join("binaries").join("generate_report.exe").is_file();
    if has_portable_resources {
        return Some(exe_dir);
    }
    None
}

fn default_config_base_dir() -> Result<PathBuf, String> {
    if let Some(portable_root) = portable_root_from_exe() {
        return Ok(portable_root);
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        if !appdata.is_empty() {
            let dir = PathBuf::from(appdata).join("OMM日报系统");
            fs::create_dir_all(&dir).map_err(|e| format!("无法创建配置目录: {}", e))?;
            return Ok(dir);
        }
    }
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("无法获取程序路径: {}", e))?
        .parent()
        .ok_or("无法获取程序目录")?
        .to_path_buf();
    Ok(exe_dir)
}

pub fn account_storage_root() -> Result<PathBuf, String> {
    let root = default_config_base_dir()?.join(".omm");
    fs::create_dir_all(root.join("accounts")).map_err(|e| format!("无法创建账户目录: {}", e))?;
    fs::create_dir_all(root.join("profiles")).map_err(|e| format!("无法创建账户配置目录: {}", e))?;
    Ok(root)
}

fn accounts_path() -> Result<PathBuf, String> {
    Ok(account_storage_root()?.join("accounts").join("accounts.json"))
}

fn session_path() -> Result<PathBuf, String> {
    Ok(account_storage_root()?.join("accounts").join("session.json"))
}

pub fn profile_dir_for_account(account_id: &str) -> Result<PathBuf, String> {
    let safe_id = sanitize_id(account_id);
    let dir = account_storage_root()?.join("profiles").join(safe_id);
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建账户配置目录: {}", e))?;
    Ok(dir)
}

pub fn current_profile_config_path() -> Result<Option<PathBuf>, String> {
    let session = read_session()?;
    if let Some(account_id) = session.current_account_id {
        return Ok(Some(profile_dir_for_account(&account_id)?.join("config.json")));
    }
    Ok(None)
}

pub fn current_account_record() -> Result<Option<AccountRecord>, String> {
    let session = read_session()?;
    let Some(account_id) = session.current_account_id else {
        return Ok(None);
    };
    let store = read_store()?;
    Ok(store.accounts.into_iter().find(|account| account.id == account_id))
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect::<String>()
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
    value.trim().to_lowercase()
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

fn read_store() -> Result<AccountStore, String> {
    let path = accounts_path()?;
    let mut store = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| format!("无法读取账户文件: {}", e))?;
        serde_json::from_str::<AccountStore>(&content).unwrap_or_default()
    } else {
        AccountStore {
            version: ACCOUNT_STORE_VERSION,
            accounts: vec![],
        }
    };

    store.version = ACCOUNT_STORE_VERSION;
    if !store.accounts.iter().any(|account| account.id == ADMIN_ID) {
        store.accounts.insert(0, admin_account());
        write_store(&store)?;
    }
    Ok(store)
}

fn write_store(store: &AccountStore) -> Result<(), String> {
    let path = accounts_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("无法创建账户目录: {}", e))?;
    }
    let content = serde_json::to_string_pretty(store).map_err(|e| format!("无法序列化账户文件: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("无法写入账户文件: {}", e))
}

fn read_session() -> Result<AccountSessionFile, String> {
    let path = session_path()?;
    if !path.exists() {
        return Ok(AccountSessionFile::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("无法读取登录状态: {}", e))?;
    Ok(serde_json::from_str::<AccountSessionFile>(&content).unwrap_or_default())
}

fn write_session(session: &AccountSessionFile) -> Result<(), String> {
    let path = session_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("无法创建登录状态目录: {}", e))?;
    }
    let content = serde_json::to_string_pretty(session).map_err(|e| format!("无法序列化登录状态: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("无法写入登录状态: {}", e))
}

fn find_account_by_login<'a>(store: &'a AccountStore, login: &str) -> Option<&'a AccountRecord> {
    let needle = normalize_login(login);
    store.accounts.iter().find(|account| {
        normalize_login(&account.id) == needle
            || normalize_login(&account.nickname) == needle
            || normalize_login(&account.real_name) == needle
    })
}

fn ensure_unique_account(store: &AccountStore, nickname: &str, real_name: &str) -> Result<(), String> {
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
    let base = sanitize_id(if nickname.trim().is_empty() { real_name } else { nickname });
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
pub async fn register_account(nickname: String, real_name: String, pin: String) -> Result<AccountSession, String> {
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
pub async fn reset_account_pin(target_account_id: String, admin_pin: String, new_pin: String) -> Result<(), String> {
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
pub async fn set_current_account_display_mode(mode: DisplayNameMode) -> Result<PublicAccount, String> {
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
