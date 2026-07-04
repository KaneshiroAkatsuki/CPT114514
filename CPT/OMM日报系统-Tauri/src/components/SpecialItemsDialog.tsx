import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, CheckCircle2, Clock3, Copy, Plus, Power, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DurationRule, DurationRuleDuration, DurationRuleMatcher } from "@/types/record";

interface SpecialItemsDialogProps {
  open: boolean;
  rules: DurationRule[];
  onClose: () => void;
  onSave: (rules: DurationRule[]) => void | Promise<void>;
}

const PIECE_MINUTES_FLOOR = 1.5;
const ORDER_BASE = 10_000;
const ORDER_STEP = 10;

const FIELD_OPTIONS: { value: DurationRuleMatcher["field"]; label: string }[] = [
  { value: "folder", label: "文件夹名" },
  { value: "station", label: "工站" },
  { value: "product", label: "品名" },
  { value: "test_type", label: "检测类型" },
  { value: "sender", label: "送测人" },
  { value: "operator", label: "测量员" },
];

const OP_OPTIONS: { value: DurationRuleMatcher["op"]; label: string }[] = [
  { value: "contains", label: "包含" },
  { value: "equals", label: "等于" },
  { value: "not_contains", label: "不包含" },
  { value: "regex", label: "正则" },
];

function defaultRule(priority = ORDER_BASE): DurationRule {
  return {
    id: `user-duration-${Date.now()}`,
    builtinKey: null,
    name: "",
    enabled: true,
    source: "user",
    priority,
    matchMode: "all",
    matchers: [{ field: "folder", op: "contains", value: "" }],
    duration: {
      mode: "per_piece",
      minutes: 5,
      minMinutes: 5,
      maxMinutes: 5,
      quantityPolicy: "piece_first",
      compressible: false,
      missingQuantityPolicy: "one_piece",
    },
    userModified: true,
    builtinVersion: 1,
    deprecated: false,
  };
}

function cloneRule(rule: DurationRule): DurationRule {
  return {
    ...rule,
    matchers: rule.matchers.map((matcher) => ({ ...matcher })),
    duration: { ...rule.duration },
  };
}

function sortRules(rules: DurationRule[]): DurationRule[] {
  return [...rules].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name, "zh-CN"));
}

function normalizeOrder(rules: DurationRule[], touchedIds = new Set<string>()): DurationRule[] {
  return sortRules(rules).map((rule, index) => ({
    ...rule,
    priority: ORDER_BASE - index * ORDER_STEP,
    userModified: touchedIds.has(rule.id) ? true : rule.userModified,
  }));
}

function durationText(duration: DurationRuleDuration): string {
  const rangeText = (min?: number | null, max?: number | null, fallback?: number | null) => {
    const lo = Number(min ?? fallback ?? 0);
    const hi = Number(max ?? fallback ?? min ?? 0);
    return lo !== hi ? `${lo}~${hi}` : `${hi}`;
  };
  if (duration.mode === "per_package") return `每包 ${rangeText(duration.minMinutes, duration.maxMinutes, duration.minutes)} 分钟`;
  if (duration.mode === "max_package_piece" || duration.mode === "package_piece") {
    const policy = duration.quantityPolicy === "package_first" ? "按包优先"
      : duration.quantityPolicy === "piece_first" ? "按件优先"
      : duration.quantityPolicy === "min" ? "取小"
      : "取大";
    return `${policy}：包 ${rangeText(duration.packageMinMinutes, duration.packageMaxMinutes, duration.packageMinutes)} / 件 ${rangeText(duration.pieceMinMinutes, duration.pieceMaxMinutes, duration.pieceMinutes)} 分钟`;
  }
  return `每件 ${rangeText(duration.minMinutes, duration.maxMinutes, duration.minutes)} 分钟`;
}

function matcherText(rule: DurationRule): string {
  const joiner = rule.matchMode === "any" ? " 或 " : " 且 ";
  return rule.matchers
    .map((matcher) => {
      const field = FIELD_OPTIONS.find((it) => it.value === matcher.field)?.label || matcher.field;
      const op = OP_OPTIONS.find((it) => it.value === matcher.op)?.label || matcher.op;
      return `${field}${op}${matcher.value || "未填写"}`;
    })
    .join(joiner);
}

