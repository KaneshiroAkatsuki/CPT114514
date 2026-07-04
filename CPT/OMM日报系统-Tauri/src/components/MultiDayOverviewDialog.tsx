import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Wrench } from "lucide-react";

export type MultiDayOverviewStatus =
  | "ok"
  | "too_little"
  | "too_much"
  | "needs_review"
  | "manual_pending"
  | "error";

export interface MultiDayOverviewItem {
  index: number;
  dateFolder: string;
  shift: string;
  status: MultiDayOverviewStatus;
  statusText: string;
  detail: string;
}

interface MultiDayOverviewDialogProps {
  open: boolean;
  loading: boolean;
  items: MultiDayOverviewItem[];
  onClose: () => void;
  onOpenPreview: (index: number) => void;
}

function statusClass(status: MultiDayOverviewStatus): string {
  switch (status) {
    case "ok":
      return "border-green-200 bg-green-50 text-green-800";
    case "too_little":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "too_much":
      return "border-red-200 bg-red-50 text-red-800";
    case "needs_review":
    case "manual_pending":
      return "border-orange-200 bg-orange-50 text-orange-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function statusIcon(status: MultiDayOverviewStatus) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "manual_pending") return <Wrench className="h-4 w-4" />;
  return <AlertTriangle className="h-4 w-4" />;
}

export function MultiDayOverviewDialog({
  open,
  loading,
  items,
  onClose,
  onOpenPreview,
}: MultiDayOverviewDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <Card className="flex h-[620px] max-h-[88vh] w-[760px] max-w-full flex-col overflow-hidden rounded-2xl border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <CardHeader className="shrink-0 border-b border-slate-200/70 bg-white/90 px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Clock className="h-4 w-4 text-blue-600" />
              多日预览总览
            </CardTitle>
            <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              正在读取队列预览状态
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              队列为空，暂无可总览的日期。
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={`${item.index}-${item.dateFolder}`}
                  type="button"
                  onClick={() => onOpenPreview(item.index)}
                  className="w-full rounded-xl border border-slate-200/80 bg-white/80 p-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{item.dateFolder}</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                          {item.shift} 班
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(item.status)}`}>
                      {statusIcon(item.status)}
                      {item.statusText}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
