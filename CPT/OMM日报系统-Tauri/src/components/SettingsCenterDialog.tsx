import * as React from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  FolderOpen,
  HelpCircle,
  Info,
  Package,
  RotateCcw,
  Save,
  Settings2,
  SlidersHorizontal,
  UserRound,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DataStoreInfo, DisplayNameMode, PublicAccount, TemplateInfo } from "@/types/record";

export interface SettingsCenterDraft {
  workDir: string;
  operatorName: string;
  leaveStrategy: "auto" | "early" | "normal";
  enableHand: boolean;
  enableOther: boolean;
  useSrcOutput: boolean;
  outputDir: string;
  shiftDefault: "A" | "B";
  tppMin: number;
  tppMax: number;
  pkgRest: number;
  handMax: number;
  otherMax: number;
  complexDefault: "A" | "B";
  configDir: string;
}

interface SettingsCenterDialogProps {
  open: boolean;
  value: SettingsCenterDraft;
  configSource: string;
  configPath: string;
  configDuplicates: string[];
  recognitionRulesPath: string;
  recognitionRulesExists: boolean;
  templateInfo: TemplateInfo | null;
  currentAccount: PublicAccount;
  canUsePersonalCleaner: boolean;
  logCount: number;
  dataStoreInfo: DataStoreInfo | null;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: SettingsCenterDraft) => Promise<void>;
  onBrowseWorkDir: (defaultPath: string) => Promise<string | null>;
  onBrowseOutputDir: (defaultPath: string) => Promise<string | null>;
  onOpenRecognitionRules: () => void;
  onOpenSpecialItems: () => void;
  onReplaceTemplate: () => void;
  onResetTemplate: () => void;
  onViewTemplatePaths: () => void;
  onRefreshTemplate: () => void;
  onOpenPersonalCleaner: () => void;
  onSwitchAccount: () => void;
  onDisplayNameModeChange: (mode: DisplayNameMode) => Promise<void>;
  onOpenDetailedLogs: () => void;
  onRefreshDataStore: () => Promise<DataStoreInfo | null>;
  onOpenDataRoot: () => void;
  onOpenHelp: (section: string) => void;
}

const APP_VERSION = "5.4.1";

type SettingsTab = "basic" | "generation" | "paths" | "assets" | "tools" | "about";

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode; description: string }[] = [
  { id: "basic", label: "基础", icon: <UserRound className="h-4 w-4" />, description: "使用者、班次和审核模式" },
  { id: "generation", label: "生成规则", icon: <SlidersHorizontal className="h-4 w-4" />, description: "下班策略、每件时间和补时长" },
  { id: "paths", label: "路径与配置", icon: <FolderOpen className="h-4 w-4" />, description: "工作目录、输出目录、配置文件" },
  { id: "assets", label: "模板规则", icon: <FileSpreadsheet className="h-4 w-4" />, description: "报表模板、特殊大件、识别补充" },
  { id: "tools", label: "工具", icon: <Wrench className="h-4 w-4" />, description: "个人清理和帮助入口" },
  { id: "about", label: "关于软件", icon: <Info className="h-4 w-4" />, description: "版本、账户、配置和帮助" },
];

function normalizeDraft(draft: SettingsCenterDraft): SettingsCenterDraft {
  return {
    ...draft,
    workDir: draft.workDir.trim(),
    operatorName: draft.operatorName.trim(),
    outputDir: draft.outputDir.trim(),
    configDir: draft.configDir.trim(),
    tppMin: Number(draft.tppMin),
    tppMax: Number(draft.tppMax),
    pkgRest: Number(draft.pkgRest),
    handMax: Number(draft.handMax),
    otherMax: Number(draft.otherMax),
  };
}

function serializeDraft(draft: SettingsCenterDraft): string {
  return JSON.stringify(normalizeDraft(draft));
}

function boolText(value: boolean): string {
  return value ? "开启" : "关闭";
}

function leaveStrategyText(value: SettingsCenterDraft["leaveStrategy"]): string {
  if (value === "early") return "下早班";
  if (value === "normal") return "不下早班";
  return "智能判断";
}