function sourceText(rule: DurationRule): string {
  if (rule.source === "builtin") return rule.userModified ? "内置已调整" : "内置";
  if (rule.source === "migrated") return "旧配置迁移";
  return "自定义";
}

function numericValue(value: number | null | undefined, fallback: number | null | undefined = 0): number {
  const safeFallback = Number(fallback ?? 0);
  const next = Number(value ?? safeFallback);
  return Number.isFinite(next) ? next : safeFallback;
}

function validationMessage(rule: DurationRule): string {
  if (!rule.name.trim()) return "请填写规则名称。";
  if (!rule.matchers.some((matcher) => matcher.value.trim())) return "请填写至少一个匹配值。";
  const duration = rule.duration;
  if (duration.mode === "per_piece") {
    if (numericValue(duration.minMinutes, duration.minutes) < PIECE_MINUTES_FLOOR) {
      return `每件下限不能低于 ${PIECE_MINUTES_FLOOR} 分钟。`;
    }
  }
  if (duration.mode === "package_piece" || duration.mode === "max_package_piece") {
    if (numericValue(duration.pieceMinMinutes, duration.pieceMinutes) < PIECE_MINUTES_FLOOR) {
      return `件时下限不能低于 ${PIECE_MINUTES_FLOOR} 分钟。`;
    }
  }
  return "";
}

