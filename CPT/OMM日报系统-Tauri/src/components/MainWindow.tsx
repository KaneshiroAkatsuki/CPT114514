import { useState, useEffect, useRef, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ReviewDialog } from "@/components/ReviewDialog";
import { ShiftChooseDialog } from "@/components/ShiftChooseDialog";
import { PreviewDialog } from "@/components/PreviewDialog";
import { MultiDayOverviewDialog, type MultiDayOverviewItem, type MultiDayOverviewStatus } from "@/components/MultiDayOverviewDialog";
import { DaySettingsDialog } from "@/components/DaySettingsDialog";
import { HelpCenterDialog } from "@/components/HelpCenterDialog";
import { ConfigLocationDialog } from "@/components/ConfigLocationDialog";
import { SpecialItemsDialog } from "@/components/SpecialItemsDialog";
import { RecognitionRulesDialog } from "@/components/RecognitionRulesDialog";
import { PersonalCleanerDialog } from "@/components/PersonalCleanerDialog";
import { SettingsCenterDialog, type SettingsCenterDraft } from "@/components/SettingsCenterDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { KnownSendersDialog } from "@/components/KnownSendersDialog";
import { MeasurementPeopleDialog } from "@/components/MeasurementPeopleDialog";
import { useFile, useSidecar, useConfigManager, useAccountManager, useDataStoreManager, usePersonalCleaner, useKnownSenderManager } from "@/hooks/useSidecar";
import { ManualTaskDialog, type ManualTimeSuggestion } from "@/components/ManualTaskDialog";
import { detectManualCandidates, validateRealManualTask } from "@/lib/utils";
import { emptyRecognitionRules } from "@/lib/recognitionRules";
import type { DisplayNameMode, DurationOverride, DurationRule, DurationRuleMatcher, FillerPosition, FolderRecord, ReviewInfo, GenerateSettings, Config, QueueItem, QueueItemSettingsOverride, PreviewData, TemplateInfo, TemplatePaths, SpecialItem, ManualFolderCandidate, RecognitionRules, RealManualTask, PublicAccount, DataStoreInfo, PersonalCleanerBackupInfo } from "@/types/record";
import { ArrowLeft, BarChart3, Clock, Database, Folder, Settings, Play, HelpCircle, FolderOpen, Trash2, Plus, RefreshCw, X, FileSpreadsheet, Home, Info, ShieldCheck } from "lucide-react";
import { pinyin } from "pinyin-pro";

function getInitials(name: string): string {
  if (!name) return "-";
  return pinyin(name, { pattern: "first", toneType: "none" }).replace(/\s/g, "").toLowerCase();
}

