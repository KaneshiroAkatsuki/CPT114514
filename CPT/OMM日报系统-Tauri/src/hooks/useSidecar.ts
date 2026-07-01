import { invoke } from "@tauri-apps/api/core";
import type { AccountSession, AccountsInfo, Config, ConfigLoadInfo, DataStoreInfo, DisplayNameMode, GenerateResponse, GenerateSettings, ParseFoldersResponse, PreviewResponse, FolderRecord, TemplateInfo, TemplatePaths, RecognitionRules, RecognitionRulesLoadInfo, PublicAccount } from "@/types/record";

export interface PersonalCleanerOptions {
  dryRun: boolean;
  cleanEdge: boolean;
  keepPasswordsAutofill: boolean;
  clearSitePreferences: boolean;
  resetEdge: boolean;
  clearBookmarks: boolean;
  clearExtensions: boolean;
  clearMicrosoftAccount: boolean;
  closeAdobiProcesses: boolean;
  clearWindowsNotifications: boolean;
  clearScreenshots: boolean;
  screenshotWindowStart?: string | null;
  screenshotWindowEnd?: string | null;
  screenshotWindowLabel?: string | null;
  clearClipboardHistory: boolean;
  clearOpencodeShortcuts: boolean;
  clearPrivateBrowserHistory: boolean;
  cleanPrivateBrowser: boolean;
  backupPrivateBrowser: boolean;
  keepWifiPrefixes: string[];
  forgetWifiProfiles: boolean;
  forgetWifiPatterns: string[];
  connectCompanyWifi: boolean;
  companyWifiSsid: string;
  skipBackup: boolean;
}

export interface PersonalCleanerRunInfo {
  runId: string;
  scriptPath: string;
  logPath: string;
  summaryPath: string;
  launched: boolean;
}

export interface PersonalCleanerLogInfo {
  log: string;
  done: boolean;
  summary?: unknown;
}

export interface PersonalCleanerProcessCandidate {
  pid: number;
  name: string;
  path: string;
  kind: string;
}

export function useSidecar() {
  const parseFolders = async (baseDir: string, operatorName: string): Promise<ParseFoldersResponse> => {
    return await invoke<ParseFoldersResponse>("sidecar_parse_folders", {
      baseDir,
      operatorName,
    });
  };

  const generate = async (
    baseDir: string,
    records: FolderRecord[],
    settings: GenerateSettings
  ): Promise<GenerateResponse> => {
    return await invoke<GenerateResponse>("sidecar_generate", {
      baseDir,
      records,
      settings,
    });
  };

  const preview = async (
    baseDir: string,
    records: FolderRecord[],
    settings: GenerateSettings
  ): Promise<PreviewResponse> => {
    return await invoke<PreviewResponse>("sidecar_preview", {
      baseDir,
      records,
      settings,
    });
  };

  const listDateFolders = async (workDir: string): Promise<string[]> => {
    return await invoke<string[]>("list_date_folders", { workDir });
  };

  const getTemplateInfo = async (): Promise<TemplateInfo> => {
    return await invoke<TemplateInfo>("sidecar_get_template_info");
  };

  const replaceTemplate = async (templatePath: string): Promise<TemplateInfo> => {
    return await invoke<TemplateInfo>("sidecar_replace_template", { templatePath });
  };

  const resetTemplate = async (): Promise<TemplateInfo> => {
    return await invoke<TemplateInfo>("sidecar_reset_template");
  };

  const getTemplatePaths = async (): Promise<TemplatePaths> => {
    return await invoke<TemplatePaths>("get_template_paths");
  };

  const listChildFolders = async (path: string): Promise<string[]> => {
    return await invoke<string[]>("list_child_folders", { path });
  };

  return { parseFolders, generate, preview, listDateFolders, listChildFolders, getTemplateInfo, replaceTemplate, resetTemplate, getTemplatePaths };
}

