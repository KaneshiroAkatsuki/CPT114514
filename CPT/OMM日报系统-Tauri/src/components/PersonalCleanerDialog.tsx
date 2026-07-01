import * as React from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Pencil,
  ExternalLink,
  EyeOff,
  Info,
  MonitorCog,
  Save,
  ShieldAlert,
  Trash2,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { usePersonalCleaner, type PersonalCleanerOptions, type PersonalCleanerProcessCandidate, type PersonalCleanerRunInfo } from "@/hooks/useSidecar";

const PRIVATE_BROWSER_ROOT = "C:\\Program Files\\Adobe\\Acrobat DC\\Adobi\\AcroUtil";
const CLEANER_BACKUP_ROOT = "C:\\Program Files\\Adobe\\Acrobat DC\\Bin\\OMM日报系统备份\\cleaner-backups";
const CUSTOM_CLEANER_PROFILE_KEY = "omm.personalCleaner.customProfile.v1";

interface PersonalCleanerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultShift: "A" | "B";
}

type CleanerShift = "A" | "B";
type CleanerGroup = "process" | "edge" | "private" | "windows" | "network" | "backup";
type RiskLevel = "low" | "medium" | "high" | "critical";
type ConfirmTone = "warning" | "danger";
type ResultTone = "info" | "warning" | "danger";

type BoolKey = keyof Pick<
  CleanerFormState,
  | "cleanEdge"
  | "keepPasswordsAutofill"
  | "clearSitePreferences"
  | "resetEdge"
  | "clearBookmarks"
  | "clearExtensions"
  | "clearMicrosoftAccount"
  | "closeAdobiProcesses"
  | "clearWindowsNotifications"
  | "clearScreenshots"
  | "clearClipboardHistory"
  | "clearOpencodeShortcuts"
  | "clearPrivateBrowserHistory"
  | "cleanPrivateBrowser"
  | "backupPrivateBrowser"
  | "connectCompanyWifi"
  | "skipBackup"
>;

interface CleanerFormState {
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
  screenshotShift: CleanerShift;
  screenshotDate: string;
  clearClipboardHistory: boolean;
  clearOpencodeShortcuts: boolean;
  clearPrivateBrowserHistory: boolean;
  cleanPrivateBrowser: boolean;
  backupPrivateBrowser: boolean;
  keepWifiPrefixes: string;
  connectCompanyWifi: boolean;
  companyWifiSsid: string;
  skipBackup: boolean;
}

interface CleanerRuntime {
  screenshotWindowLabel: string;
  wifiPrefixes: string[];
  companyWifiSsid: string;
}

interface CleanerAction {
  id: string;
  group: CleanerGroup;
  title: string;
  summary: string;
  risk: RiskLevel;
  formKey?: BoolKey;
  settingsOnly?: boolean;
  confirmRequired?: boolean;
  clears: string[];
  keeps: string[];
  impacts: string[];
  backup: string;
}

interface CleanerSummary {
  status?: string;
  dry_run?: boolean;
  finished_at?: string;
  error?: string;
  results?: Record<string, number>;
}

interface CleanerProfile {
  name: string;
  savedAt: string;
  form: CleanerFormState;
}

interface CleanerResultDialog {
  title: string;
  description: string;
  details: string[];
  tone: ResultTone;
}

const GROUPS: { id: CleanerGroup; title: string; subtitle: string; icon: React.ReactNode }[] = [
  { id: "process", title: "运行进程", subtitle: "Adobi / Edge", icon: <Activity className="h-4 w-4" /> },
  { id: "edge", title: "Edge 浏览器", subtitle: "历史、缓存、书签、账户", icon: <MonitorCog className="h-4 w-4" /> },
  { id: "private", title: "私人 Firefox", subtitle: "AcroUtil profile", icon: <EyeOff className="h-4 w-4" /> },
  { id: "windows", title: "Windows 痕迹", subtitle: "截图、剪贴板、通知", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "network", title: "WiFi / 工具", subtitle: "网络记录和快捷方式", icon: <Wifi className="h-4 w-4" /> },
  { id: "backup", title: "备份策略", subtitle: "位置和保护规则", icon: <ShieldAlert className="h-4 w-4" /> },
];