function schemePillClass(label: string): string {
  if (label.includes("方案A")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (label.includes("方案B")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (label.includes("下早班")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (label.includes("手量:开") || label.includes("其他:开")) return "bg-green-50 text-green-700 border-green-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function waitForVisibleFeedback(ms = 650): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

type GenerateFailureDetail = {
  dateFolder: string;
  reason: string;
  action?: "manual" | "review" | "check";
  type?: "failure" | "paused";
  queueIndex?: number;
};

type AppConfirmRequest = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string | null;
  tone?: "info" | "warning" | "danger";
  resolve: (confirmed: boolean) => void;
};

type ModuleView = "home" | "daily" | "dataManagement";
type QueueContextMenu = { x: number; y: number; index: number };
const DEFAULT_FILLER_POSITION: FillerPosition = "middle";
const DEFAULT_OTHER_NOTE = "其他事务";
const CONTEXT_MENU_WIDTH = 260;
const CONTEXT_MENU_MAX_HEIGHT = 520;
const CONTEXT_MENU_MARGIN = 12;
const FILLER_POSITION_LABELS: Record<FillerPosition, string> = {
  head: "头部",
  middle: "中部",
  tail: "尾部",
  random: "随机",
};

function getContextMenuStyle(menu: QueueContextMenu): CSSProperties {
  if (typeof window === "undefined") {
    return { left: menu.x, top: menu.y, width: CONTEXT_MENU_WIDTH, maxHeight: CONTEXT_MENU_MAX_HEIGHT };
  }
  const maxHeight = Math.min(window.innerHeight * 0.7, CONTEXT_MENU_MAX_HEIGHT);
  const maxLeft = Math.max(CONTEXT_MENU_MARGIN, window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_MARGIN);
  const left = Math.min(Math.max(CONTEXT_MENU_MARGIN, menu.x), maxLeft);
  const top = Math.max(
    CONTEXT_MENU_MARGIN,
    Math.min(menu.y, window.innerHeight - maxHeight - CONTEXT_MENU_MARGIN)
  );
  return { left, top, width: CONTEXT_MENU_WIDTH, maxHeight };
}

interface MainWindowProps {
  currentAccount: PublicAccount;
  onAccountUpdated: (account: PublicAccount) => void;
  onSwitchAccount: () => void;
}

export function MainWindow({ currentAccount, onAccountUpdated, onSwitchAccount }: MainWindowProps) {
  const [workDir, setWorkDir] = useState("");
  const [operatorName, setOperatorName] = useState(currentAccount.real_name || currentAccount.nickname || "");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedQueueItems, setSelectedQueueItems] = useState<Set<number>>(new Set());
  const [logs, setLogs] = useState<string[]>([]);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastOutputPath, setLastOutputPath] = useState<string | null>(null);

  // Date folder selector
  const [selectedDateFolder, setSelectedDateFolder] = useState("");
  const [dateFolders, setDateFolders] = useState<string[]>([]);

  // Settings state
  const [leaveStrategy, setLeaveStrategy] = useState<'auto' | 'early' | 'normal'>('normal');
  const [enableHand, setEnableHand] = useState(true);
  const [enableOther, setEnableOther] = useState(false);
  const [useSrcOutput, setUseSrcOutput] = useState(true);
  const [outputDir, setOutputDir] = useState("");
  const [shiftDefault, setShiftDefault] = useState<'A' | 'B'>('B');
  const [tppMin, setTppMin] = useState(2.0);
  const [tppMax, setTppMax] = useState(5.0);
  const [pkgRest, setPkgRest] = useState(0);
  const [handMax, setHandMax] = useState(120);
  const [otherMax, setOtherMax] = useState(90);
  const [complexDefault, setComplexDefault] = useState<'A' | 'B'>('A');
  const [configDir, setConfigDir] = useState(workDir);
  const [configSource, setConfigSource] = useState<string>("");
  const [configPath, setConfigPath] = useState<string>("");
  const [configDuplicates, setConfigDuplicates] = useState<string[]>([]);
  const [recognitionRulesOpen, setRecognitionRulesOpen] = useState(false);
  const [recognitionRules, setRecognitionRules] = useState<RecognitionRules>(emptyRecognitionRules());
  const [recognitionRulesPath, setRecognitionRulesPath] = useState("");
  const [recognitionRulesExists, setRecognitionRulesExists] = useState(false);
  const [dataStoreInfo, setDataStoreInfo] = useState<DataStoreInfo | null>(null);
  const [cleanerBackupInfo, setCleanerBackupInfo] = useState<PersonalCleanerBackupInfo | null>(null);
  const [dateFoldersRefreshing, setDateFoldersRefreshing] = useState(false);
  const [dateFoldersRefreshMessage, setDateFoldersRefreshMessage] = useState("");

  // Preview dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(-1);
  const [multiDayOverviewOpen, setMultiDayOverviewOpen] = useState(false);
  const [multiDayOverviewLoading, setMultiDayOverviewLoading] = useState(false);
  const [multiDayOverviewItems, setMultiDayOverviewItems] = useState<MultiDayOverviewItem[]>([]);

  // Day settings dialog state
  const [daySettingsOpen, setDaySettingsOpen] = useState(false);
  const [daySettingsIndex, setDaySettingsIndex] = useState<number>(-1);

  // Help center dialog state
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpSection, setHelpSection] = useState('quickstart');
  const [settingsCenterOpen, setSettingsCenterOpen] = useState(false);
  const [knownSendersOpen, setKnownSendersOpen] = useState(false);
  const [measurementPeopleOpen, setMeasurementPeopleOpen] = useState(false);
  const [personalCleanerOpen, setPersonalCleanerOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleView>("home");
  const [dataManagementDeniedOpen, setDataManagementDeniedOpen] = useState(false);

  // Config location dialog state
  const [configLocationOpen, setConfigLocationOpen] = useState(false);

  // 耗时规则库管理（旧 special_items 仅作兼容兜底）
  const [specialItemsOpen, setSpecialItemsOpen] = useState(false);
  const [specialItems, setSpecialItems] = useState<SpecialItem[]>([
    { name: "烧结盘", minutes: 8 },
  ]);
  const [durationRules, setDurationRules] = useState<DurationRule[]>([]);

  // Template info state
  const [templateInfo, setTemplateInfo] = useState<TemplateInfo | null>(null);
  const [templatePathsOpen, setTemplatePathsOpen] = useState(false);
  const [templatePaths, setTemplatePaths] = useState<TemplatePaths | null>(null);

  // Review dialog state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewMap, setReviewMap] = useState<Record<string, ReviewInfo>>({});
  const [pendingRecords, setPendingRecords] = useState<FolderRecord[]>([]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<QueueContextMenu | null>(null);

  // 手量任务管理弹窗
  const [manualTaskOpen, setManualTaskOpen] = useState(false);
  const [manualTaskItem, setManualTaskItem] = useState<QueueItem | null>(null);
  const [appConfirm, setAppConfirm] = useState<AppConfirmRequest | null>(null);

  // Shift choose dialog state
  const [shiftChoosePath, setShiftChoosePath] = useState<string | null>(null);
  const [shiftChooseFolderName, setShiftChooseFolderName] = useState("");
  const [shiftChooseOpen, setShiftChooseOpen] = useState(false);

  const { selectFolder, selectXlsxFile, openFolder, moveFoldersToShiftBucket } = useFile();
  const { parseFolders, generate, preview, listDateFolders, listChildFolders, getTemplateInfo, replaceTemplate, resetTemplate, getTemplatePaths } = useSidecar();
  const { loadConfigWithInfo, saveConfig, migrateConfig, syncConfigState, loadRecognitionRules, saveRecognitionRules, loadDurationRules, saveDurationRules } = useConfigManager();
  const { setCurrentAccountDisplayMode } = useAccountManager();
  const { getDataStoreInfo } = useDataStoreManager();
  const { upsertKnownSender } = useKnownSenderManager();
  const { getPersonalCleanerBackupInfo, cleanPersonalCleanerBackups } = usePersonalCleaner();
  const isAdminAccount = currentAccount.role === "admin";
  const moduleTitle = activeModule === "daily" ? "信息统计局" : activeModule === "dataManagement" ? "数据管理局" : "管理厅主页";

  const handleOpenDataManagement = () => {
    if (!isAdminAccount) {
      setDataManagementDeniedOpen(true);
      return;
    }
    setActiveModule("dataManagement");
  };

  const requestAppConfirm = (request: Omit<AppConfirmRequest, "resolve">): Promise<boolean> => {
    return new Promise((resolve) => setAppConfirm({ ...request, resolve }));
  };

  const resolveAppConfirm = (confirmed: boolean) => {
    if (!appConfirm) return;
    const { resolve } = appConfirm;
    setAppConfirm(null);
    resolve(confirmed);
  };

  const refreshRecognitionRules = async () => {
    const info = await loadRecognitionRules();
    setRecognitionRules(info.rules || emptyRecognitionRules());
    setRecognitionRulesPath(info.path);
    setRecognitionRulesExists(info.exists);
    return info;
  };

  const buildMigratedDurationRule = (item: SpecialItem): DurationRule => {
    const key = item.name.trim().replace(/\s+/g, "-").toLowerCase();
    return {
      id: `migrated-special-${encodeURIComponent(key)}`,
      builtinKey: null,
      name: item.name.trim(),
      enabled: true,
      source: "migrated",
      priority: 300,
      matchMode: "any",
      matchers: [
        { field: "folder", op: "contains", value: item.name.trim() },
        { field: "station", op: "contains", value: item.name.trim() },
        { field: "product", op: "contains", value: item.name.trim() },
      ],
      duration: {
        mode: "per_piece",
        minutes: item.minutes,
        minMinutes: item.minutes,
        maxMinutes: item.minutes,
        quantityPolicy: "piece_first",
        compressible: false,
        missingQuantityPolicy: "one_piece",
      },
      userModified: true,
      builtinVersion: 1,
      deprecated: false,
    };
  };

  const refreshDurationRules = async (legacySpecialItems?: SpecialItem[]) => {
    let rules = await loadDurationRules();
    const legacyItems = (legacySpecialItems || []).filter((item) => item.name?.trim() && Number.isFinite(item.minutes) && item.minutes > 0);
    if (legacyItems.length > 0) {
      const existingNames = new Set(rules.map((rule) => rule.name.trim()));
      const migrated = legacyItems
        .filter((item) => !existingNames.has(item.name.trim()))
        .map(buildMigratedDurationRule);
      if (migrated.length > 0) {
        rules = await saveDurationRules([...rules, ...migrated]);
        addLog(`旧特殊物品已迁移为耗时规则: ${migrated.map((rule) => rule.name).join("、")}`);
      }
    }
    setDurationRules(rules);
    return rules;
  };

  const handleDisplayNameModeChange = async (mode: DisplayNameMode) => {
    const account = await setCurrentAccountDisplayMode(mode);
    onAccountUpdated(account);
  };

  // Load saved config on startup
  useEffect(() => {
    loadConfigWithInfo().then((info) => {
      const cfg = info.config;
      if (cfg && typeof cfg === "object") {
        const c = cfg as unknown as Config;
        if (c.work_dir) setWorkDir(c.work_dir);
        if (c.operator_name) setOperatorName(c.operator_name);
        if (c.src_output !== undefined) setUseSrcOutput(c.src_output);
        if (c.output_dir) setOutputDir(c.output_dir);
        if (c.leave_strategy === 'auto' || c.leave_strategy === 'early' || c.leave_strategy === 'normal') setLeaveStrategy(c.leave_strategy);
        if (typeof c.enable_hand === 'boolean') setEnableHand(c.enable_hand);
        if (typeof c.enable_other === 'boolean') setEnableOther(c.enable_other);
        if (c.shift_default === 'A' || c.shift_default === 'B') setShiftDefault(c.shift_default);
        if (c.config_dir) setConfigDir(c.config_dir);
        if (Array.isArray(c.special_items) && c.special_items.length > 0) {
          setSpecialItems(c.special_items);
        }
        if (typeof c.hand_max === 'number') setHandMax(c.hand_max);
        if (typeof c.other_max === 'number') setOtherMax(c.other_max);
        if (typeof c.tpp_min === 'number') setTppMin(c.tpp_min);
        if (typeof c.tpp_max === 'number') setTppMax(c.tpp_max);
        if (typeof c.pkg_rest === 'number') setPkgRest(c.pkg_rest);
        if (c.complex_default === 'A' || c.complex_default === 'B') setComplexDefault(c.complex_default);
        // 记录配置来源信息
        setConfigSource(info.source);
        setConfigPath(info.path);
        setConfigDuplicates(info.duplicate_paths || []);
        // Sync the loaded config to Rust state and show the effective config directory.
        // When config_dir is empty, Rust uses the default AppData directory.
        syncConfigState(c)
          .then((effectiveDir) => {
            if (!c.config_dir && effectiveDir) setConfigDir(effectiveDir);
            refreshRecognitionRules().catch((e) => addLog(`补充规则表读取失败: ${e}`));
            refreshDurationRules(c.special_items).catch((e) => addLog(`耗时规则库读取失败: ${e}`));
          })
          .catch(() => {});
        if (!cfg.config_dir_ever_set) {
          setConfigLocationOpen(true);
        }
      } else {
        setConfigLocationOpen(true);
      }
    }).catch(() => {
      setConfigLocationOpen(true);
    });
    // 加载模板信息
    getTemplateInfo().then(setTemplateInfo).catch(() => { /* ignore */ });
    refreshDataStoreInfo().catch(() => { /* logged in helper */ });
    refreshDurationRules().catch((e) => addLog(`耗时规则库读取失败: ${e}`));
  }, []);

  useEffect(() => {
    if (settingsCenterOpen) {
      refreshDataStoreInfo().catch(() => { /* logged in helper */ });
      refreshCleanerBackupInfo().catch(() => { /* logged in helper */ });
    }
  }, [settingsCenterOpen]);

  // 统一构造需要持久化的配置对象，避免不同保存入口遗漏字段。
  const buildConfigPatch = (overrides?: Partial<Config>): Config => {
    return {
      work_dir: workDir,
      operator_name: operatorName,
      src_output: useSrcOutput,
      output_dir: outputDir,
      leave_strategy: leaveStrategy,
      enable_hand: enableHand,
      enable_other: enableOther,
      shift_default: shiftDefault,
      complex_default: complexDefault,
      tpp_min: tppMin,
      tpp_max: tppMax,
      pkg_rest: pkgRest,
      hand_max: handMax,
      other_max: otherMax,
      special_items: specialItems,
      config_dir: configDir,
      config_dir_ever_set: true,
      ...overrides,
    };
  };

  const persistConfig = (overrides?: Partial<Config>) => {
    saveConfig(buildConfigPatch(overrides)).catch(() => {});
  };

  const buildSettingsDraft = (): SettingsCenterDraft => ({
    workDir,
    operatorName,
    leaveStrategy,
    enableHand,
    enableOther,
    useSrcOutput,
    outputDir,
    shiftDefault,
    tppMin,
    tppMax,
    pkgRest,
    handMax,
    otherMax,
    complexDefault,
    configDir,
  });

  const buildConfigFromSettingsDraft = (draft: SettingsCenterDraft): Config => {
    return buildConfigPatch({
      work_dir: draft.workDir,
      operator_name: draft.operatorName,
      src_output: draft.useSrcOutput,
      output_dir: draft.outputDir,
      leave_strategy: draft.leaveStrategy,
      enable_hand: draft.enableHand,
      enable_other: draft.enableOther,
      shift_default: draft.shiftDefault,
      complex_default: draft.complexDefault,
      tpp_min: draft.tppMin,
      tpp_max: draft.tppMax,
      pkg_rest: draft.pkgRest,
      hand_max: draft.handMax,
      other_max: draft.otherMax,
      config_dir: draft.configDir,
      config_dir_ever_set: true,
    });
  };

  const configDirFromPath = (path: string): string => {
    return path.replace(/[\\/][^\\/]*$/, "");
  };

  const refreshDateFoldersForPath = async (path: string) => {
    if (!path) {
      setDateFolders([]);
      setSelectedDateFolder("");
      return;
    }
    try {
      const folders = await listDateFolders(path);
      setDateFolders(folders);
      setSelectedDateFolder("");
      addLog(`工作目录已更新，找到 ${folders.length} 个日期文件夹`);
    } catch (e) {
      setDateFolders([]);
      setSelectedDateFolder("");
      addLog(`工作目录已更新，但获取日期文件夹失败: ${e}`);
    }
  };

  const applySettingsDraftToState = (draft: SettingsCenterDraft) => {
    setWorkDir(draft.workDir);
    setOperatorName(draft.operatorName);
    setUseSrcOutput(draft.useSrcOutput);
    setOutputDir(draft.outputDir);
    setLeaveStrategy(draft.leaveStrategy);
    setEnableHand(draft.enableHand);
    setEnableOther(draft.enableOther);
    setShiftDefault(draft.shiftDefault);
    setComplexDefault(draft.complexDefault);
    setTppMin(draft.tppMin);
    setTppMax(draft.tppMax);
    setPkgRest(draft.pkgRest);
    setHandMax(draft.handMax);
    setOtherMax(draft.otherMax);
    setConfigDir(draft.configDir);
  };

  const handleSaveSettingsCenter = async (draft: SettingsCenterDraft) => {
    const config = buildConfigFromSettingsDraft(draft);
    const workDirChanged = draft.workDir !== workDir;

    await saveConfig(config);

    const info = await loadConfigWithInfo();
    const effectiveDir = await syncConfigState(info.config);

    applySettingsDraftToState({
      ...draft,
      configDir: info.config.config_dir || effectiveDir || configDirFromPath(info.path),
    });
    setConfigSource(info.source);
    setConfigPath(info.path);
    setConfigDuplicates(info.duplicate_paths || []);
    await refreshRecognitionRules();
    if (workDirChanged) {
      await refreshDateFoldersForPath(draft.workDir);
    }
    addLog(`设置已保存到配置文件: ${info.path}`);
  };

  // 更新模板：弹窗选择 xlsx，调用 sidecar 替换（复制到用户配置目录）
  const handleReplaceTemplate = async () => {
    try {
      const filePath = await selectXlsxFile();
      if (!filePath) return;
      const info = await replaceTemplate(filePath);
      setTemplateInfo(info);
      addLog(`模板已更新: ${info.path}`);
    } catch (e) {
      addLog(`更新模板失败: ${e}`);
    }
  };

  // 重置模板：回退到内置/工作目录模板
  const handleResetTemplate = async () => {
    try {
      const info = await resetTemplate();
      setTemplateInfo(info);
      addLog(`模板已重置: ${info.path ?? '(无可用模板)'}`);
    } catch (e) {
      addLog(`重置模板失败: ${e}`);
    }
  };

  // 刷新模板信息
  const handleRefreshTemplateInfo = async () => {
    try {
      const info = await getTemplateInfo();
      setTemplateInfo(info);
      addLog(`模板信息已刷新: ${info.exists ? info.path ?? "内置模板" : "未找到模板"}`);
    } catch (e) {
      addLog(`获取模板信息失败: ${e}`);
    }
  };

  // 查看模板位置：拉取所有模板路径并打开对话框
  const handleViewTemplatePaths = async () => {
    try {
      const paths = await getTemplatePaths();
      setTemplatePaths(paths);
      setTemplatePathsOpen(true);
    } catch (e) {
      addLog(`获取模板位置失败: ${e}`);
    }
  };

  const handleSaveDurationRules = async (rules: DurationRule[]) => {
    const savedRules = await saveDurationRules(rules);
    setDurationRules(savedRules);
    const fallbackSpecialItems = savedRules
      .filter((rule) => rule.enabled && !rule.deprecated && rule.duration.mode === "per_piece" && Number.isFinite(rule.duration.maxMinutes || rule.duration.minutes || NaN))
      .map((rule) => ({ name: rule.name, minutes: Number(rule.duration.maxMinutes || rule.duration.minutes) }));
    setSpecialItems(fallbackSpecialItems);
    saveConfig(buildConfigPatch({ special_items: fallbackSpecialItems })).catch(() => {});
    addLog(`耗时规则库已保存: ${savedRules.filter((rule) => rule.enabled && !rule.deprecated).length} 条启用规则`);
  };

  // 模板来源中文标签
  const templateSourceLabel = (source: string | null): string => {
    switch (source) {
      case 'user': return '用户自定义';
      case 'workdir': return '工作目录';
      case 'bundled': return '内置模板';
      default: return '未知';
    }
  };

  const validateGlobalSettings = (): string | null => {
    if (!Number.isFinite(tppMin) || tppMin <= 0) {
      return '每件时间最小值必须是大于 0 的数字';
    }
    if (!Number.isFinite(tppMax) || tppMax <= 0) {
      return '每件时间最大值必须是大于 0 的数字';
    }
    if (tppMin > tppMax) {
      return `每件时间最小值（${tppMin}）不能大于最大值（${tppMax}）`;
    }
    if (!Number.isFinite(pkgRest) || pkgRest < 0) {
      return '包间休息时间必须是非负数字';
    }
    if (!Number.isFinite(handMax) || handMax <= 0) {
      return '手量上限必须是大于 0 的数字';
    }
    if (!Number.isFinite(otherMax) || otherMax <= 0) {
      return '其他事务上限必须是大于 0 的数字';
    }
    if (!useSrcOutput && (!outputDir || outputDir.trim().length === 0)) {
      return '未勾选“输出到源日期文件夹”时，必须指定输出目录';
    }
    return null;
  };

  const getNumericQuantity = (quantity: FolderRecord["quantity"]): number => {
    if (typeof quantity === "number" && Number.isFinite(quantity)) return quantity;
    return 0;
  };

  const normalizeRecordText = (value?: string | number | null): string => {
    if (value === undefined || value === null) return "";
    const text = String(value).trim();
    return text === "/" ? "" : text;
  };

  const normalizeQuantityText = (value?: string | number | null): string => {
    const text = normalizeRecordText(value);
    if (!text) return "";
    const match = text.match(/\d+/);
    return match ? match[0] : "";
  };

  const getQuantityFromText = (value?: string | number | null): number => {
    const text = normalizeQuantityText(value);
    return text ? Number(text) : 0;
  };

  const getRecordRuleField = (record: FolderRecord, field: DurationRuleMatcher["field"]): string => {
    if (field === "folder") return normalizeRecordText(record.folder);
    if (field === "station") return normalizeRecordText(record.station);
    if (field === "product") return normalizeRecordText(record.product);
    if (field === "test_type") return normalizeRecordText(record.test_type);
    if (field === "sender") return normalizeRecordText(record.sender);
    if (field === "operator") return normalizeRecordText(record.operator);
    return "";
  };

  const durationRuleMatcherOk = (record: FolderRecord, matcher: DurationRuleMatcher): boolean => {
    const actual = getRecordRuleField(record, matcher.field);
    const expected = matcher.value.trim();
    if (!expected) return false;
    if (matcher.op === "equals") return actual.toLowerCase() === expected.toLowerCase();
    if (matcher.op === "not_contains") return !actual.toLowerCase().includes(expected.toLowerCase());
    if (matcher.op === "regex") {
      try {
        return new RegExp(expected, "i").test(actual);
      } catch {
        return actual.toLowerCase().includes(expected.toLowerCase());
      }
    }
    return actual.toLowerCase().includes(expected.toLowerCase());
  };

  const matchDurationRuleForRecord = (record: FolderRecord, rules?: DurationRule[]): DurationRule | null => {
    const activeRules = (rules || []).filter((rule) => rule.enabled && !rule.deprecated);
    activeRules.sort((a, b) => b.priority - a.priority);
    for (const rule of activeRules) {
      const results = rule.matchers.map((matcher) => durationRuleMatcherOk(record, matcher));
      if (results.length === 0) continue;
      if (rule.matchMode === "any" ? results.some(Boolean) : results.every(Boolean)) return rule;
    }
    return null;
  };

  const applyDurationOverrides = (
    records: FolderRecord[],
    overrides?: Record<string, DurationOverride>,
    rules?: DurationRule[]
  ): FolderRecord[] => {
    if (!overrides || Object.keys(overrides).length === 0) return records;
    return records.map((record) => {
      const override = overrides[record.folder];
      if (!override || !Number.isFinite(override.minutes) || override.minutes <= 0) return record;
      if (record.station === "CNC" || matchDurationRuleForRecord(record, rules)) return record;
      if (override.mode === "per_piece") {
        const qty = getNumericQuantity(record.quantity);
        if (qty <= 0) return record;
        return { ...record, manual_duration: Math.round(qty * override.minutes * 10) / 10 };
      }
      return { ...record, manual_duration: Math.round(override.minutes * 10) / 10 };
    });
  };

  const filterOmittedRecords = (
    item: QueueItem,
    records: FolderRecord[],
    actionLabel: string,
    shouldLog = true,
  ): FolderRecord[] => {
    const omitted = new Set(item.settingsOverride?.omitted_folders || []);
    if (omitted.size === 0) return records;
    const filtered = records.filter((record) => !omitted.has(record.folder));
    const omittedCount = records.length - filtered.length;
    if (shouldLog && omittedCount > 0) {
      addLog(`${actionLabel}: 已排除 ${omittedCount} 个确认暂不写入本日报的包`);
    }
    return filtered;
  };

  const buildManualTaskSuggestion = (): ManualTimeSuggestion | null => {
    if (!manualTaskItem) return null;
    const candidateInfos = (manualTaskItem.manualCandidates || [])
      .map((candidate) => {
        const qty = getQuantityFromText(candidate.recognized?.quantity);
        return {
          key: `folder:${candidate.folderName}`,
          folderName: candidate.folderName,
          qty,
        };
      })
      .filter((candidate) => candidate.qty > 0);
    const totalCandidateQuantity = candidateInfos.reduce((sum, candidate) => sum + candidate.qty, 0);
    const previewMatches = previewData?.folder_name === manualTaskItem.dateFolder;
    const summary = previewMatches ? previewData?.summary : null;
    const previewNeed = Math.max(
      0,
      Math.round(
        summary?.need_minutes ??
        summary?.decision?.need_minutes ??
        summary?.estimates?.need_minutes ??
        0
      )
    );
    if (totalCandidateQuantity > 0) {
      const taskMinutes: Record<string, number> = {};
      const taskReasons: Record<string, string> = {};
      for (const candidate of candidateInfos) {
        const baseMinutes = Math.min(180, Math.max(10, Math.round(candidate.qty * 2)));
        const gapShare = previewNeed > 0
          ? Math.round((previewNeed * candidate.qty) / totalCandidateQuantity)
          : 0;
        const minutes = Math.min(480, Math.max(baseMinutes, gapShare));
        taskMinutes[candidate.key] = minutes;
        taskReasons[candidate.key] = previewNeed > 0
          ? `该条 ${candidate.qty} PCS；基础按约 2 分钟/件估算为 ${baseMinutes} 分钟，并按件数分摊日报缺口约 ${gapShare} 分钟。`
          : `该条 ${candidate.qty} PCS；先按约 2 分钟/件给出 ${baseMinutes} 分钟起点。`;
      }
      const averageMinutes = Math.round(Object.values(taskMinutes).reduce((sum, minutes) => sum + minutes, 0) / Math.max(1, Object.keys(taskMinutes).length));
      return {
        minutes: averageMinutes,
        taskMinutes,
        taskReasons,
        reason: previewNeed > 0
          ? `当前预览还差约 ${previewNeed} 分钟有效工时；已按各手量件数比例分摊缺口，不同件数会得到不同推荐值。`
          : `按已识别 ${totalCandidateQuantity} PCS 估算，先按约 2 分钟/件给出每条手量起点。`,
      };
    }

    if (previewNeed > 0) {
      return {
        minutes: Math.min(480, previewNeed),
        reason: `当前预览还差约 ${previewNeed} 分钟有效工时；未识别到各条件数，先给出补足缺口的总量起点。`,
      };
    }

    return {
      minutes: 60,
      reason: "未识别到明确件数，先给 60 分钟作为补录起点；请按实际手量时间调整。",
    };
  };

  const manualOnlyTaskMatchesRecord = (task: RealManualTask, record: FolderRecord): boolean => {
    if (task.counting_mode !== 'manual_only') return false;

    const taskProduct = normalizeRecordText(task.product);
    const recordProduct = normalizeRecordText(record.product);
    const taskOperator = normalizeRecordText(task.operator);
    const recordOperator = normalizeRecordText(record.operator);
    if (!taskProduct || !recordProduct || taskProduct !== recordProduct) return false;
    if (!taskOperator || !recordOperator || taskOperator !== recordOperator) return false;

    const taskSender = normalizeRecordText(task.sender);
    const recordSender = normalizeRecordText(record.sender);
    if (taskSender && recordSender && taskSender !== recordSender) return false;

    const taskQuantity = normalizeQuantityText(task.quantity);
    const recordQuantity = normalizeQuantityText(record.quantity);
    if (taskQuantity && recordQuantity && taskQuantity !== recordQuantity) return false;

    return true;
  };

  const filterRecordsByManualCountingMode = (
    item: QueueItem,
    records: FolderRecord[],
    actionLabel: "预览" | "生成" | "总览",
    shouldLog = true,
  ): FolderRecord[] => {
    const manualOnlyTasks = (item.settingsOverride?.real_manual_tasks || []).filter(
      (task) => task.counting_mode === 'manual_only'
    );
    if (manualOnlyTasks.length === 0) return records;

    const skipped: string[] = [];
    const filtered = records.filter((record) => {
      const matchedTask = manualOnlyTasks.find((task) => manualOnlyTaskMatchesRecord(task, record));
      if (!matchedTask) return true;
      skipped.push(`${record.folder}（匹配手量：${matchedTask.product}/${matchedTask.operator}）`);
      return false;
    });

    if (shouldLog && skipped.length > 0) {
      addLog(`${actionLabel}：${item.dateFolder} 已按“只计手量”跳过 ${skipped.length} 个普通 OMM 记录`);
      skipped.forEach((name) => addLog(`  - ${name}`));
    }
    return filtered;
  };

  const filterReviewMapByRecords = (
    sourceReviewMap: Record<string, ReviewInfo>,
    records: FolderRecord[]
  ): Record<string, ReviewInfo> => {
    const folderNames = new Set(records.map((record) => record.folder));
    return Object.fromEntries(
      Object.entries(sourceReviewMap).filter(([folder]) => folderNames.has(folder))
    );
  };

  const hasMissingSender = (sourceReviewMap: Record<string, ReviewInfo>): boolean =>
    Object.values(sourceReviewMap).some((info) => info.missing.includes("sender"));

  const learnReviewedSenders = async (updatedRecords: FolderRecord[]) => {
    const candidates = updatedRecords.filter((record) => {
      const info = reviewMap[record.folder];
      if (!info?.missing.includes("sender") && !info?.placeholders.includes("sender")) return false;
      const sender = normalizeRecordText(record.sender);
      return sender !== "" && sender !== "/";
    });
    for (const record of candidates) {
      try {
        await upsertKnownSender(normalizeRecordText(record.sender), "review", record.folder, "审核弹窗补录");
      } catch (e) {
        addLog(`  送测人词库未写入 ${record.sender}: ${e}`);
      }
    }
    if (candidates.length > 0) {
      addLog(`  已学习 ${candidates.length} 个审核补录送测人`);
      void refreshDataStoreInfo();
    }
  };

  const getOverviewStatusFromPreview = (
    previewData: PreviewData,
    needsReview: boolean,
    manualPending: boolean,
  ): { status: MultiDayOverviewStatus; statusText: string; detail: string } => {
    if (manualPending) {
      return { status: "manual_pending", statusText: "手量待确认", detail: "存在手量候选未确认，需先确认后再生成。" };
    }
    if (needsReview) {
      return { status: "needs_review", statusText: "需审核", detail: "存在识别缺失或占位字段，点击进入单日预览后处理。" };
    }
    const anomaly = previewData.summary.time_anomaly || previewData.summary.decision?.time_anomaly;
    if (anomaly?.kind === "too_little") {
      return {
        status: "too_little",
        statusText: "测料太少",
        detail: anomaly.message || `有效工时还缺约 ${Math.round(anomaly.shortage_minutes || 0)} 分钟。`,
      };
    }
    if (anomaly?.kind === "too_much") {
      return {
        status: "too_much",
        statusText: "任务量过多",
        detail: anomaly.message || `预计超过目标结束约 ${Math.round(anomaly.overrun_minutes || 0)} 分钟。`,
      };
    }
    return {
      status: "ok",
      statusText: "可生成",
      detail: `目标 ${previewData.summary.target_clock_end}，实际 ${previewData.summary.actual_last_end}，有效 ${Math.round(previewData.summary.total_effective)} 分钟。`,
    };
  };

  const handleOpenMultiDayOverview = async () => {
    setMultiDayOverviewOpen(true);
    setMultiDayOverviewLoading(true);
    setMultiDayOverviewItems([]);
    if (queue.length === 0) {
      setMultiDayOverviewLoading(false);
      return;
    }

    const results: MultiDayOverviewItem[] = [];
    for (let index = 0; index < queue.length; index += 1) {
      const item = queue[index];
      const shift = item.shiftOverride || item.shift || shiftDefault;
      try {
        const manualPending = (item.manualCandidates || []).some(
          (candidate) => !isManualCandidateConfirmed(candidate, item)
        );
        const parseResponse = await parseFolders(item.fullPath, operatorName);
        if (!parseResponse.success) {
          results.push({
            index,
            dateFolder: item.dateFolder,
            shift: shift || "-",
            status: "error",
            statusText: "读取失败",
            detail: parseResponse.error || "无法读取该日期文件夹。",
          });
          continue;
        }
        const candidateNames = new Set(item.manualCandidates?.map((c) => c.folderName) || []);
        const manualCandidateFilteredRecords = parseResponse.data.records.filter((record) => !candidateNames.has(record.folder));
        const manualFilteredRecords = filterRecordsByManualCountingMode(item, manualCandidateFilteredRecords, "总览", false);
        const filteredRecords = filterOmittedRecords(item, manualFilteredRecords, "总览", false);
        const settings = buildItemSettings(item);
        const durationAppliedRecords = applyDurationOverrides(
          filteredRecords,
          item.settingsOverride?.duration_overrides,
          settings.duration_rules
        );
        const filteredReviewMap = filterReviewMapByRecords(parseResponse.data.review_map, durationAppliedRecords);
        const needsReview = Object.values(filteredReviewMap).some(
          (info) => info.missing.length > 0 || info.placeholders.length > 0
        );
        const previewResponse = await preview(item.fullPath, durationAppliedRecords, settings);
        if (!previewResponse.success || !previewResponse.data) {
          results.push({
            index,
            dateFolder: item.dateFolder,
            shift: shift || "-",
            status: "error",
            statusText: "预览失败",
            detail: previewResponse.error || "无法生成该日预览。",
          });
          continue;
        }
        const status = getOverviewStatusFromPreview(previewResponse.data, needsReview, manualPending);
        results.push({
          index,
          dateFolder: item.dateFolder,
          shift: previewResponse.data.shift_label || shift || "-",
          ...status,
        });
      } catch (e) {
        results.push({
          index,
          dateFolder: item.dateFolder,
          shift: shift || "-",
          status: "error",
          statusText: "读取失败",
          detail: String(e),
        });
      }
    }
    setMultiDayOverviewItems(results);
    setMultiDayOverviewLoading(false);
  };

  const handlePreview = async () => {
    const err = validateGlobalSettings();
    if (err) {
      addLog(`预览已阻止: ${err}`);
      return;
    }
    const targetIndex = Array.from(selectedQueueItems).sort((a, b) => a - b)[0] ?? 0;
    const targetItem = queue[targetIndex];
    if (!targetItem) {
      addLog("队列为空，无法预览");
      return;
    }
    await handlePreviewForItem(targetItem, targetIndex);
  };

  const handlePreviewForItem = async (targetItem: QueueItem, targetIndex?: number) => {
    const err = validateGlobalSettings();
    if (err) {
      addLog(`预览已阻止: ${err}`);
      return;
    }
    try {
      const parseResponse = await parseFolders(targetItem.fullPath, operatorName);
      if (!parseResponse.success) {
        addLog(`预览扫描失败: ${parseResponse.error}`);
        return;
      }
      const records = parseResponse.data.records;
      const candidateNames = new Set(targetItem.manualCandidates?.map((c) => c.folderName) || []);
      const manualCandidateFilteredRecords = records.filter((r) => !candidateNames.has(r.folder));
      const skippedCount = records.length - manualCandidateFilteredRecords.length;
      if (skippedCount > 0) {
        addLog(`预览：已过滤 ${skippedCount} 个手量候选文件夹，避免与普通任务重复排程`);
      }
      const manualFilteredRecords = filterRecordsByManualCountingMode(targetItem, manualCandidateFilteredRecords, "预览");
      const filteredRecords = filterOmittedRecords(targetItem, manualFilteredRecords, "预览");

      const unconfirmedCount = (targetItem.manualCandidates || []).filter(
        (candidate) => !isManualCandidateConfirmed(candidate, targetItem)
      ).length;
      if (unconfirmedCount > 0) {
        addLog(`⚠ 预览提示: ${targetItem.dateFolder} 有 ${unconfirmedCount} 个手量候选待确认，真实手量未参与排程`);
      }

      const settings = buildItemSettings(targetItem);
      const durationAppliedRecords = applyDurationOverrides(
        filteredRecords,
        targetItem.settingsOverride?.duration_overrides,
        settings.duration_rules
      );
      const previewResponse = await preview(targetItem.fullPath, durationAppliedRecords, settings);
      if (previewResponse.success && previewResponse.data) {
        setPreviewData(previewResponse.data);
        setPreviewIndex(targetIndex ?? queue.findIndex((q) => q.fullPath === targetItem.fullPath));
        setPreviewOpen(true);
        addLog(`预览已打开: ${targetItem.dateFolder}`);
      } else {
        addLog(`预览失败: ${previewResponse.error}`);
      }
    } catch (e) {
      addLog(`预览错误: ${e}`);
    }
  };

  const handleHelpOpen = (section: string) => {
    setHelpSection(section);
    setHelpOpen(true);
  };

  const handleConfigLocationDefault = () => {
    setConfigLocationOpen(false);
    persistConfig({ config_dir_ever_set: true });
  };

  const handleConfigLocationCustom = async () => {
    setConfigLocationOpen(false);
    const newDir = await selectFolder(configDir || workDir);
    if (newDir) {
      try {
        const currentConfig = buildConfigPatch();
        const migrated = await migrateConfig(currentConfig as unknown as Config, newDir, 'copy');
        const finalDir = (migrated as unknown as Config).config_dir || newDir;
        setConfigDir(finalDir);
        setConfigSource('custom');
        setConfigPath(`${finalDir}\\config.json`);
        setConfigDuplicates([]);
        await syncConfigState(migrated);
        await refreshRecognitionRules();
        persistConfig({ config_dir: finalDir, config_dir_ever_set: true });
        addLog(`配置文件已迁移到: ${finalDir}`);
      } catch (e) {
        addLog(`配置迁移失败: ${e}`);
      }
    }
  };

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, msg]);
  };

  const refreshDataStoreInfo = async () => {
    try {
      const info = await getDataStoreInfo();
      setDataStoreInfo(info);
      return info;
    } catch (e) {
      addLog(`本地数据状态读取失败: ${e}`);
      return null;
    }
  };

  const refreshCleanerBackupInfo = async () => {
    try {
      const info = await getPersonalCleanerBackupInfo();
      setCleanerBackupInfo(info);
      return info;
    } catch (e) {
      addLog(`个人清理备份状态读取失败: ${e}`);
      return null;
    }
  };

  const handleOpenCleanerBackupRoot = async () => {
    const info = cleanerBackupInfo || await refreshCleanerBackupInfo();
    if (info?.root) {
      await openFolder(info.root);
    }
  };

  const handleCleanCleanerBackups = async () => {
    try {
      const before = cleanerBackupInfo || await refreshCleanerBackupInfo();
      if (!before) {
        await requestAppConfirm({
          title: "无法读取备份状态",
          description: "没有读取到个人清理备份目录状态，未执行旧备份清理。请先点击“读取备份”或查看详细日志。",
          confirmLabel: "知道了",
          cancelLabel: null,
          tone: "warning",
        });
        return null;
      }
      const root = before?.root || "个人清理备份根目录";
      const entryCount = before?.entryCount ?? 0;
      const totalBytes = before?.totalBytes ?? 0;
      const cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const cutoff = new Date(cutoffMs).toLocaleString("zh-CN", { hour12: false });
      const hasOldBackups = Boolean(before.oldestModifiedMs && before.oldestModifiedMs <= cutoffMs);
      if (!before.exists || entryCount === 0 || !hasOldBackups) {
        await requestAppConfirm({
          title: "没有 30 天前备份可清理",
          description: [
            "个人清理备份目录中未发现最后修改时间早于 30 天的备份项。",
            "本次不会删除任何内容。",
            `备份目录：${root}`,
            `当前可见条目：${entryCount} 项，约 ${Math.round(totalBytes / 1024 / 1024 * 10) / 10} MB`,
            `判断范围：最后修改时间早于 ${cutoff} 的备份项`,
          ].join("\n"),
          confirmLabel: "知道了",
          cancelLabel: null,
          tone: "info",
        });
        addLog("个人清理备份维护无需执行: 没有 30 天前备份可清理");
        return before;
      }
      const ok = await requestAppConfirm({
        title: "确认清理旧备份",
        description: [
          "将只清理个人清理备份目录中最后修改时间早于 30 天的备份项。",
          "会保留 30 天内备份，不处理日志、账户数据库、配置、日期资料或原始测试资料。",
          "取消后不会删除任何内容。",
          `清理目录：${root}`,
          `当前可见条目：${entryCount} 项，约 ${Math.round(totalBytes / 1024 / 1024 * 10) / 10} MB`,
          `时间范围：最后修改时间早于 ${cutoff} 的备份项`,
          "保留策略：30 天内备份、日志、本地数据库、配置文件、日期文件夹全部保留",
        ].join("\n"),
        confirmLabel: "确认清理旧备份",
        cancelLabel: "取消",
        tone: "warning",
      });
      if (!ok) {
        addLog("个人清理备份维护已取消: 未执行旧备份清理");
        return before;
      }
      const info = await cleanPersonalCleanerBackups(30);
      setCleanerBackupInfo(info);
      const beforeCount = before?.entryCount ?? 0;
      const removedCount = Math.max(0, beforeCount - info.entryCount);
      addLog(`个人清理备份已维护: 清理30天前备份，移除约 ${removedCount} 项，剩余 ${info.entryCount} 项`);
      return info;
    } catch (e) {
      addLog(`个人清理备份清理失败: ${e}`);
      return null;
    }
  };

  const handleCopyDetailedLogs = async () => {
    if (logs.length === 0) return;
    try {
      await navigator.clipboard.writeText(logs.join("\n"));
      addLog("详细日志已复制到剪贴板");
    } catch (e) {
      addLog(`详细日志复制失败: ${e}`);
    }
  };

  const detectShift = (folderName: string): 'A' | 'B' | null => {
    const normalized = folderName.toUpperCase();
    if (normalized.endsWith('A')) return 'A';
    if (normalized.endsWith('B')) return 'B';
    return null;
  };

  const queueRef = useRef(queue);
  queueRef.current = queue;

  const generateStateRef = useRef<{
    currentIndex: number;
    successCount: number;
    failCount: number;
    currentRecords: FolderRecord[];
    single?: boolean;
  } | null>(null);

  // 用于在生成过程中累积所有成功输出的路径（避免 React state 在同一渲染周期内滞后）
  const outputPathsRef = useRef<string[]>([]);
  // 累积所有生成项的排程警告
  const schedWarningsRef = useRef<string[]>([]);
  // 累积失败项和可读原因，最终在结果弹窗中展示
  const failureDetailsRef = useRef<GenerateFailureDetail[]>([]);

  const detectAndAttachCandidates = async (item: QueueItem): Promise<QueueItem> => {
    const candidates = await detectManualCandidates(item.fullPath, listChildFolders, recognitionRules);
    return { ...item, manualCandidates: candidates };
  };

  const isManualCandidateConfirmed = (candidate: ManualFolderCandidate, item: QueueItem): boolean => {
    const tasks = item.settingsOverride?.real_manual_tasks || [];
    return tasks.some((task) => {
      if (task.source_folder && task.source_folder === candidate.folderName) return true;
      return false;
    });
  };

  const getManualCandidateCounts = (item: QueueItem) => {
    const candidates = item.manualCandidates || [];
    const confirmedCount = candidates.filter((candidate) => isManualCandidateConfirmed(candidate, item)).length;
    const manualTaskCount = item.settingsOverride?.real_manual_tasks?.length || 0;
    return {
      confirmedCount,
      manualTaskCount,
      pendingCount: Math.max(0, candidates.length - confirmedCount),
    };
  };

  const recordGenerateFailure = (
    item: QueueItem,
    reason: string,
    action: GenerateFailureDetail["action"] = "check",
    queueIndex?: number
  ) => {
    const resolvedIndex = queueIndex ?? queueRef.current.findIndex((it) => it.fullPath === item.fullPath);
    failureDetailsRef.current = [
      ...failureDetailsRef.current,
      {
        dateFolder: item.dateFolder,
        reason,
        action,
        queueIndex: resolvedIndex >= 0 ? resolvedIndex : undefined,
      },
    ];
  };

  const addPathToQueue = async (path: string) => {
    const basename = path.split(/[\\/]/).pop() || "";
    const dateWithShiftRegex = /^\d+\.\d+[AB]$/;
    const dateWithoutShiftRegex = /^\d+\.\d+$/;

    if (dateWithShiftRegex.test(basename)) {
      if (queueRef.current.some(item => item.dateFolder === basename)) {
        addLog(`已跳过重复项: ${basename}`);
        return;
      }
      let newItem: QueueItem = {
        dateFolder: basename,
        fullPath: path,
        shift: detectShift(basename),
      };
      newItem = await detectAndAttachCandidates(newItem);
      setQueue(prev => [...prev, newItem]);
      const c = newItem.manualCandidates?.length || 0;
      addLog(`已添加: ${basename}${c > 0 ? ` (发现 ${c} 个手量候选)` : ""}`);
    } else if (dateWithoutShiftRegex.test(basename)) {
      setShiftChoosePath(path);
      setShiftChooseFolderName(basename);
      setShiftChooseOpen(true);
    } else {
      try {
        const folders = await listDateFolders(path);
        if (folders.length > 0) {
          let added = 0;
          let skipped = 0;
          const newItems: QueueItem[] = [];
          for (const folder of folders) {
            if (queueRef.current.some(item => item.dateFolder === folder)) {
              skipped++;
              continue;
            }
            const item = await detectAndAttachCandidates({
              dateFolder: folder,
              fullPath: `${path}\\${folder}`,
              shift: detectShift(folder),
            });
            newItems.push(item);
            added++;
          }
          if (newItems.length > 0) {
            setQueue(prev => [...prev, ...newItems]);
          }
          const totalCandidates = newItems.reduce((sum, it) => sum + (it.manualCandidates?.length || 0), 0);
          addLog(`批量添加: ${added} 个已添加, ${skipped} 个已跳过${totalCandidates > 0 ? `, 共 ${totalCandidates} 个手量候选` : ""}`);
        } else {
          addLog(`路径不包含日期文件夹: ${path}`);
        }
      } catch (e) {
        addLog(`无法识别路径: ${path}`);
      }
    }
  };

  const handleSelectWorkDir = async () => {
    const path = await selectFolder(workDir || configDir);
    if (path) {
      setWorkDir(path);
      setSelectedDateFolder("");
      addLog(`工作目录: ${path}`);
      try {
        const folders = await listDateFolders(path);
        setDateFolders(folders);
        addLog(`找到 ${folders.length} 个日期文件夹`);
      } catch (e) {
        setDateFolders([]);
        addLog(`获取日期文件夹失败: ${e}`);
      }
    }
  };

  const refreshDateFolders = async () => {
    if (dateFoldersRefreshing) return;
    if (!workDir) {
      addLog("请先选择工作目录");
      setDateFoldersRefreshMessage("请先选择工作目录。");
      return;
    }
    setDateFoldersRefreshing(true);
    setDateFoldersRefreshMessage("正在刷新日期文件夹...");
    try {
      const [folders] = await Promise.all([
        listDateFolders(workDir),
        waitForVisibleFeedback(),
      ]);
      setDateFolders(folders);
      setDateFoldersRefreshMessage(`刷新完成，找到 ${folders.length} 个日期文件夹。${new Date().toLocaleTimeString("zh-CN", { hour12: false })}`);
      addLog(`刷新完成，找到 ${folders.length} 个日期文件夹`);
    } catch (e) {
      await waitForVisibleFeedback(300);
      setDateFolders([]);
      setDateFoldersRefreshMessage(`刷新失败: ${e}`);
      addLog(`获取日期文件夹失败: ${e}`);
    } finally {
      setDateFoldersRefreshing(false);
    }
  };

  const handleAddToQueue = async () => {
    if (!selectedDateFolder) {
      addLog("请先选择日期文件夹");
      return;
    }
    if (queue.some(item => item.dateFolder === selectedDateFolder)) {
      addLog(`已跳过重复项: ${selectedDateFolder}`);
      return;
    }
    const fullPath = `${workDir}\\${selectedDateFolder}`;
    let newItem: QueueItem = {
      dateFolder: selectedDateFolder,
      fullPath,
      shift: detectShift(selectedDateFolder),
    };
    newItem = await detectAndAttachCandidates(newItem);
    setQueue(prev => [...prev, newItem]);
    const c = newItem.manualCandidates?.length || 0;
    addLog(`已添加: ${selectedDateFolder}${c > 0 ? ` (发现 ${c} 个手量候选)` : ""}`);
  };

  const handleSelectAllToQueue = async () => {
    let added = 0;
    let skipped = 0;
    const newItems: QueueItem[] = [];
    for (const folder of dateFolders) {
      if (queue.some(item => item.dateFolder === folder)) {
        skipped++;
        continue;
      }
      newItems.push(await detectAndAttachCandidates({
        dateFolder: folder,
        fullPath: `${workDir}\\${folder}`,
        shift: detectShift(folder),
      }));
      added++;
    }
    if (newItems.length > 0) {
      setQueue(prev => [...prev, ...newItems]);
    }
    const totalCandidates = newItems.reduce((sum, it) => sum + (it.manualCandidates?.length || 0), 0);
    addLog(`全选添加: ${added} 个已添加, ${skipped} 个已跳过${totalCandidates > 0 ? `, 共 ${totalCandidates} 个手量候选` : ""}`);
  };

  const handleClearQueue = () => {
    setQueue([]);
    setSelectedQueueItems(new Set());
    addLog("队列已清空");
  };

  const handleRemoveSelectedFromQueue = () => {
    if (selectedQueueItems.size === 0) {
      addLog("请先选择要删除的项");
      return;
    }
    const removedCount = selectedQueueItems.size;
    const newQueue = queue.filter((_, i) => !selectedQueueItems.has(i));
    setQueue(newQueue);
    setSelectedQueueItems(new Set());
    addLog(`已删除 ${removedCount} 个选中项`);
  };

  const toggleQueueItem = (index: number) => {
    const newSelected = new Set(selectedQueueItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedQueueItems(newSelected);
  };

  const toggleAllQueueItems = () => {
    if (selectedQueueItems.size === queue.length) {
      setSelectedQueueItems(new Set());
    } else {
      setSelectedQueueItems(new Set(queue.map((_, i) => i)));
    }
  };

  const handleQueueItemContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, index });
  };

  const openDaySettingsForQueueItem = (index: number) => {
    setDaySettingsIndex(index);
    setDaySettingsOpen(true);
  };

  const handleSetReviewMode = (mode: 'A' | 'B' | null) => {
    if (contextMenu === null) return;
    const idx = contextMenu.index;
    setQueue(prev => prev.map((item, i) => i === idx ? { ...item, reviewMode: mode } : item));
    setContextMenu(null);
  };

  const handleQueueKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete') {
      handleRemoveSelectedFromQueue();
    }
  };

  const handleQueuePaste = async (e: React.ClipboardEvent) => {
    e.preventDefault();
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
      for (const line of lines) {
        await addPathToQueue(line);
      }
    } catch (e) {
      addLog(`粘贴失败: ${e}`);
    }
  };

  const handleShiftChoose = async (shift: 'A' | 'B') => {
    if (!shiftChoosePath) return;
    const basename = shiftChoosePath.split(/[\\/]/).pop() || "";
    if (queueRef.current.some(item => item.dateFolder === basename)) {
      addLog(`已跳过重复项: ${basename}`);
      setShiftChooseOpen(false);
      setShiftChoosePath(null);
      return;
    }
    let newItem: QueueItem = {
      dateFolder: basename,
      fullPath: shiftChoosePath,
      shift: null,
      shiftOverride: shift,
    };
    newItem = await detectAndAttachCandidates(newItem);
    setQueue(prev => [...prev, newItem]);
    const c = newItem.manualCandidates?.length || 0;
    addLog(`已添加: ${basename} (手动选择 ${shift}班)${c > 0 ? `, 发现 ${c} 个手量候选` : ""}`);
    setShiftChooseOpen(false);
    setShiftChoosePath(null);
  };

  const handleShiftCancel = () => {
    setShiftChooseOpen(false);
    setShiftChoosePath(null);
  };

  // 构造全局生成设置（不含 item 级覆盖）
  const buildGlobalSettings = (): GenerateSettings => ({
    early_leave: leaveStrategy === 'early',
    leave_strategy: leaveStrategy,
    enable_hand: enableHand,
    enable_other: enableOther,
    tpp_min: tppMin,
    tpp_max: tppMax,
    pkg_rest: pkgRest,
    operator_name: operatorName,
    output_dir: useSrcOutput ? null : outputDir || null,
    use_src_output: useSrcOutput,
    shift_override: shiftDefault,
    special_items: specialItems,
    duration_rules: durationRules,
    hand_max: handMax,
    other_max: otherMax,
    other_note: DEFAULT_OTHER_NOTE,
    filler_position: DEFAULT_FILLER_POSITION,
  });

  // 构造某个队列项的最终生成设置：全局 + item.settingsOverride 浅合并
  const buildItemSettings = (item: QueueItem): GenerateSettings => {
    const base = buildGlobalSettings();
    const ov = item.settingsOverride || {};
    const { duration_overrides: _durationOverrides, omitted_folders: _omittedFolders, ...generationOverride } = ov;
    return {
      ...base,
      ...generationOverride,
      // shift_override 优先级：item.shiftOverride > item.shift > shiftDefault
      shift_override: item.shiftOverride || item.shift || shiftDefault,
      // early_leave 与 leave_strategy 保持一致
      early_leave: (ov.leave_strategy ?? leaveStrategy) === 'early',
      leave_strategy: ov.leave_strategy ?? leaveStrategy,
    };
  };

  const updateQueueItemOverride = (index: number, patch: Partial<QueueItemSettingsOverride>) => {
    setQueue(prev => prev.map((item, i) =>
      i === index ? { ...item, settingsOverride: { ...(item.settingsOverride || {}), ...patch } } : item
    ));
  };

  const clearQueueItemOverride = (index: number) => {
    setQueue(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const { settingsOverride, ...rest } = item;
      return rest;
    }));
  };

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // Tauri drag-drop listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setupDragDrop = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen('tauri://drag-drop', (event) => {
        const paths = (event.payload as { paths: string[] }).paths;
        if (paths && Array.isArray(paths)) {
          for (const path of paths) {
            addPathToQueueRef.current(path);
          }
        }
      });
    };
    setupDragDrop();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const addPathToQueueRef = useRef(addPathToQueue);
  addPathToQueueRef.current = addPathToQueue;

  const handleReviewConfirm = async (updatedRecords: FolderRecord[], skippedFolders: string[]) => {
    const effectiveRecords = updatedRecords.filter((r) => !skippedFolders.includes(r.folder));
    setPendingRecords(effectiveRecords);
    setReviewOpen(false);
    addLog("审核完成，记录已更新");
    if (skippedFolders.length > 0) {
      addLog(`  跳过的文件夹: ${skippedFolders.join(", ")}`);
    }
    await learnReviewedSenders(effectiveRecords);

    const state = generateStateRef.current;
    if (!state) return;
    const { currentIndex, successCount, failCount } = state;
    const item = queue[currentIndex];

    if (effectiveRecords.length === 0) {
      addLog(`  本日期所有任务都被跳过，未生成报表: ${item.dateFolder}`);
      recordGenerateFailure(item, "本日期所有任务都被跳过，未生成报表", "review", currentIndex);
      setGenerateResult({
        ok: successCount,
        fail: failCount + 1,
        outputPath: outputPathsRef.current.length > 0 ? outputPathsRef.current[outputPathsRef.current.length - 1] : null,
        outputPaths: outputPathsRef.current.slice(),
        commonParent: computeCommonParent(outputPathsRef.current.slice()),
        schedWarnings: schedWarningsRef.current.slice(),
        failures: failureDetailsRef.current.slice(),
        status: successCount > 0 ? 'complete' : 'failed',
        pendingItems: [],
      });
      setIsGenerating(false);
      setProgress(0);
      return;
    }

    if (state.single) {
      await generateSingleItemFinal(item, effectiveRecords);
    } else {
      generateWithRecords(item, effectiveRecords, currentIndex, successCount, failCount);
    }
  };

  const handleReviewSkip = (skippedFolders: string[], updatedRecords: FolderRecord[]) => {
    const effectiveRecords = updatedRecords.filter((r) => !skippedFolders.includes(r.folder));
    setPendingRecords(effectiveRecords);
    setReviewOpen(false);
    addLog(`已跳过审核，跳过的文件夹: ${skippedFolders.join(", ")}`);

    const state = generateStateRef.current;
    if (!state) return;
    const { currentIndex, successCount, failCount } = state;
    const item = queue[currentIndex];

    if (effectiveRecords.length === 0) {
      addLog(`  本日期所有任务都被跳过，未生成报表: ${item.dateFolder}`);
      recordGenerateFailure(item, "本日期所有任务都被跳过，未生成报表", "review", currentIndex);
      setGenerateResult({
        ok: successCount,
        fail: failCount + 1,
        outputPath: outputPathsRef.current.length > 0 ? outputPathsRef.current[outputPathsRef.current.length - 1] : null,
        outputPaths: outputPathsRef.current.slice(),
        commonParent: computeCommonParent(outputPathsRef.current.slice()),
        schedWarnings: schedWarningsRef.current.slice(),
        failures: failureDetailsRef.current.slice(),
        status: successCount > 0 ? 'complete' : 'failed',
        pendingItems: [],
      });
      setIsGenerating(false);
      setProgress(0);
      return;
    }

    if (state.single) {
      generateSingleItemFinal(item, effectiveRecords);
    } else {
      generateWithRecords(item, effectiveRecords, currentIndex, successCount, failCount);
    }
  };

  const handleReviewCancel = () => {
    setReviewOpen(false);
    addLog("审核已取消，停止生成");
    setIsGenerating(false);
    setProgress(0);
    generateStateRef.current = null;
  };

  const generateWithRecords = async (
    item: QueueItem,
    records: FolderRecord[],
    index: number,
    successCount: number,
    failCount: number
  ) => {
    const settings = buildItemSettings(item);

    // 正式生成前校验真实手量字段完整
    const manualTasks = settings.real_manual_tasks || [];
    const invalidManuals = manualTasks.map((t) => ({
      task: t,
      errors: validateRealManualTask(t),
    })).filter((x) => x.errors.length > 0);
    if (invalidManuals.length > 0) {
      const lines = invalidManuals.map((x, i) =>
        `${i + 1}. ${x.task.product || '(未命名)'}: ${x.errors.join(', ')}`
      );
      addLog(`生成已阻止: ${item.dateFolder} 的真实手量字段不完整`);
      addLog(`  ${lines.join('; ')}`);
      recordGenerateFailure(item, `真实手量字段不完整：${lines.join('；')}`, "manual", index);
      setManualTaskItem(item);
      setManualTaskOpen(true);
      setGenerateResult({
        ok: successCount,
        fail: failCount,
        outputPath: outputPathsRef.current.length > 0 ? outputPathsRef.current[outputPathsRef.current.length - 1] : null,
        outputPaths: outputPathsRef.current.slice(),
        commonParent: computeCommonParent(outputPathsRef.current.slice()),
        schedWarnings: schedWarningsRef.current.slice(),
        failures: failureDetailsRef.current.slice(),
        status: 'paused',
        pendingItems: queue.slice(index).map((it) => it.dateFolder),
      });
      setIsGenerating(false);
      setProgress(0);
      return;
    }

    // 超过 180 分钟给出醒目 warning（不阻止）
    const longManuals = manualTasks.filter((t) => (t.duration_minutes || 0) > 180);
    if (longManuals.length > 0) {
      addLog(`注意: ${item.dateFolder} 存在耗时超过 3 小时的真实手量，请确认`);
      longManuals.forEach((t) => addLog(`  - ${t.product}: ${t.duration_minutes} 分钟`));
    }

    try {
      const genResponse = await generate(item.fullPath, records, settings);
      if (genResponse.success) {
        addLog(`  生成完成: ${genResponse.data.output_path}`);
        setLastOutputPath(genResponse.data.output_path);
        outputPathsRef.current = [...outputPathsRef.current, genResponse.data.output_path];
        if (genResponse.data.sched_warnings && genResponse.data.sched_warnings.length > 0) {
          genResponse.data.sched_warnings.forEach((w) => {
            addLog(`  警告: ${w}`);
            schedWarningsRef.current.push(w);
          });
        }
        await processQueueItem(index + 1, successCount + 1, failCount);
      } else {
        addLog(`  生成失败: ${genResponse.error}`);
        recordGenerateFailure(item, genResponse.error || "sidecar 未返回具体错误，请查看运行日志", "check", index);
        await processQueueItem(index + 1, successCount, failCount + 1);
      }
    } catch (e) {
      addLog(`  错误: ${e}`);
      recordGenerateFailure(item, `程序调用失败：${e}`, "check", index);
      await processQueueItem(index + 1, successCount, failCount + 1);
    }
  };

  const [generateResult, setGenerateResult] = useState<{
    ok: number;
    fail: number;
    outputPath: string | null;
    outputPaths: string[]; // 所有成功生成的报表路径
    commonParent: string | null; // 所有报表的公共父目录
    schedWarnings: string[]; // 排程警告
    failures: GenerateFailureDetail[]; // 失败项及可读原因
    status: 'complete' | 'paused' | 'failed';
    pendingItems: string[]; // 尚未处理的日期（暂停时）
  } | null>(null);

  /**
   * 计算一组文件路径的公共父目录。
   * 例如 ["a/b/x.xlsx", "a/b/y.xlsx"] -> "a/b"
   *      ["a/b/x.xlsx", "a/c/y.xlsx"] -> "a"
   *      ["a/x.xlsx", "b/y.xlsx"]     -> ""（无公共前缀，返回空串）
   */
  const computeCommonParent = (paths: string[]): string | null => {
    if (paths.length === 0) return null;
    const sep = /[\\/]/;
    const splitPath = (p: string) => {
      // 取目录部分（去掉文件名）
      const idx = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
      const dir = idx >= 0 ? p.substring(0, idx) : p;
      return dir.split(sep).filter((s) => s.length > 0);
    };
    const allParts = paths.map(splitPath);
    let common: string[] = [];
    const first = allParts[0];
    for (let i = 0; i < first.length; i++) {
      const seg = first[i];
      if (allParts.every((parts) => parts[i] === seg)) {
        common.push(seg);
      } else {
        break;
      }
    }
    if (common.length === 0) return null;
    // 用原始路径中出现的分隔符重建（Windows 下用 \）
    return common.join("\\");
  };

  const processQueueItem = async (index: number, successCount: number, failCount: number) => {
    if (index >= queue.length) {
      addLog(`全部完成: ${successCount} 成功, ${failCount} 失败`);
      persistConfig();
      setIsGenerating(false);
      setProgress(100);

      // Auto-open output directory on success —— 打开所有报表的公共父目录
      const allPaths = outputPathsRef.current.slice();
      const commonParent = computeCommonParent(allPaths);
      // 优先用公共父目录；如果没有公共父目录，回退到最后一个成功的路径或统一输出目录
      const openTarget =
        commonParent ||
        (allPaths.length > 0 ? allPaths[allPaths.length - 1] : null) ||
        (useSrcOutput ? null : outputDir || null);
      if (successCount > 0 && openTarget) {
        try { await openFolder(openTarget); } catch (_) { /* ignore */ }
      }

      // 同步到 state 供完成对话框使用
      // (generateResult 携带 outputPaths，无需单独 state)

      // Show completion dialog
      setGenerateResult({
        ok: successCount,
        fail: failCount,
        outputPath: openTarget,
        outputPaths: allPaths,
        commonParent,
        schedWarnings: schedWarningsRef.current.slice(),
        failures: failureDetailsRef.current.slice(),
        status: failCount === 0 ? 'complete' : successCount > 0 ? 'complete' : 'failed',
        pendingItems: [],
      });
      generateStateRef.current = null;
      return;
    }

    const item = queue[index];
    const currentStep = index + 1;
    const totalSteps = queue.length;
    setProgress(Math.round((currentStep / totalSteps) * 100));
    addLog(`[${currentStep}/${totalSteps}] 处理: ${item.dateFolder}`);

    try {
      const parseResponse = await parseFolders(item.fullPath, operatorName);
      if (!parseResponse.success) {
        addLog(`  扫描失败: ${parseResponse.error}`);
        recordGenerateFailure(item, `扫描日期文件夹失败：${parseResponse.error || "请确认路径可访问且不是空目录"}`, "check", index);
        await processQueueItem(index + 1, successCount, failCount + 1);
        return;
      }

      const records = parseResponse.data.records;
      const reviewMap = parseResponse.data.review_map;

      // 过滤掉手量候选对应的普通 records，避免重复排程
      const candidateNames = new Set(item.manualCandidates?.map((c) => c.folderName) || []);
      const manualCandidateFilteredRecords = records.filter((r) => !candidateNames.has(r.folder));
      const skippedCount = records.length - manualCandidateFilteredRecords.length;
      if (skippedCount > 0) {
        addLog(`  已过滤 ${skippedCount} 个手量候选文件夹，避免与普通任务重复排程`);
      }
      const manualFilteredRecords = filterRecordsByManualCountingMode(item, manualCandidateFilteredRecords, "生成");
      const filteredRecords = filterOmittedRecords(item, manualFilteredRecords, "生成");

      // 如果还有未确认的手量候选，生成前阻止
      const unconfirmedCandidates = (item.manualCandidates || []).filter(
        (candidate) => !isManualCandidateConfirmed(candidate, item)
      );
      if (unconfirmedCandidates.length > 0) {
        const names = unconfirmedCandidates.map((c) => c.folderName).join(", ");
        const reason = `有 ${unconfirmedCandidates.length} 个手量文件夹未确认：${names}。请先在弹窗中确认耗时、数量和测量员。`;
        addLog(`  生成已暂停: ${item.dateFolder} ${reason}`);
        recordGenerateFailure(item, reason, "manual", index);
        setManualTaskItem(item);
        setManualTaskOpen(true);
        setGenerateResult({
          ok: successCount,
          fail: failCount,
          outputPath: outputPathsRef.current.length > 0 ? outputPathsRef.current[outputPathsRef.current.length - 1] : null,
          outputPaths: outputPathsRef.current.slice(),
          commonParent: computeCommonParent(outputPathsRef.current.slice()),
          schedWarnings: schedWarningsRef.current.slice(),
          failures: failureDetailsRef.current.slice(),
          status: 'paused',
          pendingItems: queue.slice(index).map((it) => it.dateFolder),
        });
        setIsGenerating(false);
        setProgress(0);
        return;
      }

      const settings = buildItemSettings(item);
      const durationAppliedRecords = applyDurationOverrides(
        filteredRecords,
        item.settingsOverride?.duration_overrides,
        settings.duration_rules
      );
      const filteredReviewMap = filterReviewMapByRecords(reviewMap, durationAppliedRecords);
      setReviewMap(filteredReviewMap);

      const needsReview = Object.keys(filteredReviewMap).some(
        (key) =>
          filteredReviewMap[key].missing.length > 0 ||
          filteredReviewMap[key].placeholders.length > 0
      );

      const effectiveReviewMode = item.reviewMode ?? complexDefault;
      const forceReviewDialog = hasMissingSender(filteredReviewMap);
      if (needsReview && (effectiveReviewMode === 'A' || forceReviewDialog)) {
        addLog(forceReviewDialog && effectiveReviewMode === 'B'
          ? `  缺少送测人，强制打开审核对话框`
          : `  需要审核，打开审核对话框`);
        setPendingRecords(durationAppliedRecords);
        setReviewMap(filteredReviewMap);
        setReviewOpen(true);
        generateStateRef.current = {
          currentIndex: index,
          successCount,
          failCount,
          currentRecords: durationAppliedRecords,
        };
        return;
      }

      if (needsReview && effectiveReviewMode === 'B') {
        addLog(`  警告: 部分记录需要审核 (留坑自填模式)`);
      }

      await generateWithRecords(item, durationAppliedRecords, index, successCount, failCount);
    } catch (e) {
      addLog(`  错误: ${e}`);
      recordGenerateFailure(item, `处理时发生异常：${e}`, "check", index);
      await processQueueItem(index + 1, successCount, failCount + 1);
    }
  };

  const handleGenerate = async () => {
    const err = validateGlobalSettings();
    if (err) {
      addLog(`生成已阻止: ${err}`);
      return;
    }
    if (queue.length === 0) {
      addLog("队列为空，请先添加日期文件夹");
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    addLog("开始生成...");
    outputPathsRef.current = []; // 清空上一轮的输出路径列表
    schedWarningsRef.current = []; // 清空上一轮的排程警告
    failureDetailsRef.current = []; // 清空上一轮的失败明细

    generateStateRef.current = {
      currentIndex: 0,
      successCount: 0,
      failCount: 0,
      currentRecords: [],
    };

    await processQueueItem(0, 0, 0);
  };

  const generateSingleItemFinal = async (item: QueueItem, records: FolderRecord[]) => {
    const settings = buildItemSettings(item);

    const manualTasks = settings.real_manual_tasks || [];
    const invalidManuals = manualTasks.map((t) => ({
      task: t,
      errors: validateRealManualTask(t),
    })).filter((x) => x.errors.length > 0);
    if (invalidManuals.length > 0) {
      const lines = invalidManuals.map((x, i) =>
        `${i + 1}. ${x.task.product || '(未命名)'}: ${x.errors.join(', ')}`
      );
      addLog(`生成已阻止: ${item.dateFolder} 的真实手量字段不完整`);
      addLog(`  ${lines.join('; ')}`);
      recordGenerateFailure(item, `真实手量字段不完整：${lines.join('；')}`, "manual");
      setManualTaskItem(item);
      setManualTaskOpen(true);
      setGenerateResult({
        ok: 0,
        fail: 0,
        outputPath: null,
        outputPaths: [],
        commonParent: null,
        schedWarnings: schedWarningsRef.current.slice(),
        failures: failureDetailsRef.current.slice(),
        status: 'paused',
        pendingItems: [item.dateFolder],
      });
      setIsGenerating(false);
      setProgress(0);
      return;
    }

    const longManuals = manualTasks.filter((t) => (t.duration_minutes || 0) > 180);
    if (longManuals.length > 0) {
      addLog(`注意: ${item.dateFolder} 存在耗时超过 3 小时的真实手量，请确认`);
      longManuals.forEach((t) => addLog(`  - ${t.product}: ${t.duration_minutes} 分钟`));
    }

    try {
      const genResponse = await generate(item.fullPath, records, settings);
      if (genResponse.success) {
        addLog(`  生成完成: ${genResponse.data.output_path}`);
        setLastOutputPath(genResponse.data.output_path);
        outputPathsRef.current = [genResponse.data.output_path];
        if (genResponse.data.sched_warnings && genResponse.data.sched_warnings.length > 0) {
          genResponse.data.sched_warnings.forEach((w) => {
            addLog(`  警告: ${w}`);
            schedWarningsRef.current.push(w);
          });
        }
        setGenerateResult({
          ok: 1,
          fail: 0,
          outputPath: genResponse.data.output_path,
          outputPaths: [genResponse.data.output_path],
          commonParent: computeCommonParent([genResponse.data.output_path]),
          schedWarnings: schedWarningsRef.current.slice(),
          failures: failureDetailsRef.current.slice(),
          status: 'complete',
          pendingItems: [],
        });
        try { await openFolder(genResponse.data.output_path); } catch (_) { /* ignore */ }
      } else {
        addLog(`  生成失败: ${genResponse.error}`);
        recordGenerateFailure(item, genResponse.error || "sidecar 未返回具体错误，请查看运行日志", "check");
        setGenerateResult({
          ok: 0,
          fail: 1,
          outputPath: null,
          outputPaths: [],
          commonParent: null,
          schedWarnings: schedWarningsRef.current.slice(),
          failures: failureDetailsRef.current.slice(),
          status: 'failed',
          pendingItems: [],
        });
      }
    } catch (e) {
      addLog(`  错误: ${e}`);
      recordGenerateFailure(item, `程序调用失败：${e}`, "check");
      setGenerateResult({
        ok: 0,
        fail: 1,
        outputPath: null,
        outputPaths: [],
        commonParent: null,
        schedWarnings: schedWarningsRef.current.slice(),
        failures: failureDetailsRef.current.slice(),
        status: 'failed',
        pendingItems: [],
      });
    } finally {
      setIsGenerating(false);
      setProgress(100);
    }
  };

  const handleGenerateSingleFromPreview = async (index: number) => {
    const err = validateGlobalSettings();
    if (err) {
      addLog(`生成已阻止: ${err}`);
      return;
    }
    if (index < 0 || index >= queue.length) return;
    const item = queue[index];
    setIsGenerating(true);
    setProgress(0);
    outputPathsRef.current = [];
    schedWarningsRef.current = [];
    failureDetailsRef.current = [];
    addLog(`开始生成: ${item.dateFolder}`);

    try {
      const parseResponse = await parseFolders(item.fullPath, operatorName);
      if (!parseResponse.success) {
        addLog(`  扫描失败: ${parseResponse.error}`);
        recordGenerateFailure(item, `扫描日期文件夹失败：${parseResponse.error || "请确认路径可访问且不是空目录"}`, "check", index);
        setGenerateResult({
          ok: 0,
          fail: 1,
          outputPath: null,
          outputPaths: [],
          commonParent: null,
          schedWarnings: schedWarningsRef.current.slice(),
          failures: failureDetailsRef.current.slice(),
          status: 'failed',
          pendingItems: [],
        });
        setIsGenerating(false);
        return;
      }
      const records = parseResponse.data.records;
      const reviewMap = parseResponse.data.review_map;

      const candidateNames = new Set(item.manualCandidates?.map((c) => c.folderName) || []);
      const manualCandidateFilteredRecords = records.filter((r) => !candidateNames.has(r.folder));
      const skippedCount = records.length - manualCandidateFilteredRecords.length;
      if (skippedCount > 0) {
        addLog(`  已过滤 ${skippedCount} 个手量候选文件夹，避免与普通任务重复排程`);
      }
      const manualFilteredRecords = filterRecordsByManualCountingMode(item, manualCandidateFilteredRecords, "生成");
      const filteredRecords = filterOmittedRecords(item, manualFilteredRecords, "生成");

      const unconfirmedCandidates = (item.manualCandidates || []).filter(
        (candidate) => !isManualCandidateConfirmed(candidate, item)
      );
      if (unconfirmedCandidates.length > 0) {
        const names = unconfirmedCandidates.map((c) => c.folderName).join(", ");
        const reason = `有 ${unconfirmedCandidates.length} 个手量文件夹未确认：${names}。请先在弹窗中确认耗时、数量和测量员。`;
        addLog(`生成已暂停: ${item.dateFolder} ${reason}`);
        recordGenerateFailure(item, reason, "manual", index);
        setManualTaskItem(item);
        setManualTaskOpen(true);
        setGenerateResult({
          ok: 0,
          fail: 0,
          outputPath: null,
          outputPaths: [],
          commonParent: null,
          schedWarnings: schedWarningsRef.current.slice(),
          failures: failureDetailsRef.current.slice(),
          status: 'paused',
          pendingItems: queue.slice(index).map((it) => it.dateFolder),
        });
        setIsGenerating(false);
        return;
      }

      const settings = buildItemSettings(item);
      const durationAppliedRecords = applyDurationOverrides(
        filteredRecords,
        item.settingsOverride?.duration_overrides,
        settings.duration_rules
      );
      const filteredReviewMap = filterReviewMapByRecords(reviewMap, durationAppliedRecords);
      setReviewMap(filteredReviewMap);

      const needsReview = Object.keys(filteredReviewMap).some(
        (key) => filteredReviewMap[key].missing.length > 0 || filteredReviewMap[key].placeholders.length > 0
      );
      const effectiveReviewMode = item.reviewMode ?? complexDefault;
      const forceReviewDialog = hasMissingSender(filteredReviewMap);
      if (needsReview && (effectiveReviewMode === 'A' || forceReviewDialog)) {
        addLog(forceReviewDialog && effectiveReviewMode === 'B'
          ? `  缺少送测人，强制打开审核对话框`
          : `  需要审核，打开审核对话框`);
        setPendingRecords(durationAppliedRecords);
        setReviewMap(filteredReviewMap);
        setReviewOpen(true);
        generateStateRef.current = {
          currentIndex: index,
          successCount: 0,
          failCount: 0,
          currentRecords: durationAppliedRecords,
          single: true,
        };
        return;
      }
      if (needsReview && effectiveReviewMode === 'B') {
        addLog(`  警告: 部分记录需要审核 (留坑自填模式)`);
      }

      await generateSingleItemFinal(item, durationAppliedRecords);
    } catch (e) {
      addLog(`  错误: ${e}`);
      recordGenerateFailure(item, `处理时发生异常：${e}`, "check", index);
      setGenerateResult({
        ok: 0,
        fail: 1,
        outputPath: null,
        outputPaths: [],
        commonParent: null,
        schedWarnings: schedWarningsRef.current.slice(),
        failures: failureDetailsRef.current.slice(),
        status: 'failed',
        pendingItems: [],
      });
      setIsGenerating(false);
    }
  };

  const handlePreviewGenerate = () => {
    if (previewIndex >= 0 && previewIndex < queue.length) {
      handleGenerateSingleFromPreview(previewIndex);
    }
  };

  const handlePreviewOpenManual = () => {
    if (previewIndex >= 0 && previewIndex < queue.length) {
      const item = queue[previewIndex];
      setManualTaskItem(item);
      setManualTaskOpen(true);
    }
  };

  const handlePreviewOpenDaySettings = () => {
    if (previewIndex >= 0 && previewIndex < queue.length) {
      setDaySettingsIndex(previewIndex);
      setDaySettingsOpen(true);
    }
  };

  const handleOpenPreviewFromOverview = (index: number) => {
    const item = queue[index];
    if (!item) return;
    setMultiDayOverviewOpen(false);
    handlePreviewForItem(item, index);
  };

  const handlePreviewDurationOverridesSave = async (overrides: Record<string, DurationOverride>) => {
    if (previewIndex < 0 || previewIndex >= queue.length) return;
    const item = queue[previewIndex];
    const nextOverride: QueueItemSettingsOverride = { ...(item.settingsOverride || {}) };
    if (Object.keys(overrides).length > 0) {
      nextOverride.duration_overrides = overrides;
    } else {
      delete nextOverride.duration_overrides;
    }
    const nextItem: QueueItem = { ...item, settingsOverride: nextOverride };
    setQueue((prev) => prev.map((queueItem, index) => index === previewIndex ? nextItem : queueItem));
    addLog(Object.keys(overrides).length > 0
      ? `已保存 ${item.dateFolder} 的本日包耗时覆盖，重新预览`
      : `已清除 ${item.dateFolder} 的本日包耗时覆盖，重新预览`);
    await handlePreviewForItem(nextItem, previewIndex);
  };

  const handleApplyTimeAnomalyRecommendation = async () => {
    if (previewIndex < 0 || previewIndex >= queue.length || !previewData) return;
    const anomaly = previewData.summary.time_anomaly || previewData.summary.decision?.time_anomaly;
    const items = anomaly?.kind === "too_little" ? (anomaly.adjustment_items || []) : [];
    if (items.length === 0) {
      addLog("应用推荐已跳过: 当前没有可应用的普通包调时建议");
      return;
    }
    const currentOverrides = queue[previewIndex]?.settingsOverride?.duration_overrides || {};
    const nextOverrides: Record<string, DurationOverride> = { ...currentOverrides };
    for (const item of items) {
      const minutes = Math.min(6, Math.max(0, item.recommended_per_piece));
      if (!Number.isFinite(minutes) || minutes <= 0) continue;
      nextOverrides[item.folder] = {
        folder: item.folder,
        mode: "per_piece",
        minutes: Math.round(minutes * 10) / 10,
        computed_total_minutes: Math.round(item.recommended_total_minutes * 10) / 10,
      };
    }
    addLog(`应用时间异常推荐: ${queue[previewIndex].dateFolder} 写入 ${items.length} 个包耗时覆盖`);
    await handlePreviewDurationOverridesSave(nextOverrides);
  };

  const handleMoveTimeAnomalyOmitItems = async () => {
    if (previewIndex < 0 || previewIndex >= queue.length || !previewData) return;
    const item = queue[previewIndex];
    const anomaly = previewData.summary.time_anomaly || previewData.summary.decision?.time_anomaly;
    const omitItems = anomaly?.kind === "too_much" ? (anomaly.omit_items || []) : [];
    const folderNames = omitItems.map((omit) => omit.folder).filter(Boolean);
    if (folderNames.length === 0) {
      addLog("省略清单处理已跳过: 当前没有可移动的候选包");
      return;
    }
    const settings = buildItemSettings(item);
    const shift = (settings.shift_override === "A" || settings.shift_override === "B" ? settings.shift_override : item.shiftOverride || item.shift || shiftDefault) as "A" | "B";
    const targetName = `新建文件夹${shift}`;
    const confirmed = await requestAppConfirm({
      title: "确认移动省略清单",
      description: [
        `将把 ${folderNames.length} 个文件夹移动到当前日期目录内的“${targetName}”。`,
        "目标同名不会覆盖，会自动追加序号。",
        "",
        ...folderNames.map((name) => `- ${name} -> ${targetName}`),
      ].join("\n"),
      confirmLabel: "确认移动",
      cancelLabel: "取消",
      tone: "warning",
    });
    if (!confirmed) {
      addLog(`省略清单移动已取消: ${item.dateFolder}`);
      return;
    }

    const moved = await moveFoldersToShiftBucket(item.fullPath, folderNames, shift);
    const movedNames = moved.map((entry) => entry.folder_name);
    const nextOverride: QueueItemSettingsOverride = { ...(item.settingsOverride || {}) };
    const omitted = new Set([...(nextOverride.omitted_folders || []), ...movedNames]);
    nextOverride.omitted_folders = Array.from(omitted);
    if (nextOverride.duration_overrides) {
      const nextDurationOverrides = { ...nextOverride.duration_overrides };
      for (const name of movedNames) delete nextDurationOverrides[name];
      nextOverride.duration_overrides = Object.keys(nextDurationOverrides).length > 0 ? nextDurationOverrides : undefined;
    }
    const nextItem: QueueItem = { ...item, settingsOverride: nextOverride };
    setQueue((prev) => prev.map((queueItem, index) => index === previewIndex ? nextItem : queueItem));
    moved.forEach((entry) => addLog(`省略清单已移动: ${entry.folder_name} -> ${entry.target_path}`));
    await handlePreviewForItem(nextItem, previewIndex);
  };

  const handlePreviewDecisionSettingsSave = async (patch: Partial<QueueItemSettingsOverride>) => {
    if (previewIndex < 0 || previewIndex >= queue.length) return;
    const item = queue[previewIndex];
    const nextOverride: QueueItemSettingsOverride = { ...(item.settingsOverride || {}), ...patch };
    if (nextOverride.other_note !== undefined) {
      const normalizedOtherNote = String(nextOverride.other_note).trim();
      nextOverride.other_note = normalizedOtherNote || DEFAULT_OTHER_NOTE;
    }
    const nextItem: QueueItem = { ...item, settingsOverride: nextOverride };
    setQueue((prev) => prev.map((queueItem, index) => index === previewIndex ? nextItem : queueItem));
    addLog(`已更新 ${item.dateFolder} 的生成前排程决策，重新预览`);
    await handlePreviewForItem(nextItem, previewIndex);
  };

  const buildPreviewDurationOverrideDisabledFolders = (): Record<string, string> => {
    if (previewIndex < 0 || previewIndex >= queue.length || !previewData) return {};
    const item = queue[previewIndex];
    const settings = buildItemSettings(item);
    const disabled: Record<string, string> = {};
    for (const record of previewData.records) {
      if (record.station === "CNC") {
        disabled[record.folder] = "CNC 本轮不覆盖";
        continue;
      }
      const matchedRule = matchDurationRuleForRecord(record, settings.duration_rules);
      if (matchedRule) {
        disabled[record.folder] = `耗时规则料本轮不覆盖：${matchedRule.name}`;
      }
    }
    return disabled;
  };

  const getSchemeLabel = (item: QueueItem): string[] => {
    const labels: string[] = [];
    // 班次标签（从文件夹后缀或手动选择）—— 显示为 [A班]/[B班]
    const effectiveShift = item.shiftOverride || item.shift;
    if (effectiveShift === 'A') labels.push('[A班]');
    if (effectiveShift === 'B') labels.push('[B班]');
    // 审核模式标签（文件夹级覆盖，null=跟随全局不显示）
    if (item.reviewMode === 'A') labels.push('[方案A:弹窗]');
    if (item.reviewMode === 'B') labels.push('[方案B:留坑]');
    // 下班策略：使用 item 级覆盖后的生效值
    const effectiveLeave = item.settingsOverride?.leave_strategy ?? leaveStrategy;
    if (effectiveLeave === 'early') labels.push('[下早班]');
    if (effectiveLeave === 'normal') labels.push('[正常班]');
    if (effectiveLeave === 'auto') labels.push('[智能]');
    // 其他覆盖标签
    if (item.settingsOverride) {
      if (item.settingsOverride.enable_hand !== undefined) labels.push(item.settingsOverride.enable_hand ? '[手量:开]' : '[手量:关]');
      if (item.settingsOverride.enable_other !== undefined) labels.push(item.settingsOverride.enable_other ? '[其他:开]' : '[其他:关]');
      if (item.settingsOverride.tpp_min !== undefined || item.settingsOverride.tpp_max !== undefined) labels.push('[tpp覆盖]');
      if (item.settingsOverride.pkg_rest !== undefined) labels.push('[包材休息覆盖]');
      if (item.settingsOverride.hand_max !== undefined) labels.push('[手量上限覆盖]');
      if (item.settingsOverride.other_max !== undefined) labels.push('[其他上限覆盖]');
      if (item.settingsOverride.filler_position !== undefined) labels.push(`[补时:${FILLER_POSITION_LABELS[item.settingsOverride.filler_position]}]`);
      if (item.settingsOverride.special_items !== undefined) labels.push('[耗时规则覆盖]');
      if (item.settingsOverride.duration_overrides && Object.keys(item.settingsOverride.duration_overrides).length > 0) labels.push('[包耗时覆盖]');
      if (item.settingsOverride.omitted_folders && item.settingsOverride.omitted_folders.length > 0) labels.push(`[已省略:${item.settingsOverride.omitted_folders.length}]`);
    }
    return labels;
  };

  return (
    <div className="flex h-screen flex-col bg-[#f5f5f7] text-slate-950">
      {/* Header */}
      <header className="mx-3 mt-3 flex shrink-0 items-center justify-between rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3 shadow-[0_10px_32px_rgba(15,23,42,0.07)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-[0_10px_24px_rgba(10,132,255,0.24)]">
            {activeModule === "home" ? <Home className="h-5 w-5" /> : activeModule === "dataManagement" ? <Database className="h-5 w-5" /> : <FileSpreadsheet className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {activeModule !== "home" && (
                <Button variant="ghost" size="sm" onClick={() => setActiveModule("home")} className="h-7 gap-1 px-2 text-xs">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  主页
                </Button>
              )}
              <h1 className="text-base font-semibold leading-tight tracking-normal text-slate-950">玉衡山科学院管理厅</h1>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                {moduleTitle}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] font-medium tracking-[0.16em] text-slate-300">
              玉衡山科学院
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              欢迎您，Dr. {currentAccount.display_name}
              <span className="ml-1 text-slate-400">· {isAdminAccount ? "管理员" : "访客"}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSettingsCenterOpen(true)} className="gap-1.5">
            <Settings className="h-4 w-4" />
            设置
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleHelpOpen('quickstart')} className="gap-1.5">
            <HelpCircle className="h-4 w-4" />
            使用说明
          </Button>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-5">
        <div className="mx-auto max-w-[1440px]">
          {activeModule === "home" ? (
            <div className="space-y-5">
              <section className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.07)] backdrop-blur-xl">
                <div>
                  <div>
                    <div className="text-xs font-semibold tracking-[0.18em] text-slate-300">KANESHIRO·AKATSUKI</div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">玉衡山科学院管理厅</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                      统筹观测记录、统计生成与本机数据治理。
                    </p>
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setActiveModule("daily")}
                  className="group rounded-2xl border border-white/80 bg-white/85 p-5 text-left shadow-[0_12px_34px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_44px_rgba(15,23,42,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                      <BarChart3 className="h-5 w-5" />
                    </span>
                    <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">可进入</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-950">信息统计局</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">测量记录识别、过程统计与日报生成。</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-1">记录识别</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">统计预演</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">报表归档</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleOpenDataManagement}
                  className="group rounded-2xl border border-white/80 bg-white/85 p-5 text-left shadow-[0_12px_34px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_44px_rgba(15,23,42,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                      <Database className="h-5 w-5" />
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${isAdminAccount ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                      {isAdminAccount ? "管理员" : "需管理员"}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-950">数据管理局</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">本机数据治理、环境校准与风险控制。</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-1">数据净化</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">环境复位</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">风险校验</span>
                  </div>
                </button>
              </section>
            </div>
          ) : activeModule === "dataManagement" ? (
            <div className="space-y-5">
              <section className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.07)] backdrop-blur-xl">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <ShieldCheck className="h-4 w-4 text-blue-600" />
                      数据管理局
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                      管理员专用区域。真实执行清理前仍会列出影响范围、候选进程和高风险确认。
                    </p>
                  </div>
                  <Button onClick={() => setPersonalCleanerOpen(true)} className="gap-1.5">
                    <Database className="h-4 w-4" />
                    打开数据维护中心
                  </Button>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {[
                  { title: "基准净化", text: "按低风险基线执行日常治理。" },
                  { title: "方案参数", text: "保存并复用个人治理参数。" },
                  { title: "保护边界", text: "保留表格、送测与程序相关对象。" },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.text}</p>
                  </div>
                ))}
              </section>
            </div>
          ) : (
          <>
          {/* Top warning */}
          <div className="warning-strip mb-4 flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>关键流程：先核对数量，再预览，最后生成。选择方案 B 时，报表中的占位符需要生成后手动补全。</span>
          </div>

          <Card className="mb-4 border-slate-200/80 bg-white/75">
            <CardContent className="py-4">
              <div className="flex flex-col items-center gap-3 text-center">
                <div>
                  <div className="text-sm font-semibold text-slate-900">日报主操作</div>
                  <div className="mt-1 text-xs text-slate-500">先预览核对，再生成正式报表。</div>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handlePreview}
                    disabled={isGenerating || queue.length === 0}
                    className="min-w-[132px] gap-1.5"
                  >
                    预览日报
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="min-w-[148px] gap-2 shadow-[0_12px_28px_rgba(10,132,255,0.22)]"
                  >
                    <Play className="h-4 w-4" />
                    生成报表
                  </Button>
                  {lastOutputPath && !isGenerating && (
                    <Button variant="secondary" size="lg" onClick={() => openFolder(lastOutputPath)} className="gap-1.5">
                      <FolderOpen className="h-4 w-4" />
                      打开输出文件夹
                    </Button>
                  )}
                </div>
              </div>
              {isGenerating && (
                <div className="mx-auto mt-4 max-w-md">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-center text-sm font-medium text-slate-600">{progress}%</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Left column */}
            <div className="space-y-4">
              {/* Settings summary */}
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Settings className="h-4 w-4 text-blue-600" />
                    当前设置
                  </CardTitle>
                  <Button variant="secondary" size="sm" onClick={() => setSettingsCenterOpen(true)}>
                    打开设置
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="soft-panel">
                      <div className="text-xs text-slate-500">使用者</div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {operatorName || "未设置"}
                        <span className="ml-2 text-xs font-normal text-slate-500">{getInitials(operatorName)}</span>
                      </div>
                    </div>
                    <div className="soft-panel">
                      <div className="text-xs text-slate-500">时间策略</div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {leaveStrategy === 'early' ? '下早班' : leaveStrategy === 'normal' ? '不下早班' : '智能判断'} · {tppMin}~{tppMax} 分钟/件
                      </div>
                    </div>
                    <div className="soft-panel">
                      <div className="text-xs text-slate-500">补时长</div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        手量{enableHand ? '开' : '关'}（{handMax}分钟） · 其他{enableOther ? '开' : '关'}（{otherMax}分钟）
                      </div>
                    </div>
                    <div className="soft-panel">
                      <div className="text-xs text-slate-500">输出</div>
                      <div className="mt-1 truncate text-sm font-medium text-slate-800" title={useSrcOutput ? '输出到源日期文件夹' : outputDir}>
                        {useSrcOutput ? '源日期文件夹' : (outputDir || '统一输出目录未设置')}
                      </div>
                    </div>
                    <div className="soft-panel">
                      <div className="text-xs text-slate-500">审核与班次</div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {complexDefault === 'A' ? '方案 A' : '方案 B'} · 默认{shiftDefault}班
                      </div>
                    </div>
                    <div className="soft-panel">
                      <div className="text-xs text-slate-500">模板</div>
                      <div className="mt-1 truncate text-sm font-medium text-slate-800" title={templateInfo?.path || ''}>
                        {templateInfo?.exists ? templateSourceLabel(templateInfo.source) : '未找到模板'}
                      </div>
                    </div>
                  </div>
                  <div className="info-strip flex items-start gap-2">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>设置中心按账户登录、信息统计局设置、数据管理局设置和关于软件分区。清理执行入口已独立到数据管理局，修改设置会先进入草稿，保存后才写入配置文件。</span>
                  </div>
                </CardContent>
              </Card>

              {/* Work Directory */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Folder className="h-4 w-4 text-blue-600" />
                    工作目录
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={workDir}
                      onChange={(e) => setWorkDir(e.target.value)}
                      placeholder="请选择包含日期文件夹的根目录"
                    />
                    <Button variant="secondary" onClick={handleSelectWorkDir}>
                      <FolderOpen className="h-4 w-4 mr-1.5" />
                      选择
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-600 shrink-0">日期文件夹:</span>
                    <select
                      value={selectedDateFolder}
                      onChange={(e) => setSelectedDateFolder(e.target.value)}
                      className="h-9 min-w-[10rem] rounded-lg border border-slate-200/90 bg-white/80 px-3 py-1 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-visible:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
                    >
                      <option value="">-- 请选择日期文件夹 --</option>
                      {dateFolders.map((folder) => (
                        <option key={folder} value={folder}>{folder}</option>
                      ))}
                    </select>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" onClick={handleAddToQueue}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        添加
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleSelectAllToQueue}>
                        全选
                      </Button>
                      <Button variant="outline" size="sm" onClick={refreshDateFolders} disabled={dateFoldersRefreshing}>
                        <RefreshCw className={`h-3.5 w-3.5 mr-1 ${dateFoldersRefreshing ? "animate-spin" : ""}`} />
                        {dateFoldersRefreshing ? "刷新中" : "刷新"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleClearQueue}>
                        <X className="h-3.5 w-3.5 mr-1" />
                        清空
                      </Button>
                    </div>
                  </div>
                  <div className="info-strip flex items-start gap-2">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>日期文件夹请直接放在工作目录下，命名格式如 6.13A、6.13B。没有 A/B 后缀的文件夹添加时会提示选择班次。</span>
                  </div>
                  {dateFoldersRefreshMessage && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
                      {dateFoldersRefreshMessage}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* Queue */}
              <Card className="flex flex-col">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Folder className="h-4 w-4 text-blue-600" />
                    待生成队列
                  </CardTitle>
                  <span className="text-xs text-slate-500">共 {queue.length} 项</span>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div
                    className="h-64 overflow-y-auto rounded-xl border border-slate-200/80 bg-white/70 p-1 shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
                    tabIndex={0}
                    onKeyDown={handleQueueKeyDown}
                    onPaste={handleQueuePaste}
                  >
                    {queue.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center p-4 text-center text-sm text-slate-400">
                        <Folder className="h-8 w-8 mb-2 text-slate-300" />
                        暂无任务，请从左侧选择日期文件夹并添加
                        <p className="text-xs mt-1">支持拖拽文件夹或 Ctrl+V 粘贴路径</p>
                      </div>
                    ) : (
                      queue.map((item, index) => (
                        <div
                          key={index}
                          className={`m-1 cursor-pointer rounded-lg border px-2.5 py-2 text-sm transition-[background-color,border-color,box-shadow] ${
                            selectedQueueItems.has(index)
                              ? "border-blue-200 bg-blue-50/90 shadow-sm"
                              : "border-transparent hover:border-slate-200/80 hover:bg-white/85"
                          }`}
                          onClick={() => toggleQueueItem(index)}
                          onContextMenu={(e) => handleQueueItemContextMenu(e, index)}
                        >
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate font-medium text-slate-800">{item.dateFolder}</span>
                                <span className="flex flex-wrap gap-1">
                                  {getSchemeLabel(item).map((label, li) => (
                                    <span key={li} className={`rounded-full border px-2 py-0.5 text-[10px] ${schemePillClass(label)}`}>
                                      {label.replace(/[\[\]]/g, "")}
                                    </span>
                                  ))}
                                  {(() => {
                                    const { pendingCount, manualTaskCount } = getManualCandidateCounts(item);
                                    return (
                                      <>
                                        {pendingCount > 0 && (
                                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                            手量待确认×{pendingCount}
                                          </span>
                                        )}
                                        {manualTaskCount > 0 && (
                                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                            真实手量×{manualTaskCount}
                                          </span>
                                        )}
                                      </>
                                    );
                                  })()}
                                </span>
                              </div>
                              <div className="mt-1 truncate text-xs text-slate-400">
                                {item.fullPath}
                                {(() => {
                                  const { pendingCount } = getManualCandidateCounts(item);
                                  return pendingCount > 0 ? (
                                    <span className="ml-2 font-medium text-amber-600">本日内有 {pendingCount} 个手量待确认</span>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 shrink-0 gap-1 px-2 text-xs text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDaySettingsForQueueItem(index);
                              }}
                            >
                              <Settings className="h-3.5 w-3.5" />
                              设置
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenMultiDayOverview}
                      disabled={queue.length === 0 || multiDayOverviewLoading}
                    >
                      <Clock className="h-3.5 w-3.5 mr-1" />
                      多日预览总览
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveSelectedFromQueue}
                      disabled={selectedQueueItems.size === 0}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      删除选中
                    </Button>
                    <Button variant="outline" size="sm" onClick={toggleAllQueueItems}>
                      {selectedQueueItems.size === queue.length ? "取消全选" : "全选"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleClearQueue}>
                      <X className="h-3.5 w-3.5 mr-1" />
                      清空
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          </>
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 overflow-y-auto overscroll-contain rounded-xl border border-white/80 bg-white/95 p-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.22)] backdrop-blur-sm"
          style={getContextMenuStyle(contextMenu)}
        >
          <button
            className="w-full rounded-lg px-3 py-1.5 text-left text-sm font-medium text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            onClick={() => {
              if (contextMenu === null) return;
              openDaySettingsForQueueItem(contextMenu.index);
              setContextMenu(null);
            }}
          >
            单日设置 / 补时插入位置
          </button>
          <div className="my-1 border-t border-slate-200/70" />
          <div className="cursor-default px-3 py-1.5 text-xs font-medium leading-5 text-slate-500">
            当前审核模式: {queue[contextMenu.index]?.reviewMode === 'A' ? '方案A(弹窗审核)' : queue[contextMenu.index]?.reviewMode === 'B' ? '方案B(留坑自填)' : '默认(跟随全局)'}
          </div>
          <div className="my-1 border-t border-slate-200/70" />
          <button
            className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            onClick={() => handleSetReviewMode('A')}
          >
            方案A：弹窗审核
          </button>
          <button
            className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            onClick={() => handleSetReviewMode('B')}
          >
            方案B：留坑自填
          </button>
          <div className="my-1 border-t border-slate-200/70" />
          <button
            className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            onClick={() => handleSetReviewMode(null)}
          >
            恢复默认（跟随全局审核模式）
          </button>

          <div className="my-1 border-t border-slate-200/70" />
          <div className="cursor-default px-3 py-1.5 text-xs font-medium leading-5 text-slate-500">
            当前下班策略: {(() => {
              const item = queue[contextMenu.index];
              const v = item?.settingsOverride?.leave_strategy ?? leaveStrategy;
              return v === 'early' ? '下早班' : v === 'normal' ? '不下早班' : '智能判断';
            })()}
          </div>
          <button
            className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            onClick={() => {
              if (contextMenu === null) return;
              updateQueueItemOverride(contextMenu.index, { leave_strategy: 'auto' });
              setContextMenu(null);
            }}
          >
            下班策略：智能判断
          </button>
          <button
            className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            onClick={() => {
              if (contextMenu === null) return;
              updateQueueItemOverride(contextMenu.index, { leave_strategy: 'early' });
              setContextMenu(null);
            }}
          >
            下班策略：下早班
          </button>
          <button
            className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            onClick={() => {
              if (contextMenu === null) return;
              updateQueueItemOverride(contextMenu.index, { leave_strategy: 'normal' });
              setContextMenu(null);
            }}
          >
            下班策略：不下早班
          </button>
          <button
            className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            onClick={() => {
              if (contextMenu === null) return;
              updateQueueItemOverride(contextMenu.index, {
                leave_strategy: undefined,
              });
              setContextMenu(null);
            }}
          >
            下班策略：恢复默认
          </button>

          <div className="my-1 border-t border-slate-200/70" />
          <button
            className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            onClick={() => {
              if (contextMenu === null) return;
              const item = queue[contextMenu.index];
              updateQueueItemOverride(contextMenu.index, {
                enable_hand: !(item.settingsOverride?.enable_hand ?? enableHand),
              });
              setContextMenu(null);
            }}
          >
            切换手量覆盖
          </button>
          <button
            className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            onClick={() => {
              if (contextMenu === null) return;
              const item = queue[contextMenu.index];
              updateQueueItemOverride(contextMenu.index, {
                enable_other: !(item.settingsOverride?.enable_other ?? enableOther),
              });
              setContextMenu(null);
            }}
          >
            切换其他事务覆盖
          </button>

          <button
            className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-amber-700 transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100"
            onClick={() => {
              if (contextMenu === null) return;
              const item = queue[contextMenu.index];
              setManualTaskItem(item);
              setManualTaskOpen(true);
              setContextMenu(null);
            }}
          >
            手量任务管理 / 补录
          </button>

          <div className="my-1 border-t border-slate-200/70" />
          <button
            className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
            onClick={() => {
              if (contextMenu === null) return;
              clearQueueItemOverride(contextMenu.index);
              setContextMenu(null);
            }}
          >
            清除所有单独设置
          </button>
        </div>
      )}

      {/* Review Dialog */}
      <ConfirmDialog
        open={Boolean(appConfirm)}
        title={appConfirm?.title || ""}
        description={appConfirm?.description}
        confirmLabel={appConfirm?.confirmLabel || "确认"}
        cancelLabel={appConfirm?.cancelLabel}
        tone={appConfirm?.tone}
        onConfirm={() => resolveAppConfirm(true)}
        onCancel={() => resolveAppConfirm(false)}
      />

      <ConfirmDialog
        open={dataManagementDeniedOpen}
        title="需要管理员权限"
        description="数据管理局包含本机清理、网络切换、进程维护等功能，仅管理员账户可进入。"
        confirmLabel="知道了"
        cancelLabel="切换账户"
        tone="info"
        onConfirm={() => setDataManagementDeniedOpen(false)}
        onCancel={() => {
          setDataManagementDeniedOpen(false);
          onSwitchAccount();
        }}
      />

      <ReviewDialog
        open={reviewOpen}
        records={pendingRecords}
        reviewMap={reviewMap}
        onConfirm={handleReviewConfirm}
        onSkip={handleReviewSkip}
        onCancel={handleReviewCancel}
      />

      {/* Shift Choose Dialog */}
      <ShiftChooseDialog
        open={shiftChooseOpen}
        folderName={shiftChooseFolderName}
        onChoose={handleShiftChoose}
        onCancel={handleShiftCancel}
      />

      {/* Preview Dialog */}
      <PreviewDialog
        open={previewOpen}
        data={previewData}
        decisionSettings={previewIndex >= 0 && previewIndex < queue.length ? buildItemSettings(queue[previewIndex]) : undefined}
        durationOverrides={previewIndex >= 0 ? queue[previewIndex]?.settingsOverride?.duration_overrides : undefined}
        durationOverrideDisabledFolders={buildPreviewDurationOverrideDisabledFolders()}
        onClose={() => setPreviewOpen(false)}
        onGenerate={handlePreviewGenerate}
        onOpenManual={handlePreviewOpenManual}
        onOpenDaySettings={handlePreviewOpenDaySettings}
        onSaveDecisionSettings={handlePreviewDecisionSettingsSave}
        onSaveDurationOverrides={handlePreviewDurationOverridesSave}
        onApplyTimeRecommendation={handleApplyTimeAnomalyRecommendation}
        onMoveOmitItems={handleMoveTimeAnomalyOmitItems}
      />

      <MultiDayOverviewDialog
        open={multiDayOverviewOpen}
        loading={multiDayOverviewLoading}
        items={multiDayOverviewItems}
        onClose={() => setMultiDayOverviewOpen(false)}
        onOpenPreview={handleOpenPreviewFromOverview}
      />

      <SettingsCenterDialog
        open={settingsCenterOpen}
        value={buildSettingsDraft()}
        configSource={configSource}
        configPath={configPath}
        configDuplicates={configDuplicates}
        recognitionRulesPath={recognitionRulesPath}
        recognitionRulesExists={recognitionRulesExists}
        templateInfo={templateInfo}
        currentAccount={currentAccount}
        logCount={logs.length}
        dataStoreInfo={dataStoreInfo}
        cleanerBackupInfo={cleanerBackupInfo}
        onOpenChange={setSettingsCenterOpen}
        onSave={handleSaveSettingsCenter}
        onBrowseWorkDir={(defaultPath) => selectFolder(defaultPath || configDir)}
        onBrowseOutputDir={(defaultPath) => selectFolder(defaultPath || outputDir || workDir || configDir)}
        onOpenRecognitionRules={() => setRecognitionRulesOpen(true)}
        onOpenSpecialItems={() => setSpecialItemsOpen(true)}
        onOpenKnownSenders={() => setKnownSendersOpen(true)}
        onOpenMeasurementPeople={() => setMeasurementPeopleOpen(true)}
        onReplaceTemplate={handleReplaceTemplate}
        onResetTemplate={handleResetTemplate}
        onViewTemplatePaths={handleViewTemplatePaths}
        onRefreshTemplate={handleRefreshTemplateInfo}
        onSwitchAccount={onSwitchAccount}
        onDisplayNameModeChange={handleDisplayNameModeChange}
        onOpenDetailedLogs={() => setLogDialogOpen(true)}
        onRefreshDataStore={refreshDataStoreInfo}
        onOpenDataRoot={() => {
          if (dataStoreInfo?.dataRoot) openFolder(dataStoreInfo.dataRoot);
        }}
        onRefreshCleanerBackups={refreshCleanerBackupInfo}
        onOpenCleanerBackupRoot={handleOpenCleanerBackupRoot}
        onCleanCleanerBackups={handleCleanCleanerBackups}
        onOpenHelp={handleHelpOpen}
      />

      {logDialogOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="mx-4 flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            <div className="flex items-center justify-between border-b border-slate-200/70 bg-white/90 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">详细日志</h2>
                <p className="mt-1 text-xs text-slate-500">共 {logs.length} 条运行记录</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setLogDialogOpen(false)}>
                <X className="h-4 w-4 mr-1" />
                关闭
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
              {logs.length === 0 ? (
                <div className="text-slate-400">暂无详细日志。</div>
              ) : (
                logs.map((log, index) => (
                  <div key={`${index}-${log}`} className="flex gap-3 border-b border-white/5 py-1">
                    <span className="w-10 shrink-0 select-none text-right text-slate-500">{index + 1}</span>
                    <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{log}</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200/70 bg-white/70 px-5 py-3">
              <Button type="button" variant="outline" onClick={handleCopyDetailedLogs} disabled={logs.length === 0}>
                复制日志
              </Button>
              <Button type="button" variant="outline" onClick={() => setLogs([])} disabled={logs.length === 0}>
                <Trash2 className="h-4 w-4 mr-1" />
                清空日志
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Help Center Dialog */}
      <HelpCenterDialog
        open={helpOpen}
        initialSection={helpSection}
        onClose={() => setHelpOpen(false)}
      />

      {isAdminAccount && (
        <PersonalCleanerDialog
          open={personalCleanerOpen}
          onOpenChange={setPersonalCleanerOpen}
          defaultShift={shiftDefault}
        />
      )}

      {/* Config Location Dialog */}
      <ConfigLocationDialog
        open={configLocationOpen}
        onChooseDefault={handleConfigLocationDefault}
        onChooseCustom={handleConfigLocationCustom}
      />

      <SpecialItemsDialog
        open={specialItemsOpen}
        rules={durationRules}
        onClose={() => setSpecialItemsOpen(false)}
        onSave={handleSaveDurationRules}
      />

      <KnownSendersDialog
        open={knownSendersOpen}
        onOpenChange={setKnownSendersOpen}
        onChanged={() => { void refreshDataStoreInfo(); }}
      />

      <MeasurementPeopleDialog
        open={measurementPeopleOpen}
        onOpenChange={setMeasurementPeopleOpen}
        onChanged={() => { void refreshDataStoreInfo(); }}
      />

      {/* Template Paths Dialog */}
      {templatePathsOpen && templatePaths && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-white/70 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">模板位置</h2>

            {/* 当前生效模板 */}
            <div className="mb-3 rounded-xl border border-slate-200/80 bg-white/70 p-3">
              <div className="text-xs font-medium text-slate-500 mb-1">当前生效模板</div>
              {templatePaths.current_path ? (
                <>
                  <div className="flex items-start gap-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs flex-shrink-0 ${
                      templatePaths.current_source === 'user' ? 'bg-blue-100 text-blue-700' :
                      templatePaths.current_source === 'bundled' ? 'bg-green-100 text-green-700' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      {templateSourceLabel(templatePaths.current_source)}
                    </span>
                    <span className="text-sm text-slate-800 break-all flex-1">{templatePaths.current_path}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs mt-1"
                    onClick={async () => {
                      try { if (templatePaths.current_path) await openFolder(templatePaths.current_path); } catch (_) {}
                    }}
                  >
                    <FolderOpen className="h-3 w-3 mr-1" />
                    打开所在文件夹
                  </Button>
                </>
              ) : (
                <span className="text-sm text-red-600">未找到可用模板</span>
              )}
            </div>

            <div className="my-2 border-t border-slate-200/70" />

            {/* 内置打包模板 */}
            <div className="mb-3 rounded-xl border border-slate-200/80 bg-white/70 p-3">
              <div className="text-xs font-medium text-slate-500 mb-1">
                软件内置模板 {templatePaths.bundled_exists ? '' : '（不存在）'}
              </div>
              {templatePaths.bundled_path ? (
                <>
                  <div className="text-sm text-slate-800 break-all">{templatePaths.bundled_path}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs mt-1"
                    onClick={async () => {
                      try { if (templatePaths.bundled_path) await openFolder(templatePaths.bundled_path); } catch (_) {}
                    }}
                  >
                    <FolderOpen className="h-3 w-3 mr-1" />
                    打开内置模板文件夹
                  </Button>
                </>
              ) : (
                <span className="text-sm text-slate-400">未检测到内置模板（开发模式下需放置于 src-tauri/resources/template.xlsx）</span>
              )}
            </div>

            <div className="my-2 border-t border-slate-200/70" />

            {/* 用户自定义模板 */}
            <div className="mb-3 rounded-xl border border-slate-200/80 bg-white/70 p-3">
              <div className="text-xs font-medium text-slate-500 mb-1">
                用户自定义模板 {templatePaths.user_template_exists ? '（已设置）' : '（未设置，点击「更新模板」可设置）'}
              </div>
              <div className="text-sm text-slate-800 break-all">{templatePaths.user_template_path}</div>
              <div className="text-xs text-slate-400 mt-1">目录: {templatePaths.user_template_dir}</div>
              {templatePaths.user_template_exists && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs mt-1"
                  onClick={async () => {
                    try { if (templatePaths.user_template_path) await openFolder(templatePaths.user_template_path); } catch (_) {}
                  }}
                >
                  <FolderOpen className="h-3 w-3 mr-1" />
                  打开自定义模板文件夹
                </Button>
              )}
            </div>

            <div className="my-2 border-t border-slate-200/70" />

            <p className="mb-3 rounded-lg border border-blue-200/70 bg-blue-50/80 p-3 text-xs leading-5 text-blue-800">
              说明：生成报表时按以下优先级查找模板 —— 用户自定义模板 &gt; 工作目录模板 &gt; 内置模板。
              点击「更新模板」可上传新模板到用户配置目录；点击「重置为内置」会清除自定义模板，回退到内置模板。
            </p>

            <div className="mt-2 flex justify-end gap-2 border-t border-slate-200/70 pt-3">
              <Button onClick={() => setTemplatePathsOpen(false)}>关闭</Button>
            </div>
          </div>
        </div>
      )}

      {/* Generation Complete Dialog */}
      {generateResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-white/70 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {generateResult.status === 'paused'
                ? '生成已暂停，需要先处理手量'
                : generateResult.fail === 0
                ? '生成完成'
                : generateResult.ok > 0
                ? '生成完成（部分失败）'
                : '生成未完成'}
            </h2>
            <p className="text-sm text-slate-700 mb-2">
              成功生成 {generateResult.ok} 份报表
              {generateResult.fail > 0 && `，${generateResult.fail} 份失败`}
              {generateResult.status === 'paused' && generateResult.pendingItems.length > 0 && `，${generateResult.pendingItems.length} 个日期尚未处理`}
            </p>

            {/* 生成结果列表 */}
            {generateResult.outputPaths.length > 0 && (
              <div className="mb-3 mt-2 flex-1 overflow-y-auto rounded-xl border border-slate-200/80 bg-white/70">
                <div className="sticky top-0 border-b border-slate-200/70 bg-white/90 px-3 py-2 text-xs font-medium text-slate-600">
                  生成结果（共 {generateResult.outputPaths.length} 份）
                </div>
                <ul className="divide-y divide-slate-100">
                  {generateResult.outputPaths.map((p, i) => {
                    const sep = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
                    const fileName = sep >= 0 ? p.substring(sep + 1) : p;
                    const dir = sep >= 0 ? p.substring(0, sep) : "";
                    return (
                      <li key={i} className="px-3 py-2 flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate" title={fileName}>
                            {i + 1}. {fileName}
                          </div>
                          <div className="text-xs text-slate-500 truncate" title={dir}>
                            位置: {dir || "(当前目录)"}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs flex-shrink-0"
                          onClick={async () => {
                            try { await openFolder(p); } catch (_) {}
                          }}
                        >
                          <FolderOpen className="h-3 w-3 mr-1" />
                          打开
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* 未处理项列表 */}
            {generateResult.pendingItems.length > 0 && (
              <div className="mb-3 mt-2 flex-1 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50/80">
                <div className="sticky top-0 border-b border-amber-200 bg-amber-50/95 px-3 py-2 text-xs font-medium text-amber-700">
                  以下日期尚未生成
                </div>
                <ul className="divide-y divide-amber-100">
                  {generateResult.pendingItems.map((folder, i) => (
                    <li key={i} className="px-3 py-2 text-sm text-amber-900">
                      {i + 1}. {folder}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 失败明细 */}
            {generateResult.failures.length > 0 && (
              <div className="mb-3 mt-2 flex-1 overflow-y-auto rounded-xl border border-red-200 bg-red-50/80">
                <div className="sticky top-0 border-b border-red-200 bg-red-50/95 px-3 py-2 text-xs font-medium text-red-700">
                  {generateResult.status === 'paused' ? '暂停原因' : '失败原因'}（共 {generateResult.failures.length} 项）
                </div>
                <ul className="divide-y divide-red-100">
                  {generateResult.failures.map((failure, i) => (
                    <li key={`${failure.dateFolder}-${i}`} className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-red-900">
                            {i + 1}. {failure.dateFolder}
                          </div>
                          <div className="text-sm leading-6 text-red-800">
                            {failure.reason}
                          </div>
                        </div>
                        {failure.action === "manual" && failure.queueIndex !== undefined && queue[failure.queueIndex] && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs flex-shrink-0 border-red-200 text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setManualTaskItem(queue[failure.queueIndex!]);
                              setManualTaskOpen(true);
                            }}
                          >
                            打开手量补录
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 公共父目录提示 */}
            {generateResult.commonParent && (
              <p className="text-xs text-slate-500 mb-1">
                所有报表位于: {generateResult.commonParent}
              </p>
            )}
            {generateResult.outputPath && !generateResult.commonParent && (
              <p className="text-xs text-slate-500 mb-1">
                已打开: {generateResult.outputPath}
              </p>
            )}

            {/* 排程警告醒目提示 */}
            {generateResult.schedWarnings.length > 0 && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/90 p-3">
                <p className="text-sm font-semibold text-amber-900 mb-1">⚠ 排程警告（请人工核对）</p>
                <ul className="list-disc list-inside text-sm text-amber-800 space-y-1">
                  {generateResult.schedWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 flex justify-end gap-2 border-t border-slate-200/70 pt-3">
              {generateResult.commonParent && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try { await openFolder(generateResult.commonParent!); } catch (_) {}
                  }}
                >
                  <FolderOpen className="h-4 w-4 mr-1" />
                  打开公共目录
                </Button>
              )}
              {generateResult.outputPath && !generateResult.commonParent && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try { await openFolder(generateResult.outputPath!); } catch (_) {}
                  }}
                >
                  <FolderOpen className="h-4 w-4 mr-1" />
                  打开输出目录
                </Button>
              )}
              <Button onClick={() => setGenerateResult(null)}>确定</Button>
            </div>
          </div>
        </div>
      )}

      {/* 手量任务管理弹窗 */}
      <ManualTaskDialog
        item={manualTaskItem}
        open={manualTaskOpen}
        onOpenChange={setManualTaskOpen}
        onSave={(tasks) => {
          if (!manualTaskItem) return;
          const idx = queue.findIndex((it) => it.fullPath === manualTaskItem.fullPath);
          if (idx >= 0) {
            updateQueueItemOverride(idx, { real_manual_tasks: tasks.length > 0 ? tasks : undefined });
            addLog(`手量记录已更新: ${manualTaskItem.dateFolder} (${tasks.length} 条)`);
          }
        }}
        onPreview={(tasks) => {
          if (manualTaskItem) {
            const idx = queue.findIndex((it) => it.fullPath === manualTaskItem.fullPath);
            const nextItem = {
              ...manualTaskItem,
              settingsOverride: {
                ...(manualTaskItem.settingsOverride || {}),
                real_manual_tasks: tasks.length > 0 ? tasks : undefined,
              },
            };
            updateQueueItemOverride(idx, { real_manual_tasks: tasks.length > 0 ? tasks : undefined });
            addLog(`手量记录已更新: ${manualTaskItem.dateFolder} (${tasks.length} 条)`);
            handlePreviewForItem(nextItem, idx);
          }
        }}
        recognitionRules={recognitionRules}
        ownerName={operatorName}
        suggestion={buildManualTaskSuggestion()}
      />
      <RecognitionRulesDialog
        open={recognitionRulesOpen}
        rules={recognitionRules}
        path={recognitionRulesPath}
        exists={recognitionRulesExists}
        onOpenChange={setRecognitionRulesOpen}
        onReload={() => {
          return refreshRecognitionRules()
            .then((info) => addLog(`补充规则表已重新读取: ${info.path}`))
            .catch((e) => addLog(`补充规则表读取失败: ${e}`));
        }}
        onSave={(rules) => {
          saveRecognitionRules(rules)
            .then((info) => {
              setRecognitionRules(info.rules || emptyRecognitionRules());
              setRecognitionRulesPath(info.path);
              setRecognitionRulesExists(info.exists);
              addLog(`补充规则表已保存: ${info.path}`);
            })
            .catch((e) => addLog(`补充规则表保存失败: ${e}`));
        }}
      />
      {/* 单日设置弹窗 */}
      {daySettingsIndex >= 0 && daySettingsIndex < queue.length && (
        <DaySettingsDialog
          open={daySettingsOpen}
          folderName={queue[daySettingsIndex].dateFolder}
          leaveStrategy={queue[daySettingsIndex].settingsOverride?.leave_strategy}
          enableHand={queue[daySettingsIndex].settingsOverride?.enable_hand}
          enableOther={queue[daySettingsIndex].settingsOverride?.enable_other}
          fillerPosition={queue[daySettingsIndex].settingsOverride?.filler_position}
          globalEnableHand={enableHand}
          globalEnableOther={enableOther}
          globalFillerPosition={DEFAULT_FILLER_POSITION}
          globalLeaveStrategy={leaveStrategy}
          onSave={(settings) => {
            updateQueueItemOverride(daySettingsIndex, settings);
            addLog(`单日设置已更新: ${queue[daySettingsIndex].dateFolder}`);
          }}
          onClear={() => {
            clearQueueItemOverride(daySettingsIndex);
            addLog(`单日设置已恢复默认: ${queue[daySettingsIndex].dateFolder}`);
          }}
          onClose={() => {
            setDaySettingsOpen(false);
            setDaySettingsIndex(-1);
          }}
        />
      )}
    </div>
  );
}
