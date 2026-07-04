import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ManualFolderCandidate, QueueItem, RealManualTask, RecognitionRules } from "@/types/record";
import {
  parseManualDuration,
  recognizeManualTaskFromFolder,
  validateRealManualTask,
} from "@/lib/utils";
import { nanoid } from "@/lib/nanoid";
import { AlertTriangle, CheckCircle2, Clock, Folder, User } from "lucide-react";

interface ManualTaskDialogProps {
  item: QueueItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (tasks: RealManualTask[]) => void;
  onPreview?: (tasks: RealManualTask[]) => void;
  recognitionRules?: RecognitionRules;
  ownerName?: string;
  suggestion?: ManualTimeSuggestion | null;
}

export interface ManualTimeSuggestion {
  minutes: number;
  reason: string;
  taskMinutes?: Record<string, number>;
  taskReasons?: Record<string, string>;
}

const EMPTY_TASK: Partial<RealManualTask> = {
  station: '',
  product: '',
  sender: '',
  work_order: '/',
  mold: '/',
  machine: '/',
  test_type: '测试尺寸',
  send_project: 'OMM',
  send_date: '',
  send_time: '/',
  quantity: '',
  duration_minutes: undefined as unknown as number,
  counting_mode: 'separate',
  operator: '',
  note: '',
  from_recognition: false,
};

const FIELD_NAMES: Record<string, string> = {
  station: '工站',
  product: '品名',
  sender: '送测人',
  send_date: '测试日期',
  quantity: '数量',
  duration_minutes: '耗时（分钟）',
  operator: '测量员',
};

