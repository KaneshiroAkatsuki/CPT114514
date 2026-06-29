import { invoke } from "@tauri-apps/api/core";
import type { Config, ConfigLoadInfo, GenerateResponse, GenerateSettings, ParseFoldersResponse, PreviewResponse, FolderRecord, TemplateInfo, TemplatePaths, RecognitionRules, RecognitionRulesLoadInfo } from "@/types/record";

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
  const selectFolder = async (): Promise<string | null> => {
    return await invoke<string | null>("select_folder");
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
