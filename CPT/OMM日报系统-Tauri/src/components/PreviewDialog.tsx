import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PreviewData } from "@/types/record";
import { AlertTriangle, CheckCircle2, Clock, FileSpreadsheet, Info, Settings2, Wrench } from "lucide-react";

interface PreviewDialogProps {
  open: boolean;
  data: PreviewData | null;
  onClose: () => void;
  onGenerate?: () => void;
  onOpenManual?: () => void;
  onOpenDaySettings?: () => void;
}

function formatMinutes(minutes: number): string {
  const safeMinutes = Number.isFinite(minutes) ? Math.round(minutes) : 0;
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}m`;
}

function sourceLabel(source?: string): string {
  switch (source) {
    case 'special': return '特殊大件';
    case 'zhengxing_cnc': return '整形CNC';
    case 'cnc': return '普通CNC';
    case 'real_manual': return '真实手量';
    case 'hand_filler': return '补时间手量';
    case 'other_filler': return '其他事务';
    case 'hidden_buffer': return '隐形缓冲';
    case 'break': return '固定休息';
    case 'supplement_manual': return '补录手量';
    case 'supplement_other': return '补录事务';
    case 'tpp': return '普通';
    default: return source || '';
  }
}

function sourcePillClass(source?: string): string {
  switch (source) {
    case 'real_manual': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'supplement_manual': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'special': return 'bg-purple-50 text-purple-700 border-purple-200';
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

export function PreviewDialog({ open, data, onClose, onGenerate, onOpenManual, onOpenDaySettings }: PreviewDialogProps) {
  if (!open || !data) return null;

  const { folder_name, shift_label, early_leave, rows, summary, warnings, schedule_warnings } = data;

  const title = `预览 - ${folder_name} (${shift_label}班${early_leave ? "-下早班" : ""})`;

  const effectiveDelta = Math.round(summary.total_effective - summary.required_effective);
  const hasEnoughTime = summary.meets_required;
  const needMinutes = Math.max(0, Math.round(summary.estimates?.need_minutes ?? Math.abs(effectiveDelta)));
  const statusTitle = summary.decision?.title || (hasEnoughTime ? "当天可以生成" : "有效时长不足");
  const statusMessage = summary.decision?.message || (
    hasEnoughTime
      ? "有效计入已经达到最低要求。下方明细仅供核对，不需要逐项理解也可以继续生成。"
      : "有效计入还没有达到最低要求，建议先补录手量/事务，或打开单日设置确认当天规则。"
  );

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
    { label: "特殊/CNC", value: (summary.special_effective || 0) + (summary.zhengxing_cnc_effective || 0) + (summary.cnc_effective || 0), help: "特殊大件、整形 CNC、普通 CNC 的计入量。" },
    { label: "其他事务", value: summary.other_filler_minutes || 0, help: "手动补录的其他事务时间。" },
  ];

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
          <div className={`rounded-xl border px-4 py-3 ${shortageClass(summary.shortage_level || (hasEnoughTime ? 'ok' : 'shortage'))}`}>
            <div className="flex items-start gap-3">
              {shortageIcon(summary.shortage_level || (hasEnoughTime ? 'ok' : 'shortage'))}
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
                {!hasEnoughTime && (
                  <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm leading-6">
                    还差约 <span className="font-semibold">{needMinutes}</span> 分钟；可先补录手量/其他事务，或确认当天是否应调整下班策略。
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
                        <span className="font-medium">{opt.label}</span>：{opt.description}
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
                    {onGenerate && (
                      <Button size="sm" variant="outline" onClick={() => { onClose(); onGenerate(); }} className="h-8 gap-1.5 bg-white/70 border-current hover:bg-white">
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        仍按此结果生成
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

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
            </div>
          </details>

          {/* Warnings */}
          {(warnings.length > 0 || schedule_warnings.length > 0) && (
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
              {schedule_warnings.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-amber-800">排程警告</p>
                  {schedule_warnings.map((w, idx) => (
                    <p key={idx} className="text-sm text-amber-800">
                      · {w}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

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
