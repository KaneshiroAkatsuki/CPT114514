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

  const statItems = [
    { label: "总在岗", value: formatMinutes(summary.total_shift) },
    { label: "纯工作", value: formatMinutes(summary.total_work) },
    { label: "有效时长", value: formatMinutes(summary.total_effective) },
    { label: "需要最低", value: formatMinutes(summary.required_effective) },
    { label: "固定休息", value: formatMinutes(summary.total_rest) },
    { label: "隐形缓冲", value: formatMinutes(summary.hidden_buffer_total) },
    { label: "目标下班", value: summary.target_clock_end },
    { label: "实际结束", value: summary.actual_last_end },
  ];

  const contributionItems = [
    { label: "普通任务", value: summary.regular_effective || 0 },
    { label: "真实手量", value: summary.real_manual_effective || 0 },
    { label: "特殊大件", value: summary.special_effective || 0 },
    { label: "整形CNC", value: summary.zhengxing_cnc_effective || 0 },
    { label: "普通CNC", value: summary.cnc_effective || 0 },
    { label: "补时间手量", value: summary.hand_filler_minutes || 0 },
    { label: "其他事务", value: summary.other_filler_minutes || 0 },
    { label: "隐形缓冲", value: summary.hidden_buffer_total || 0 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-[900px] max-w-full h-[680px] max-h-[90vh] flex flex-col overflow-hidden rounded-lg border-slate-200 shadow-xl">
        <CardHeader className="shrink-0 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
          <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            {title}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {statItems.map((item) => (
              <div key={item.label} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-xs text-slate-500">{item.label}</div>
                <div className="text-sm font-semibold text-slate-800">{item.value}</div>
              </div>
            ))}
          </div>

          {/* Shortage diagnosis */}
          {summary.decision && (
            <div className={`rounded-lg border px-4 py-3 ${shortageClass(summary.shortage_level)}`}>
              <div className="flex items-start gap-2">
                {shortageIcon(summary.shortage_level)}
                <div className="flex-1">
                  <p className="text-sm font-semibold">{summary.decision.title}</p>
                  <p className="text-sm leading-6 mt-0.5 opacity-90">{summary.decision.message}</p>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {contributionItems.map((item) => (
                      <div key={item.label} className="rounded bg-white/60 px-2 py-1.5">
                        <div className="text-xs opacity-80">{item.label}</div>
                        <div className="text-sm font-medium">{formatMinutes(item.value)}</div>
                      </div>
                    ))}
                  </div>
                  {summary.decision.options && summary.decision.options.length > 0 && (
                    <div className="mt-3 space-y-1.5 rounded bg-white/60 p-2.5">
                      <p className="text-sm font-medium">可选处理方式</p>
                      {summary.decision.options.map((opt) => (
                        <div key={opt.key} className="text-sm leading-6">
                          <span className="font-medium">{opt.label}</span>：{opt.description}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {onGenerate && (
                      <Button size="sm" variant="outline" onClick={() => { onClose(); onGenerate(); }} className="h-8 gap-1.5 bg-white/70 border-current hover:bg-white">
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        仍按此结果生成
                      </Button>
                    )}
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
                </div>
              </div>
            </div>
          )}

          {!summary.decision && (
            summary.meets_required ? (
              <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-green-800">已满足最低有效时长要求</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-red-800">有效时长不足</span>
                </div>
                {summary.estimates && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm leading-6 text-amber-900 whitespace-pre-line">
                      还差 {Math.round(summary.estimates.need_minutes)} 分钟{"\n"}
                      乐观估计: 还需约 {summary.estimates.optimistic} 件{"\n"}
                      保守估计: 还需约 {summary.estimates.conservative} 件
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {onGenerate && (
                    <Button size="sm" variant="outline" onClick={() => { onClose(); onGenerate(); }} className="h-8 gap-1.5">
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      仍按此结果生成
                    </Button>
                  )}
                  {onOpenManual && (
                    <Button size="sm" variant="outline" onClick={() => { onClose(); onOpenManual(); }} className="h-8 gap-1.5">
                      <Wrench className="h-3.5 w-3.5" />
                      打开手量补录
                    </Button>
                  )}
                  {onOpenDaySettings && (
                    <Button size="sm" variant="outline" onClick={() => { onClose(); onOpenDaySettings(); }} className="h-8 gap-1.5">
                      <Settings2 className="h-3.5 w-3.5" />
                      打开单日设置
                    </Button>
                  )}
                </div>
              </div>
            )
          )}

          {/* Warnings */}
          {(warnings.length > 0 || schedule_warnings.length > 0) && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
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
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
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
                    <tr key={idx} className="bg-white hover:bg-slate-50/80 transition-colors">
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

        <div className="shrink-0 border-t border-slate-100 bg-slate-50/50 px-5 py-3 flex justify-end">
          <Button onClick={onClose}>关闭</Button>
        </div>
      </Card>
    </div>
  );
}