function reviewModeText(value: SettingsCenterDraft["complexDefault"]): string {
  return value === "A" ? "方案 A：弹窗审核" : "方案 B：留坑自填";
}

function outputModeText(draft: SettingsCenterDraft): string {
  return draft.useSrcOutput ? "输出到源日期文件夹" : (draft.outputDir || "统一输出目录未设置");
}

function configSourceLabel(source: string): { text: string; color: string } {
  switch (source) {
    case "portable": return { text: "便携版 config.json", color: "text-green-700 bg-green-50 border-green-200" };
    case "profile": return { text: "账户 profile", color: "text-indigo-700 bg-indigo-50 border-indigo-200" };
    case "appdata": return { text: "系统 AppData", color: "text-blue-700 bg-blue-50 border-blue-200" };
    case "custom": return { text: "自定义位置", color: "text-purple-700 bg-purple-50 border-purple-200" };
    case "legacy": return { text: "旧版 exe 目录（已迁移）", color: "text-amber-700 bg-amber-50 border-amber-200" };
    default: return { text: "默认位置", color: "text-slate-600 bg-slate-100 border-slate-200" };
  }
}

function templateSourceLabel(source: string | null): string {
  switch (source) {
    case "user": return "用户自定义";
    case "workdir": return "工作目录";
    case "bundled": return "内置模板";
    default: return "未知";
  }
}

function validateDraft(draft: SettingsCenterDraft): string | null {
  const normalized = normalizeDraft(draft);
  if (!normalized.operatorName) return "使用者姓名不能为空。";
  if (!Number.isFinite(normalized.tppMin) || normalized.tppMin <= 0) return "每件时间最小值必须是大于 0 的数字。";
  if (!Number.isFinite(normalized.tppMax) || normalized.tppMax <= 0) return "每件时间最大值必须是大于 0 的数字。";
  if (normalized.tppMin > normalized.tppMax) return `每件时间最小值（${normalized.tppMin}）不能大于最大值（${normalized.tppMax}）。`;
  if (!Number.isFinite(normalized.pkgRest) || normalized.pkgRest < 0) return "包间休息补时必须是非负数字。";
  if (!Number.isFinite(normalized.handMax) || normalized.handMax <= 0) return "手量上限必须是大于 0 的数字。";
  if (!Number.isFinite(normalized.otherMax) || normalized.otherMax <= 0) return "其他事务上限必须是大于 0 的数字。";
  if (!normalized.useSrcOutput && !normalized.outputDir) return "未启用“输出到源日期文件夹”时，必须指定统一输出目录。";
  return null;
}