export function SpecialItemsDialog({
  open,
  rules,
  onClose,
  onSave,
}: SpecialItemsDialogProps) {
  const [localRules, setLocalRules] = useState<DurationRule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DurationRule>(defaultRule());
  const [notice, setNotice] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalRules(normalizeOrder(rules.map(cloneRule)));
    setEditingId(null);
    setDraft(defaultRule());
    setNotice("");
    setHighlightId(null);
  }, [open, rules]);

  const orderedRules = useMemo(() => sortRules(localRules), [localRules]);
  const activeCount = useMemo(() => localRules.filter((rule) => rule.enabled && !rule.deprecated).length, [localRules]);
  const draftError = editingId ? validationMessage(draft) : "";

  if (!open) return null;

  const showNotice = (message: string, id?: string) => {
    setNotice(message);
    if (id) setHighlightId(id);
    window.setTimeout(() => {
      setNotice("");
      if (id) setHighlightId(null);
    }, 2600);
  };

  const startAdd = () => {
    if (editingId === "__new__") {
      setEditingId(null);
      setDraft(defaultRule());
      return;
    }
    setEditingId("__new__");
    setDraft(defaultRule(ORDER_BASE - orderedRules.length * ORDER_STEP));
    setNotice("");
  };

  const toggleEdit = (rule: DurationRule) => {
    if (editingId === rule.id) {
      setEditingId(null);
      return;
    }
    setEditingId(rule.id);
    setDraft(cloneRule(rule));
    setNotice("");
  };

  const updateFirstMatcher = (patch: Partial<DurationRuleMatcher>) => {
    setDraft((prev) => {
      const first = prev.matchers[0] || { field: "folder", op: "contains", value: "" };
      const rest = prev.matchers.slice(1);
      return { ...prev, matchers: [{ ...first, ...patch }, ...rest] };
    });
  };

  const applyDraft = () => {
    const message = validationMessage(draft);
    if (message) {
      setNotice(message);
      return;
    }
    const name = draft.name.trim();
    const matchers = draft.matchers
      .map((matcher) => ({ ...matcher, value: matcher.value.trim() }))
      .filter((matcher) => matcher.value.length > 0);
    const next: DurationRule = {
      ...draft,
      name,
      matchers,
      userModified: true,
      source: draft.source === "builtin" ? "builtin" : draft.source || "user",
    };
    if (editingId === "__new__") {
      setLocalRules((prev) => normalizeOrder([...prev, next], new Set([next.id])));
      showNotice(`已添加耗时规则：${name}`, next.id);
      setDraft(defaultRule());
    } else {
      setLocalRules((prev) => normalizeOrder(prev.map((rule) => rule.id === next.id ? next : rule), new Set([next.id])));
      showNotice(`已更新耗时规则：${name}`, next.id);
    }
    setEditingId(null);
  };

  const duplicateRule = (rule: DurationRule) => {
    const copy: DurationRule = {
      ...cloneRule(rule),
      id: `user-duration-${Date.now()}`,
      builtinKey: null,
      name: `${rule.name} 副本`,
      source: "user",
      userModified: true,
      priority: ORDER_BASE - orderedRules.length * ORDER_STEP,
    };
    setLocalRules((prev) => normalizeOrder([...prev, copy], new Set([copy.id])));
    setEditingId(copy.id);
    setDraft(copy);
    showNotice("已复制为新规则，修改后保存即可。", copy.id);
  };

  const toggleEnabled = (rule: DurationRule) => {
    setLocalRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, enabled: !item.enabled, userModified: true } : item));
    showNotice(`${rule.enabled ? "已停用" : "已启用"}：${rule.name}`, rule.id);
  };

  const deleteRule = (rule: DurationRule) => {
    if (!window.confirm(`确定删除“${rule.name}”吗？内置规则会改为停用。`)) return;
    setLocalRules((prev) => normalizeOrder(prev.filter((item) => item.id !== rule.id || item.source === "builtin").map((item) => (
      item.id === rule.id ? { ...item, enabled: false, userModified: true } : item
    ))));
    if (editingId === rule.id) setEditingId(null);
    showNotice(rule.source === "builtin" ? `已停用内置规则：${rule.name}` : `已删除耗时规则：${rule.name}`);
  };

  const moveRule = (rule: DurationRule, direction: -1 | 1) => {
    const current = orderedRules.findIndex((item) => item.id === rule.id);
    const target = current + direction;
    if (current < 0 || target < 0 || target >= orderedRules.length) return;
    const next = [...orderedRules];
    [next[current], next[target]] = [next[target], next[current]];
    setLocalRules(next.map((item, index) => ({
      ...item,
      priority: ORDER_BASE - index * ORDER_STEP,
      userModified: item.id === rule.id ? true : item.userModified,
    })));
    showNotice(direction < 0 ? "已上移，匹配会更早命中。" : "已下移，匹配会更晚命中。", rule.id);
  };

  const updateDraftDurationMode = (mode: DurationRuleDuration["mode"]) => {
    setDraft((prev) => ({
      ...prev,
      duration: mode === "max_package_piece" || mode === "package_piece"
        ? {
          mode: "package_piece",
          packageMinutes: prev.duration.packageMinutes || prev.duration.packageMaxMinutes || 30,
          packageMinMinutes: prev.duration.packageMinMinutes || prev.duration.packageMinutes || 30,
          packageMaxMinutes: prev.duration.packageMaxMinutes || prev.duration.packageMinutes || 30,
          pieceMinutes: prev.duration.pieceMinutes || prev.duration.pieceMaxMinutes || 5,
          pieceMinMinutes: prev.duration.pieceMinMinutes || prev.duration.pieceMinutes || 5,
          pieceMaxMinutes: prev.duration.pieceMaxMinutes || prev.duration.pieceMinutes || 5,
          quantityPolicy: prev.duration.quantityPolicy || "max",
          compressible: prev.duration.compressible ?? false,
          missingQuantityPolicy: "package_floor",
        }
        : {
          mode,
          minutes: prev.duration.minutes || (mode === "per_package" ? 30 : 5),
          minMinutes: prev.duration.minMinutes || prev.duration.minutes || (mode === "per_package" ? 20 : 5),
          maxMinutes: prev.duration.maxMinutes || prev.duration.minutes || (mode === "per_package" ? 30 : 5),
          quantityPolicy: mode === "per_package" ? "package_first" : "piece_first",
          compressible: prev.duration.compressible ?? mode === "per_package",
          missingQuantityPolicy: mode === "per_package" ? "allowed" : "one_piece",
        },
    }));
  };

  const updateDuration = (patch: Partial<DurationRuleDuration>) => {
    setDraft((prev) => ({ ...prev, duration: { ...prev.duration, ...patch } }));
  };

  const renderRuleEditor = () => (
    <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3" onClick={(event) => event.stopPropagation()}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">规则名称</label>
          <Input className="h-8 bg-white" value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">匹配字段</label>
          <select className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm" value={draft.matchers[0]?.field || "folder"} onChange={(e) => updateFirstMatcher({ field: e.target.value as DurationRuleMatcher["field"] })}>
            {FIELD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">匹配方式</label>
          <select className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm" value={draft.matchers[0]?.op || "contains"} onChange={(e) => updateFirstMatcher({ op: e.target.value as DurationRuleMatcher["op"] })}>
            {OP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">匹配值</label>
          <Input className="h-8 bg-white" value={draft.matchers[0]?.value || ""} onChange={(e) => updateFirstMatcher({ value: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr]">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">耗时模型</label>
          <select className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm" value={draft.duration.mode === "max_package_piece" ? "package_piece" : draft.duration.mode} onChange={(e) => updateDraftDurationMode(e.target.value as DurationRuleDuration["mode"])}>
            <option value="per_package">每包固定</option>
            <option value="per_piece">每件固定</option>
            <option value="package_piece">包时 + 件时</option>
          </select>
        </div>
        {draft.duration.mode === "max_package_piece" || draft.duration.mode === "package_piece" ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">包下限</label>
              <Input className="h-8 bg-white" type="number" min={0} value={draft.duration.packageMinMinutes ?? draft.duration.packageMinutes ?? 0} onChange={(e) => updateDuration({ packageMinMinutes: Number(e.target.value), packageMinutes: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">包上限</label>
              <Input className="h-8 bg-white" type="number" min={0} value={draft.duration.packageMaxMinutes ?? draft.duration.packageMinutes ?? 0} onChange={(e) => updateDuration({ packageMaxMinutes: Number(e.target.value), packageMinutes: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">件下限</label>
              <Input className="h-8 bg-white" type="number" min={PIECE_MINUTES_FLOOR} step="0.5" value={draft.duration.pieceMinMinutes ?? draft.duration.pieceMinutes ?? 0} onChange={(e) => updateDuration({ pieceMinMinutes: Number(e.target.value), pieceMinutes: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">件上限</label>
              <Input className="h-8 bg-white" type="number" min={PIECE_MINUTES_FLOOR} step="0.5" value={draft.duration.pieceMaxMinutes ?? draft.duration.pieceMinutes ?? 0} onChange={(e) => updateDuration({ pieceMaxMinutes: Number(e.target.value), pieceMinutes: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">计时策略</label>
              <select className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm" value={draft.duration.quantityPolicy || "max"} onChange={(e) => updateDuration({ quantityPolicy: e.target.value as DurationRuleDuration["quantityPolicy"] })}>
                <option value="max">取较长时间</option>
                <option value="min">取较短时间</option>
                <option value="package_first">按包优先</option>
                <option value="piece_first">按件优先</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">下限</label>
              <Input className="h-8 bg-white" type="number" min={draft.duration.mode === "per_piece" ? PIECE_MINUTES_FLOOR : 0} step="0.5" value={draft.duration.minMinutes ?? draft.duration.minutes ?? 0} onChange={(e) => updateDuration({ minMinutes: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">上限</label>
              <Input className="h-8 bg-white" type="number" min={draft.duration.mode === "per_piece" ? PIECE_MINUTES_FLOOR : 0} step="0.5" value={draft.duration.maxMinutes ?? draft.duration.minutes ?? 0} onChange={(e) => updateDuration({ maxMinutes: Number(e.target.value), minutes: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">时间保护</label>
              <select className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm" value={draft.duration.compressible === false ? "fixed" : "compressible"} onChange={(e) => updateDuration({ compressible: e.target.value === "compressible" })}>
                <option value="compressible">不够时可压缩</option>
                <option value="fixed">固定不压缩</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={`text-xs ${draftError ? "text-amber-700" : "text-slate-500"}`}>
          {draftError || "匹配顺序在列表里用上移/下移调整；不会再手填内部优先级。"}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>
            <X className="mr-1 h-3.5 w-3.5" />
            取消
          </Button>
          <Button type="button" size="sm" onClick={applyDraft} disabled={Boolean(draftError)}>
            <Check className="mr-1 h-3.5 w-3.5" />
            {editingId === "__new__" ? "添加" : "更新"}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <Card className="mx-4 flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <CardHeader className="border-b border-slate-200/70 bg-white/90 px-5 py-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <Clock3 className="h-4 w-4 text-blue-600" />
            耗时规则库
          </CardTitle>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            已启用 {activeCount} 条规则。识别后按列表从上到下匹配；区间默认按上限计算，不够时才压缩到下限，每件时间最低保护为 {PIECE_MINUTES_FLOOR} 分钟。
          </p>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {notice && (
            <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              {notice}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white/70 shadow-sm">
            <div className="grid min-w-[960px] grid-cols-[70px_76px_1fr_1.15fr_1fr_260px] gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
              <div>顺序</div>
              <div>状态</div>
              <div>规则</div>
              <div>匹配对象</div>
              <div>耗时模型</div>
              <div className="text-right">操作</div>
            </div>
            {orderedRules.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-slate-400">暂无耗时规则</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {orderedRules.map((rule, index) => {
                  const editing = editingId === rule.id;
                  return (
                    <li
                      key={rule.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleEdit(rule)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") toggleEdit(rule);
                      }}
                      className={`cursor-pointer px-3 py-2 text-sm transition ${editing ? "bg-blue-50/80" : highlightId === rule.id ? "bg-green-50/80" : rule.enabled ? "bg-white/80 hover:bg-slate-50" : "bg-slate-50/80 text-slate-400 hover:bg-slate-100/70"}`}
                    >
                      <div className="grid min-w-[936px] grid-cols-[70px_76px_1fr_1.15fr_1fr_260px] gap-2">
                        <div className="flex items-center text-xs font-medium text-slate-500">第 {index + 1} 条</div>
                        <div className="flex items-center">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${rule.enabled ? "border-green-200 bg-green-50 text-green-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                            {rule.enabled ? "启用" : "停用"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-800">{rule.name}</div>
                          <div className="text-xs text-slate-400">{sourceText(rule)} · 点击展开/收起</div>
                        </div>
                        <div className="min-w-0 truncate text-xs leading-6 text-slate-600">{matcherText(rule)}</div>
                        <div className="text-xs leading-6 text-slate-600">{durationText(rule.duration)}</div>
                        <div className="flex flex-wrap justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                          <Button type="button" variant="outline" size="sm" className="h-7 px-2" disabled={index === 0} onClick={() => moveRule(rule, -1)}>
                            <ArrowUp className="mr-1 h-3.5 w-3.5" />
                            上移
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="h-7 px-2" disabled={index === orderedRules.length - 1} onClick={() => moveRule(rule, 1)}>
                            <ArrowDown className="mr-1 h-3.5 w-3.5" />
                            下移
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => toggleEnabled(rule)}>
                            <Power className="mr-1 h-3.5 w-3.5" />
                            {rule.enabled ? "停用" : "启用"}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => duplicateRule(rule)}>
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            复制
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-red-600 hover:text-red-700" onClick={() => deleteRule(rule)}>
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            删除
                          </Button>
                        </div>
                      </div>
                      {editing && <div className="mt-3">{renderRuleEditor()}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <Button variant="outline" size="sm" className="w-fit" onClick={startAdd}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {editingId === "__new__" ? "收起新增" : "新增规则"}
            </Button>
            {editingId === "__new__" && renderRuleEditor()}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200/70 pt-4">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={() => { void onSave(normalizeOrder(localRules)); onClose(); }}>保存</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
