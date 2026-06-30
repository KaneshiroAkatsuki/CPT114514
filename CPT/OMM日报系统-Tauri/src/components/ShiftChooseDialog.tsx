import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ShiftChooseDialogProps {
  open: boolean;
  folderName: string;
  onChoose: (shift: 'A' | 'B') => void;
  onCancel: () => void;
}

export function ShiftChooseDialog({
  open,
  folderName,
  onChoose,
  onCancel,
}: ShiftChooseDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <Card className="mx-4 w-[360px] overflow-hidden rounded-2xl border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <CardHeader className="border-b border-slate-200/70 bg-white/90 px-5 py-4">
          <CardTitle className="text-base font-semibold text-slate-950">选择班次</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <p className="rounded-xl border border-blue-200/70 bg-blue-50/80 px-3 py-2.5 text-sm leading-6 text-blue-800">
            文件夹 '{folderName}' 缺少班次后缀，需要手动选择白班或夜班：
          </p>
          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              className="border-amber-200 bg-amber-50/90 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
              onClick={() => onChoose('A')}
            >
              A 白班
            </Button>
            <Button
              variant="default"
              onClick={() => onChoose('B')}
            >
              B 夜班
            </Button>
          </div>
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              取消
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