function buildChangeSummary(initial: SettingsCenterDraft, draft: SettingsCenterDraft): string[] {
  const before = normalizeDraft(initial);
  const after = normalizeDraft(draft);
  const items: { changed: boolean; label: string; before: string; after: string }[] = [
    { changed: before.workDir !== after.workDir, label: "工作目录", before: before.workDir || "未设置", after: after.workDir || "未设置" },
    { changed: before.operatorName !== after.operatorName, label: "使用者姓名", before: before.operatorName || "未设置", after: after.operatorName || "未设置" },
    { changed: before.leaveStrategy !== after.leaveStrategy, label: "下班策略", before: leaveStrategyText(before.leaveStrategy), after: leaveStrategyText(after.leaveStrategy) },
    { changed: before.shiftDefault !== after.shiftDefault, label: "默认班次", before: before.shiftDefault, after: after.shiftDefault },
    { changed: before.complexDefault !== after.complexDefault, label: "审核模式", before: reviewModeText(before.complexDefault), after: reviewModeText(after.complexDefault) },
    { changed: before.tppMin !== after.tppMin || before.tppMax !== after.tppMax, label: "每件时间", before: `${before.tppMin}~${before.tppMax} 分钟`, after: `${after.tppMin}~${after.tppMax} 分钟` },
    { changed: before.pkgRest !== after.pkgRest, label: "包间休息补时", before: `${before.pkgRest} 分钟`, after: `${after.pkgRest} 分钟` },
    { changed: before.enableHand !== after.enableHand, label: "补时间手量", before: boolText(before.enableHand), after: boolText(after.enableHand) },
    { changed: before.enableOther !== after.enableOther, label: "其他事务", before: boolText(before.enableOther), after: boolText(after.enableOther) },
    { changed: before.handMax !== after.handMax, label: "手量上限", before: `${before.handMax} 分钟`, after: `${after.handMax} 分钟` },
    { changed: before.otherMax !== after.otherMax, label: "其他上限", before: `${before.otherMax} 分钟`, after: `${after.otherMax} 分钟` },
    { changed: before.useSrcOutput !== after.useSrcOutput || before.outputDir !== after.outputDir, label: "输出目录", before: outputModeText(before), after: outputModeText(after) },
    { changed: before.configDir !== after.configDir, label: "配置文件目录", before: before.configDir || "默认位置", after: after.configDir || "默认位置" },
  ];
  return items
    .filter((item) => item.changed)
    .map((item) => `${item.label}: ${item.before} -> ${item.after}`);
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-blue-600">{icon}</span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200/80 bg-white/75 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {children}
      </div>
    </section>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[112px_1fr] sm:items-start">
      <div className="pt-2">
        <div className="text-sm font-medium text-slate-700">{label}</div>
        {hint && <div className="mt-1 text-xs leading-5 text-slate-500">{hint}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; tone?: "default" | "warning" }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "default" : "outline"}
          onClick={() => onChange(option.value)}
          className={value === option.value && option.tone === "warning" ? "bg-amber-500 hover:bg-amber-600" : ""}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function ToggleRow({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 transition hover:bg-white">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600"
      />
    </label>
  );
}

function NumberInput({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={Number.isFinite(value) ? value : ""}
      onChange={(event) => onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))}
      className="h-9 w-24 rounded-lg border border-slate-200/90 bg-white/80 px-2 py-1 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-visible:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
    />
  );
}