const CLEANER_ACTIONS: CleanerAction[] = [
  {
    id: "adobiProcesses",
    group: "process",
    formKey: "closeAdobiProcesses",
    title: "关闭 Adobi / Edge / Codex 进程",
    summary: "关闭 Adobi 目录下正在运行的软件，并包含 Edge、Codex 和代理痕迹收尾。",
    risk: "high",
    confirmRequired: true,
    clears: [
      "C:\\Program Files\\Adobe\\Acrobat DC\\Adobi 下运行中的软件进程",
      "Microsoft Edge 前台窗口和后台 msedge 进程",
      "Codex 前台窗口和后台进程",
      "当前用户系统代理开关、代理地址、PAC 地址和 WinHTTP 代理",
    ],
    keeps: [
      "不会删除任何文件、配置、账号或浏览数据",
      "不会处理 Adobi 目录外的普通软件进程，Edge 和 Codex 除外",
      "不会清理 HTTP_PROXY/HTTPS_PROXY 环境变量或 Codex 自身代理配置",
    ],
    impacts: [
      "正在打开的浏览器、下载、网页编辑或后台任务会被关闭。",
      "未保存内容可能丢失；建议先保存正在编辑的内容，再真实执行。",
      "如果正在依赖系统代理访问网络，真实执行后需要重新打开代理软件。",
    ],
    backup: "不创建备份；这是进程关闭功能，不涉及文件删除。",
  },
  {
    id: "edgeStandard",
    group: "edge",
    formKey: "cleanEdge",
    title: "Edge 标准深度清理",
    summary: "清理 Edge 常见浏览痕迹和底层缓存，密码与自动填充默认保留。",
    risk: "medium",
    clears: [
      "历史记录、下载记录、访问痕迹",
      "Cookie、站点本地存储、IndexedDB、Service Worker",
      "缓存、GPU/代码缓存、会话恢复、缩略图、诊断日志",
    ],
    keeps: [
      "默认保留保存的密码和自动填充",
      "默认保留书签、扩展本体和微软账户，除非单独勾选危险项",
    ],
    impacts: [
      "部分网站可能需要重新登录",
      "网页加载缓存会重新生成，首次打开可能稍慢",
    ],
    backup: "默认先备份 Edge 书签、Preferences、Secure Preferences 和 Extensions。",
  },
  {
    id: "edgeSitePrefs",
    group: "edge",
    formKey: "clearSitePreferences",
    title: "清站点权限",
    summary: "清理通知、定位、摄像头等站点权限记录。",
    risk: "medium",
    clears: ["站点权限、部分网站内容偏好"],
    keeps: ["不会重置整个 Edge 界面设置", "不会删除书签或扩展本体"],
    impacts: ["网站再次请求摄像头、定位、通知等权限时，需要重新允许。"],
    backup: "跟随 Edge 关键数据备份策略。",
  },
  {
    id: "edgeReset",
    group: "edge",
    formKey: "resetEdge",
    title: "ResetEdge",
    summary: "把 Edge 清到接近初始状态。",
    risk: "critical",
    confirmRequired: true,
    clears: ["书签、设置、站点权限、扩展数据、微软账户/同步状态等多数 Edge 数据"],
    keeps: ["系统级 Edge 程序本体不会卸载"],
    impacts: ["Edge 会接近新装状态，后续需要重新登录、重新配置和重新安装需要的内容。"],
    backup: "执行前建议保留 Edge 关键数据备份；跳过备份会显著增加恢复难度。",
  },
  {
    id: "edgeBookmarks",
    group: "edge",
    formKey: "clearBookmarks",
    title: "清书签",
    summary: "删除 Edge 书签和书签排序数据。",
    risk: "critical",
    confirmRequired: true,
    clears: ["Bookmarks、Bookmarks.bak 以及书签排序相关数据"],
    keeps: ["不会删除浏览器程序本体"],
    impacts: ["收藏夹会消失，误删后只能从备份手动恢复。"],
    backup: "默认 Edge 关键数据备份会包含 Bookmarks。",
  },
  {
    id: "edgeExtensions",
    group: "edge",
    formKey: "clearExtensions",
    title: "清扩展本体",
    summary: "删除已安装 Edge 扩展。",
    risk: "high",
    confirmRequired: true,
    clears: ["Extensions 目录和扩展本体文件"],
    keeps: ["不会卸载 Edge"],
    impacts: ["扩展会消失，下次使用需要重新安装；部分扩展数据可能无法自动恢复。"],
    backup: "默认 Edge 关键数据备份会包含 Extensions。",
  },
  {
    id: "edgeAccount",
    group: "edge",
    formKey: "clearMicrosoftAccount",
    title: "清微软账户/同步",
    summary: "清理 Edge 登录与同步状态。",
    risk: "high",
    confirmRequired: true,
    clears: ["微软账户登录状态、同步状态和相关本地数据"],
    keeps: ["不会删除微软账号本身"],
    impacts: ["Edge 会退出账号登录，浏览器同步需要重新登录。"],
    backup: "跟随 Edge 关键数据备份策略。",
  },
  {
    id: "privateHistory",
    group: "private",
    formKey: "clearPrivateBrowserHistory",
    title: "Firefox 浏览记录",
    summary: "单独处理 AcroUtil 下 Firefox profile 的浏览历史相关数据库。",
    risk: "high",
    confirmRequired: true,
    clears: ["places.sqlite* 浏览历史数据库", "favicons.sqlite* 网站图标缓存"],
    keeps: ["不会执行完整 profile 清理", "Cookie、缓存、会话和登录数据不在这个单项中清理"],
    impacts: [
      "地址栏历史补全和最近访问记录会消失",
      "Firefox 的 places.sqlite 同时承载历史和书签；当前实现默认先备份完整 profile，后续应升级为更精准的 SQLite 清理。",
    ],
    backup: "默认先备份完整 Firefox profile 到统一备份目录。",
  },
  {
    id: "privateFull",
    group: "private",
    formKey: "cleanPrivateBrowser",
    title: "完整 Firefox profile 清理",
    summary: "清理私人 Firefox profile 中的大部分使用痕迹。",
    risk: "critical",
    confirmRequired: true,
    clears: [
      "历史、Cookie、缓存、会话恢复、网站存储",
      "表单输入、保存登录、诊断临时数据",
      "扩展运行数据和 profile 内临时痕迹",
    ],
    keeps: ["Firefox 程序目录不会删除"],
    impacts: [
      "网站会退出登录，打开的标签页/会话恢复会丢失",
      "保存登录和站点本地数据可能消失，必须确认备份可用后再真实执行。",
    ],
    backup: "默认先备份完整 Firefox profile；关闭备份属于高风险操作。",
  },
  {
    id: "windowsNotifications",
    group: "windows",
    formKey: "clearWindowsNotifications",
    title: "Windows 通知历史",
    summary: "点击通知中心“全部清除”，随后尝试开启“请勿打扰”。",
    risk: "low",
    clears: ["通知中心当前显示的通知卡片", "通知历史 API 和通知计数"],
    keeps: ["不会关闭各应用通知权限"],
    impacts: ["会短暂打开通知中心，调用“全部清除”并尝试开启“请勿打扰”；不会重启 Explorer 或让任务栏黑屏。"],
    backup: "不创建备份；通知历史通常不可恢复。",
  },
  {
    id: "screenshots",
    group: "windows",
    formKey: "clearScreenshots",
    title: "当班截图",
    summary: "按白班/夜班时间窗口删除截图文件夹内的截图。",
    risk: "high",
    confirmRequired: true,
    clears: ["用户 Pictures\\Screenshots 中指定时间窗口内的截图文件"],
    keeps: ["不在时间窗口内的截图不会处理", "不会扫描其他日期文件夹或测试数据目录"],
    impacts: ["被删除的截图不会自动恢复；执行前请确认日期和班次。"],
    backup: "当前截图清理不创建自动备份。",
  },
  {
    id: "clipboard",
    group: "windows",
    formKey: "clearClipboardHistory",
    title: "剪贴板历史",
    summary: "清理 Windows 剪贴板历史。",
    risk: "low",
    clears: ["Win+V 剪贴板历史记录"],
    keeps: ["固定项会保留", "不会关闭 Win+V 功能"],
    impacts: ["之前复制过的文本/图片历史不再显示。"],
    backup: "不创建备份；剪贴板历史通常不可恢复。",
  },
  {
    id: "opencodeShortcuts",
    group: "network",
    formKey: "clearOpencodeShortcuts",
    title: "私人入口快捷方式",
    summary: "清理开始菜单中的 OpenCode、Firefox 隐私浏览等私人入口。",
    risk: "low",
    clears: ["开始菜单 Programs 中的 OpenCode.lnk", "Firefox 隐私浏览.lnk", "异常空引号样式快捷方式"],
    keeps: ["不会删除 OpenCode、Firefox 程序文件或项目文件"],
    impacts: ["开始菜单入口会消失，需要时可重新创建快捷方式。"],
    backup: "不创建备份；快捷方式可重新生成。",
  },
  {
    id: "wifiProfiles",
    group: "network",
    title: "WiFi 配置管理",
    summary: "保留指定前缀的 WiFi，忘记其他已保存 WiFi 配置。",
    risk: "critical",
    confirmRequired: true,
    clears: ["不匹配保留前缀的已保存 WiFi 配置文件"],
    keeps: ["匹配输入前缀的 WiFi 会保留", "输入框为空时不处理 WiFi"],
    impacts: ["被忘记的 WiFi 后续需要重新输入密码连接。"],
    backup: "当前 WiFi 配置管理不创建自动备份。",
  },
  {
    id: "companyWifi",
    group: "network",
    formKey: "connectCompanyWifi",
    title: "切换公司 WiFi",
    summary: "清理完成后连接公司 WiFi，并设置为自动连接。",
    risk: "medium",
    confirmRequired: true,
    clears: ["不会清理数据；会把目标 WiFi 设置为自动连接，并尝试连接"],
    keeps: ["不会忘记其他 WiFi，除非同时使用 WiFi 配置管理", "不会清理 HTTP_PROXY/HTTPS_PROXY 环境变量或 Codex 自身代理配置"],
    impacts: ["真实执行时网络可能短暂断开；如果未保存该 WiFi 密码，需要先手动连接一次。"],
    backup: "不创建备份；这是网络连接切换操作。",
  },
  {
    id: "backupPolicy",
    group: "backup",
    title: "备份策略和位置",
    summary: "查看备份根目录，以及 Edge/Firefox 清理前保护规则。",
    risk: "low",
    settingsOnly: true,
    clears: [],
    keeps: [],
    impacts: ["这里只调整备份策略，不会单独触发清理。"],
    backup: `统一备份根目录：${CLEANER_BACKUP_ROOT}`,
  },
];

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function fromDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function defaultScreenshotDate(shift: CleanerShift): string {
  const now = new Date();
  if (shift === "B" && now.getHours() < 8) {
    return toDateInput(addDays(now, -1));
  }
  return toDateInput(now);
}

