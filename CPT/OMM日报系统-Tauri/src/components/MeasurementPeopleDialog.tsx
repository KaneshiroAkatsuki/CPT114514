import * as React from "react";
import { Database, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMeasurementPeopleManager } from "@/hooks/useSidecar";
import type { MeasurementPerson, MeasurementPersonRole } from "@/types/record";

interface MeasurementPeopleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

const ROLE_OPTIONS: { value: MeasurementPersonRole; label: string }[] = [
  { value: "ordinary", label: "普通 OMM 员工" },
  { value: "manager", label: "班长/管理" },
  { value: "extra", label: "额外量测人员" },
];

function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label || role || "普通 OMM 员工";
}

function splitAliases(value: string): string[] {
  return value.split(/[,，;；]/).map((item) => item.trim()).filter(Boolean);
}

export function MeasurementPeopleDialog({ open, onOpenChange, onChanged }: MeasurementPeopleDialogProps) {
  const { loadMeasurementPeople, upsertMeasurementPerson, deleteMeasurementPerson } = useMeasurementPeopleManager();
  const [people, setPeople] = React.useState<MeasurementPerson[]>([]);
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<MeasurementPersonRole>("ordinary");
  const [aliases, setAliases] = React.useState("");
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const refresh = React.useCallback(async (showResult = false) => {
    setLoading(true);
    setMessage("");
    try {
      const items = await loadMeasurementPeople(false);
      setPeople(items);
      if (showResult) setMessage(`测量人库已刷新：${items.length} 个启用条目。`);
    } catch (error) {
      setMessage(`测量人库读取失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [loadMeasurementPeople]);

  React.useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const addPerson = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      setMessage("请先填写测量人姓名。");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await upsertMeasurementPerson(cleanName, role, splitAliases(aliases), note.trim());
      setName("");
      setAliases("");
      setNote("");
      await refresh(false);
      setMessage(`已保存测量人：${cleanName}`);
      onChanged?.();
    } catch (error) {
      setMessage(`测量人保存失败: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const removePerson = async (person: MeasurementPerson) => {
    if (!window.confirm(`确定停用测量人“${person.name}”吗？`)) return;
    setMessage("");
    try {
      await deleteMeasurementPerson(person.id);
      await refresh(false);
      setMessage(`已停用测量人：${person.name}`);
      onChanged?.();
    } catch (error) {
      setMessage(`测量人停用失败: ${error}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="flex h-[82vh] max-h-[82vh] max-w-4xl flex-col overflow-hidden">
      <DialogHeader className="shrink-0">
        <DialogTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-600" />
          测量人库
        </DialogTitle>
        <div className="mt-1 text-sm text-slate-500">普通员工用于 OMM 统计口径；班长/管理人员可识别为测量员，但不计入普通 OMM 员工。</div>
      </DialogHeader>
      <DialogContent className="min-h-0 flex-1 overflow-hidden p-0">
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-slate-200/70 bg-[#f5f5f7] p-4">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_150px_1fr_1fr_auto]">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="姓名" />
              <select className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm" value={role} onChange={(event) => setRole(event.target.value as MeasurementPersonRole)}>
                {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <Input value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="别名，如 魏泽元" />
              <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="备注" />
              <Button onClick={addPerson} disabled={saving}>
                <Plus className="mr-1 h-4 w-4" />
                {saving ? "保存中" : "保存"}
              </Button>
            </div>
          </div>
          {message && <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">{message}</div>}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
              <span>启用条目：{people.length}</span>
              <Button variant="outline" size="sm" onClick={() => { void refresh(true); }} disabled={loading}>
                <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "刷新中" : "刷新"}
              </Button>
            </div>
            <div className="space-y-2">
              {people.map((person) => (
                <div key={person.id} className="grid grid-cols-[1fr_140px_1fr_auto] items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 p-3 text-sm shadow-sm">
                  <div>
                    <div className="font-medium text-slate-900">{person.name}</div>
                    {person.note && <div className="mt-1 text-xs text-slate-500">{person.note}</div>}
                  </div>
                  <div className="text-xs text-slate-600">{roleLabel(person.role)}</div>
                  <div className="text-xs text-slate-500">{person.aliases.length > 0 ? `别名：${person.aliases.join("、")}` : "无别名"}</div>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => { void removePerson(person); }}>
                    <Trash2 className="mr-1 h-4 w-4" />
                    停用
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
      <DialogFooter className="shrink-0">
        <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
      </DialogFooter>
    </Dialog>
  );
}
