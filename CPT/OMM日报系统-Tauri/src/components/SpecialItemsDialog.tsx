import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil, Check, X, Package } from "lucide-react";
import type { SpecialItem } from "@/types/record";

interface SpecialItemsDialogProps {
  open: boolean;
  items: SpecialItem[];
  onClose: () => void;
  onSave: (items: SpecialItem[]) => void;
}

export function SpecialItemsDialog({
  open,
  items,
  onClose,
  onSave,
}: SpecialItemsDialogProps) {
  const [localItems, setLocalItems] = useState<SpecialItem[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editMinutes, setEditMinutes] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMinutes, setNewMinutes] = useState("8");

  useEffect(() => {
    if (open) {
      setLocalItems(items.map((it) => ({ ...it })));
      setEditingIndex(null);
      setAdding(false);
      setNewName("");
      setNewMinutes("8");
    }
  }, [open, items]);

  if (!open) return null;

  const handleAdd = () => {
    const name = newName.trim();
    const minutes = parseFloat(newMinutes);
    if (!name) return;
    if (isNaN(minutes) || minutes <= 0) return;
    if (localItems.some((it) => it.name === name)) return;
    setLocalItems([...localItems, { name, minutes }]);
    setNewName("");
    setNewMinutes("8");
    setAdding(false);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditName(localItems[index].name);
    setEditMinutes(String(localItems[index].minutes));
  };

  const handleConfirmEdit = (index: number) => {
    const name = editName.trim();
    const minutes = parseFloat(editMinutes);
    if (!name || isNaN(minutes) || minutes <= 0) {
      setEditingIndex(null);
      return;
    }
    const updated = [...localItems];
    updated[index] = { name, minutes };
    setLocalItems(updated);
    setEditingIndex(null);
  };

  const handleDelete = (index: number) => {
    setLocalItems(localItems.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  const handleSave = () => {
    onSave(localItems);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <Card className="mx-4 w-[520px] overflow-hidden rounded-2xl border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <CardHeader className="border-b border-slate-200/70 bg-white/90 px-5 py-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <Package className="h-4 w-4 text-blue-600" />
            特殊大件物品管理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <p className="rounded-xl border border-blue-200/70 bg-blue-50/80 px-3 py-2.5 text-xs leading-6 text-blue-800">
            添加需要单独计时的特殊物品（如烧结盘）。排程时，匹配到物品名称的记录会按设定的每件耗时计算，不参与普通件的耗时缩放。匹配范围：文件夹名、工站、产品名等字段。
          </p>

          {/* 列表 */}
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/70 shadow-sm">
            {localItems.length === 0 && !adding ? (
              <div className="px-3 py-6 text-center text-sm text-slate-400">
                暂无特殊物品，点击下方「添加物品」
              </div>
            ) : (
              <ul className="divide-y divide-slate-100/80">
                {localItems.map((it, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-2 transition hover:bg-blue-50/40">
                    {editingIndex === i ? (
                      <>
                        <Input
                          className="h-7 text-sm flex-1"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                        />
                        <Input
                          className="h-7 text-sm w-24"
                          type="number"
                          value={editMinutes}
                          onChange={(e) => setEditMinutes(e.target.value)}
                        />
                        <span className="text-xs text-slate-500">分钟/件</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleConfirmEdit(i)}
                        >
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditingIndex(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 text-sm font-medium text-slate-800">{it.name}</div>
                        <div className="w-20 text-right text-sm text-slate-600">
                          {it.minutes} 分钟/件
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleStartEdit(i)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDelete(i)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 添加区域 */}
          {adding ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 p-2">
              <Input
                className="h-8 flex-1 text-sm"
                placeholder="物品名称（如：烧结盘）"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") {
                    setAdding(false);
                    setNewName("");
                    setNewMinutes("8");
                  }
                }}
              />
              <Input
                className="h-8 w-24 text-sm"
                type="number"
                value={newMinutes}
                onChange={(e) => setNewMinutes(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
              <span className="text-xs text-slate-500">分钟/件</span>
              <Button variant="default" size="sm" className="h-8" onClick={handleAdd}>
                <Check className="h-3.5 w-3.5 mr-1" />
                确认
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => {
                  setAdding(false);
                  setNewName("");
                  setNewMinutes("8");
                }}
              >
                取消
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              添加物品
            </Button>
          )}

          {/* 底部按钮 */}
          <div className="flex justify-end gap-2 border-t border-slate-200/70 pt-4">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
