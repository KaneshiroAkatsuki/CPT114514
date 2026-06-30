import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings2, X } from "lucide-react";
import { useState, useEffect } from "react";

interface DaySettingsDialogProps {
  open: boolean;
  folderName: string;
  leaveStrategy: 'auto' | 'early' | 'normal' | undefined;
  enableHand: boolean | undefined;
  enableOther: boolean | undefined;
  globalEnableHand: boolean;
  globalEnableOther: boolean;
  globalLeaveStrategy: 'auto' | 'early' | 'normal';
  onSave: (settings: {
    leave_strategy?: 'auto' | 'early' | 'normal';
    enable_hand?: boolean;
    enable_other?: boolean;
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
  globalEnableHand,
  globalEnableOther,
  globalLeaveStrategy,
  onSave,
  onClear,
  onClose,
}: DaySettingsDialogProps) {
  const [leave, setLeave] = useState<'auto' | 'early' | 'normal'>(leaveStrategy ?? globalLeaveStrategy);
  const [hand, setHand] = useState<boolean>(enableHand ?? globalEnableHand);
  const [other, setOther] = useState<boolean>(enableOther ?? globalEnableOther);

  useEffect(() => {
    if (open) {
      setLeave(leaveStrategy ?? globalLeaveStrategy);
      setHand(enableHand ?? globalEnableHand);
      setOther(enableOther ?? globalEnableOther);
    }
  }, [open, leaveStrategy, enableHand, enableOther, globalEnableHand, globalEnableOther, globalLeaveStrategy]);

  if (!open) return null;

  const hasOverrides = leaveStrategy !== undefined || enableHand !== undefined || enableOther !== undefined;

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
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
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
                  } = {};
                  if (leave !== globalLeaveStrategy) patch.leave_strategy = leave;
                  if (hand !== globalEnableHand) patch.enable_hand = hand;
                  if (other !== globalEnableOther) patch.enable_other = other;
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