export function SettingsCenterDialog({
  open,
  value,
  configSource,
  configPath,
  configDuplicates,
  recognitionRulesPath,
  recognitionRulesExists,
  templateInfo,
  currentAccount,
  canUsePersonalCleaner,
  logCount,
  dataStoreInfo,
  onOpenChange,
  onSave,
  onBrowseWorkDir,
  onBrowseOutputDir,
  onOpenRecognitionRules,
  onOpenSpecialItems,
  onReplaceTemplate,
  onResetTemplate,
  onViewTemplatePaths,
  onRefreshTemplate,
  onOpenPersonalCleaner,
  onSwitchAccount,
  onDisplayNameModeChange,
  onOpenDetailedLogs,
  onRefreshDataStore,
  onOpenDataRoot,
  onOpenHelp,
}: SettingsCenterDialogProps) {
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("basic");
  const [draft, setDraft] = React.useState<SettingsCenterDraft>(value);
  const [initialDraft, setInitialDraft] = React.useState<SettingsCenterDraft>(value);
  const [confirmExit, setConfirmExit] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [accountSaving, setAccountSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDraft(value);
    setInitialDraft(value);
    setActiveTab("basic");
    setConfirmExit(false);
    setError("");
    setSaving(false);
  }, [open]);

  const normalizedDraft = normalizeDraft(draft);
  const dirty = serializeDraft(initialDraft) !== serializeDraft(draft);
  const changes = buildChangeSummary(initialDraft, draft);
  const sourceInfo = configSourceLabel(configSource);

  const updateDraft = (patch: Partial<SettingsCenterDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setError("");
  };

  const requestClose = () => {
    if (saving) return;
    if (dirty) {
      setConfirmExit(true);
      return;
    }
    onOpenChange(false);
  };

  const saveDraft = async (closeAfterSave: boolean) => {
    const validation = validateDraft(draft);
    if (validation) {
      setError(validation);
      setConfirmExit(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const next = normalizeDraft(draft);
      await onSave(next);
      setInitialDraft(next);
      setDraft(next);
      setConfirmExit(false);
      if (closeAfterSave) onOpenChange(false);
    } catch (e) {
      setError(`设置保存失败: ${e}`);
      setConfirmExit(false);
    } finally {
      setSaving(false);
    }
  };

  const renderBasic = () => (
    <div className="space-y-5">
      <Section icon={<UserRound className="h-4 w-4" />} title="使用者" description="影响 OMM 测量员匹配、手量默认测量员和报表归属。">
        <FieldRow label="使用者姓名" hint="例如：禹欣">
          <Input
            value={draft.operatorName}
            onChange={(event) => updateDraft({ operatorName: event.target.value })}
            placeholder="请输入使用者姓名"
            className="max-w-xs"
          />
        </FieldRow>
        <FieldRow label="默认班次" hint="日期文件夹无 A/B 后缀时使用。">
          <Segmented
            value={draft.shiftDefault}
            onChange={(shiftDefault) => updateDraft({ shiftDefault })}
            options={[
              { value: "B", label: "晚班 B" },
              { value: "A", label: "早班 A" },
            ]}
          />
        </FieldRow>
        <FieldRow label="审核模式" hint="复杂文件名或缺字段时的默认处理方式。">
          <div className="space-y-2">
            <Segmented
              value={draft.complexDefault}
              onChange={(complexDefault) => updateDraft({ complexDefault })}
              options={[
                { value: "A", label: "方案 A：弹窗审核" },
                { value: "B", label: "方案 B：留坑自填" },
              ]}
            />
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-blue-600" onClick={() => onOpenHelp("complex")}>
              <HelpCircle className="mr-1 h-3.5 w-3.5" />
              查看审核模式说明
            </Button>
          </div>
        </FieldRow>
      </Section>

      <Section icon={<UserRound className="h-4 w-4" />} title="账户显示" description="控制页头欢迎语显示昵称还是真实姓名。">
        <FieldRow label="当前账户" hint={currentAccount.role === "admin" ? "管理员账户" : "访客账户"}>
          <div className="rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-sm text-slate-800 shadow-sm">
            {currentAccount.nickname} / {currentAccount.real_name}
          </div>
        </FieldRow>
        <FieldRow label="欢迎语显示">
          <Segmented
            value={currentAccount.display_name_mode}
            onChange={async (displayMode) => {
              setAccountSaving(true);
              setError("");
              try {
                await onDisplayNameModeChange(displayMode);
              } catch (e) {
                setError(`账户显示设置保存失败: ${e}`);
              } finally {
                setAccountSaving(false);
              }
            }}
            options={[
              { value: "nickname", label: "显示昵称" },
              { value: "real_name", label: "显示真名" },
            ]}
          />
          {accountSaving && <p className="mt-2 text-xs text-slate-500">正在保存账户显示设置...</p>}
        </FieldRow>
      </Section>
    </div>
  );

  const renderGeneration = () => (
    <div className="space-y-5">
      <Section icon={<CalendarClock className="h-4 w-4" />} title="时间策略" description="控制默认下班判断、每件时间区间和包间休息补时。">
        <FieldRow label="下班策略" hint="单日设置仍可覆盖。">
          <Segmented
            value={draft.leaveStrategy}
            onChange={(leaveStrategy) => updateDraft({ leaveStrategy })}
            options={[
              { value: "auto", label: "智能判断" },
              { value: "early", label: "下早班", tone: "warning" },
              { value: "normal", label: "不下早班" },
            ]}
          />
        </FieldRow>
        <FieldRow label="每件时间" hint="偏低时预览/生成前会二次确认。">
          <div className="flex flex-wrap items-center gap-2">
            <NumberInput value={draft.tppMin} min={1} max={20} step={0.5} onChange={(tppMin) => updateDraft({ tppMin })} />
            <span className="text-sm text-slate-400">到</span>
            <NumberInput value={draft.tppMax} min={1} max={20} step={0.5} onChange={(tppMax) => updateDraft({ tppMax })} />
            <span className="text-sm text-slate-500">分钟</span>
          </div>
        </FieldRow>
        <FieldRow label="包间休息补时" hint="只作为排程补时参数；0 表示关闭。">
          <div className="flex flex-wrap items-center gap-2">
            <NumberInput value={draft.pkgRest} min={0} max={30} step={1} onChange={(pkgRest) => updateDraft({ pkgRest })} />
            <span className="text-sm text-slate-500">分钟</span>
          </div>
        </FieldRow>
      </Section>

      <Section icon={<ClipboardList className="h-4 w-4" />} title="补时长上限" description="这些上限只限制系统自动补出的手量/其他事务，不影响真实手量记录。">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <ToggleRow
            checked={draft.enableHand}
            onChange={(enableHand) => updateDraft({ enableHand })}
            title="允许补时间手量"
            description="用于补足有效时长的系统生成手量。"
          />
          <ToggleRow
            checked={draft.enableOther}
            onChange={(enableOther) => updateDraft({ enableOther })}
            title="允许补其他事务"
            description="用于补足有效时长的其他事务。"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FieldRow label="手量上限">
            <div className="flex items-center gap-2">
              <NumberInput value={draft.handMax} min={10} max={240} step={10} onChange={(handMax) => updateDraft({ handMax })} />
              <span className="text-sm text-slate-500">分钟/次</span>
            </div>
          </FieldRow>
          <FieldRow label="其他上限">
            <div className="flex items-center gap-2">
              <NumberInput value={draft.otherMax} min={10} max={240} step={10} onChange={(otherMax) => updateDraft({ otherMax })} />
              <span className="text-sm text-slate-500">分钟/次</span>
            </div>
          </FieldRow>
        </div>
      </Section>
    </div>
  );

  const renderPaths = () => (
    <div className="space-y-5">
      <Section icon={<FolderOpen className="h-4 w-4" />} title="工作与输出" description="路径选择会默认打开当前显示的文件夹，避免跳到旧目录。">
        <FieldRow label="工作目录" hint="包含日期文件夹的根目录。">
          <div className="flex gap-2">
            <Input
              value={draft.workDir}
              onChange={(event) => updateDraft({ workDir: event.target.value })}
              placeholder="请选择包含日期文件夹的根目录"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                const path = await onBrowseWorkDir(draft.workDir || draft.configDir);
                if (path) updateDraft({ workDir: path });
              }}
            >
              浏览
            </Button>
          </div>
        </FieldRow>
        <FieldRow label="输出方式">
          <ToggleRow
            checked={draft.useSrcOutput}
            onChange={(useSrcOutput) => updateDraft({ useSrcOutput })}
            title="输出到源日期文件夹"
            description="每份报表保存回对应日期文件夹；关闭后使用下方统一输出目录。"
          />
        </FieldRow>
        <FieldRow label="统一输出目录" hint={draft.useSrcOutput ? "当前已启用源文件夹输出，可留空。" : "关闭源文件夹输出时必须填写。"}>
          <div className="flex gap-2">
            <Input
              value={draft.outputDir}
              onChange={(event) => updateDraft({ outputDir: event.target.value })}
              placeholder={draft.useSrcOutput ? "源文件夹输出已启用" : "请选择统一输出目录"}
              disabled={draft.useSrcOutput}
              className={draft.useSrcOutput ? "border-slate-200/70 bg-white/60 text-slate-500" : ""}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={draft.useSrcOutput}
              onClick={async () => {
                const path = await onBrowseOutputDir(draft.outputDir || draft.workDir || draft.configDir);
                if (path) updateDraft({ outputDir: path });
              }}
            >
              浏览
            </Button>
          </div>
        </FieldRow>
      </Section>

      <Section icon={<Settings2 className="h-4 w-4" />} title="配置文件" description="保存工作目录、使用者姓名、生成规则和输出目录。">
        <FieldRow label="配置目录" hint="账户模式下由当前账户 profile 管理。">
          <div className="flex gap-2">
            <Input
              value={draft.configDir}
              readOnly
              placeholder="登录后自动使用账户配置目录"
              className="border-slate-200/70 bg-white/60 text-slate-500"
            />
          </div>
        </FieldRow>
        <div className="rounded-xl border border-blue-200/70 bg-blue-50/80 px-3 py-2 text-xs leading-6 text-blue-800">
          <div className="flex flex-wrap items-center gap-2">
            <span>当前配置来源：</span>
            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${sourceInfo.color}`}>
              {sourceInfo.text}
            </span>
          </div>
          <div className="mt-1 break-all">实际配置路径：{configPath || normalizedDraft.configDir || "未识别"}</div>
          {configDuplicates.length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/90 px-2.5 py-1.5 text-amber-800">
              便携版目录内还发现 {configDuplicates.length} 个额外 config.json，建议只保留一个。
            </div>
          )}
        </div>
      </Section>
    </div>
  );

  const renderAssets = () => (
    <div className="space-y-5">
      <Section icon={<FileSpreadsheet className="h-4 w-4" />} title="报表模板" description="模板优先级：用户自定义、工作目录、内置模板。">
        <div className="flex flex-wrap items-start gap-2">
          {templateInfo?.exists ? (
            <>
              <span className={`status-pill border shrink-0 ${
                templateInfo.source === "user" ? "bg-blue-50 text-blue-700 border-blue-200" :
                templateInfo.source === "bundled" ? "bg-green-50 text-green-700 border-green-200" :
                "bg-slate-100 text-slate-600 border-slate-200"
              }`}>
                {templateSourceLabel(templateInfo.source)}
              </span>
              <span className="min-w-0 flex-1 break-all pt-0.5 text-xs leading-5 text-slate-600">{templateInfo.path}</span>
            </>
          ) : (
            <span className="text-sm text-red-700">未找到模板，将无法生成报表。</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onReplaceTemplate}>更新模板</Button>
          <Button type="button" variant="outline" size="sm" onClick={onResetTemplate}>重置为内置</Button>
          <Button type="button" variant="outline" size="sm" onClick={onViewTemplatePaths}>查看位置</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRefreshTemplate}>刷新</Button>
        </div>
      </Section>

      <Section icon={<Package className="h-4 w-4" />} title="识别补充与特殊大件" description="这两类属于独立管理项，入口集中在设置中心。">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <button
            type="button"
            onClick={onOpenRecognitionRules}
            className="rounded-xl border border-slate-200/80 bg-white/70 p-3 text-left shadow-sm transition hover:bg-white hover:shadow-[0_8px_20px_rgba(15,23,42,0.07)]"
          >
            <div className="text-sm font-medium text-slate-800">识别补充规则</div>
            <div className="mt-1 text-xs leading-5 text-slate-500 break-all">
              {recognitionRulesPath || "recognition-rules.json"} {recognitionRulesExists ? "（已存在）" : "（未创建）"}
            </div>
          </button>
          <button
            type="button"
            onClick={onOpenSpecialItems}
            className="rounded-xl border border-slate-200/80 bg-white/70 p-3 text-left shadow-sm transition hover:bg-white hover:shadow-[0_8px_20px_rgba(15,23,42,0.07)]"
          >
            <div className="text-sm font-medium text-slate-800">特殊大件</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">管理烧结盘等固定耗时物品。</div>
          </button>
        </div>
      </Section>
    </div>
  );

  const renderTools = () => (
    <div className="space-y-5">
      <Section icon={<Wrench className="h-4 w-4" />} title="本机工具" description="个人清理仅管理员账户可使用，访客账户无入口且后端会拒绝调用。">
        {canUsePersonalCleaner ? (
          <button
            type="button"
            onClick={onOpenPersonalCleaner}
            className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-left transition hover:bg-amber-100/90"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              个人清理工具
            </div>
            <div className="mt-1 text-xs leading-5 text-amber-800">
              Edge、截图、剪贴板、WiFi、私人浏览器等本机维护功能。仅管理员账户可执行，危险项会二次确认。
            </div>
          </button>
        ) : (
          <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 text-sm leading-6 text-slate-600">
            访客账户不显示个人清理工具。
          </div>
        )}
      </Section>

      <Section icon={<HelpCircle className="h-4 w-4" />} title="帮助" description="设置说明和日常操作说明统一放在帮助中心。">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenHelp("settings-center")}>设置中心说明</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenHelp("quickstart")}>快速上手</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenHelp("personal-cleaner")}>个人清理说明</Button>
        </div>
      </Section>

      <Section icon={<UserRound className="h-4 w-4" />} title="账户" description="切换账户会回到登录页，并加载另一套默认配置。">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-700">
            不是您？当前为 <span className="font-medium">{currentAccount.nickname}</span>
          </div>
          <Button type="button" variant="outline" onClick={onSwitchAccount}>
            切换账户 / 退出登录
          </Button>
        </div>
      </Section>
    </div>
  );

  const renderAbout = () => (
    <div className="space-y-5">
      <Section icon={<Info className="h-4 w-4" />} title="关于软件" description="版本、账户和配置位置集中展示，便于验收和排查。">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 shadow-sm">
            <div className="text-xs text-slate-500">软件名称</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">OMM 日报系统</div>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 shadow-sm">
            <div className="text-xs text-slate-500">当前版本</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">v{APP_VERSION}</div>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 shadow-sm">
            <div className="text-xs text-slate-500">当前账户</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {currentAccount.nickname} / {currentAccount.real_name}
              <span className="ml-2 text-xs font-normal text-slate-500">{currentAccount.role === "admin" ? "管理员" : "访客"}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 shadow-sm">
            <div className="text-xs text-slate-500">配置来源</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{sourceInfo.text}</div>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white/70 p-3 text-xs leading-6 text-slate-600 shadow-sm">
          <div>
            <span className="font-medium text-slate-700">配置文件：</span>
            <span className="break-all">{configPath || normalizedDraft.configDir || "未识别"}</span>
          </div>
          <div>
            <span className="font-medium text-slate-700">识别补充：</span>
            <span className="break-all">{recognitionRulesPath || "recognition-rules.json"}</span>
            <span className="ml-1 text-slate-400">{recognitionRulesExists ? "已存在" : "未创建"}</span>
          </div>
          <div>
            <span className="font-medium text-slate-700">报表模板：</span>
            <span className="break-all">
              {templateInfo?.exists ? `${templateSourceLabel(templateInfo.source)} · ${templateInfo.path}` : "未找到模板"}
            </span>
          </div>
        </div>
      </Section>

      <Section icon={<Package className="h-4 w-4" />} title="本地数据管理" description="账号、配置、日志、备份和 manifest 统一收纳在本地 data 目录。">
        {dataStoreInfo ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 shadow-sm">
                <div className="text-xs text-slate-500">数据库</div>
                <div className="mt-1 break-all text-xs font-mono text-slate-700">{dataStoreInfo.databasePath}</div>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 shadow-sm">
                <div className="text-xs text-slate-500">数据目录</div>
                <div className="mt-1 break-all text-xs font-mono text-slate-700">{dataStoreInfo.dataRoot}</div>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 shadow-sm">
                <div className="text-xs text-slate-500">账户配置</div>
                <div className="mt-1 break-all text-xs font-mono text-slate-700">{dataStoreInfo.profilesDir}</div>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 shadow-sm">
                <div className="text-xs text-slate-500">日志 / 备份 / manifest</div>
                <div className="mt-1 text-xs leading-5 text-slate-700">
                  <div className="break-all">日志：{dataStoreInfo.logsDir}</div>
                  <div className="break-all">备份：{dataStoreInfo.backupsDir}</div>
                  <div className="break-all">manifest：{dataStoreInfo.manifestsDir}</div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200/70 bg-blue-50/80 px-3 py-2 text-xs leading-6 text-blue-800">
              <div>
                SQLite schema v{dataStoreInfo.schemaVersion}，账户 {dataStoreInfo.accountCount} 个，
                {dataStoreInfo.isPortable ? "便携版数据跟随程序目录。" : "安装版数据位于当前 Windows 用户目录。"}
                {(dataStoreInfo.legacyAccountsExists || dataStoreInfo.legacyProfilesExists) && (
                  <span className="ml-1">检测到旧 .omm 数据，已作为兼容导入来源保留。</span>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onOpenDataRoot}>打开数据目录</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { void onRefreshDataStore(); }}>刷新</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/70 p-3 text-sm text-slate-600">
            <span>尚未读取本地数据状态。</span>
            <Button type="button" variant="outline" size="sm" onClick={() => { void onRefreshDataStore(); }}>读取状态</Button>
          </div>
        )}
      </Section>

      <Section icon={<HelpCircle className="h-4 w-4" />} title="帮助与状态" description="帮助中心会随功能更新，版本记录写入当前状态文件。">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenHelp("about")}>版本和快捷键</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenHelp("account-login")}>账户登录说明</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenHelp("settings-center")}>设置中心说明</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenHelp("faq")}>常见问题</Button>
        </div>
        <div className="rounded-xl border border-blue-200/70 bg-blue-50/80 px-3 py-2 text-xs leading-6 text-blue-800">
          日常开发验收优先使用 dev 窗口；只有明确需要便携版或正式交付时再打包。
        </div>
      </Section>

      <Section icon={<ClipboardList className="h-4 w-4" />} title="诊断" description="一般情况下不需要打开，排查问题时再查看。">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/70 p-3">
          <div>
            <div className="text-sm font-medium text-slate-800">运行诊断日志</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">当前累计 {logCount} 条，仅用于排查生成、识别和配置加载问题。</div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onOpenDetailedLogs}>
            查看
          </Button>
        </div>
      </Section>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case "generation": return renderGeneration();
      case "paths": return renderPaths();
      case "assets": return renderAssets();
      case "tools": return renderTools();
      case "about": return renderAbout();
      default: return renderBasic();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : requestClose())}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-blue-600" />
          设置中心
        </DialogTitle>
        <div className="mt-1 text-sm text-slate-500">
          修改会先保存在本页草稿中，点击保存后才写入配置文件。
        </div>
      </DialogHeader>

      <DialogContent className="p-0">
        <div className="grid min-h-[560px] grid-cols-1 md:grid-cols-[190px_1fr]">
          <aside className="border-b border-slate-200/80 bg-[#f5f5f7] p-3 md:border-b-0 md:border-r">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl px-3 py-2 text-left transition-[background-color,box-shadow,color] duration-150 ${
                    activeTab === tab.id
                      ? "bg-white text-blue-700 shadow-[0_8px_20px_rgba(15,23,42,0.07)] ring-1 ring-blue-100"
                      : "text-slate-600 hover:bg-white/80 hover:text-slate-950"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {tab.icon}
                    {tab.label}
                  </span>
                  <span className="mt-1 hidden text-xs leading-5 text-slate-500 md:block">{tab.description}</span>
                </button>
              ))}
            </div>
          </aside>

          <main className="max-h-[62vh] overflow-y-auto bg-white/45 p-4">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-sm leading-6 text-red-800">
                {error}
              </div>
            )}
            {dirty && !confirmExit && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2 text-xs leading-5 text-blue-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>当前有 {changes.length} 项未保存改动。保存前不会写入配置文件。</span>
              </div>
            )}
            {renderActiveTab()}
          </main>
        </div>

        {confirmExit && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-white/70 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-slate-900">设置尚未保存</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">你修改了 {changes.length} 项设置，退出前请选择如何处理。</p>
                </div>
              </div>
              <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200/80 bg-white/70 p-3 text-xs leading-5 text-slate-700">
                {changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setConfirmExit(false)} disabled={saving}>
                  继续编辑
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setDraft(initialDraft);
                    setConfirmExit(false);
                    onOpenChange(false);
                  }}
                  disabled={saving}
                >
                  放弃更改
                </Button>
                <Button type="button" onClick={() => saveDraft(true)} disabled={saving}>
                  <Save className="mr-1.5 h-4 w-4" />
                  保存并退出
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      <DialogFooter className="items-center justify-between">
        <div className="text-xs text-slate-500">
          {dirty ? `${changes.length} 项未保存` : "没有未保存改动"}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setDraft(initialDraft)} disabled={!dirty || saving}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            还原
          </Button>
          <Button type="button" variant="secondary" onClick={requestClose} disabled={saving}>
            关闭
          </Button>
          <Button type="button" onClick={() => saveDraft(false)} disabled={!dirty || saving}>
            <Save className="mr-1.5 h-4 w-4" />
            保存设置
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  );
}