export function useFile() {
  const selectFolder = async (defaultPath?: string | null): Promise<string | null> => {
    return await invoke<string | null>("select_folder", {
      defaultPath: defaultPath || null,
    });
  };

  const selectXlsxFile = async (): Promise<string | null> => {
    return await invoke<string | null>("select_xlsx_file");
  };

  const openFolder = async (path: string): Promise<void> => {
    await invoke("open_folder", { path });
  };

  return { selectFolder, selectXlsxFile, openFolder };
}

export function useConfigManager() {
  const loadConfigWithInfo = async (): Promise<ConfigLoadInfo> => {
    return await invoke<ConfigLoadInfo>("load_config_with_info");
  };

  const loadConfig = async (): Promise<Config> => {
    return await invoke<Config>("load_config");
  };

  const saveConfig = async (config: Config): Promise<void> => {
    await invoke("save_config", { config });
  };

  const migrateConfig = async (config: Config, newDir: string, strategy: string): Promise<Config> => {
    return await invoke<Config>("migrate_config", { config, newDir, strategy });
  };

  const syncConfigState = async (config: Config): Promise<string> => {
    return await invoke<string>("sync_config_state", { config });
  };

  const loadRecognitionRules = async (): Promise<RecognitionRulesLoadInfo> => {
    return await invoke<RecognitionRulesLoadInfo>("load_recognition_rules");
  };

  const saveRecognitionRules = async (rules: RecognitionRules): Promise<RecognitionRulesLoadInfo> => {
    return await invoke<RecognitionRulesLoadInfo>("save_recognition_rules", { rules });
  };

  return { loadConfigWithInfo, loadConfig, saveConfig, migrateConfig, syncConfigState, loadRecognitionRules, saveRecognitionRules };
}

export function useAccountManager() {
  const loadAccounts = async (): Promise<AccountsInfo> => {
    return await invoke<AccountsInfo>("load_accounts");
  };

  const loginAccount = async (login: string, pin: string): Promise<AccountSession> => {
    return await invoke<AccountSession>("login_account", { login, pin });
  };

  const registerAccount = async (nickname: string, realName: string, pin: string): Promise<AccountSession> => {
    return await invoke<AccountSession>("register_account", { nickname, realName, pin });
  };

  const logoutAccount = async (): Promise<void> => {
    await invoke("logout_account");
  };

  const resetAccountPin = async (targetAccountId: string, adminPin: string, newPin: string): Promise<void> => {
    await invoke("reset_account_pin", { targetAccountId, adminPin, newPin });
  };

  const setCurrentAccountDisplayMode = async (mode: DisplayNameMode): Promise<PublicAccount> => {
    return await invoke<PublicAccount>("set_current_account_display_mode", { mode });
  };

  return { loadAccounts, loginAccount, registerAccount, logoutAccount, resetAccountPin, setCurrentAccountDisplayMode };
}

export function useDataStoreManager() {
  const getDataStoreInfo = async (): Promise<DataStoreInfo> => {
    return await invoke<DataStoreInfo>("get_data_store_info");
  };

  return { getDataStoreInfo };
}

export function usePersonalCleaner() {
  const runPersonalCleaner = async (options: PersonalCleanerOptions): Promise<PersonalCleanerRunInfo> => {
    return await invoke<PersonalCleanerRunInfo>("run_personal_cleaner", { options });
  };

  const readPersonalCleanerLog = async (logPath: string, summaryPath: string): Promise<PersonalCleanerLogInfo> => {
    return await invoke<PersonalCleanerLogInfo>("read_personal_cleaner_log", { logPath, summaryPath });
  };

  const previewPersonalCleanerProcesses = async (): Promise<PersonalCleanerProcessCandidate[]> => {
    return await invoke<PersonalCleanerProcessCandidate[]>("preview_personal_cleaner_processes");
  };

  return { runPersonalCleaner, readPersonalCleanerLog, previewPersonalCleanerProcesses };
}
