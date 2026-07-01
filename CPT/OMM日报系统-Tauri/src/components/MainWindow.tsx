import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ReviewDialog } from "@/components/ReviewDialog";
import { ShiftChooseDialog } from "@/components/ShiftChooseDialog";
import { PreviewDialog } from "@/components/PreviewDialog";
import { DaySettingsDialog } from "@/components/DaySettingsDialog";
import { HelpCenterDialog } from "@/components/HelpCenterDialog";
import { ConfigLocationDialog } from "@/components/ConfigLocationDialog";
import { SpecialItemsDialog } from "@/components/SpecialItemsDialog";
import { RecognitionRulesDialog } from "@/components/RecognitionRulesDialog";
import { PersonalCleanerDialog } from "@/components/PersonalCleanerDialog";
import { SettingsCenterDialog, type SettingsCenterDraft } from "@/components/SettingsCenterDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useFile, useSidecar, useConfigManager, useAccountManager, useDataStoreManager } from "@/hooks/useSidecar";
import { ManualTaskDialog } from "@/components/ManualTaskDialog";
import { detectManualCandidates, validateRealManualTask } from "@/lib/utils";
import { emptyRecognitionRules } from "@/lib/recognitionRules";
import type { DisplayNameMode, FolderRecord, ReviewInfo, GenerateSettings, Config, QueueItem, QueueItemSettingsOverride, PreviewData, TemplateInfo, TemplatePaths, SpecialItem, ManualFolderCandidate, RecognitionRules, RealManualTask, PublicAccount, DataStoreInfo } from "@/types/record";
import { Folder, Settings, Play, HelpCircle, FolderOpen, Trash2, Plus, RefreshCw, X, FileSpreadsheet, Info } from "lucide-react";
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
  cancelLabel?: string;
  tone?: "info" | "warning" | "danger";
  resolve: (confirmed: boolean) => void;
};

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
  const [leaveStrategy, setLeaveStrategy] = useState<'auto' | 'early' | 'normal'>('auto');
  const [enableHand, setEnableHand] = useState(true);
  const [enableOther, setEnableOther] = useState(false);
  const [useSrcOutput, setUseSrcOutput] = useState(true);
  const [outputDir, setOutputDir] = useState("");
  const [shiftDefault, setShiftDefault] = useState<'A' | 'B'>('B');
  const [tppMin, setTppMin] = useState(3.0);
  const [tppMax, setTppMax] = useState(7.0);
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

  // Preview dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(-1);

  // Day settings dialog state
  const [daySettingsOpen, setDaySettingsOpen] = useState(false);
  const [daySettingsIndex, setDaySettingsIndex] = useState<number>(-1);

  // Help center dialog state
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpSection, setHelpSection] = useState('quickstart');
  const [settingsCenterOpen, setSettingsCenterOpen] = useState(false);
  const [personalCleanerOpen, setPersonalCleanerOpen] = useState(false);

  // Config location dialog state
  const [configLocationOpen, setConfigLocationOpen] = useState(false);

  // 特殊大件物品管理
  const [specialItemsOpen, setSpecialItemsOpen] = useState(false);
  const [specialItems, setSpecialItems] = useState<SpecialItem[]>([
    { name: "烧结盘", minutes: 8 },
  ]);

  // Template info state
  const [templateInfo, setTemplateInfo] = useState<TemplateInfo | null>(null);
  const [templatePathsOpen, setTemplatePathsOpen] = useState(false);
  const [templatePaths, setTemplatePaths] = useState<TemplatePaths | null>(null);

  // Review dialog state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewMap, setReviewMap] = useState<Record<string, ReviewInfo>>({});
  const [pendingRecords, setPendingRecords] = useState<FolderRecord[]>([]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);

  // 手量任务管理弹窗
  const [manualTaskOpen, setManualTaskOpen] = useState(false);
  const [manualTaskItem, setManualTaskItem] = useState<QueueItem | null>(null);
  const [appConfirm, setAppConfirm] = useState<AppConfirmRequest | null>(null);

  // Shift choose dialog state
  const [shiftChoosePath, setShiftChoosePath] = useState<string | null>(null);
  const [shiftChooseFolderName, setShiftChooseFolderName] = useState("");
  const [shiftChooseOpen, setShiftChooseOpen] = useState(false);

  const { selectFolder, selectXlsxFile, openFolder } = useFile();
  const { parseFolders, generate, preview, listDateFolders, listChildFolders, getTemplateInfo, replaceTemplate, resetTemplate, getTemplatePaths } = useSidecar();
  const { loadConfigWithInfo, saveConfig, migrateConfig, syncConfigState, loadRecognitionRules, saveRecognitionRules } = useConfigManager();
  const { setCurrentAccountDisplayMode } = useAccountManager();
  const { getDataStoreInfo } = useDataStoreManager();
  const isAdminAccount = currentAccount.role === "admin";

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
            refreshRecognitionRules().catch((e) => addLog(`识别补充规则读取失败: ${e}`));
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
  }, []);

  useEffect(() => {
    if (settingsCenterOpen) {
      refreshDataStoreInfo().catch(() => { /* logged in helper */ });
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

  // 保存特殊物品列表
  const handleSaveSpecialItems = (items: SpecialItem[]) => {
    setSpecialItems(items);
    // 立即持久化（specialItems state 更新有延迟，直接用参数）
    saveConfig(buildConfigPatch({ special_items: items })).catch(() => {});
    if (items.length > 0) {
      addLog(`特殊物品已保存: ${items.map((it) => `${it.name}(${it.minutes}分钟)`).join(", ")}`);
    } else {
      addLog(`特殊物品列表已清空`);
    }
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
    actionLabel: "预览" | "生成"
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

    if (skipped.length > 0) {
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

  const buildTppRangeRiskMessage = (
    item: QueueItem,
    records: FolderRecord[],
    settings: GenerateSettings,
    actionLabel: "预览" | "生成"
  ): string | null => {
    if (records.length === 0) return null;
    const min = settings.tpp_min;
    const max = settings.tpp_max;
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

    const packageCount = records.length;
    const totalQuantity = records.reduce((sum, record) => sum + getNumericQuantity(record.quantity), 0);
    const manyPackages = packageCount >= 6;
    const heavyQuantity = totalQuantity >= 60;
    const veryManyPackages = packageCount >= 10;
    const veryHeavyQuantity = totalQuantity >= 120;

    const suspicious =
      (max <= 5 && (manyPackages || heavyQuantity)) ||
      (max <= 6 && (veryManyPackages || veryHeavyQuantity));

    if (!suspicious) return null;

    const quantityText = totalQuantity > 0 ? `、约 ${totalQuantity} PCS` : "";
    return [
      `${item.dateFolder} 当前每件时间范围是 ${min}~${max} 分钟。`,
      `本日已识别 ${packageCount} 个普通任务${quantityText}，这个范围可能偏短，容易让大量料的总耗时被压低。`,
      `如果这是你故意设置的，可以继续${actionLabel}；如果不是，建议先把“每件时间”调回常用范围（例如 3~7 分钟）或在单日设置里单独调整。`,
    ].join("\n");
  };

  const confirmTppRangeIfNeeded = async (
    item: QueueItem,
    records: FolderRecord[],
    settings: GenerateSettings,
    actionLabel: "预览" | "生成"
  ): Promise<boolean> => {
    const message = buildTppRangeRiskMessage(item, records, settings, actionLabel);
    if (!message) return true;

    const ok = await requestAppConfirm({
      title: "每件时间偏低确认",
      description: `${message}\n\n是否继续${actionLabel}？`,
      confirmLabel: `继续${actionLabel}`,
      cancelLabel: "先不继续",
      tone: "warning",
    });
    if (ok) {
      addLog(`注意: ${item.dateFolder} 每件时间 ${settings.tpp_min}~${settings.tpp_max} 分钟偏低，用户已确认继续${actionLabel}`);
    } else {
      addLog(`${actionLabel}已取消: ${item.dateFolder} 每件时间 ${settings.tpp_min}~${settings.tpp_max} 分钟可能偏低`);
    }
    return ok;
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
      const filteredRecords = filterRecordsByManualCountingMode(targetItem, manualCandidateFilteredRecords, "预览");

      const unconfirmedCount = (targetItem.manualCandidates || []).filter(
        (candidate) => !isManualCandidateConfirmed(candidate, targetItem)
      ).length;
      if (unconfirmedCount > 0) {
        addLog(`⚠ 预览提示: ${targetItem.dateFolder} 有 ${unconfirmedCount} 个手量候选待确认，真实手量未参与排程`);
      }

      const settings = buildItemSettings(targetItem);
      if (!(await confirmTppRangeIfNeeded(targetItem, filteredRecords, settings, "预览"))) {
        return;
      }
      const previewResponse = await preview(targetItem.fullPath, filteredRecords, settings);
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
    if (folderName.endsWith('A')) return 'A';
    if (folderName.endsWith('B')) return 'B';
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
    if (!workDir) {
      addLog("请先选择工作目录");
      return;
    }
    try {
      const folders = await listDateFolders(workDir);
      setDateFolders(folders);
      addLog(`刷新完成，找到 ${folders.length} 个日期文件夹`);
    } catch (e) {
      setDateFolders([]);
      addLog(`获取日期文件夹失败: ${e}`);
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
    hand_max: handMax,
    other_max: otherMax,
  });

  // 构造某个队列项的最终生成设置：全局 + item.settingsOverride 浅合并
  const buildItemSettings = (item: QueueItem): GenerateSettings => {
    const base = buildGlobalSettings();
    const ov = item.settingsOverride || {};
    return {
      ...base,
      ...ov,
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
      const filteredRecords = filterRecordsByManualCountingMode(item, manualCandidateFilteredRecords, "生成");
      const filteredReviewMap = filterReviewMapByRecords(reviewMap, filteredRecords);
      setReviewMap(filteredReviewMap);

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
      if (!(await confirmTppRangeIfNeeded(item, filteredRecords, settings, "生成"))) {
        recordGenerateFailure(item, `每件时间范围 ${settings.tpp_min}~${settings.tpp_max} 分钟可能偏低，用户取消生成以便调整设置`, "check", index);
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

      const needsReview = Object.keys(filteredReviewMap).some(
        (key) =>
          filteredReviewMap[key].missing.length > 0 ||
          filteredReviewMap[key].placeholders.length > 0
      );

      const effectiveReviewMode = item.reviewMode ?? complexDefault;
      if (needsReview && effectiveReviewMode === 'A') {
        addLog(`  需要审核，打开审核对话框`);
        setPendingRecords(filteredRecords);
        setReviewMap(filteredReviewMap);
        setReviewOpen(true);
        generateStateRef.current = {
          currentIndex: index,
          successCount,
          failCount,
          currentRecords: filteredRecords,
        };
        return;
      }

      if (needsReview && effectiveReviewMode === 'B') {
        addLog(`  警告: 部分记录需要审核 (留坑自填模式)`);
      }

      await generateWithRecords(item, filteredRecords, index, successCount, failCount);
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
      const filteredRecords = filterRecordsByManualCountingMode(item, manualCandidateFilteredRecords, "生成");
      const filteredReviewMap = filterReviewMapByRecords(reviewMap, filteredRecords);
      setReviewMap(filteredReviewMap);

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
      if (!(await confirmTppRangeIfNeeded(item, filteredRecords, settings, "生成"))) {
        recordGenerateFailure(item, `每件时间范围 ${settings.tpp_min}~${settings.tpp_max} 分钟可能偏低，用户取消生成以便调整设置`, "check", index);
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

      const needsReview = Object.keys(filteredReviewMap).some(
        (key) => filteredReviewMap[key].missing.length > 0 || filteredReviewMap[key].placeholders.length > 0
      );
      const effectiveReviewMode = item.reviewMode ?? complexDefault;
      if (needsReview && effectiveReviewMode === 'A') {
        addLog(`  需要审核，打开审核对话框`);
        setPendingRecords(filteredRecords);
        setReviewMap(filteredReviewMap);
        setReviewOpen(true);
        generateStateRef.current = {
          currentIndex: index,
          successCount: 0,
          failCount: 0,
          currentRecords: filteredRecords,
          single: true,
        };
        return;
      }
      if (needsReview && effectiveReviewMode === 'B') {
        addLog(`  警告: 部分记录需要审核 (留坑自填模式)`);
      }

      await generateSingleItemFinal(item, filteredRecords);
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
      if (item.settingsOverride.special_items !== undefined) labels.push('[特殊物品覆盖]');
    }
    return labels;
  };

  return (
    <div className="flex h-screen flex-col bg-[#f5f5f7] text-slate-950">
      {/* Header */}
      <header className="mx-3 mt-3 flex shrink-0 items-center justify-between rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3 shadow-[0_10px_32px_rgba(15,23,42,0.07)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-[0_10px_24px_rgba(10,132,255,0.24)]">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight tracking-normal text-slate-950">OMM 日报自动生成</h1>
            <p className="text-xs text-slate-500">
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
                    <span>默认规则、输出目录、配置文件、模板、特殊大件、识别补充和个人清理都集中到设置中心。修改设置会先进入草稿，保存后才写入配置文件。</span>
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
                      <Button variant="outline" size="sm" onClick={refreshDateFolders}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        刷新
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
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800 truncate">{item.dateFolder}</span>
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
                                <span className="ml-2 text-amber-600 font-medium">本日内有 {pendingCount} 个手量待确认</span>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[230px] rounded-2xl border border-white/80 bg-white/95 p-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.22)] backdrop-blur-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="cursor-default px-3 py-2 text-xs font-medium leading-5 text-slate-500">
            当前审核模式: {queue[contextMenu.index]?.reviewMode === 'A' ? '方案A(弹窗审核)' : queue[contextMenu.index]?.reviewMode === 'B' ? '方案B(留坑自填)' : '默认(跟随全局)'}
          </div>
          <div className="my-1 border-t border-slate-200/70" />
          <button
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            onClick={() => handleSetReviewMode('A')}
          >
            方案A：弹窗审核
          </button>
          <button
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            onClick={() => handleSetReviewMode('B')}
          >
            方案B：留坑自填
          </button>
          <div className="my-1 border-t border-slate-200/70" />
          <button
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            onClick={() => handleSetReviewMode(null)}
          >
            恢复默认（跟随全局审核模式）
          </button>

          <div className="my-1 border-t border-slate-200/70" />
          <div className="cursor-default px-3 py-2 text-xs font-medium leading-5 text-slate-500">
            当前下班策略: {(() => {
              const item = queue[contextMenu.index];
              const v = item?.settingsOverride?.leave_strategy ?? leaveStrategy;
              return v === 'early' ? '下早班' : v === 'normal' ? '不下早班' : '智能判断';
            })()}
          </div>
          <button
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            onClick={() => {
              if (contextMenu === null) return;
              updateQueueItemOverride(contextMenu.index, { leave_strategy: 'auto' });
              setContextMenu(null);
            }}
          >
            下班策略：智能判断
          </button>
          <button
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            onClick={() => {
              if (contextMenu === null) return;
              updateQueueItemOverride(contextMenu.index, { leave_strategy: 'early' });
              setContextMenu(null);
            }}
          >
            下班策略：下早班
          </button>
          <button
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
            onClick={() => {
              if (contextMenu === null) return;
              updateQueueItemOverride(contextMenu.index, { leave_strategy: 'normal' });
              setContextMenu(null);
            }}
          >
            下班策略：不下早班
          </button>
          <button
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
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
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
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
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
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
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-amber-700 transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100"
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
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
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
        onClose={() => setPreviewOpen(false)}
        onGenerate={handlePreviewGenerate}
        onOpenManual={handlePreviewOpenManual}
        onOpenDaySettings={handlePreviewOpenDaySettings}
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
        canUsePersonalCleaner={isAdminAccount}
        logCount={logs.length}
        dataStoreInfo={dataStoreInfo}
        onOpenChange={setSettingsCenterOpen}
        onSave={handleSaveSettingsCenter}
        onBrowseWorkDir={(defaultPath) => selectFolder(defaultPath || configDir)}
        onBrowseOutputDir={(defaultPath) => selectFolder(defaultPath || outputDir || workDir || configDir)}
        onOpenRecognitionRules={() => setRecognitionRulesOpen(true)}
        onOpenSpecialItems={() => setSpecialItemsOpen(true)}
        onReplaceTemplate={handleReplaceTemplate}
        onResetTemplate={handleResetTemplate}
        onViewTemplatePaths={handleViewTemplatePaths}
        onRefreshTemplate={handleRefreshTemplateInfo}
        onOpenPersonalCleaner={() => {
          if (isAdminAccount) setPersonalCleanerOpen(true);
        }}
        onSwitchAccount={onSwitchAccount}
        onDisplayNameModeChange={handleDisplayNameModeChange}
        onOpenDetailedLogs={() => setLogDialogOpen(true)}
        onRefreshDataStore={refreshDataStoreInfo}
        onOpenDataRoot={() => {
          if (dataStoreInfo?.dataRoot) openFolder(dataStoreInfo.dataRoot);
        }}
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
        items={specialItems}
        onClose={() => setSpecialItemsOpen(false)}
        onSave={handleSaveSpecialItems}
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
      />
      <RecognitionRulesDialog
        open={recognitionRulesOpen}
        rules={recognitionRules}
        path={recognitionRulesPath}
        exists={recognitionRulesExists}
        onOpenChange={setRecognitionRulesOpen}
        onReload={() => {
          refreshRecognitionRules()
            .then((info) => addLog(`识别补充规则已重新读取: ${info.path}`))
            .catch((e) => addLog(`识别补充规则读取失败: ${e}`));
        }}
        onSave={(rules) => {
          saveRecognitionRules(rules)
            .then((info) => {
              setRecognitionRules(info.rules || emptyRecognitionRules());
              setRecognitionRulesPath(info.path);
              setRecognitionRulesExists(info.exists);
              addLog(`识别补充规则已保存: ${info.path}`);
            })
            .catch((e) => addLog(`识别补充规则保存失败: ${e}`));
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
          globalEnableHand={enableHand}
          globalEnableOther={enableOther}
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
