import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, Info, Settings } from "lucide-react";

interface ConfigLocationDialogProps {
  open: boolean;
  onChooseDefault: () => void;
  onChooseCustom: () => void;
}

export function ConfigLocationDialog({
  open,
  onChooseDefault,
  onChooseCustom,
}: ConfigLocationDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <Card className="w-[520px] max-w-full overflow-hidden rounded-2xl border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <CardHeader className="border-b border-slate-200/70 bg-white/90 px-5 py-4">
          <CardTitle className="flex items-center gap-3 text-base font-semibold text-slate-950">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <Settings className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-base leading-tight">配置文件位置</span>
              <span className="mt-1 block text-xs font-medium text-slate-400">玉衡山科学院管理厅</span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-900">欢迎使用玉衡山科学院管理厅</p>
            <p className="text-sm text-slate-600 leading-relaxed">
              配置文件会保存工作目录、使用者姓名、生成设置等，下次打开时自动恢复。
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm leading-6 text-blue-800">
                <strong>默认位置：</strong>系统用户配置目录（AppData），通常更稳定，也避免写入日期数据目录。
                <br />
                <code className="rounded bg-blue-100/70 px-1.5 py-0.5 text-xs font-mono">%APPDATA%\玉衡山科学院管理厅\config.json</code>
                <span className="ml-1 text-xs text-blue-700">（旧目录存在时会自动迁移缺失配置）</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FolderOpen className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm leading-6 text-blue-800">
                <strong>便携版：</strong>如果把本程序放在 U 盘或需要随身携带配置，可选择程序所在文件夹作为配置位置。便携版启动时会优先识别自身目录内任意位置的 <code className="rounded bg-blue-100/70 px-1.5 py-0.5 text-xs font-mono">config.json</code>，并把后续保存写回该配置所在目录。
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="default" onClick={onChooseDefault} className="gap-1.5">
              使用默认位置（推荐）
            </Button>
            <Button variant="outline" onClick={onChooseCustom}>
              自定义位置
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
