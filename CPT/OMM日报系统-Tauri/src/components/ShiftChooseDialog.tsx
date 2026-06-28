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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-[360px] mx-4">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-base">选择班次</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm text-slate-700">
            文件夹 '{folderName}' 缺少班次后缀，需要手动选择白班或夜班：
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              className="bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
              onClick={() => onChoose('A')}
            >
              A 白班
            </Button>
            <Button
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
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
