import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProductAliasRule, RecognitionRules, SinterPlateRule, StationAliasRule, WeldingRule } from "@/types/record";
import { emptyRecognitionRules, recognizeManualTaskWithRules } from "@/lib/recognitionRules";
import { CheckCircle2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";

interface RecognitionRulesDialogProps {
  open: boolean;
  rules: RecognitionRules;
  path: string;
  exists: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (rules: RecognitionRules) => void;
  onReload: () => void | Promise<void>;
}

function waitForVisibleFeedback(ms = 650): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeRules(rules?: RecognitionRules): RecognitionRules {
  return {
    ...emptyRecognitionRules(),
    ...(rules || {}),
    version: rules?.version || 1,
    station_aliases: rules?.station_aliases || [],
    product_aliases: rules?.product_aliases || [],
    ignored_tokens: rules?.ignored_tokens || [],
    welding_rules: rules?.welding_rules || [],
    sinter_plate_rules: rules?.sinter_plate_rules || [],
  };
}

function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

function updateAt<T>(items: T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

export function RecognitionRulesDialog({
  open,
  rules,
  path,
  exists,
  onOpenChange,
  onSave,
  onReload,
}: RecognitionRulesDialogProps) {
  const [draft, setDraft] = useState<RecognitionRules>(() => normalizeRules(rules));
  const [testInput, setTestInput] = useState("565-开发-MO-T0模具测试-安容克送测-96PCS-CMM-测量员-手量-复测");
  const [notice, setNotice] = useState("");
  const [reloadBusy, setReloadBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(normalizeRules(rules));
      setNotice("");
      setReloadBusy(false);
    }
  }, [open, rules]);

  const testResult = useMemo(() => {
    if (!testInput.trim()) return null;
    return recognizeManualTaskWithRules(testInput.trim(), draft);
  }, [testInput, draft]);

  const saveDraft = () => {
    onSave({
      ...normalizeRules(draft),
      updated_at: new Date().toISOString(),
    });
    setNotice("已保存补充规则。");
  };

  const clearAll = () => {
    if (!window.confirm("确定清空用户补充规则吗？内置识别规则不会被清空。")) return;
    setDraft({
      ...emptyRecognitionRules(),
      updated_at: new Date().toISOString(),
    });
    setNotice("已清空用户补充规则，保存后生效。");
  };

  const reloadRules = async () => {
    if (reloadBusy) return;
    setReloadBusy(true);
    setNotice("正在重新读取补充规则...");
    try {
      await Promise.all([onReload(), waitForVisibleFeedback()]);
      setNotice("补充规则已重新读取。");
    } catch (e) {
      await waitForVisibleFeedback(300);
      setNotice(`补充规则重新读取失败：${e}`);
    } finally {
      setReloadBusy(false);
    }
  };

  const stationAliases = draft.station_aliases || [];
  const productAliases = draft.product_aliases || [];
  const ignoredTokens = draft.ignored_tokens || [];
  const weldingRules = draft.welding_rules || [];
  const sinterRules = draft.sinter_plate_rules || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="flex h-[86vh] max-h-[86vh] max-w-5xl flex-col overflow-hidden">
      <DialogHeader className="shrink-0">
        <DialogTitle>补充规则表</DialogTitle>
        <div className="text-sm text-slate-500">
          补充规则独立保存，不会随普通配置重置而清空。
        </div>
      </DialogHeader>
      <DialogContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-5">
        <div className="space-y-1 rounded-xl border border-blue-200/80 bg-blue-50/80 p-3 text-sm text-blue-800">
          <div>规则文件：<code className="break-all">{path || "recognition-rules.json"}</code></div>
          <div>状态：{exists ? "已存在，将继续写回此文件" : "尚未创建，保存后自动创建"}</div>
          <div>内置规则仍始终生效：806 料号取后三位、CNC=035、FAI=开发、烧结盘多品名、焊接/AOI 括号品名、焊接 289/290。</div>
        </div>
        {notice && (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            {notice}
          </div>
        )}

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">测试识别</h3>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => { void reloadRules(); }} disabled={reloadBusy}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${reloadBusy ? "animate-spin" : ""}`} />
              {reloadBusy ? "读取中" : "重新读取"}
            </Button>
          </div>
          <Input value={testInput} onChange={(e) => setTestInput(e.target.value)} />
          {testResult && (
            <div className="space-y-1 rounded-xl border border-slate-200/80 bg-white/70 p-3 text-xs text-slate-700 shadow-sm">
              <div>工站：{testResult.station || "-"}</div>
              <div>品名：{testResult.product || "-"}</div>
              <div>类型：{testResult.test_type || "-"}</div>
              <div>送测人：{testResult.sender || "-"}</div>
              <div>数量：{testResult.quantity || "-"}</div>
              <div>测量员：{testResult.operator || "-"}</div>
              {(testResult.matched_rules || []).length > 0 && (
                <div>命中：{testResult.matched_rules?.join("；")}</div>
              )}
              {(testResult.recognition_warnings || []).length > 0 && (
                <div className="text-amber-700">提示：{testResult.recognition_warnings?.join("；")}</div>
              )}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">工站别名</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft((d) => ({ ...d, station_aliases: [...stationAliases, { alias: "", station: "", default_test_type: "测试尺寸" }] }));
                setNotice("已新增工站别名，填写后保存生效。");
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />添加
            </Button>
          </div>
          {stationAliases.map((rule: StationAliasRule, index: number) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-xl border border-slate-200/80 bg-white/75 p-2 shadow-sm">
              <Input placeholder="匹配词，如 FAI" value={rule.alias} onChange={(e) => setDraft((d) => ({ ...d, station_aliases: updateAt(stationAliases, index, { alias: e.target.value }) }))} />
              <Input placeholder="工站，如 开发" value={rule.station} onChange={(e) => setDraft((d) => ({ ...d, station_aliases: updateAt(stationAliases, index, { station: e.target.value }) }))} />
              <Input placeholder="默认类型" value={rule.default_test_type || ""} onChange={(e) => setDraft((d) => ({ ...d, station_aliases: updateAt(stationAliases, index, { default_test_type: e.target.value }) }))} />
              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setDraft((d) => ({ ...d, station_aliases: removeAt(stationAliases, index) }))}>
                <Trash2 className="mr-1 h-4 w-4" />删除
              </Button>
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">品名补充</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft((d) => ({ ...d, product_aliases: [...productAliases, { pattern: "", product: "", station: "", note: "" }] }));
                setNotice("已新增品名补充，填写后保存生效。");
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />添加
            </Button>
          </div>
          {productAliases.map((rule: ProductAliasRule, index: number) => (
            <div key={index} className="grid grid-cols-[1fr_90px_90px_1fr_auto] gap-2 rounded-xl border border-slate-200/80 bg-white/75 p-2 shadow-sm">
              <Input placeholder="匹配词/正则" value={rule.pattern} onChange={(e) => setDraft((d) => ({ ...d, product_aliases: updateAt(productAliases, index, { pattern: e.target.value }) }))} />
              <Input placeholder="品名" value={rule.product} onChange={(e) => setDraft((d) => ({ ...d, product_aliases: updateAt(productAliases, index, { product: e.target.value }) }))} />
              <Input placeholder="工站(可空)" value={rule.station || ""} onChange={(e) => setDraft((d) => ({ ...d, product_aliases: updateAt(productAliases, index, { station: e.target.value }) }))} />
              <Input placeholder="备注" value={rule.note || ""} onChange={(e) => setDraft((d) => ({ ...d, product_aliases: updateAt(productAliases, index, { note: e.target.value }) }))} />
              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setDraft((d) => ({ ...d, product_aliases: removeAt(productAliases, index) }))}>
                <Trash2 className="mr-1 h-4 w-4" />删除
              </Button>
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">烧结盘 / 焊接特殊补充</h3>
          </div>
          <div className="text-xs text-slate-500">烧结盘多品名用逗号分隔；焊接规则适合补新编号。</div>
          <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white/70 p-2">
            <Button variant="outline" size="sm" onClick={() => {
              setDraft((d) => ({ ...d, sinter_plate_rules: [...sinterRules, { pattern: "", products: [], note: "" }] }));
              setNotice("已新增烧结盘规则，填写后保存生效。");
            }}>添加烧结盘规则</Button>
            {sinterRules.map((rule: SinterPlateRule, index: number) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-xl border border-slate-200/70 bg-white/80 p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <Input placeholder="匹配词/正则" value={rule.pattern} onChange={(e) => setDraft((d) => ({ ...d, sinter_plate_rules: updateAt(sinterRules, index, { pattern: e.target.value }) }))} />
                <Input placeholder="品名，如 511,512" value={(rule.products || []).join(",")} onChange={(e) => setDraft((d) => ({ ...d, sinter_plate_rules: updateAt(sinterRules, index, { products: e.target.value.split(/[,，]/).map((p) => p.trim()).filter(Boolean) }) }))} />
                <Input placeholder="备注" value={rule.note || ""} onChange={(e) => setDraft((d) => ({ ...d, sinter_plate_rules: updateAt(sinterRules, index, { note: e.target.value }) }))} />
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setDraft((d) => ({ ...d, sinter_plate_rules: removeAt(sinterRules, index) }))}><Trash2 className="mr-1 h-4 w-4" />删除</Button>
              </div>
            ))}
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white/70 p-2">
            <Button variant="outline" size="sm" onClick={() => {
              setDraft((d) => ({ ...d, welding_rules: [...weldingRules, { pattern: "", product: "", note: "" }] }));
              setNotice("已新增焊接规则，填写后保存生效。");
            }}>添加焊接规则</Button>
            {weldingRules.map((rule: WeldingRule, index: number) => (
              <div key={index} className="grid grid-cols-[1fr_100px_1fr_auto] gap-2 rounded-xl border border-slate-200/70 bg-white/80 p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <Input placeholder="匹配词/正则" value={rule.pattern} onChange={(e) => setDraft((d) => ({ ...d, welding_rules: updateAt(weldingRules, index, { pattern: e.target.value }) }))} />
                <Input placeholder="品名" value={rule.product} onChange={(e) => setDraft((d) => ({ ...d, welding_rules: updateAt(weldingRules, index, { product: e.target.value }) }))} />
                <Input placeholder="备注" value={rule.note || ""} onChange={(e) => setDraft((d) => ({ ...d, welding_rules: updateAt(weldingRules, index, { note: e.target.value }) }))} />
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setDraft((d) => ({ ...d, welding_rules: removeAt(weldingRules, index) }))}><Trash2 className="mr-1 h-4 w-4" />删除</Button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">忽略词</h3>
            <Button variant="outline" size="sm" onClick={() => {
              setDraft((d) => ({ ...d, ignored_tokens: [...ignoredTokens, ""] }));
              setNotice("已新增忽略词，填写后保存生效。");
            }}>
              <Plus className="h-3.5 w-3.5 mr-1" />添加
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200/80 bg-white/70 p-2 md:grid-cols-4">
            {ignoredTokens.map((token: string, index: number) => (
              <div key={index} className="flex gap-1 rounded-xl border border-slate-200/70 bg-white/80 p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <Input value={token} onChange={(e) => setDraft((d) => ({ ...d, ignored_tokens: updateAt(ignoredTokens.map((value) => ({ value })), index, { value: e.target.value }).map((x) => x.value) }))} />
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setDraft((d) => ({ ...d, ignored_tokens: removeAt(ignoredTokens, index) }))}><Trash2 className="mr-1 h-4 w-4" />删除</Button>
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-800">
          清空下方补充只会清空 <code>recognition-rules.json</code> 的用户补充规则，内置识别能力不会消失。
        </div>
      </DialogContent>
      <DialogFooter className="shrink-0">
        <Button variant="ghost" onClick={clearAll}>清空补充</Button>
        <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        <Button onClick={saveDraft}>
          <Save className="h-4 w-4 mr-1" />
          保存补充规则
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
