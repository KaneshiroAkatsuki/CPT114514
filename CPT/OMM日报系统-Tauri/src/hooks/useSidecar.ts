import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";
import type { AccountSession, AccountsInfo, Config, ConfigLoadInfo, DataStoreInfo, DisplayNameMode, DurationRule, GenerateResponse, GenerateSettings, ParseFoldersResponse, PreviewResponse, FolderRecord, TemplateInfo, TemplatePaths, RecognitionRules, RecognitionRulesLoadInfo, PublicAccount, PersonalCleanerBackupInfo, KnownSender, KnownSenderSortBy, MeasurementPerson, MeasurementPersonRole } from "@/types/record";

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
  ensureDoNotDisturb: boolean;
  clearScreenshots: boolean;
  screenshotWindowStart?: string | null;
  screenshotWindowEnd?: string | null;
  screenshotWindowLabel?: string | null;
  clearClipboardHistory: boolean;
  clearRecycleBin: boolean;
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

export interface MovedFolderInfo {
  folder_name: string;
  source_path: string;
  target_path: string;
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

  const moveFoldersToShiftBucket = async (
    dateDir: string,
    folderNames: string[],
    shift: "A" | "B",
  ): Promise<MovedFolderInfo[]> => {
    return await invoke<MovedFolderInfo[]>("move_folders_to_shift_bucket", {
      dateDir,
      folderNames,
      shift,
    });
  };

  return { selectFolder, selectXlsxFile, openFolder, moveFoldersToShiftBucket };
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

  const loadDurationRules = async (): Promise<DurationRule[]> => {
    return await invoke<DurationRule[]>("load_duration_rules");
  };

  const saveDurationRules = async (rules: DurationRule[]): Promise<DurationRule[]> => {
    return await invoke<DurationRule[]>("save_duration_rules", { rules });
  };

  return {
    loadConfigWithInfo,
    loadConfig,
    saveConfig,
    migrateConfig,
    syncConfigState,
    loadRecognitionRules,
    saveRecognitionRules,
    loadDurationRules,
    saveDurationRules,
  };
}

export function useAccountManager() {
  const loadAccounts = useCallback(async (): Promise<AccountsInfo> => {
    return await invoke<AccountsInfo>("load_accounts");
  }, []);

  const loginAccount = useCallback(async (login: string, pin: string): Promise<AccountSession> => {
    return await invoke<AccountSession>("login_account", { login, pin });
  }, []);

  const registerAccount = useCallback(async (nickname: string, realName: string, pin: string): Promise<AccountSession> => {
    return await invoke<AccountSession>("register_account", { nickname, realName, pin });
  }, []);

  const logoutAccount = useCallback(async (): Promise<void> => {
    await invoke("logout_account");
  }, []);

  const resetAccountPin = useCallback(async (targetAccountId: string, adminPin: string, newPin: string): Promise<void> => {
    await invoke("reset_account_pin", { targetAccountId, adminPin, newPin });
  }, []);

  const setCurrentAccountDisplayMode = useCallback(async (mode: DisplayNameMode): Promise<PublicAccount> => {
    return await invoke<PublicAccount>("set_current_account_display_mode", { mode });
  }, []);

  return { loadAccounts, loginAccount, registerAccount, logoutAccount, resetAccountPin, setCurrentAccountDisplayMode };
}

export function useDataStoreManager() {
  const getDataStoreInfo = async (): Promise<DataStoreInfo> => {
    return await invoke<DataStoreInfo>("get_data_store_info");
  };

  return { getDataStoreInfo };
}

export function useKnownSenderManager() {
  const loadKnownSenders = useCallback(async (
    sortBy: KnownSenderSortBy = "lastSeenAt",
    descending = true,
    includeDisabled = false,
  ): Promise<KnownSender[]> => {
    return await invoke<KnownSender[]>("load_known_senders", { sortBy, descending, includeDisabled });
  }, []);

  const upsertKnownSender = useCallback(async (
    name: string,
    source = "user",
    sampleFolder = "",
    note = "",
  ): Promise<KnownSender> => {
    return await invoke<KnownSender>("upsert_known_sender", { name, source, sampleFolder, note });
  }, []);

  const updateKnownSender = useCallback(async (
    id: string,
    name: string,
    note = "",
    enabled = true,
  ): Promise<KnownSender> => {
    return await invoke<KnownSender>("update_known_sender", { id, name, note, enabled });
  }, []);

  const deleteKnownSender = useCallback(async (id: string): Promise<void> => {
    await invoke("delete_known_sender", { id });
  }, []);

  return { loadKnownSenders, upsertKnownSender, updateKnownSender, deleteKnownSender };
}

export function useMeasurementPeopleManager() {
  const loadMeasurementPeople = useCallback(async (includeDisabled = false): Promise<MeasurementPerson[]> => {
    return await invoke<MeasurementPerson[]>("load_measurement_people", { includeDisabled });
  }, []);

  const upsertMeasurementPerson = useCallback(async (
    name: string,
    role: MeasurementPersonRole = "ordinary",
    aliases: string[] = [],
    note = "",
  ): Promise<MeasurementPerson> => {
    return await invoke<MeasurementPerson>("upsert_measurement_person", { name, role, aliases, note });
  }, []);

  const deleteMeasurementPerson = useCallback(async (id: string): Promise<void> => {
    await invoke("delete_measurement_person", { id });
  }, []);

  return { loadMeasurementPeople, upsertMeasurementPerson, deleteMeasurementPerson };
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

  const getPersonalCleanerBackupInfo = async (): Promise<PersonalCleanerBackupInfo> => {
    return await invoke<PersonalCleanerBackupInfo>("get_personal_cleaner_backup_info");
  };

  const cleanPersonalCleanerBackups = async (olderThanDays = 30): Promise<PersonalCleanerBackupInfo> => {
    return await invoke<PersonalCleanerBackupInfo>("clean_personal_cleaner_backups", { olderThanDays });
  };

  return {
    runPersonalCleaner,
    readPersonalCleanerLog,
    previewPersonalCleanerProcesses,
    getPersonalCleanerBackupInfo,
    cleanPersonalCleanerBackups,
  };
}