function formatDuration(minutes?: number | null): string {
  if (minutes === undefined || minutes === null || Number.isNaN(minutes)) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}小时${m}分钟`;
  if (h > 0) return `${h}小时`;
  return `${m}分钟`;
}

function sanitizeSuggestedMinutes(minutes?: number | null): number | null {
  if (!Number.isFinite(minutes || NaN)) return null;
  return Math.max(1, Math.round(Number(minutes)));
}

function getQuantityFromText(value?: string | number | null): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function normalizeManualSendDate(value?: string): string {
  const raw = (value || "").trim();
  if (!raw) return raw;
  const chinese = raw.match(/^(\d{1,2})月(\d{1,2})日?([AB])?$/i);
  if (chinese) return `${chinese[1]}.${chinese[2]}${chinese[3] || ""}`;
  return raw;
}

function CandidateInfo({ candidate, task, ownerName }: { candidate?: ManualFolderCandidate; task?: RealManualTask; ownerName?: string }) {
  if (!candidate) return null;
  const recognized = candidate.recognized || {};
  const warnings = recognized.recognition_warnings || [];
  const missingFields: string[] = [];
  if (!recognized.station) missingFields.push('工站');
  if (!recognized.product) missingFields.push('品名');
  if (!recognized.sender) missingFields.push('送测人');
  if (!recognized.send_date) missingFields.push('测试日期');
  if (!recognized.quantity) missingFields.push('数量');
  if (!recognized.operator) missingFields.push('测量员');
  // 手量耗时通常不写进文件夹名，不列为强警告

  const hasDurationAuto = recognized.duration_minutes !== undefined && recognized.duration_minutes !== null && recognized.duration_minutes > 0;

  return (
    <div className="space-y-1.5 rounded-xl border border-slate-200/80 bg-white/70 p-2.5 text-xs shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-1.5 text-slate-600">
        <Folder className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span className="break-all flex-1">来源：{candidate.folderName}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-700">
        {recognized.station && <span>工站：{recognized.station}</span>}
        {recognized.product && <span>品名：{recognized.product}</span>}
        {recognized.sender && <span>送测人：{recognized.sender}</span>}
        {recognized.quantity && <span>数量：{recognized.quantity}</span>}
        {hasDurationAuto ? (
          <span className="flex items-center gap-1 text-blue-700">
            <Clock className="h-3 w-3" />
            自动识别耗时：{formatDuration(recognized.duration_minutes)}
          </span>
        ) : (
          <span className="text-slate-500">耗时：待填写</span>
        )}
        {recognized.operator && <span className="flex items-center gap-1"><User className="h-3 w-3" />测量员：{recognized.operator}</span>}
      </div>
      {ownerName && recognized.operator && recognized.operator !== ownerName && (
        <div className="flex items-start gap-1.5 text-blue-700">
          <User className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            该手量将写入 <strong>{ownerName}</strong> 日报，量测员按 <strong>{recognized.operator}</strong> 填写
          </span>
        </div>
      )}
      {missingFields.length > 0 && (
        <div className="flex items-start gap-1.5 text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>需人工补充：{missingFields.join('、')}</span>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="space-y-1 text-amber-700">
          <div className="font-medium">来源文件夹提示：</div>
          {warnings.map((warning, index) => (
            <div key={index} className="flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}
      {task && validateRealManualTask(task).length === 0 && (
        <div className="flex items-center gap-1.5 text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          字段完整
        </div>
      )}
    </div>
  );
}

export const ManualTaskDialog: React.FC<ManualTaskDialogProps> = ({
  item,
  open,
  onOpenChange,
  onSave,
  onPreview,
  recognitionRules,
  ownerName = '',
  suggestion = null,
}) => {
  const existingTasks = useMemo(() => {
    if (!item) return [];
    const existing = item.settingsOverride?.real_manual_tasks || [];
    return existing.length > 0 ? existing.map((t) => ({ ...t })) : [];
  }, [item, open]);

  const defaultDate = useMemo(() => {
    if (!item) return '';
    // 尝试从 6.13A 这种 dateFolder 解析月和日
    const m = item.dateFolder.match(/^(\d+)\.(\d+)/);
    if (m) {
      return `${m[1]}.${m[2]}`;
    }
    const now = new Date();
    return `${now.getMonth() + 1}.${now.getDate()}`;
  }, [item]);

  const patchedExistingTasks = useMemo(() => {
    return existingTasks.map((t) => ({
      ...t,
      send_date: t.send_date || defaultDate,
      station: t.station || '',
      counting_mode: t.counting_mode || 'separate',
    }));
  }, [existingTasks, defaultDate]);

  const candidateMap = useMemo(() => {
    const map: Record<string, ManualFolderCandidate> = {};
    if (!item) return map;
    for (const c of item.manualCandidates || []) {
      map[`folder:${c.folderName}`] = c;
    }
    return map;
  }, [item, open]);

  const candidateDrafts = useMemo(() => {
    if (!item) return [];
    const candidates = item.manualCandidates || [];
    if (candidates.length === 0) return [];
    const existingSourceFolders = new Set(patchedExistingTasks.map((t) => t.source_folder).filter(Boolean));
    const drafts: RealManualTask[] = [];
    for (const c of candidates) {
      if (existingSourceFolders.has(c.folderName)) continue;
      const rec = c.recognized || {};
      drafts.push({
        ...EMPTY_TASK,
        ...rec,
        send_date: rec.send_date || defaultDate,
        station: rec.station || '',
        id: nanoid(),
        duration_minutes: rec.duration_minutes ?? (0 as unknown as number),
        note: rec.note || '手量',
        from_recognition: true,
        source_folder: c.folderName,
      } as RealManualTask);
    }
    return drafts;
  }, [item, open, patchedExistingTasks, defaultDate]);

  const initialTasks = useMemo(() => {
    return [...patchedExistingTasks, ...candidateDrafts];
  }, [patchedExistingTasks, candidateDrafts]);

  const [tasks, setTasks] = useState<RealManualTask[]>(initialTasks);
  const [rawInput, setRawInput] = useState("");
  const [recognizeLog, setRecognizeLog] = useState<string[]>([]);

  React.useEffect(() => {
    if (open) {
      setTasks(initialTasks);
      setRawInput("");
      setRecognizeLog([]);
    }
  }, [open, initialTasks]);

  const effectiveShift = item?.shiftOverride || item?.shift || null;
  const hasCandidates = (item?.manualCandidates?.length || 0) > 0;
  const autoRecognizedCount = tasks.filter((t) => t.from_recognition && t.duration_minutes && t.duration_minutes > 0).length;
  const suggestedMinutes = sanitizeSuggestedMinutes(suggestion?.minutes);
  const suggestedInput = suggestedMinutes ? `${suggestedMinutes}分钟` : "";

  const getTaskSuggestion = (task: RealManualTask) => {
    const sourceKey = task.source_folder ? `folder:${task.source_folder}` : "";
    const mapped = sourceKey ? sanitizeSuggestedMinutes(suggestion?.taskMinutes?.[sourceKey]) : null;
    if (mapped) {
      return {
        minutes: mapped,
        input: `${mapped}分钟`,
        reason: suggestion?.taskReasons?.[sourceKey] || suggestion?.reason || "根据该条手量件数和日报缺口估算。",
      };
    }
    const qty = getQuantityFromText(task.quantity);
    if (qty > 0) {
      const minutes = Math.min(240, Math.max(10, Math.round(qty * 2)));
      return {
        minutes,
        input: `${minutes}分钟`,
        reason: `按该条 ${qty} PCS 估算，先按约 2 分钟/件给出起点。`,
      };
    }
    if (suggestedMinutes && suggestedInput) {
      return { minutes: suggestedMinutes, input: suggestedInput, reason: suggestion?.reason || "根据当前日报缺口估算。" };
    }
    return null;
  };

  const handleAdd = () => {
    setTasks((prev) => [
      ...prev,
      {
        ...EMPTY_TASK,
        send_date: defaultDate,
        id: nanoid(),
        send_project: 'OMM',
        test_type: '测试尺寸',
        work_order: '/',
        mold: '/',
        machine: '/',
        send_time: '/',
        counting_mode: 'separate',
        note: '手量',
        from_recognition: false,
      } as RealManualTask,
    ]);
  };

  const handleRemove = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdate = (id: string, patch: Partial<RealManualTask>) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch };
        if ('durationInput' in patch && patch.durationInput !== undefined) {
          const parsed = parseManualDuration(patch.durationInput);
          if (parsed !== null) {
            next.duration_minutes = parsed;
          } else if (patch.durationInput.trim() === '') {
            next.duration_minutes = 0 as unknown as number;
          }
          (next as unknown as Record<string, string>).durationInput = patch.durationInput;
        }
        return next;
      })
    );
  };

  const applySuggestionToTask = (id: string) => {
    const task = tasks.find((it) => it.id === id);
    if (!task) return;
    const taskSuggestion = getTaskSuggestion(task);
    if (!taskSuggestion) return;
    handleUpdate(id, { durationInput: taskSuggestion.input, duration_minutes: taskSuggestion.minutes });
  };

  const applySuggestionToEmptyTasks = () => {
    setTasks((prev) =>
      prev.map((task) => {
        const raw = (task as RealManualTask & { durationInput?: string }).durationInput || "";
        if ((task.duration_minutes && task.duration_minutes > 0) || raw.trim()) return task;
        const taskSuggestion = getTaskSuggestion(task);
        if (!taskSuggestion) return task;
        return {
          ...task,
          durationInput: taskSuggestion.input,
          duration_minutes: taskSuggestion.minutes,
          note: task.note || "手量",
        };
      })
    );
  };

  const handleRecognize = () => {
    const lines = rawInput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const logs: string[] = [];
    const newTasks: RealManualTask[] = [];
    for (const line of lines) {
      const recognized = recognizeManualTaskFromFolder(line, recognitionRules);
      newTasks.push({
        ...EMPTY_TASK,
        ...recognized,
        id: nanoid(),
        duration_minutes: recognized.duration_minutes ?? 0,
        counting_mode: recognized.counting_mode ?? 'separate',
        note: recognized.note || '手量',
        from_recognition: true,
      } as RealManualTask);
      const warnings = recognized.recognition_warnings || [];
      logs.push(warnings.length > 0 ? `已识别：${line}；需确认：${warnings.join('；')}` : `已识别：${line}`);
    }
    setTasks((prev) => [...prev, ...newTasks]);
    setRecognizeLog(logs);
  };

  const normalizeTasksForSave = (source: RealManualTask[]) =>
    source.map((task) => ({
      ...task,
      send_date: normalizeManualSendDate(task.send_date),
      note: task.note || '手量',
    }));

  const handleSave = () => {
    onSave(normalizeTasksForSave(tasks));
    onOpenChange(false);
  };

  const handleSaveAndPreview = () => {
    const normalizedTasks = normalizeTasksForSave(tasks);
    onSave(normalizedTasks);
    onOpenChange(false);
    onPreview?.(normalizedTasks);
  };

  const validationMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const t of tasks) {
      map[t.id] = validateRealManualTask(t);
    }
    return map;
  }, [tasks]);

  const hasIncomplete = Object.values(validationMap).some((arr) => arr.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="flex h-[86vh] max-h-[86vh] max-w-5xl flex-col overflow-hidden">
      <DialogHeader className="shrink-0">
        <DialogTitle>手量任务管理 / 补录 - {item?.dateFolder || ''}</DialogTitle>
        <div className="text-sm text-slate-500">
          识别班次：{effectiveShift ? `${effectiveShift}班` : '未识别'}
          {ownerName && (
            <span className="ml-2 text-blue-700">
              日报归属人：<strong>{ownerName}</strong>
            </span>
          )}
        </div>
      </DialogHeader>
      <DialogContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-5">
        {hasCandidates && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-sm text-blue-800">
            已从日期文件夹发现 {item?.manualCandidates?.length || 0} 个手量文件夹，请确认耗时后保存。
            {autoRecognizedCount > 0 && (
              <span className="ml-1">其中 {autoRecognizedCount} 条耗时已自动识别，仍需人工确认。</span>
            )}
          </div>
        )}
        {suggestedMinutes && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/85 p-3 text-sm text-emerald-800">
            <div>
              <div className="font-medium">推荐手量耗时：按每条件数分别估算</div>
              <div className="mt-1 text-xs leading-5">{suggestion?.reason || "根据当前件数和日报缺口估算；不同件数会得到不同推荐值。"}</div>
            </div>
            <Button type="button" size="sm" variant="outline" className="border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50" onClick={applySuggestionToEmptyTasks}>
              填入空耗时
            </Button>
          </div>
        )}
        {hasIncomplete && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-700">
            存在未补齐的真实手量字段，正式生成前请补全。
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">粘贴文件夹名识别</label>
            <textarea
              className="h-32 w-full rounded-lg border border-slate-200/90 bg-white/80 px-3 py-2 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-visible:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
              placeholder="每行一个文件夹名，支持 -手量-姓名 强特征"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
            />
            <Button size="sm" variant="secondary" onClick={handleRecognize}>识别手量</Button>
            {recognizeLog.length > 0 && (
              <div className="max-h-24 overflow-y-auto rounded-lg border border-slate-200/80 bg-white/70 p-2 text-xs text-slate-600">
                {recognizeLog.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">当前手量记录（{tasks.length} 条）</label>
            <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-200/80 bg-white/60 p-2">
              {tasks.length === 0 ? (
                <div className="p-4 text-sm text-slate-400">暂无手量记录</div>
              ) : (
              tasks.map((t) => {
                const errs = validationMap[t.id] || [];
                const taskSuggestion = getTaskSuggestion(t);
                const durationInput = (t as RealManualTask & { durationInput?: string }).durationInput ?? (t.duration_minutes > 0 ? t.duration_minutes.toString() : '');
                const parsedMinutes = parseManualDuration(durationInput);
                const parsedDurationText = durationInput.trim().length > 0
                  ? parsedMinutes !== null
                    ? `将按 ${parsedMinutes} 分钟计入`
                    : '无法识别，请重新输入'
                  : null;
                const candidate = t.source_folder ? candidateMap[`folder:${t.source_folder}`] : undefined;
                return (
                    <div
                      key={t.id}
                      className={`space-y-2 rounded-xl border p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${errs.length > 0 ? 'border-amber-200 bg-amber-50/90' : 'border-slate-200/80 bg-white/80'}`}
                    >
                      {candidate && <CandidateInfo candidate={candidate} task={t} ownerName={ownerName} />}
                      {ownerName && t.operator && t.operator !== ownerName && !candidate && (
                        <div className="text-xs text-blue-700 flex items-start gap-1.5">
                          <User className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>
                            该手量将写入 <strong>{ownerName}</strong> 日报，量测员按 <strong>{t.operator}</strong> 填写
                          </span>
                        </div>
                      )}
                      {!candidate && (t.recognition_warnings || []).length > 0 && (
                        <div className="space-y-1 text-xs text-amber-700">
                          <div className="font-medium">来源文件夹提示：</div>
                          {(t.recognition_warnings || []).map((warning, index) => (
                            <div key={index} className="flex items-start gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              <span>{warning}</span>
                            </div>
                          ))}
                        </div>
                      )}
                  <div className="grid grid-cols-3 gap-2">
                    {(['station', 'product', 'sender'] as const).map((field) => (
                      <div key={field} className="space-y-0.5">
                        <label className="text-[10px] text-slate-500">{FIELD_NAMES[field]}</label>
                        <Input
                          className="h-7 text-xs"
                          value={t[field] as string}
                          onChange={(e) => handleUpdate(t.id, { [field]: e.target.value })}
                        />
                      </div>
                    ))}
                    <div className="space-y-0.5">
                      <label className="text-[10px] text-slate-500">{FIELD_NAMES.send_date}</label>
                      <Input
                        className="h-7 text-xs"
                        value={t.send_date}
                        onChange={(e) => handleUpdate(t.id, { send_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] text-slate-500">{FIELD_NAMES.quantity}</label>
                      <Input
                        className="h-7 text-xs"
                        value={t.quantity}
                        onChange={(e) => handleUpdate(t.id, { quantity: e.target.value })}
                      />
                    </div>
                        <div className="space-y-0.5 col-span-2">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-[10px] text-slate-500">{FIELD_NAMES.duration_minutes}</label>
                            {taskSuggestion && (
                              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-emerald-700" onClick={() => applySuggestionToTask(t.id)}>
                                用推荐 {taskSuggestion.minutes} 分钟
                              </Button>
                            )}
                          </div>
                          <Input
                            className="h-7 text-xs"
                            placeholder="例如 90分钟、1.5h、2"
                            value={durationInput}
                            onChange={(e) => handleUpdate(t.id, { durationInput: e.target.value })}
                          />
                          <p className="text-[10px] text-slate-400">
                            裸数字仍按小时理解；推荐值会写成“分钟”，避免误判。
                          </p>
                          {parsedDurationText && (
                            <p className="text-xs text-blue-700 font-medium">{parsedDurationText}</p>
                          )}
                          {taskSuggestion && (
                            <p className="text-[10px] leading-4 text-emerald-700">{taskSuggestion.reason}</p>
                          )}
                        </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] text-slate-500">{FIELD_NAMES.operator}</label>
                      <Input
                        className="h-7 text-xs"
                        value={t.operator}
                        onChange={(e) => handleUpdate(t.id, { operator: e.target.value })}
                      />
                    </div>
                    <div className="space-y-0.5 col-span-3">
                      <label className="text-[10px] text-slate-500">计时方式</label>
                      <select
                        className="h-7 w-full rounded-lg border border-slate-200/90 bg-white/80 px-2 text-xs focus-visible:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
                        value={t.counting_mode || 'separate'}
                        onChange={(e) => handleUpdate(t.id, { counting_mode: e.target.value as RealManualTask['counting_mode'] })}
                      >
                        <option value="separate">OMM + 手量都计时（同一天都测）</option>
                        <option value="manual_only">只计手量（OMM 已在其他日期登记）</option>
                      </select>
                      <p className="text-[10px] text-slate-400">
                        选“只计手量”时，生成/预览会跳过同品名同测量员的普通 OMM 记录，避免重复计时。
                      </p>
                    </div>
                  </div>
                      {errs.length > 0 && (
                        <div className="text-xs text-amber-700 flex items-start gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{errs.join('；')}</span>
                        </div>
                      )}
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-red-600"
                          onClick={() => handleRemove(t.id)}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <Button size="sm" variant="outline" onClick={handleAdd}>+ 添加记录</Button>
          </div>
        </div>
      </DialogContent>
      <DialogFooter className="shrink-0">
        <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
        <Button variant="secondary" onClick={handleSave}>保存到当前日期</Button>
        <Button onClick={handleSaveAndPreview}>保存并预览</Button>
      </DialogFooter>
    </Dialog>
  );
};
