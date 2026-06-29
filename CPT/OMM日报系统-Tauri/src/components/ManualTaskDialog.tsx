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
import type { ManualFolderCandidate, QueueItem, RealManualTask } from "@/types/record";
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

function CandidateInfo({ candidate, task }: { candidate?: ManualFolderCandidate; task?: RealManualTask }) {
  if (!candidate) return null;
  const recognized = candidate.recognized || {};
  const missingFields: string[] = [];
  if (!recognized.station) missingFields.push('工站');
  if (!recognized.product) missingFields.push('品名');
  if (!recognized.sender) missingFields.push('送测人');
  if (!recognized.send_date) missingFields.push('测试日期');
  if (!recognized.quantity) missingFields.push('数量');
  if (recognized.duration_minutes === undefined || recognized.duration_minutes === null) missingFields.push('耗时');
  if (!recognized.operator) missingFields.push('测量员');

  const hasDurationAuto = recognized.duration_minutes !== undefined && recognized.duration_minutes !== null;

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs space-y-1.5">
      <div className="flex items-start gap-1.5 text-slate-600">
        <Folder className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span className="break-all flex-1">来源：{candidate.folderName}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-700">
        {recognized.station && <span>工站：{recognized.station}</span>}
        {recognized.product && <span>品名：{recognized.product}</span>}
        {recognized.sender && <span>送测人：{recognized.sender}</span>}
        {recognized.quantity && <span>数量：{recognized.quantity}</span>}
        {hasDurationAuto && (
          <span className="flex items-center gap-1 text-blue-700">
            <Clock className="h-3 w-3" />
            自动识别耗时：{formatDuration(recognized.duration_minutes)}
          </span>
        )}
        {recognized.operator && <span className="flex items-center gap-1"><User className="h-3 w-3" />测量员：{recognized.operator}</span>}
      </div>
      {missingFields.length > 0 && (
        <div className="flex items-start gap-1.5 text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>需人工补充：{missingFields.join('、')}</span>
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
      return `${m[1]}月${m[2]}日`;
    }
    const now = new Date();
    return `${now.getMonth() + 1}月${now.getDate()}日`;
  }, [item]);

  const patchedExistingTasks = useMemo(() => {
    return existingTasks.map((t) => ({
      ...t,
      send_date: t.send_date || defaultDate,
      station: t.station || '',
    }));
  }, [existingTasks, defaultDate]);

  const candidateMap = useMemo(() => {
    const map: Record<string, ManualFolderCandidate> = {};
    if (!item) return map;
    for (const c of item.manualCandidates || []) {
      map[`folder:${c.folderName}`] = c;
      if (c.recognized?.product) {
        map[`product:${c.recognized.product}`] = c;
      }
    }
    return map;
  }, [item, open]);

  const candidateDrafts = useMemo(() => {
    if (!item) return [];
    const candidates = item.manualCandidates || [];
    if (candidates.length === 0) return [];
    const existingProducts = new Set(patchedExistingTasks.map((t) => t.product));
    const existingSourceFolders = new Set(patchedExistingTasks.map((t) => t.source_folder).filter(Boolean));
    const drafts: RealManualTask[] = [];
    for (const c of candidates) {
      const recognizedProduct = c.recognized?.product;
      if (existingSourceFolders.has(c.folderName)) continue;
      if (recognizedProduct && existingProducts.has(recognizedProduct)) continue;
      const rec = c.recognized || {};
      drafts.push({
        ...EMPTY_TASK,
        ...rec,
        send_date: rec.send_date || defaultDate,
        station: rec.station || '',
        id: nanoid(),
        duration_minutes: rec.duration_minutes ?? (0 as unknown as number),
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
  const autoRecognizedCount = tasks.filter((t) => t.from_recognition && t.duration_minutes).length;

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
          }
        }
        return next;
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
      const recognized = recognizeManualTaskFromFolder(line);
      if (!recognized.operator) {
        logs.push(`未识别到手量测量员：${line}`);
        continue;
      }
      newTasks.push({
        ...EMPTY_TASK,
        ...recognized,
        id: nanoid(),
        duration_minutes: recognized.duration_minutes ?? 0,
        from_recognition: true,
      } as RealManualTask);
      logs.push(`已识别：${line}`);
    }
    setTasks((prev) => [...prev, ...newTasks]);
    setRecognizeLog(logs);
  };

  const handleSave = () => {
    onSave(tasks);
    onOpenChange(false);
  };

  const handleSaveAndPreview = () => {
    onSave(tasks);
    onOpenChange(false);
    onPreview?.(tasks);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>手量任务管理 / 补录 - {item?.dateFolder || ''}</DialogTitle>
        <div className="text-sm text-slate-500">
          识别班次：{effectiveShift ? `${effectiveShift}班` : '未识别'}
        </div>
      </DialogHeader>
      <DialogContent className="space-y-4">
        {hasCandidates && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            已从日期文件夹发现 {item?.manualCandidates?.length || 0} 个手量文件夹，请确认耗时后保存。
            {autoRecognizedCount > 0 && (
              <span className="ml-1">其中 {autoRecognizedCount} 条耗时已自动识别，仍需人工确认。</span>
            )}
          </div>
        )}
        {hasIncomplete && (
          <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-700 border border-amber-200">
            存在未补齐的真实手量字段，正式生成前请补全。
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">粘贴文件夹名识别</label>
            <textarea
              className="h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="每行一个文件夹名，支持 -手量-姓名 强特征"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
            />
            <Button size="sm" variant="secondary" onClick={handleRecognize}>识别手量</Button>
            {recognizeLog.length > 0 && (
              <div className="max-h-24 overflow-y-auto rounded bg-slate-50 p-2 text-xs text-slate-600">
                {recognizeLog.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">当前手量记录（{tasks.length} 条）</label>
            <div className="max-h-80 overflow-y-auto rounded-md border space-y-2 p-2">
              {tasks.length === 0 ? (
                <div className="p-4 text-sm text-slate-400">暂无手量记录</div>
              ) : (
                tasks.map((t) => {
                  const errs = validationMap[t.id] || [];
                  const durationInput = t.duration_minutes?.toString() || '';
                  const candidate = (t.source_folder && candidateMap[`folder:${t.source_folder}`]) || candidateMap[`product:${t.product}`];
                  return (
                    <div
                      key={t.id}
                      className={`rounded-md border p-2 space-y-2 ${errs.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}
                    >
                      {candidate && <CandidateInfo candidate={candidate} task={t} />}
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
                    <div className="space-y-0.5">
                      <label className="text-[10px] text-slate-500">{FIELD_NAMES.duration_minutes}</label>
                      <Input
                        className="h-7 text-xs"
                        placeholder="1.5H/90分钟/1:30"
                        value={durationInput}
                        onChange={(e) => handleUpdate(t.id, { durationInput: e.target.value })}
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] text-slate-500">{FIELD_NAMES.operator}</label>
                      <Input
                        className="h-7 text-xs"
                        value={t.operator}
                        onChange={(e) => handleUpdate(t.id, { operator: e.target.value })}
                      />
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
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
        <Button variant="secondary" onClick={handleSave}>保存到当前日期</Button>
        <Button onClick={handleSaveAndPreview}>保存并预览</Button>
      </DialogFooter>
    </Dialog>
  );
};
