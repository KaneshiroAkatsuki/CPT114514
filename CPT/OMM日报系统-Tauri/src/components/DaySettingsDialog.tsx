import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FillerPosition } from "@/types/record";
import { Settings2, X } from "lucide-react";
import { useState, useEffect } from "react";

interface DaySettingsDialogProps {
  open: boolean;
  folderName: string;
  leaveStrategy: 'auto' | 'early' | 'normal' | undefined;
  enableHand: boolean | undefined;
  enableOther: boolean | undefined;
  fillerPosition: FillerPosition | undefined;
  globalEnableHand: boolean;
  globalEnableOther: boolean;
  globalFillerPosition: FillerPosition;
  globalLeaveStrategy: 'auto' | 'early' | 'normal';
  onSave: (settings: {
    leave_strategy?: 'auto' | 'early' | 'normal';
    enable_hand?: boolean;
    enable_other?: boolean;
    filler_position?: FillerPosition;
  }) => void;
  onClear: () => void;
  onClose: () => void;
}

export function DaySettingsDialog({
  open,
  folderName,
  leaveStrategy,
  enableHand,
  enableOther,
  fillerPosition,
  globalEnableHand,
  globalEnableOther,
  globalFillerPosition,
  globalLeaveStrategy,
  onSave,
  onClear,
  onClose,
}: DaySettingsDialogProps) {
  const [leave, setLeave] = useState<'auto' | 'early' | 'normal'>(leaveStrategy ?? globalLeaveStrategy);
  const [hand, setHand] = useState<boolean>(enableHand ?? globalEnableHand);
  const [other, setOther] = useState<boolean>(enableOther ?? globalEnableOther);
  const [position, setPosition] = useState<FillerPosition>(fillerPosition ?? globalFillerPosition);

  useEffect(() => {
    if (open) {
      setLeave(leaveStrategy ?? globalLeaveStrategy);
      setHand(enableHand ?? globalEnableHand);
      setOther(enableOther ?? globalEnableOther);
      setPosition(fillerPosition ?? globalFillerPosition);
    }
  }, [open, leaveStrategy, enableHand, enableOther, fillerPosition, globalEnableHand, globalEnableOther, globalFillerPosition, globalLeaveStrategy]);

  if (!open) return null;

  const hasOverrides = leaveStrategy !== undefined || enableHand !== undefined || enableOther !== undefined || fillerPosition !== undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <Card className="w-[420px] max-w-full overflow-hidden rounded-2xl border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200/70 bg-white/90 px-5 py-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <Settings2 className="h-4 w-4 text-blue-600" />
            单日设置 - {folderName}
          </CardTitle>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-slate-400 transition hover:border-slate-200/80 hover:bg-white/80 hover:text-slate-700 hover:shadow-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white/70 p-3">
            <label className="text-sm font-medium text-slate-700">下班策略</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'auto', label: '智能判断' },
                { key: 'early', label: '下早班' },
                { key: 'normal', label: '不下早班' },
              ].map((opt) => (
                <Button
                  key={opt.key}
                  type="button"
                  size="sm"
                  variant={leave === opt.key ? 'default' : 'outline'}
                  onClick={() => setLeave(opt.key as 'auto' | 'early' | 'normal')}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200/80 bg-white/70 p-3 shadow-sm">
            <p className="text-xs font-medium text-slate-500">补时长选项</p>
            <label className="flex items-center justify-between text-sm text-slate-700 cursor-pointer">
              允许补时间手量
              <input
                type="checkbox"
                checked={hand}
                onChange={(e) => setHand(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </label>
            <label className="flex items-center justify-between text-sm text-slate-700 cursor-pointer">
              允许补其他事务
              <input
                type="checkbox"
                checked={other}
                onChange={(e) => setOther(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </label>
            <div className="space-y-2 border-t border-slate-200/70 pt-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-700">补时插入位置</div>
                  <div className="mt-0.5 text-xs leading-5 text-slate-500">保存后预览/生成会提示插入位置。</div>
                </div>
                <select
                  className="h-8 rounded-lg border border-slate-200/90 bg-white/80 px-2 text-sm text-slate-800 focus-visible:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
                  value={position}
                  onChange={(e) => setPosition(e.target.value as FillerPosition)}
                >
                  <option value="head">头部</option>
                  <option value="middle">中部</option>
                  <option value="tail">尾部</option>
                  <option value="random">随机</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200/70 pt-4">
            {hasOverrides ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClear();
                  onClose();
                }}
                className="text-amber-600 hover:bg-amber-50 hover:text-amber-700"
              >
                恢复默认
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                取消
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const patch: {
                    leave_strategy?: 'auto' | 'early' | 'normal';
                    enable_hand?: boolean;
                    enable_other?: boolean;
                    filler_position?: FillerPosition;
                  } = {};
                  if (leave !== globalLeaveStrategy) patch.leave_strategy = leave;
                  if (hand !== globalEnableHand) patch.enable_hand = hand;
                  if (other !== globalEnableOther) patch.enable_other = other;
                  if (position !== globalFillerPosition) patch.filler_position = position;
                  onSave(patch);
                  onClose();
                }}
              >
                保存
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
