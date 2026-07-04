import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DurationOverride, DurationOverrideMode, FolderRecord, GenerateSettings, PreviewData, QueueItemSettingsOverride } from "@/types/record";
import { AlertTriangle, CheckCircle2, Clock, FileSpreadsheet, Info, RotateCcw, Save, Settings2, SlidersHorizontal, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface PreviewDialogProps {
  open: boolean;
  data: PreviewData | null;
  onClose: () => void;
  onGenerate?: () => void;
  onOpenManual?: () => void;
  onOpenDaySettings?: () => void;
  decisionSettings?: GenerateSettings;
  durationOverrides?: Record<string, DurationOverride>;
  durationOverrideDisabledFolders?: Record<string, string>;
  onSaveDecisionSettings?: (patch: Partial<QueueItemSettingsOverride>) => void | Promise<void>;
  onSaveDurationOverrides?: (overrides: Record<string, DurationOverride>) => void | Promise<void>;
  onApplyTimeRecommendation?: () => void | Promise<void>;
  onMoveOmitItems?: () => void | Promise<void>;
}

type DurationDraft = {
  mode: DurationOverrideMode;
  minutesInput: string;
};

type DecisionDraft = {
  handMaxInput: string;
  otherMaxInput: string;
  otherNote: string;
};

const DEFAULT_OTHER_NOTE = "其他事务";

function formatMinutes(minutes: number): string {
  const safeMinutes = Number.isFinite(minutes) ? Math.round(minutes) : 0;
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}m`;
}

function formatApproxMinutes(minutes: number): string {
  if (!Number.isFinite(minutes)) return "约 0 分钟";
  return `约 ${Math.round(Math.max(0, minutes))} 分钟`;
}

function normalizeMinuteText(text: string, approximateAll = false): string {
  return text.replace(/(?:约\s*)?(\d+(?:\.\d+)?)\s*分钟/g, (_match, raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return _match;
    const decimalPart = raw.split(".")[1] || "";
    if (!approximateAll && decimalPart.length <= 1) return _match;
    return formatApproxMinutes(value);
  });
}

function isOverloadScheduleWarning(warning: string): boolean {
  return /任务量(?:偏多|过多)|压缩|超过目标结束时间|移到下一天/.test(warning);
}

function sourceLabel(source?: string): string {
  if (source?.startsWith('duration_rule:')) {
    const name = source.slice('duration_rule:'.length).replace(':compressed', '');
    return source.endsWith(':compressed') ? `规则：${name}（已压缩）` : `规则：${name}`;
  }
  switch (source) {
    case 'special': return '耗时规则';
    case 'zhengxing_cnc': return '整形CNC';
    case 'cnc': return '普通CNC';
    case 'real_manual': return '真实手量';
    case 'hand_filler': return '补时间手量';
    case 'other_filler': return '其他事务';
    case 'hidden_buffer': return '隐形缓冲';
    case 'break': return '固定休息';
    case 'supplement_manual': return '补录手量';
    case 'supplement_other': return '补录事务';
    case 'manual_duration': return '手动指定';
    case 'tpp': return '普通';
    default: return source || '';
  }
}

function sourcePillClass(source?: string): string {
  if (source?.startsWith('duration_rule:')) return 'bg-purple-50 text-purple-700 border-purple-200';
  switch (source) {
    case 'real_manual': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'supplement_manual': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'special': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'manual_duration': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'zhengxing_cnc':
    case 'cnc': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'hand_filler':
    case 'other_filler':
    case 'supplement_other': return 'bg-green-50 text-green-700 border-green-200';
    case 'hidden_buffer': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'break': return 'bg-slate-100 text-slate-500 border-slate-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function shortageClass(level?: string): string {
  switch (level) {
    case 'extreme': return 'bg-red-50 border-red-200 text-red-900';
    case 'severe': return 'bg-orange-50 border-orange-200 text-orange-900';
    case 'shortage': return 'bg-amber-50 border-amber-200 text-amber-900';
    default: return 'bg-green-50 border-green-200 text-green-900';
  }
}

function shortageIcon(level?: string) {
  switch (level) {
    case 'extreme':
    case 'severe':
    case 'shortage':
      return <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />;
    default:
      return <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />;
  }
}

function getRecordQuantity(record: FolderRecord): number | null {
  return typeof record.quantity === 'number' && Number.isFinite(record.quantity) && record.quantity > 0
    ? record.quantity
    : null;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatOneDecimal(value?: number): string {
  return Number.isFinite(value) ? Number(value).toFixed(1) : "0.0";
}

function formatPerPiece(value?: number | null): string {
  return Number.isFinite(value) ? `${Number(value).toFixed(1)} 分/颗` : "-";
}

function buildDurationDrafts(overrides?: Record<string, DurationOverride>): Record<string, DurationDraft> {
  const result: Record<string, DurationDraft> = {};
  for (const [folder, override] of Object.entries(overrides || {})) {
    result[folder] = {
      mode: override.mode,
      minutesInput: String(override.minutes),
    };
  }
  return result;
}

export function PreviewDialog({
  open,
  data,
  onClose,
  onGenerate,
  onOpenManual,
  onOpenDaySettings,
  decisionSettings,
  durationOverrides,
  durationOverrideDisabledFolders,
  onSaveDecisionSettings,
  onSaveDurationOverrides,
  onApplyTimeRecommendation,
  onMoveOmitItems,
}: PreviewDialogProps) {
  const [durationDrafts, setDurationDrafts] = useState<Record<string, DurationDraft>>({});
  const [durationError, setDurationError] = useState<string | null>(null);
  const [durationSaving, setDurationSaving] = useState(false);
  const [decisionDraft, setDecisionDraft] = useState<DecisionDraft>({
    handMaxInput: "120",
    otherMaxInput: "90",
    otherNote: DEFAULT_OTHER_NOTE,
  });
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionSaving, setDecisionSaving] = useState(false);
  const editableRecords = data?.records ?? [];
  const overrideCount = Object.keys(durationDrafts).length;

  useEffect(() => {
    if (open) {
      setDurationDrafts(buildDurationDrafts(durationOverrides));
      setDurationError(null);
      setDurationSaving(false);
    }
  }, [open, durationOverrides]);

  useEffect(() => {
    if (!open || !decisionSettings) return;
    setDecisionDraft({
      handMaxInput: String(decisionSettings.hand_max ?? 120),
      otherMaxInput: String(decisionSettings.other_max ?? 90),
      otherNote: decisionSettings.other_note || DEFAULT_OTHER_NOTE,
    });
    setDecisionError(null);
    setDecisionSaving(false);
  }, [
    open,
    decisionSettings?.hand_max,
    decisionSettings?.other_max,
    decisionSettings?.other_note,
  ]);

  const durationPreviewByFolder = useMemo(() => {
    const result: Record<string, string> = {};
    for (const record of editableRecords) {
      const draft = durationDrafts[record.folder];
      if (!draft) continue;
      const minutes = Number(draft.minutesInput);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        result[record.folder] = '-';
      } else if (draft.mode === 'per_piece') {
        const qty = getRecordQuantity(record);
        result[record.folder] = qty ? `${formatNumber(qty * minutes)} 分钟` : '缺件数';
      } else {
        result[record.folder] = `${formatNumber(minutes)} 分钟`;
      }
    }
    return result;
  }, [durationDrafts, editableRecords]);

  const updateDurationDraft = (folder: string, patch: Partial<DurationDraft>) => {
    setDurationDrafts((prev) => ({
      ...prev,
      [folder]: {
        mode: prev[folder]?.mode || 'package_total',
        minutesInput: prev[folder]?.minutesInput || '',
        ...patch,
      },
    }));
    setDurationError(null);
  };

  const clearDurationDraft = (folder: string) => {
    setDurationDrafts((prev) => {
      const next = { ...prev };
      delete next[folder];
      return next;
    });
    setDurationError(null);
  };

  const saveDurationDrafts = async () => {
    if (!onSaveDurationOverrides) return;
    const next: Record<string, DurationOverride> = {};
    for (const record of editableRecords) {
      const draft = durationDrafts[record.folder];
      if (!draft) continue;
      const disabledReason = durationOverrideDisabledFolders?.[record.folder];
      if (disabledReason) {
        setDurationError(`${record.folder} ${disabledReason}`);
        return;
      }
      const minutes = Number(draft.minutesInput);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        setDurationError(`${record.folder} 的耗时必须是大于 0 的数字。`);
        return;
      }
      if (draft.mode === 'per_piece') {
        const qty = getRecordQuantity(record);
        if (!qty) {
          setDurationError(`${record.folder} 没有可用件数，不能按每颗耗时，请改用整包总耗时。`);
          return;
        }
        if (minutes > 6) {
          setDurationError(`${record.folder} 普通料每颗最多 6 分钟，特殊规则料除外。`);
          return;
        }
        next[record.folder] = {
          folder: record.folder,
          mode: draft.mode,
          minutes,
          computed_total_minutes: Math.round(qty * minutes * 10) / 10,
        };
      } else {
        next[record.folder] = {
          folder: record.folder,
          mode: draft.mode,
          minutes,
          computed_total_minutes: Math.round(minutes * 10) / 10,
        };
      }
    }
    setDurationSaving(true);
    try {
      await onSaveDurationOverrides(next);
      setDurationError(null);
    } catch (error) {
      setDurationError(`保存本日包耗时失败: ${error}`);
    } finally {
      setDurationSaving(false);
    }
  };

  const saveDecisionPatch = async (patch: Partial<QueueItemSettingsOverride>) => {
    if (!onSaveDecisionSettings) return;
    setDecisionSaving(true);
    setDecisionError(null);
    try {
      await onSaveDecisionSettings(patch);
    } catch (error) {
      setDecisionError(`更新排程决策失败: ${error}`);
    } finally {
      setDecisionSaving(false);
    }
  };

  const saveDecisionDraft = async () => {
    const handMax = Number(decisionDraft.handMaxInput);
    const otherMax = Number(decisionDraft.otherMaxInput);
    const otherNote = decisionDraft.otherNote.trim() || DEFAULT_OTHER_NOTE;
    if (!Number.isFinite(handMax) || handMax <= 0) {
      setDecisionError("手量补时上限必须是大于 0 的数字。");
      return;
    }
    if (!Number.isFinite(otherMax) || otherMax <= 0) {
      setDecisionError("其他事务补时上限必须是大于 0 的数字。");
      return;
    }
    await saveDecisionPatch({
      hand_max: Math.round(handMax * 10) / 10,
      other_max: Math.round(otherMax * 10) / 10,
      other_note: otherNote,
    });
  };

  if (!open || !data) return null;

  const { folder_name, shift_label, early_leave, rows, summary, warnings, schedule_warnings } = data;

  const title = `预览 - ${folder_name} (${shift_label}班${early_leave ? "-下早班" : ""})`;

  const effectiveDelta = Math.round(summary.total_effective - summary.required_effective);
  const hasEnoughTime = summary.meets_required;
  const needMinutes = Math.max(0, summary.estimates?.need_minutes ?? Math.abs(effectiveDelta));
  const needMinutesText = formatApproxMinutes(needMinutes);
  const timeAnomaly = summary.time_anomaly || summary.decision?.time_anomaly;
  const hasTimeAnomaly = !!timeAnomaly && timeAnomaly.kind !== "ok";
  const statusLevel = timeAnomaly?.kind === "too_much"
    ? "extreme"
    : (summary.shortage_level || (hasEnoughTime ? "ok" : "shortage"));
  const statusTitle = timeAnomaly?.title || summary.decision?.title || (hasEnoughTime ? "当天可以生成" : "有效时长不足");
  const statusMessage = normalizeMinuteText(timeAnomaly?.message || summary.decision?.message || (
    hasEnoughTime
      ? "有效计入已经达到最低要求。下方明细仅供核对，不需要逐项理解也可以继续生成。"
      : "有效计入还没有达到最低要求，建议先补录手量/事务，或打开单日设置确认当天规则。"
  ), true);
  const visibleScheduleWarnings = hasEnoughTime
    ? schedule_warnings
    : schedule_warnings.filter((warning) => !isOverloadScheduleWarning(warning));

  const keyMetrics = [
    {
      label: "有效计入",
      value: formatMinutes(summary.total_effective),
      help: "用于判断当天是否合格的工作量，不等于人在岗总时长。",
    },
    {
      label: "最低要求",
      value: formatMinutes(summary.required_effective),
      help: "当天需要达到的最低有效工作量。",
    },
    {
      label: effectiveDelta >= 0 ? "已超出" : "还差",
      value: formatMinutes(Math.abs(effectiveDelta)),
      help: effectiveDelta >= 0 ? "超过最低要求的余量。" : "距离最低要求还缺少的有效工作量。",
    },
  ];

  const detailItems = [
    { label: "在岗范围", value: formatMinutes(summary.total_shift), help: "从班次开始到目标下班的总时段。" },
    { label: "纯工作", value: formatMinutes(summary.total_work), help: "排除固定休息后的可安排时间。" },
    { label: "固定休息", value: formatMinutes(summary.total_rest), help: "系统自动扣除的固定休息时间。" },
    { label: "缓冲余量", value: formatMinutes(summary.hidden_buffer_total), help: "系统为排程留出的安全余量。" },
    { label: "目标下班", value: summary.target_clock_end, help: "按当前班次和设置计算的目标结束时间。" },
    { label: "实际结束", value: summary.actual_last_end, help: "当前排程最后一项任务结束时间。" },
  ];

  const contributionItems = [
    { label: "普通任务", value: summary.regular_effective || 0, help: "常规 OMM 文件夹按每件时间换算。" },
    { label: "手量/补录", value: (summary.real_manual_effective || 0) + (summary.hand_filler_minutes || 0), help: "手量任务和手动补录的有效工作量。" },
    { label: "规则/CNC", value: (summary.special_effective || 0) + (summary.zhengxing_cnc_effective || 0) + (summary.cnc_effective || 0), help: "耗时规则、整形 CNC、普通 CNC 的计入量。" },
    { label: "其他事务", value: summary.other_filler_minutes || 0, help: "手动补录的其他事务时间。" },
  ];
  const regularHeadroom = summary.regular_tpp_headroom_minutes || 0;
  const regularTppItems = [
    {
      label: "普通料均值",
      value: `${formatOneDecimal(summary.regular_avg_tpp)} 分/件`,
      help: `普通料 ${summary.regular_quantity || 0} 件，按当前排程折算。`,
    },
    {
      label: "普通料上限",
      value: `${formatOneDecimal(summary.regular_tpp_max)} 分/件`,
      help: summary.regular_tpp_at_upper ? "普通料已触达当前上限。" : "普通料仍可在上限内上调。",
    },
    {
      label: "可上调空间",
      value: formatMinutes(regularHeadroom),
      help: "普通料到当前上限之间还能增加的有效工时。",
    },
  ];
  const currentStrategy = decisionSettings?.leave_strategy || data.leave_strategy || (early_leave ? "early" : "normal");
  const currentEnableHand = decisionSettings?.enable_hand ?? true;
  const currentEnableOther = decisionSettings?.enable_other ?? false;
  const currentOtherNote = decisionSettings?.other_note || DEFAULT_OTHER_NOTE;
  const decisionDisabled = decisionSaving || !onSaveDecisionSettings;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <Card className="flex h-[680px] max-h-[90vh] w-[900px] max-w-full flex-col overflow-hidden rounded-2xl border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <CardHeader className="shrink-0 border-b border-slate-200/70 bg-white/90 px-5 py-3">
          <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            {title}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className={`rounded-xl border px-4 py-3 ${shortageClass(statusLevel)}`}>
            <div className="flex items-start gap-3">
              {shortageIcon(statusLevel)}
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="text-sm font-semibold">{statusTitle}</p>
                  <p className="mt-1 text-sm leading-6 opacity-90">{statusMessage}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {keyMetrics.map((item) => (
                    <div key={item.label} className="rounded-xl border border-white/70 bg-white/75 px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                      <div className="text-xs opacity-80">{item.label}</div>
                      <div className="text-base font-semibold">{item.value}</div>
                      <div className="mt-1 text-[11px] leading-4 opacity-75">{item.help}</div>
                    </div>
                  ))}
                </div>
                {hasTimeAnomaly && (
                  <details className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm leading-6" open={timeAnomaly.kind === "too_little"}>
                    <summary className="cursor-pointer select-none font-medium">
                      {timeAnomaly.kind === "too_much" ? "查看建议省略清单" : "查看推荐处理"}
                    </summary>
                    {timeAnomaly.kind === "too_little" && (
                      <div className="mt-2 space-y-2">
                        <p>
                          当前有效 {formatMinutes(timeAnomaly.current_effective || summary.total_effective)}，
                          最低要求 {formatMinutes(timeAnomaly.min_effective || summary.required_effective)}，
                          缺口 {formatApproxMinutes(timeAnomaly.shortage_minutes || 0)}。
                        </p>
                        {timeAnomaly.adjustment_items && timeAnomaly.adjustment_items.length > 0 ? (
                          <div className="space-y-1.5">
                            {timeAnomaly.adjustment_items.map((item) => (
                              <div key={item.folder} className="rounded-lg border border-white/70 bg-white/75 px-2.5 py-2">
                                <div className="font-medium">{item.folder}</div>
                                <div className="text-xs opacity-80">
                                  {item.quantity} 颗：{formatPerPiece(item.current_per_piece)} → {formatPerPiece(item.recommended_per_piece)}
                                  ，整包约 {formatApproxMinutes(item.recommended_total_minutes)}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p>没有可上调的普通包；特殊规则、CNC、真实手量和已有手动覆盖不纳入普通推荐。</p>
                        )}
                        {(timeAnomaly.supplemental_minutes || 0) > 0.5 && (
                          <p>
                            普通料按最高 6 分钟/颗估算后仍差 {formatApproxMinutes(timeAnomaly.supplemental_minutes || 0)}，
                            建议补充真实手量或其他事务。
                          </p>
                        )}
                        {onApplyTimeRecommendation && timeAnomaly.adjustment_items && timeAnomaly.adjustment_items.length > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={onApplyTimeRecommendation}
                            className="h-8 bg-white/80"
                          >
                            应用推荐到本日包耗时覆盖
                          </Button>
                        )}
                        {timeAnomaly.note && <p className="text-xs opacity-75">{timeAnomaly.note}</p>}
                      </div>
                    )}
                    {timeAnomaly.kind === "too_much" && (
                      <div className="mt-2 space-y-2">
                        <p>
                          预计超过目标结束 {formatApproxMinutes(timeAnomaly.overrun_minutes || 0)}。
                          以下是暂不写入本日报的候选包；未确认前不会移动、重命名或修改任何文件夹。
                        </p>
                        {timeAnomaly.omit_items && timeAnomaly.omit_items.length > 0 ? (
                          <div className="space-y-1.5">
                            {timeAnomaly.omit_items.map((item) => (
                              <div key={item.folder} className="rounded-lg border border-white/70 bg-white/75 px-2.5 py-2">
                                <div className="font-medium">{item.folder}</div>
                                <div className="text-xs opacity-80">
                                  {item.quantity === "/" ? "件数未知" : `${item.quantity} 颗`}
                                  ，当前整包约 {formatApproxMinutes(item.current_total_minutes)}
                                  {item.current_per_piece ? `，${formatPerPiece(item.current_per_piece)}` : ""}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p>没有可建议省略的普通包；请人工核对特殊规则或 CNC 项。</p>
                        )}
                        {onMoveOmitItems && timeAnomaly.omit_items && timeAnomaly.omit_items.length > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={onMoveOmitItems}
                            className="h-8 bg-white/80"
                          >
                            确认后移动到新建文件夹{data.shift_label}
                          </Button>
                        )}
                        {timeAnomaly.note && <p className="text-xs opacity-75">{timeAnomaly.note}</p>}
                      </div>
                    )}
                  </details>
                )}
                {!hasEnoughTime && (
                  <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm leading-6">
                    还差 <span className="font-semibold">{needMinutesText}</span>；可先补录手量/其他事务，或确认当天是否应调整下班策略。
                    {summary.estimates && (
                      <span className="block text-xs opacity-75">
                        若继续按普通件补足，粗略估计还需 {summary.estimates.optimistic} 到 {summary.estimates.conservative} 件。
                      </span>
                    )}
                  </div>
                )}
                {summary.decision?.options && summary.decision.options.length > 0 && (
                  <div className="space-y-1.5 rounded-xl border border-white/70 bg-white/70 p-2.5">
                    <p className="text-sm font-medium">建议处理</p>
                    {summary.decision.options.map((opt) => (
                      <div key={opt.key} className="text-sm leading-6">
                        <span className="font-medium">{opt.label}</span>：{normalizeMinuteText(opt.description, true)}
                      </div>
                    ))}
                  </div>
                )}
                {!hasEnoughTime && (
                  <div className="flex flex-wrap gap-2">
                    {onOpenManual && (
                      <Button size="sm" variant="outline" onClick={() => { onClose(); onOpenManual(); }} className="h-8 gap-1.5 bg-white/70 border-current hover:bg-white">
                        <Wrench className="h-3.5 w-3.5" />
                        打开手量补录
                      </Button>
                    )}
                    {onOpenDaySettings && (
                      <Button size="sm" variant="outline" onClick={() => { onClose(); onOpenDaySettings(); }} className="h-8 gap-1.5 bg-white/70 border-current hover:bg-white">
                        <Settings2 className="h-3.5 w-3.5" />
                        打开单日设置
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <section className="rounded-xl border border-blue-200/70 bg-blue-50/70 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-950">
                  <SlidersHorizontal className="h-4 w-4" />
                  生成前排程决策
                </h3>
                <p className="mt-1 text-xs leading-5 text-blue-800">
                  每次选择都会按当前日期重新预览；Excel 只会使用最后确认的排程口径。
                </p>
              </div>
              {onGenerate && (
                <Button size="sm" onClick={() => { onClose(); onGenerate(); }} className="h-8 gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  按当前结果生成
                </Button>
              )}
            </div>
            {decisionError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {decisionError}
              </div>
            )}
            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.25fr]">
              <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                <div className="text-xs font-medium text-slate-500">下班策略</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={currentStrategy === "normal" ? "secondary" : "outline"}
                    size="sm"
                    disabled={decisionDisabled || currentStrategy === "normal"}
                    onClick={() => saveDecisionPatch({ leave_strategy: "normal" })}
                    className="h-8"
                  >
                    不下早班
                  </Button>
                  <Button
                    type="button"
                    variant={currentStrategy === "early" ? "secondary" : "outline"}
                    size="sm"
                    disabled={decisionDisabled || currentStrategy === "early"}
                    onClick={() => saveDecisionPatch({ leave_strategy: "early" })}
                    className="h-8"
                  >
                    下早班
                  </Button>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  当前：{currentStrategy === "early" ? "下早班" : currentStrategy === "auto" ? "智能判断（按正常班确认）" : "不下早班"}，目标 {summary.target_clock_end}，实际 {summary.actual_last_end}。
                </p>
              </div>

              <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-medium text-slate-500">补时选项</div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={currentEnableHand ? "secondary" : "outline"}
                      size="sm"
                      disabled={decisionDisabled}
                      onClick={() => saveDecisionPatch({ enable_hand: !currentEnableHand })}
                      className="h-8"
                    >
                      手量{currentEnableHand ? "已开" : "已关"}
                    </Button>
                    <Button
                      type="button"
                      variant={currentEnableOther ? "secondary" : "outline"}
                      size="sm"
                      disabled={decisionDisabled}
                      onClick={() => saveDecisionPatch({ enable_other: !currentEnableOther, other_note: currentOtherNote })}
                      className="h-8"
                    >
                      其他事务{currentEnableOther ? "已开" : "已关"}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[90px_90px_minmax(140px,1fr)_auto]">
                  <label className="text-xs text-slate-500">
                    手量上限
                    <input
                      className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm tabular-nums text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      value={decisionDraft.handMaxInput}
                      inputMode="decimal"
                      onChange={(event) => setDecisionDraft((prev) => ({ ...prev, handMaxInput: event.target.value }))}
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    事务上限
                    <input
                      className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm tabular-nums text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      value={decisionDraft.otherMaxInput}
                      inputMode="decimal"
                      onChange={(event) => setDecisionDraft((prev) => ({ ...prev, otherMaxInput: event.target.value }))}
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    其他事务备注
                    <input
                      className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      value={decisionDraft.otherNote}
                      placeholder={DEFAULT_OTHER_NOTE}
                      onChange={(event) => setDecisionDraft((prev) => ({ ...prev, otherNote: event.target.value }))}
                    />
                  </label>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={decisionDisabled}
                      onClick={saveDecisionDraft}
                      className="h-8 w-full"
                    >
                      {decisionSaving ? "应用中" : "应用"}
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  其他事务默认写作“其他事务”；需要时可改为“来料登记”等，预览和 Excel 会同步使用。
                </p>
              </div>
            </div>
          </section>

          <details className="group rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <summary className="cursor-pointer select-none text-sm font-medium text-slate-800 outline-none">
              查看计算细项
              <span className="ml-2 text-xs font-normal text-slate-500">包含休息、缓冲、下班参考和来源拆分</span>
            </summary>
            <div className="mt-3 space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                {detailItems.map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2">
                    <div className="text-xs text-slate-500">{item.label}</div>
                    <div className="text-sm font-semibold text-slate-800">{item.value}</div>
                    <div className="mt-1 text-[11px] leading-4 text-slate-500">{item.help}</div>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">计入来源</p>
                <div className="grid gap-2 sm:grid-cols-4">
                  {contributionItems.map((item) => (
                    <div key={item.label} className="rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2">
                      <div className="text-xs text-slate-500">{item.label}</div>
                      <div className="text-sm font-semibold text-slate-800">{formatMinutes(item.value)}</div>
                      <div className="mt-1 text-[11px] leading-4 text-slate-500">{item.help}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">普通料动态耗时</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {regularTppItems.map((item) => (
                    <div key={item.label} className="rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2">
                      <div className="text-xs text-slate-500">{item.label}</div>
                      <div className="text-sm font-semibold text-slate-800">{item.value}</div>
                      <div className="mt-1 text-[11px] leading-4 text-slate-500">{item.help}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </details>

          {/* Warnings */}
          {(warnings.length > 0 || visibleScheduleWarnings.length > 0) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Info className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-900">警告与提示</span>
              </div>
              {warnings.length > 0 && (
                <div className="mb-2 space-y-1">
                  <p className="text-xs font-medium text-amber-800">文件夹警告</p>
                  {warnings.map(([folder, warns], idx) => (
                    <p key={idx} className="text-sm text-amber-800">
                      · {folder}: {warns.join(", ")}
                    </p>
                  ))}
                </div>
              )}
              {visibleScheduleWarnings.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-amber-800">排程警告</p>
                  {visibleScheduleWarnings.map((w, idx) => (
                    <p key={idx} className="text-sm text-amber-800">
                      · {normalizeMinuteText(w)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <section className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">本日包耗时</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  只影响当前预览日期；保存后会重新预览，生成 Excel 时沿用同一结果。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDurationDrafts({});
                    setDurationError(null);
                  }}
                  disabled={durationSaving || overrideCount === 0}
                  className="h-8 gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  清除全部
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={saveDurationDrafts}
                  disabled={durationSaving || !onSaveDurationOverrides}
                  className="h-8 gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {durationSaving ? "保存中" : "保存并重新预览"}
                </Button>
              </div>
            </div>
            {durationError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {durationError}
              </div>
            )}
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200/80">
              <div className="grid grid-cols-[minmax(180px,1fr)_90px_132px_96px_110px_84px] gap-0 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                <div>包/文件夹</div>
                <div className="text-center">件数</div>
                <div className="text-center">模式</div>
                <div className="text-center">分钟</div>
                <div className="text-center">换算总耗时</div>
                <div className="text-center">操作</div>
              </div>
              <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto bg-white">
                {editableRecords.map((record) => {
                  const draft = durationDrafts[record.folder];
                  const disabledReason = durationOverrideDisabledFolders?.[record.folder];
                  const isDisabled = Boolean(disabledReason);
                  const qty = getRecordQuantity(record);
                  return (
                    <div
                      key={record.folder}
                      className={`grid grid-cols-[minmax(180px,1fr)_90px_132px_96px_110px_84px] items-center gap-0 px-3 py-2 text-sm ${isDisabled ? 'bg-slate-50/80 text-slate-400' : 'text-slate-700'}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium" title={record.folder}>{record.folder}</div>
                        {disabledReason && <div className="mt-0.5 text-[11px] text-slate-400">{disabledReason}</div>}
                      </div>
                      <div className="text-center tabular-nums">{qty ?? '/'}</div>
                      <div className="px-1">
                        <select
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                          value={draft?.mode || 'package_total'}
                          disabled={isDisabled}
                          onChange={(event) => updateDurationDraft(record.folder, { mode: event.target.value as DurationOverrideMode })}
                        >
                          <option value="package_total">整包总耗时</option>
                          <option value="per_piece">每颗耗时</option>
                        </select>
                      </div>
                      <div className="px-1">
                        <input
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-center text-sm tabular-nums text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                          value={draft?.minutesInput || ''}
                          disabled={isDisabled}
                          inputMode="decimal"
                          placeholder="-"
                          onChange={(event) => updateDurationDraft(record.folder, { minutesInput: event.target.value })}
                        />
                      </div>
                      <div className="text-center text-xs tabular-nums text-slate-500">
                        {durationPreviewByFolder[record.folder] || (record.manual_duration ? `${formatNumber(record.manual_duration)} 分钟` : '-')}
                      </div>
                      <div className="text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={!draft}
                          onClick={() => clearDurationDraft(record.folder)}
                        >
                          清除
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200/80 bg-white/70">
                <tr>
                  <th className="px-3 py-2.5 text-center font-medium text-slate-700 w-14">序号</th>
                  <th className="px-3 py-2.5 text-center font-medium text-slate-700">产品</th>
                  <th className="px-3 py-2.5 text-center font-medium text-slate-700 w-16">件数</th>
                  <th className="px-3 py-2.5 text-center font-medium text-slate-700 w-24">开始</th>
                  <th className="px-3 py-2.5 text-center font-medium text-slate-700 w-24">结束</th>
                  <th className="px-3 py-2.5 text-center font-medium text-slate-700 w-24">每件耗时</th>
                  <th className="px-3 py-2.5 text-center font-medium text-slate-700 w-24">来源</th>
                  <th className="px-3 py-2.5 text-center font-medium text-slate-700 w-28">类型</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => {
                  const isHiddenBuffer = row.type === '隐形缓冲';
                  const isRealManual = row.type === '真实手量';
                  const rowText = isHiddenBuffer
                    ? 'text-amber-600 italic'
                    : isRealManual
                    ? 'text-blue-700 font-medium'
                    : 'text-slate-700';
                  return (
                    <tr key={idx} className="bg-white/70 transition-colors hover:bg-blue-50/40">
                      <td className={`px-3 py-2 text-center ${rowText}`}>{row.seq}</td>
                      <td className={`px-3 py-2 text-center ${rowText}`}>{row.product}</td>
                      <td className={`px-3 py-2 text-center ${rowText}`}>{row.qty}</td>
                      <td className={`px-3 py-2 text-center ${rowText}`}>{row.start}</td>
                      <td className={`px-3 py-2 text-center ${rowText}`}>{row.end}</td>
                      <td className={`px-3 py-2 text-center ${rowText}`}>{row.tpp}</td>
                      <td className="px-3 py-2 text-center">
                        {row.source ? (
                          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${sourcePillClass(row.source)}`}>
                            {sourceLabel(row.source)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-center ${rowText}`}>{row.type}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>

        <div className="flex shrink-0 justify-end border-t border-slate-200/70 bg-white/70 px-5 py-3">
          <Button onClick={onClose}>关闭</Button>
        </div>
      </Card>
    </div>
  );
}
