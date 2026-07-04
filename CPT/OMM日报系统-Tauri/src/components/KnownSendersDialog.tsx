import * as React from "react";
import { CheckCircle2, Database, Pencil, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useKnownSenderManager } from "@/hooks/useSidecar";
import type { KnownSender, KnownSenderSortBy } from "@/types/record";

interface KnownSendersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

const SORT_OPTIONS: { value: KnownSenderSortBy; label: string }[] = [
  { value: "lastSeenAt", label: "最近使用" },
  { value: "updatedAt", label: "最近修改" },
  { value: "firstSeenAt", label: "首次加入" },
  { value: "usageCount", label: "使用次数" },
  { value: "name", label: "姓名" },
];

function formatTime(raw: string): string {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return "-";
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceLabel(source: string): string {
  if (source.includes("history_seed")) return "历史扫描";
  if (source.includes("review")) return "审核录入";
  if (source === "user") return "手动维护";
  return source || "未知";
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase("zh-CN") === b.trim().toLocaleLowerCase("zh-CN");
}

function waitForVisibleFeedback(ms = 650): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function KnownSendersDialog({ open, onOpenChange, onChanged }: KnownSendersDialogProps) {
  const { loadKnownSenders, upsertKnownSender, updateKnownSender, deleteKnownSender } = useKnownSenderManager();
  const [senders, setSenders] = React.useState<KnownSender[]>([]);
  const [sortBy, setSortBy] = React.useState<KnownSenderSortBy>("lastSeenAt");
  const [descending, setDescending] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [newNote, setNewNote] = React.useState("");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editNote, setEditNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [highlightId, setHighlightId] = React.useState<string | null>(null);
  const [savingNew, setSavingNew] = React.useState(false);
  const [savingEditId, setSavingEditId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async (showResult = false) => {
    setLoading(true);
    setError("");
    try {
      const [items] = await Promise.all([
        loadKnownSenders(sortBy, descending, false),
        waitForVisibleFeedback(),
      ]);
      setSenders(items);
      if (showResult) showNotice(`送测人库已刷新：${items.length} 个启用条目。`);
    } catch (e) {
      await waitForVisibleFeedback(300);
      setError(`送测人库读取失败: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [descending, loadKnownSenders, sortBy]);

  React.useEffect(() => {
    if (open) {
      setExpandedId(null);
      setEditingId(null);
      setNotice("");
      setSavingNew(false);
      setSavingEditId(null);
      void refresh(false);
    }
  }, [open, refresh]);

  const filtered = senders.filter((sender) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [sender.name, sender.note || "", sender.source || "", sender.sampleFolder || ""]
      .some((value) => value.toLowerCase().includes(q));
  });

  const showNotice = (message: string, id?: string) => {
    setNotice(message);
    if (id) setHighlightId(id);
    window.setTimeout(() => {
      setNotice("");
      if (id) setHighlightId(null);
    }, 2600);
  };

  const mergeSavedSender = (saved: KnownSender) => {
    setSenders((prev) => {
      const rest = prev.filter((sender) => sender.id !== saved.id && !sameName(sender.name, saved.name));
      return [saved, ...rest];
    });
  };

  const toggleExpanded = (sender: KnownSender) => {
    if (expandedId === sender.id) {
      setExpandedId(null);
      setEditingId(null);
      return;
    }
    setExpandedId(sender.id);
    setEditingId(null);
  };

  const beginEdit = (sender: KnownSender) => {
    setExpandedId(sender.id);
    setEditingId(sender.id);
    setEditName(sender.name);
    setEditNote(sender.note || "");
    setError("");
  };

  const addSender = async () => {
    const name = newName.trim();
    const note = newNote.trim();
    if (!name) {
      setError("请先填写送测人姓名。");
      return;
    }
    setError("");
    const existed = senders.find((sender) => sameName(sender.name, name));
    setSavingNew(true);
    try {
      const saved = await upsertKnownSender(name, "user", "", note);
      mergeSavedSender(saved);
      setNewName("");
      setNewNote("");
      setQuery("");
      await refresh(false);
      setExpandedId(saved.id);
      showNotice(existed ? `保存成功，已更新已有送测人：${name}` : `保存成功，已添加送测人：${name}`, saved.id);
      onChanged?.();
    } catch (e) {
      setError(`送测人保存失败: ${e}`);
    } finally {
      setSavingNew(false);
    }
  };

  const saveEdit = async (sender: KnownSender) => {
    const name = editName.trim();
    if (!name) {
      setError("送测人姓名不能为空。");
      return;
    }
    setError("");
    setSavingEditId(sender.id);
    try {
      const saved = await updateKnownSender(sender.id, name, editNote.trim(), true);
      mergeSavedSender(saved);
      setEditingId(null);
      await refresh(false);
      setExpandedId(saved.id);
      showNotice(`已更新送测人：${name}`, sender.id);
      onChanged?.();
    } catch (e) {
      setError(`送测人更新失败: ${e}`);
    } finally {
      setSavingEditId(null);
    }
  };

  const removeSender = async (sender: KnownSender) => {
    if (!window.confirm(`确定删除送测人“${sender.name}”吗？`)) return;
    setError("");
    try {
      await deleteKnownSender(sender.id);
      if (expandedId === sender.id) setExpandedId(null);
      if (editingId === sender.id) setEditingId(null);
      await refresh(false);
      showNotice(`已删除送测人：${sender.name}`);
      onChanged?.();
    } catch (e) {
      setError(`送测人删除失败: ${e}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="flex h-[86vh] max-h-[86vh] max-w-5xl flex-col overflow-hidden">
      <DialogHeader className="shrink-0">
        <DialogTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-600" />
          送测人库
        </DialogTitle>
        <div className="mt-1 text-sm text-slate-500">
          共 {senders.length} 个启用条目。点击条目展开，再次点击收起；新增同名送测人会更新原条目。
        </div>
      </DialogHeader>

      <DialogContent className="min-h-0 flex-1 overflow-hidden p-0">
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-slate-200/70 bg-[#f5f5f7] px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、来源、备注" className="pl-9" />
              </div>
              <select
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as KnownSenderSortBy)}
              >
                {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <Button type="button" variant="outline" size="sm" onClick={() => setDescending((value) => !value)}>
                {descending ? "降序" : "升序"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { void refresh(true); }} disabled={loading}>
                <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "刷新中" : "刷新"}
              </Button>
            </div>
          </div>

          {error && (
            <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
          )}
          {notice && (
            <div className="flex shrink-0 items-center gap-2 border-b border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              {notice}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {filtered.map((sender) => {
                const expanded = expandedId === sender.id;
                const editing = editingId === sender.id;
                return (
                  <div
                    key={sender.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpanded(sender)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") toggleExpanded(sender);
                    }}
                    className={`cursor-pointer rounded-xl border p-3 shadow-sm transition ${expanded ? "border-blue-200 bg-blue-50/60" : highlightId === sender.id ? "border-green-200 bg-green-50/80" : "border-slate-200/80 bg-white/80 hover:bg-slate-50"}`}
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(120px,180px)_1fr_auto] md:items-center">
                      <div>
                        <div className="text-base font-semibold text-slate-950">{sender.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{sourceLabel(sender.source)}</div>
                      </div>
                      <div className="min-w-0 text-xs leading-5 text-slate-600">
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <span>次数 {sender.usageCount}</span>
                          <span>最近 {formatTime(sender.lastSeenAt)}</span>
                          <span>修改 {formatTime(sender.updatedAt)}</span>
                        </div>
                        {sender.note && <div className="mt-1 truncate text-slate-500">{sender.note}</div>}
                      </div>
                      <div className="text-right text-xs text-slate-400">
                        {expanded ? "点击收起" : "点击展开"}
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-3 rounded-lg border border-slate-200/70 bg-white/75 p-3" onClick={(event) => event.stopPropagation()}>
                        {editing ? (
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-[180px_1fr_auto]">
                            <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
                            <Input value={editNote} onChange={(event) => setEditNote(event.target.value)} placeholder="备注" />
                            <div className="flex gap-2">
                              <Button type="button" size="sm" onClick={() => { void saveEdit(sender); }} disabled={!editName.trim() || savingEditId === sender.id}>
                                <Save className="mr-1 h-4 w-4" />
                                {savingEditId === sender.id ? "保存中" : "保存"}
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>
                                <X className="mr-1 h-4 w-4" />
                                取消
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                            <div className="space-y-1 text-xs leading-5 text-slate-600">
                              <div>首次加入：{formatTime(sender.firstSeenAt)}</div>
                              <div>最近使用：{formatTime(sender.lastSeenAt)}</div>
                              <div>最后修改：{formatTime(sender.updatedAt)}</div>
                              <div>备注：{sender.note || "-"}</div>
                              <div className="break-all font-mono text-slate-400">样例文件夹：{sender.sampleFolder || "-"}</div>
                            </div>
                            <div className="flex flex-wrap content-start justify-end gap-2">
                              <Button type="button" variant="outline" size="sm" onClick={() => beginEdit(sender)}>
                                <Pencil className="mr-1 h-4 w-4" />
                                编辑
                              </Button>
                              <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => { void removeSender(sender); }}>
                                <Trash2 className="mr-1 h-4 w-4" />
                                删除
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-500">
                  没有符合条件的送测人。
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      <DialogFooter className="shrink-0 justify-between">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 md:grid-cols-[160px_1fr]">
          <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="新增姓名" />
          <Input value={newNote} onChange={(event) => setNewNote(event.target.value)} placeholder="备注，可留空" />
          {notice && (
            <div className="md:col-span-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
              {notice}
            </div>
          )}
        </div>
        <Button type="button" onClick={() => { void addSender(); }} disabled={!newName.trim() || savingNew}>
          <Plus className="mr-1 h-4 w-4" />
          {savingNew ? "保存中" : "添加/更新"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