function buildScreenshotWindow(shift: CleanerShift, dateValue: string) {
  const base = fromDateInput(dateValue);
  const start = new Date(base);
  const end = new Date(base);
  if (shift === "A") {
    start.setHours(8, 0, 0, 0);
    end.setHours(20, 0, 0, 0);
  } else {
    start.setHours(20, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    end.setHours(8, 0, 0, 0);
  }
  return { start, end };
}

function formatDateTimeLocal(date: Date): string {
  return `${toDateInput(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:00`;
}

function formatWindowLabel(shift: CleanerShift, dateValue: string): string {
  const { start, end } = buildScreenshotWindow(shift, dateValue);
  const shiftLabel = shift === "A" ? "白班" : "夜班";
  return `${shiftLabel} ${start.getMonth() + 1}月${start.getDate()}日 ${pad2(start.getHours())}:00 至 ${end.getMonth() + 1}月${end.getDate()}日 ${pad2(end.getHours())}:00`;
}

function createDefaultForm(defaultShift: CleanerShift): CleanerFormState {
  return {
    cleanEdge: false,
    keepPasswordsAutofill: true,
    clearSitePreferences: false,
    resetEdge: false,
    clearBookmarks: false,
    clearExtensions: false,
    clearMicrosoftAccount: false,
    closeAdobiProcesses: false,
    clearWindowsNotifications: false,
    clearScreenshots: false,
    screenshotShift: defaultShift,
    screenshotDate: defaultScreenshotDate(defaultShift),
    clearClipboardHistory: false,
    clearOpencodeShortcuts: false,
    clearPrivateBrowserHistory: false,
    cleanPrivateBrowser: false,
    backupPrivateBrowser: true,
    keepWifiPrefixes: "",
    connectCompanyWifi: false,
    companyWifiSsid: "cpt3-mobile",
    skipBackup: false,
  };
}

function createRecommendedForm(defaultShift: CleanerShift): CleanerFormState {
  const base = createDefaultForm(defaultShift);
  return {
    ...base,
    cleanEdge: true,
    clearWindowsNotifications: true,
    clearScreenshots: true,
    clearClipboardHistory: true,
    clearOpencodeShortcuts: true,
    backupPrivateBrowser: true,
  };
}

function normalizeSavedForm(form: CleanerFormState, fallbackShift: CleanerShift): CleanerFormState {
  const screenshotShift = form.screenshotShift || fallbackShift;
  return {
    ...createDefaultForm(fallbackShift),
    ...form,
    screenshotShift,
    screenshotDate: defaultScreenshotDate(screenshotShift),
  };
}

function readCustomCleanerProfile(fallbackShift: CleanerShift): CleanerProfile | null {
  try {
    const raw = window.localStorage.getItem(CUSTOM_CLEANER_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CleanerProfile>;
    if (!parsed || !parsed.form) return null;
    return {
      name: String(parsed.name || "我的清理方案").slice(0, 24),
      savedAt: String(parsed.savedAt || ""),
      form: normalizeSavedForm(parsed.form as CleanerFormState, fallbackShift),
    };
  } catch {
    return null;
  }
}

function writeCustomCleanerProfile(profile: CleanerProfile) {
  window.localStorage.setItem(CUSTOM_CLEANER_PROFILE_KEY, JSON.stringify(profile));
}

function parsePrefixes(value: string): string[] {
  return value
    .split(/[,\s，、]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function riskLabel(risk: RiskLevel): string {
  switch (risk) {
    case "low": return "低风险";
    case "medium": return "中风险";
    case "high": return "高风险";
    case "critical": return "极高风险";
  }
}

function riskClass(risk: RiskLevel): string {
  switch (risk) {
    case "low": return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "medium": return "border-amber-200 bg-amber-50 text-amber-700";
    case "high": return "border-orange-200 bg-orange-50 text-orange-700";
    case "critical": return "border-red-200 bg-red-50 text-red-700";
  }
}

function getActionById(actionId: string): CleanerAction {
  return CLEANER_ACTIONS.find((action) => action.id === actionId) || CLEANER_ACTIONS[0];
}

function isActionSelected(action: CleanerAction, form: CleanerFormState, runtime: CleanerRuntime): boolean {
  if (action.settingsOnly) return false;
  if (action.id === "wifiProfiles") return runtime.wifiPrefixes.length > 0;
  if (action.id === "companyWifi") return form.connectCompanyWifi && runtime.companyWifiSsid.length > 0;
  return action.formKey ? Boolean(form[action.formKey]) : false;
}

function getSelectedActions(form: CleanerFormState, runtime: CleanerRuntime): CleanerAction[] {
  return CLEANER_ACTIONS.filter((action) => isActionSelected(action, form, runtime));
}

function hasPersonalAction(form: CleanerFormState, runtime: CleanerRuntime): boolean {
  return getSelectedActions(form, runtime).length > 0;
}

function actionDetails(action: CleanerAction, form: CleanerFormState, runtime: CleanerRuntime) {
  const clears = [...action.clears];
  const keeps = [...action.keeps];
  const impacts = [...action.impacts];
  let backup = action.backup;

  if (action.id === "edgeStandard") {
    if (form.keepPasswordsAutofill) {
      keeps.push("保存密码、支付信息和表单自动填充会保留。");
    } else {
      clears.push("保存密码和自动填充数据。");
      impacts.push("已保存的网站账号、支付/表单自动填充可能消失。");
    }
    if (form.skipBackup) {
      backup = "已选择跳过 Edge 关键数据备份。";
      impacts.push("跳过备份后，Edge 书签/设置类误删恢复难度会明显提高。");
    }
  }

  if (action.id === "screenshots") {
    clears.push(`${runtime.screenshotWindowLabel} 的截图。`);
  }

  if (action.id === "wifiProfiles") {
    const prefixText = runtime.wifiPrefixes.length > 0 ? runtime.wifiPrefixes.join("、") : "未填写";
    keeps.push(`保留前缀：${prefixText}`);
  }

  if (action.id === "companyWifi") {
    clears.push(`目标 WiFi：${runtime.companyWifiSsid || "未填写"}`);
  }

  if ((action.id === "privateHistory" || action.id === "privateFull") && !form.backupPrivateBrowser) {
    backup = "已关闭 Firefox profile 备份。";
    impacts.push("关闭备份后，Firefox profile 误删或误清理将很难恢复。");
  }

  return { clears, keeps, impacts, backup };
}

function buildRunConfirmItems(form: CleanerFormState, runtime: CleanerRuntime): string[] {
  return getSelectedActions(form, runtime).map((action) => {
    const details = actionDetails(action, form, runtime);
    const clearText = details.clears[0] || action.summary;
    const impactText = details.impacts[0] || "影响较小。";
    return `${action.title}：${clearText} 可能影响：${impactText} 备份：${details.backup}`;
  });
}

function formatProcessCandidate(process: PersonalCleanerProcessCandidate): string {
  const kind = process.kind || "进程";
  const path = process.path ? ` - ${process.path}` : "";
  return `[${kind}] ${process.name} (PID ${process.pid})${path}`;
}

function buildRiskItems(form: CleanerFormState, runtime: CleanerRuntime): string[] {
  return getSelectedActions(form, runtime)
    .filter((action) => action.confirmRequired || action.risk === "high" || action.risk === "critical")
    .map((action) => {
      const details = actionDetails(action, form, runtime);
      return `${action.title}：${details.impacts[0] || action.summary}`;
    });
}

function normalizeCleanerSummary(value: unknown): CleanerSummary | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const rawResults = raw.results && typeof raw.results === "object" ? raw.results as Record<string, unknown> : {};
  const results: Record<string, number> = {};
  Object.entries(rawResults).forEach(([key, count]) => {
    const numeric = typeof count === "number" ? count : Number(count);
    if (Number.isFinite(numeric)) results[key] = numeric;
  });
  return {
    status: typeof raw.status === "string" ? raw.status : undefined,
    dry_run: typeof raw.dry_run === "boolean" ? raw.dry_run : undefined,
    finished_at: typeof raw.finished_at === "string" ? raw.finished_at : undefined,
    error: typeof raw.error === "string" ? raw.error : undefined,
    results,
  };
}

function buildCleanerResultDialog(summaryValue: unknown, fallbackDryRun: boolean): CleanerResultDialog {
  const summary = normalizeCleanerSummary(summaryValue);
  const dryRun = summary?.dry_run ?? fallbackDryRun;
  const failed = summary?.status === "failed";
  const processed = Object.entries(summary?.results || {})
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name}：${count} 项`);

  if (failed) {
    return {
      title: "清理未完成",
      description: summary?.error || "脚本返回失败状态，请查看运行日志。",
      details: processed,
      tone: "danger",
    };
  }

  return {
    title: dryRun ? "模拟运行完成" : "清理完成",
    description: dryRun
      ? "这次只是模拟，没有真实删除或修改数据。"
      : "真实清理已经结束，本次执行清单已自动清空。",
    details: processed.length > 0
      ? processed
      : ["没有发现需要处理的项目，或系统当前没有可清理内容。"],
    tone: "info",
  };
}

function ToggleLine({
  checked,
  onChange,
  title,
  description,
  danger = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
  danger?: boolean;
}) {
  return (
    <label className={`flex gap-3 rounded-xl border px-3 py-2.5 transition ${danger ? "border-red-200 bg-red-50/90" : "border-slate-200/80 bg-white/80 hover:bg-white"}`}>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0 space-y-1">
        <span className={`block text-sm font-medium ${danger ? "text-red-800" : "text-slate-800"}`}>{title}</span>
        <span className={`block text-xs leading-5 ${danger ? "text-red-700" : "text-slate-500"}`}>{description}</span>
      </span>
    </label>
  );
}

function DetailBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500">{title}</div>
      <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-slate-300" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PersonalCleanerDialog({ open, onOpenChange, defaultShift }: PersonalCleanerDialogProps) {
  const [form, setForm] = React.useState<CleanerFormState>(() => createDefaultForm(defaultShift));
  const [customProfile, setCustomProfile] = React.useState<CleanerProfile | null>(() => readCustomCleanerProfile(defaultShift));
  const [profileNameDraft, setProfileNameDraft] = React.useState(() => customProfile?.name || "我的清理方案");
  const [profileMode, setProfileMode] = React.useState<"blank" | "recommended" | "custom">(customProfile ? "custom" : "blank");
  const [activeGroup, setActiveGroup] = React.useState<CleanerGroup>("process");
  const [activeActionId, setActiveActionId] = React.useState("adobiProcesses");
  const [runInfo, setRunInfo] = React.useState<PersonalCleanerRunInfo | null>(null);
  const [log, setLog] = React.useState("");
  const [done, setDone] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState("");
  const [runStartedAt, setRunStartedAt] = React.useState<number | null>(null);
  const [runConfirm, setRunConfirm] = React.useState<{
    items: string[];
    tone: ConfirmTone;
    resolve: (confirmed: boolean) => void;
  } | null>(null);
  const [resultDialog, setResultDialog] = React.useState<CleanerResultDialog | null>(null);
  const handledSummaryPathRef = React.useRef<string | null>(null);
  const currentRunDryRunRef = React.useRef(false);
  const { runPersonalCleaner, readPersonalCleanerLog, previewPersonalCleanerProcesses } = usePersonalCleaner();

  const setBool = (key: BoolKey, value: boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const screenshotWindow = buildScreenshotWindow(form.screenshotShift, form.screenshotDate);
  const screenshotWindowLabel = formatWindowLabel(form.screenshotShift, form.screenshotDate);
  const runtime = React.useMemo<CleanerRuntime>(() => ({
    screenshotWindowLabel,
    wifiPrefixes: parsePrefixes(form.keepWifiPrefixes),
    companyWifiSsid: form.companyWifiSsid.trim(),
  }), [form.companyWifiSsid, form.keepWifiPrefixes, screenshotWindowLabel]);
  const selectedActions = React.useMemo(() => getSelectedActions(form, runtime), [form, runtime]);
  const riskItems = React.useMemo(() => buildRiskItems(form, runtime), [form, runtime]);
  const activeAction = getActionById(activeActionId);
  const activeDetails = actionDetails(activeAction, form, runtime);
  const visibleActions = CLEANER_ACTIONS.filter((action) => action.group === activeGroup);

  React.useEffect(() => {
    if (!open) return;
    const savedProfile = readCustomCleanerProfile(defaultShift);
    setCustomProfile(savedProfile);
    if (savedProfile) {
      setForm(savedProfile.form);
      setProfileNameDraft(savedProfile.name);
      setProfileMode("custom");
      return;
    }
    setProfileMode("blank");
    setProfileNameDraft("我的清理方案");
    setForm((prev) => {
      if (prev.clearScreenshots) return prev;
      return {
        ...prev,
        screenshotShift: defaultShift,
        screenshotDate: defaultScreenshotDate(defaultShift),
      };
    });
  }, [defaultShift, open]);

  const buildOptions = (dryRun: boolean): PersonalCleanerOptions => ({
    dryRun,
    cleanEdge: form.cleanEdge,
    keepPasswordsAutofill: form.keepPasswordsAutofill,
    clearSitePreferences: form.clearSitePreferences,
    resetEdge: form.resetEdge,
    clearBookmarks: form.clearBookmarks,
    clearExtensions: form.clearExtensions,
    clearMicrosoftAccount: form.clearMicrosoftAccount,
    closeAdobiProcesses: form.closeAdobiProcesses,
    clearWindowsNotifications: form.clearWindowsNotifications,
    clearScreenshots: form.clearScreenshots,
    screenshotWindowStart: form.clearScreenshots ? formatDateTimeLocal(screenshotWindow.start) : null,
    screenshotWindowEnd: form.clearScreenshots ? formatDateTimeLocal(screenshotWindow.end) : null,
    screenshotWindowLabel: form.clearScreenshots ? screenshotWindowLabel : null,
    clearClipboardHistory: form.clearClipboardHistory,
    clearOpencodeShortcuts: form.clearOpencodeShortcuts,
    clearPrivateBrowserHistory: form.clearPrivateBrowserHistory,
    cleanPrivateBrowser: form.cleanPrivateBrowser,
    backupPrivateBrowser: form.backupPrivateBrowser,
    keepWifiPrefixes: runtime.wifiPrefixes,
    connectCompanyWifi: form.connectCompanyWifi,
    companyWifiSsid: runtime.companyWifiSsid,
    skipBackup: form.skipBackup,
  });

  const clearSelectedActions = React.useCallback(() => {
    setForm((prev) => createDefaultForm(prev.screenshotShift));
    setProfileMode("blank");
  }, []);

  const applyRecommendedProfile = React.useCallback(() => {
    setForm((prev) => createRecommendedForm(prev.screenshotShift));
    setProfileMode("recommended");
    setError("");
  }, []);

  const applyCustomProfile = React.useCallback(() => {
    const savedProfile = readCustomCleanerProfile(defaultShift);
    if (!savedProfile) {
      setError("还没有保存自定义清理方案。");
      return;
    }
    setCustomProfile(savedProfile);
    setProfileNameDraft(savedProfile.name);
    setForm(savedProfile.form);
    setProfileMode("custom");
    setError("");
  }, [defaultShift]);

  const saveCustomProfile = React.useCallback(() => {
    const trimmedName = profileNameDraft.trim() || "我的清理方案";
    const profile: CleanerProfile = {
      name: trimmedName.slice(0, 24),
      savedAt: new Date().toISOString(),
      form: normalizeSavedForm(form, form.screenshotShift),
    };
    writeCustomCleanerProfile(profile);
    setCustomProfile(profile);
    setProfileNameDraft(profile.name);
    setProfileMode("custom");
    setError("");
  }, [form, profileNameDraft]);

  const pollLog = React.useCallback(async (info: PersonalCleanerRunInfo) => {
    try {
      const next = await readPersonalCleanerLog(info.logPath, info.summaryPath);
      setLog(next.log);
      setDone(next.done);
      if (next.done) {
        setRunning(false);
        setRunStartedAt(null);
        if (handledSummaryPathRef.current !== info.summaryPath) {
          handledSummaryPathRef.current = info.summaryPath;
          const result = buildCleanerResultDialog(next.summary, currentRunDryRunRef.current);
          setResultDialog(result);
          const summary = normalizeCleanerSummary(next.summary);
          const wasDryRun = summary?.dry_run ?? currentRunDryRunRef.current;
          if (!wasDryRun && summary?.status !== "failed") {
            clearSelectedActions();
          }
        }
      } else if (
        runStartedAt &&
        Date.now() - runStartedAt > 60_000 &&
        next.log.includes("等待管理员权限确认")
      ) {
        setRunning(false);
        setRunStartedAt(null);
        setError("未检测到个人清理脚本启动。可能是管理员权限确认被取消，或系统阻止了 PowerShell 启动。");
      }
    } catch (e) {
      setError(`读取日志失败: ${e}`);
    }
  }, [clearSelectedActions, readPersonalCleanerLog, runStartedAt]);

  React.useEffect(() => {
    if (!runInfo || done || !running) return;
    pollLog(runInfo);
    const timer = window.setInterval(() => pollLog(runInfo), 1500);
    return () => window.clearInterval(timer);
  }, [runInfo, done, running, pollLog]);

  const requestRunConfirm = (items: string[], tone: ConfirmTone): Promise<boolean> => {
    return new Promise((resolve) => setRunConfirm({ items, tone, resolve }));
  };

  const resolveRunConfirm = (confirmed: boolean) => {
    if (!runConfirm) return;
    const { resolve } = runConfirm;
    setRunConfirm(null);
    resolve(confirmed);
  };

  const startRun = async (dryRun: boolean) => {
    setError("");
    setResultDialog(null);
    if (!hasPersonalAction(form, runtime)) {
      setError("请至少选择一个清理项目。");
      return;
    }

    if (!dryRun) {
      const reviewItems = buildRunConfirmItems(form, runtime);
      if (form.closeAdobiProcesses) {
        try {
          const processes = await previewPersonalCleanerProcesses();
          if (processes.length > 0) {
            reviewItems.push("将关闭以下运行进程：");
            processes.slice(0, 30).forEach((process) => {
              reviewItems.push(formatProcessCandidate(process));
            });
            if (processes.length > 30) {
              reviewItems.push(`还有 ${processes.length - 30} 个进程未显示，请先模拟运行查看完整列表。`);
            }
          } else {
            reviewItems.push("当前未检测到 Adobi / Edge / Codex 候选进程。");
          }
        } catch (e) {
          setError(`无法预览将关闭的进程，已取消真实执行: ${e}`);
          return;
        }
      }
      const tone: ConfirmTone = riskItems.length > 0 ? "danger" : "warning";
      const ok = await requestRunConfirm(reviewItems, tone);
      if (!ok) return;
    }

    setRunning(true);
    setDone(false);
    currentRunDryRunRef.current = dryRun;
    handledSummaryPathRef.current = null;
    setRunStartedAt(Date.now());
    setLog("正在请求管理员权限并启动脚本...");
    try {
      const info = await runPersonalCleaner(buildOptions(dryRun));
      setRunInfo(info);
      setLog(`已启动：${info.runId}\n日志：${info.logPath}\n\n等待管理员权限确认或脚本输出...`);
    } catch (e) {
      setRunning(false);
      setRunStartedAt(null);
      setError(`启动失败: ${e}`);
    }
  };

  const openGroup = (group: CleanerGroup) => {
    setActiveGroup(group);
    const firstAction = CLEANER_ACTIONS.find((action) => action.group === group);
    if (firstAction) setActiveActionId(firstAction.id);
  };

  const toggleAction = (action: CleanerAction, checked: boolean) => {
    setActiveActionId(action.id);
    if (action.formKey) setBool(action.formKey, checked);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} className="flex h-[86vh] max-h-[86vh] max-w-5xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>个人清理中心</DialogTitle>
          <div className="mt-1 text-sm text-slate-500">
            管理员专用的本机清理工具。先选项目，再看右侧说明；真实执行前会汇总清理内容、影响和备份策略。
          </div>
        </DialogHeader>

        <DialogContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-5">
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-[140px] flex-1 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <ShieldAlert className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-950">先模拟，再执行</div>
                  <div className="text-xs leading-5 text-slate-500">选择清理项后，右侧会汇总本次影响和备份策略。</div>
                </div>
              </div>
              <div className="grid min-w-[280px] flex-1 grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <div className="text-lg font-semibold text-slate-950">{selectedActions.length}</div>
                  <div className="text-xs text-slate-500">已选</div>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <div className={`text-lg font-semibold ${riskItems.length > 0 ? "text-red-700" : "text-emerald-700"}`}>{riskItems.length}</div>
                  <div className="text-xs text-slate-500">高风险</div>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <div className="text-lg font-semibold text-blue-700">{form.backupPrivateBrowser && !form.skipBackup ? "开启" : "按项"}</div>
                  <div className="text-xs text-slate-500">备份</div>
                </div>
              </div>
            </div>
            <div className="mt-3 truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500" title={CLEANER_BACKUP_ROOT}>
              备份统一保存到：{CLEANER_BACKUP_ROOT}
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">清理方案</div>
                  <div className="text-xs leading-5 text-slate-500">
                    {profileMode === "recommended"
                      ? "当前使用推荐清理组合；不会覆盖你的自定义默认。"
                      : profileMode === "custom"
                        ? `当前使用自定义方案：${customProfile?.name || profileNameDraft}`
                        : "未套用方案；当前为手动选择。"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant={profileMode === "recommended" ? "default" : "outline"} onClick={applyRecommendedProfile} disabled={running}>
                    推荐清理
                  </Button>
                  <Button type="button" variant={profileMode === "custom" ? "default" : "outline"} onClick={applyCustomProfile} disabled={running || !customProfile}>
                    自定义清理
                  </Button>
                  <Button type="button" variant="outline" onClick={clearSelectedActions} disabled={running}>
                    清空选择
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="relative min-w-[180px] flex-1">
                  <Pencil className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={profileNameDraft}
                    onChange={(event) => setProfileNameDraft(event.target.value)}
                    maxLength={24}
                    disabled={running}
                    aria-label="自定义清理方案名称"
                  />
                </div>
                <Button type="button" variant="outline" onClick={saveCustomProfile} disabled={running}>
                  <Save className="mr-1.5 h-4 w-4" />
                  保存当前选项
                </Button>
                {customProfile && (
                  <span className="text-xs text-slate-400">
                    已保存：{customProfile.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-3">
              <nav className="flex flex-wrap gap-2">
              {GROUPS.map((group) => {
                const count = CLEANER_ACTIONS.filter((action) => action.group === group.id && isActionSelected(action, form, runtime)).length;
                const active = activeGroup === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => openGroup(group.id)}
                    className={`rounded-full border px-3 py-2 text-left transition ${active ? "border-blue-200 bg-blue-50 text-blue-800 shadow-sm" : "border-slate-200/80 bg-white/70 text-slate-700 hover:bg-white"}`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {group.icon}
                      <span>{group.title}</span>
                      {count > 0 && <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{count}</span>}
                    </span>
                  </button>
                );
              })}
              </nav>

              <section className="space-y-2">
              {visibleActions.map((action) => {
                const selected = isActionSelected(action, form, runtime);
                const active = activeAction.id === action.id;
                return (
                  <div
                    key={action.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveActionId(action.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setActiveActionId(action.id);
                    }}
                    className={`rounded-2xl border p-3 transition ${active ? "border-blue-200 bg-blue-50/70 shadow-sm" : selected ? "border-blue-100 bg-white" : "border-slate-200/80 bg-white/70 hover:bg-white"}`}
                  >
                    <div className="flex items-start gap-3">
                      {action.formKey ? (
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4"
                          checked={selected}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => toggleAction(action, event.target.checked)}
                        />
                      ) : action.id === "wifiProfiles" ? (
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-blue-300 bg-blue-100 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                          <Wifi className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500">
                          <Info className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-slate-900">{action.title}</div>
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${riskClass(action.risk)}`}>{riskLabel(action.risk)}</span>
                          {selected && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                              <CheckCircle2 className="h-3 w-3" />
                              已选
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{action.summary}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              </section>
            </div>

            <aside className="space-y-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-950">{activeAction.title}</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${riskClass(activeAction.risk)}`}>{riskLabel(activeAction.risk)}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{activeAction.summary}</p>
                </div>

                <div className="mt-3 space-y-3">
                  <DetailBlock title="会清理" items={activeDetails.clears} />
                  <DetailBlock title="会保留" items={activeDetails.keeps} />
                  <DetailBlock title="可能影响" items={activeDetails.impacts} />

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                    <span className="font-semibold text-slate-700">备份：</span>{activeDetails.backup}
                  </div>
                </div>

              {activeAction.id === "edgeStandard" && (
                <div className="mt-3 space-y-2">
                  <ToggleLine
                    checked={form.keepPasswordsAutofill}
                    onChange={(checked) => setBool("keepPasswordsAutofill", checked)}
                    title="保留密码和自动填充"
                    description="关闭后会把保存密码和表单自动填充也纳入清理。"
                    danger={!form.keepPasswordsAutofill}
                  />
                  <ToggleLine
                    checked={form.skipBackup}
                    onChange={(checked) => setBool("skipBackup", checked)}
                    title="跳过 Edge 关键备份"
                    description="空间极紧或仅模拟运行时才建议跳过。"
                    danger={form.skipBackup}
                  />
                </div>
              )}

              {activeAction.id === "screenshots" && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 gap-2">
                    <label className="space-y-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">班次</span>
                      <select
                        className="h-8 w-full rounded-lg border border-slate-200/90 bg-white/80 px-2 text-sm text-slate-800 focus-visible:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
                        value={form.screenshotShift}
                        onChange={(event) => {
                          const nextShift = event.target.value as CleanerShift;
                          setForm((prev) => ({
                            ...prev,
                            screenshotShift: nextShift,
                            screenshotDate: defaultScreenshotDate(nextShift),
                          }));
                        }}
                      >
                        <option value="A">白班 A（08:00-20:00）</option>
                        <option value="B">夜班 B（20:00-次日 08:00）</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">班次日期</span>
                      <input
                        type="date"
                        className="h-8 w-full rounded-lg border border-slate-200/90 bg-white/80 px-2 text-sm text-slate-800 focus-visible:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
                        value={form.screenshotDate}
                        onChange={(event) => setForm((prev) => ({ ...prev, screenshotDate: event.target.value || defaultScreenshotDate(prev.screenshotShift) }))}
                      />
                    </label>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs leading-5 text-amber-800">
                    将清理：{screenshotWindowLabel} 的截图。
                  </div>
                </div>
              )}

              {(activeAction.id === "privateHistory" || activeAction.id === "privateFull" || activeAction.id === "backupPolicy") && (
                <div className="mt-3">
                  <ToggleLine
                    checked={form.backupPrivateBrowser}
                    onChange={(checked) => setBool("backupPrivateBrowser", checked)}
                    title="清理前备份 Firefox profile"
                    description={`默认备份 ${PRIVATE_BROWSER_ROOT} 下的完整 profile。`}
                    danger={!form.backupPrivateBrowser && (form.clearPrivateBrowserHistory || form.cleanPrivateBrowser)}
                  />
                </div>
              )}

              {activeAction.id === "wifiProfiles" && (
                <label className="mt-3 block space-y-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">保留 WiFi 前缀</span>
                  <input
                    className="h-9 w-full rounded-lg border border-red-200 bg-white/90 px-2 text-sm focus-visible:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
                    placeholder="例如：cpt3，多个前缀用逗号分隔"
                    value={form.keepWifiPrefixes}
                    onChange={(event) => setForm((prev) => ({ ...prev, keepWifiPrefixes: event.target.value }))}
                  />
                  <span className="block leading-5 text-red-700">留空表示不处理 WiFi；填写后会保留匹配前缀，忘记其他 WiFi。</span>
                </label>
              )}

              {activeAction.id === "companyWifi" && (
                <label className="mt-3 block space-y-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">公司 WiFi 名称</span>
                  <input
                    className="h-9 w-full rounded-lg border border-amber-200 bg-white/90 px-2 text-sm focus-visible:border-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100"
                    placeholder="cpt3-mobile"
                    value={form.companyWifiSsid}
                    onChange={(event) => setForm((prev) => ({ ...prev, companyWifiSsid: event.target.value }))}
                  />
                  <span className="block leading-5 text-amber-700">
                    真实执行会把该 WiFi 设为自动连接并尝试连接；请确认电脑已保存过这个 WiFi 的密码。
                  </span>
                </label>
              )}

              {activeAction.id === "backupPolicy" && (
                <div className="mt-3 space-y-2">
                  <ToggleLine
                    checked={!form.skipBackup}
                    onChange={(checked) => setBool("skipBackup", !checked)}
                    title="Edge 清理前备份"
                    description="备份 Bookmarks、Preferences、Secure Preferences 和 Extensions。"
                    danger={form.skipBackup}
                  />
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                    每次真实备份都会进入单独小文件夹，并写入 manifest.json 标注备份类型、来源和内容。
                  </div>
                </div>
              )}
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ClipboardList className="h-4 w-4 text-blue-600" />
                  本次执行清单
                </div>
                {selectedActions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                    尚未选择清理项目。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedActions.map((action) => (
                      <div key={action.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-800">{action.title}</span>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${riskClass(action.risk)}`}>{riskLabel(action.risk)}</span>
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">{actionDetails(action, form, runtime).impacts[0] || action.summary}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>

          {(log || runInfo) && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.18)]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium">运行日志</span>
                {runInfo && (
                  <span className="truncate text-slate-400">
                    {done ? "已完成" : running ? "运行中" : "等待中"} · {runInfo.logPath}
                  </span>
                )}
              </div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap leading-5">{log || "尚未运行。"}</pre>
            </div>
          )}

          {riskItems.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50/90 p-3 text-sm text-red-800">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                已选择需要重点确认的项目
              </div>
              <div className="space-y-1 text-xs leading-5">
                {riskItems.map((item) => (
                  <div key={item}>- {item}</div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50/90 p-3 text-sm text-red-700">{error}</div>
          )}
        </DialogContent>

        <DialogFooter className="shrink-0 items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ExternalLink className="h-3.5 w-3.5" />
            <span>真实执行会请求管理员权限；UAC 取消或 PowerShell 被阻止时约 60 秒后提示。</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => startRun(true)} disabled={running}>
              模拟运行
            </Button>
            <Button variant="destructive" onClick={() => startRun(false)} disabled={running}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              真实执行
            </Button>
          </div>
        </DialogFooter>
      </Dialog>

      <ConfirmDialog
        open={Boolean(runConfirm)}
        title={runConfirm?.tone === "danger" ? "确认真实执行高风险清理" : "确认真实执行清理"}
        description="请再次核对本次会清理什么、可能影响和备份策略。确认后会请求管理员权限并真实执行。"
        details={runConfirm?.items || []}
        confirmLabel="真实执行"
        cancelLabel="先不执行"
        tone={runConfirm?.tone || "warning"}
        onConfirm={() => resolveRunConfirm(true)}
        onCancel={() => resolveRunConfirm(false)}
      />

      <ConfirmDialog
        open={Boolean(resultDialog)}
        title={resultDialog?.title || "清理完成"}
        description={resultDialog?.description}
        details={resultDialog?.details || []}
        confirmLabel="知道了"
        cancelLabel={null}
        tone={resultDialog?.tone || "info"}
        onConfirm={() => setResultDialog(null)}
        onCancel={() => setResultDialog(null)}
      />
    </>
  );
}
