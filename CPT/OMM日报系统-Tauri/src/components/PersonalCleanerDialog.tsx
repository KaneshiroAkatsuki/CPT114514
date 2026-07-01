import * as React from "react";
import { AlertTriangle, ClipboardList, ExternalLink, EyeOff, MonitorCog, ShieldAlert, Trash2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { usePersonalCleaner, type PersonalCleanerOptions, type PersonalCleanerRunInfo } from "@/hooks/useSidecar";

interface PersonalCleanerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultShift: "A" | "B";
}

type CleanerShift = "A" | "B";

type BoolKey = keyof Pick<
  CleanerFormState,
  | "cleanEdge"
  | "keepPasswordsAutofill"
  | "clearSitePreferences"
  | "resetEdge"
  | "clearBookmarks"
  | "clearExtensions"
  | "clearMicrosoftAccount"
  | "clearWindowsNotifications"
  | "clearScreenshots"
  | "clearClipboardHistory"
  | "clearOpencodeShortcuts"
  | "clearPrivateBrowserHistory"
  | "cleanPrivateBrowser"
  | "backupPrivateBrowser"
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
  skipBackup: boolean;
}

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
  skipBackup: false,
  };
}

function parsePrefixes(value: string): string[] {
  return value
    .split(/[,\s，、]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function hasPersonalAction(form: CleanerFormState): boolean {
  return (
    form.cleanEdge ||
    form.clearSitePreferences ||
    form.resetEdge ||
    form.clearBookmarks ||
    form.clearExtensions ||
    form.clearMicrosoftAccount ||
    form.clearWindowsNotifications ||
    form.clearScreenshots ||
    form.clearClipboardHistory ||
    form.clearOpencodeShortcuts ||
    form.clearPrivateBrowserHistory ||
    form.cleanPrivateBrowser ||
    parsePrefixes(form.keepWifiPrefixes).length > 0
  );
}

function buildDangerList(form: CleanerFormState): string[] {
  const dangers: string[] = [];
  if (form.resetEdge) dangers.push("ResetEdge 会重置 Edge 到接近初始状态");
  if (form.clearBookmarks) dangers.push("清书签会删除 Edge 书签");
  if (form.clearExtensions) dangers.push("清扩展本体会删除已安装扩展");
  if (form.clearMicrosoftAccount) dangers.push("清微软账户会退出 Edge 登录/同步状态");
  if (form.clearScreenshots) dangers.push(`截图清理会删除 ${formatWindowLabel(form.screenshotShift, form.screenshotDate)} 的截图`);
  if (form.clearPrivateBrowserHistory) dangers.push("火狐浏览记录清理会删除私人浏览器历史数据库，默认先备份 profile");
  if (form.cleanPrivateBrowser) dangers.push("完整私人浏览器清理会删除历史、Cookie、缓存、会话、表单和保存登录等 profile 数据");
  if (form.cleanPrivateBrowser && !form.backupPrivateBrowser) dangers.push("私人浏览器清理未启用备份");
  if (parsePrefixes(form.keepWifiPrefixes).length > 0) dangers.push("WiFi 管理会忘记不匹配保留前缀的 WiFi");
  return dangers;
}

function ToggleRow({
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
    <label className={`flex gap-3 rounded-xl border p-3 transition ${danger ? "border-red-200 bg-red-50/90" : "border-slate-200/80 bg-white/70 hover:bg-white"}`}>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="space-y-1">
        <span className={`block text-sm font-medium ${danger ? "text-red-800" : "text-slate-800"}`}>{title}</span>
        <span className={`block text-xs leading-5 ${danger ? "text-red-700" : "text-slate-500"}`}>{description}</span>
      </span>
    </label>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        {icon}
        <span>{title}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200/80 bg-white/70 p-2">{children}</div>
    </section>
  );
}

export function PersonalCleanerDialog({ open, onOpenChange, defaultShift }: PersonalCleanerDialogProps) {
  const [form, setForm] = React.useState<CleanerFormState>(() => createDefaultForm(defaultShift));
  const [runInfo, setRunInfo] = React.useState<PersonalCleanerRunInfo | null>(null);
  const [log, setLog] = React.useState("");
  const [done, setDone] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState("");
  const [runStartedAt, setRunStartedAt] = React.useState<number | null>(null);
  const [dangerConfirm, setDangerConfirm] = React.useState<{ items: string[]; resolve: (confirmed: boolean) => void } | null>(null);
  const { runPersonalCleaner, readPersonalCleanerLog } = usePersonalCleaner();

  const setBool = (key: BoolKey, value: boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const screenshotWindow = buildScreenshotWindow(form.screenshotShift, form.screenshotDate);
  const screenshotWindowLabel = formatWindowLabel(form.screenshotShift, form.screenshotDate);

  React.useEffect(() => {
    if (!open) return;
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
    keepWifiPrefixes: parsePrefixes(form.keepWifiPrefixes),
    skipBackup: form.skipBackup,
  });

  const pollLog = React.useCallback(async (info: PersonalCleanerRunInfo) => {
    try {
      const next = await readPersonalCleanerLog(info.logPath, info.summaryPath);
      setLog(next.log);
      setDone(next.done);
      if (next.done) {
        setRunning(false);
        setRunStartedAt(null);
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
  }, [readPersonalCleanerLog, runStartedAt]);

  React.useEffect(() => {
    if (!runInfo || done || !running) return;
    pollLog(runInfo);
    const timer = window.setInterval(() => pollLog(runInfo), 1500);
    return () => window.clearInterval(timer);
  }, [runInfo, done, running, pollLog]);

  const requestDangerConfirm = (items: string[]): Promise<boolean> => {
    return new Promise((resolve) => setDangerConfirm({ items, resolve }));
  };

  const resolveDangerConfirm = (confirmed: boolean) => {
    if (!dangerConfirm) return;
    const { resolve } = dangerConfirm;
    setDangerConfirm(null);
    resolve(confirmed);
  };

  const startRun = async (dryRun: boolean) => {
    setError("");
    if (!hasPersonalAction(form)) {
      setError("请至少选择一个清理模块。");
      return;
    }

    const dangerList = buildDangerList(form);
    if (!dryRun && dangerList.length > 0) {
      const ok = await requestDangerConfirm(dangerList);
      if (!ok) return;
    }

    setRunning(true);
    setDone(false);
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

  const dangers = buildDangerList(form);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>个人清理工具（本机维护）</DialogTitle>
        <div className="mt-1 text-sm text-slate-500">
          面向当前维护电脑的高级工具。执行会调用内置 EdgeCleaner 脚本，需要管理员权限；建议先模拟运行，再确认执行。
        </div>
      </DialogHeader>
      <DialogContent className="space-y-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              每个项目都可以单独勾选清理。涉及截图、火狐浏览记录、ResetEdge、书签、扩展、微软账户和 WiFi 的真实执行会二次确认；浏览器类项目默认先备份。
            </div>
          </div>
        </div>

        <Section icon={<MonitorCog className="h-4 w-4" />} title="Edge 清理">
          <ToggleRow
            checked={form.cleanEdge}
            onChange={(checked) => setBool("cleanEdge", checked)}
            title="Edge 标准深度清理"
            description="清理历史、Cookie、网站本地存储、缓存、会话、扩展运行缓存、缩略图、安全隐私状态和诊断临时数据；密码和自动填充默认保留。"
          />
          <ToggleRow
            checked={form.keepPasswordsAutofill}
            onChange={(checked) => setBool("keepPasswordsAutofill", checked)}
            title="保留密码和自动填充"
            description="标准深度清理时保留已保存密码、支付/表单自动填充数据。"
          />
          <ToggleRow
            checked={form.clearSitePreferences}
            onChange={(checked) => setBool("clearSitePreferences", checked)}
            title="清站点权限"
            description="清理通知、定位、摄像头等站点权限记录；不会重置整个 Edge 界面设置。"
          />
          <ToggleRow
            checked={form.skipBackup}
            onChange={(checked) => setBool("skipBackup", checked)}
            title="跳过 Edge 关键数据备份"
            description="默认会备份 Bookmarks、Preferences、Secure Preferences 和 Extensions；自动化或空间紧张时才建议跳过。"
            danger
          />
        </Section>

        <Section icon={<AlertTriangle className="h-4 w-4 text-red-600" />} title="危险 Edge 操作">
          <ToggleRow
            checked={form.resetEdge}
            onChange={(checked) => setBool("resetEdge", checked)}
            title="ResetEdge"
            description="清理到接近初始状态，会强制清理书签、设置、站点权限、微软账户等多数数据。"
            danger
          />
          <ToggleRow
            checked={form.clearBookmarks}
            onChange={(checked) => setBool("clearBookmarks", checked)}
            title="清书签"
            description="删除 Edge 书签和书签排序数据，误删后只能从备份手动恢复。"
            danger
          />
          <ToggleRow
            checked={form.clearExtensions}
            onChange={(checked) => setBool("clearExtensions", checked)}
            title="清扩展本体"
            description="删除已安装扩展，下次使用需要重新安装。"
            danger
          />
          <ToggleRow
            checked={form.clearMicrosoftAccount}
            onChange={(checked) => setBool("clearMicrosoftAccount", checked)}
            title="清微软账户/同步"
            description="删除账户与同步数据，会导致 Edge 退出微软账号登录状态。"
            danger
          />
        </Section>

        <Section icon={<ClipboardList className="h-4 w-4" />} title="Windows / 个人专项">
          <ToggleRow
            checked={form.clearWindowsNotifications}
            onChange={(checked) => setBool("clearWindowsNotifications", checked)}
            title="清 Windows 通知历史"
            description="清理通知中心数据库和通知计数，真实执行时会重启 Explorer/任务栏以刷新操作中心。"
          />
          <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3">
            <ToggleRow
              checked={form.clearScreenshots}
              onChange={(checked) => setBool("clearScreenshots", checked)}
              title="按当班时间清截图"
              description="只清理用户图片目录 Screenshots 中指定班次时间窗口内的截图。"
              danger={form.clearScreenshots}
            />
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr]">
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
            <div className={`mt-2 rounded-lg border px-3 py-2 text-xs leading-5 ${form.clearScreenshots ? "border-amber-200 bg-amber-50/90 text-amber-800" : "border-slate-200/80 bg-slate-50 text-slate-500"}`}>
              将清理：{screenshotWindowLabel} 的截图。
            </div>
          </div>
          <ToggleRow
            checked={form.clearClipboardHistory}
            onChange={(checked) => setBool("clearClipboardHistory", checked)}
            title="清剪贴板历史"
            description="清理 Windows 剪贴板历史记录，保留固定项，不关闭 Win+V 功能。"
          />
          <ToggleRow
            checked={form.clearOpencodeShortcuts}
            onChange={(checked) => setBool("clearOpencodeShortcuts", checked)}
            title="清 opencode 开始菜单快捷方式"
            description="删除开始菜单中名称包含 opencode/OpenCode 的快捷方式。"
          />
          <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3">
            <div className="flex items-start gap-2">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
              <div className="flex-1 space-y-2">
                <ToggleRow
                  checked={form.clearPrivateBrowserHistory}
                  onChange={(checked) => setBool("clearPrivateBrowserHistory", checked)}
                  title="仅清火狐浏览记录"
                  description="清理 C:\\Program Files\\Adobe\\Acrobat DC\\Adobi\\AcroUtil 下 Firefox profile 的历史数据库；默认先备份完整 profile。"
                  danger={form.clearPrivateBrowserHistory}
                />
                <ToggleRow
                  checked={form.cleanPrivateBrowser}
                  onChange={(checked) => setBool("cleanPrivateBrowser", checked)}
                  title="完整清理私人浏览器 profile"
                  description="清理本机私人浏览器 profile 中的历史、Cookie、缓存、会话、站点存储、表单、保存登录和诊断临时数据。"
                  danger={form.cleanPrivateBrowser}
                />
                <ToggleRow
                  checked={form.backupPrivateBrowser}
                  onChange={(checked) => setBool("backupPrivateBrowser", checked)}
                  title="清理前备份私人浏览器 profile"
                  description="真实执行前备份完整 profile，误删后可手动恢复；不勾选会直接清理。"
                  danger={!form.backupPrivateBrowser && form.cleanPrivateBrowser}
                />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/90 p-3">
            <div className="flex items-start gap-2">
              <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
              <div className="flex-1">
                <label className="text-sm font-medium text-red-800">WiFi 配置管理</label>
                <p className="mt-1 text-xs leading-5 text-red-700">
                  填写要保留的 WiFi 前缀，例如 cpt3。真实执行会忘记其他已保存 WiFi 配置；留空则不处理 WiFi。
                </p>
                <input
                  className="mt-2 h-8 w-full rounded-lg border border-red-200 bg-white/90 px-2 text-sm focus-visible:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
                  placeholder="例如：cpt3，多个前缀用逗号分隔"
                  value={form.keepWifiPrefixes}
                  onChange={(event) => setForm((prev) => ({ ...prev, keepWifiPrefixes: event.target.value }))}
                />
              </div>
            </div>
          </div>
        </Section>

        {dangers.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50/90 p-3 text-sm text-red-800">
            <div className="mb-1 font-medium">已选择危险项：</div>
            {dangers.map((item) => (
              <div key={item}>- {item}</div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.18)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-medium">运行日志</span>
            {runInfo && (
              <span className="truncate text-slate-400">
                {done ? "已完成" : running ? "运行中" : "等待中"} · {runInfo.logPath}
              </span>
            )}
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap leading-5">{log || "尚未运行。"}</pre>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50/90 p-3 text-sm text-red-700">{error}</div>
        )}
      </DialogContent>
      <DialogFooter className="items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ExternalLink className="h-3.5 w-3.5" />
          <span>管理员权限窗口可能会在系统层弹出，请确认 UAC 后查看日志。</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => startRun(true)} disabled={running}>
            模拟运行
          </Button>
          <Button variant="destructive" onClick={() => startRun(false)} disabled={running}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            确认执行
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
    <ConfirmDialog
      open={Boolean(dangerConfirm)}
      title="确认真实执行危险清理"
      description="以下项目属于危险操作。建议先模拟运行；确认后会请求管理员权限并真实执行。"
      details={dangerConfirm?.items || []}
      confirmLabel="真实执行"
      cancelLabel="先不执行"
      tone="danger"
      onConfirm={() => resolveDangerConfirm(true)}
      onCancel={() => resolveDangerConfirm(false)}
    />
    </>
  );
}
