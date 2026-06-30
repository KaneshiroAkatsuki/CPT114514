import { AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ConfirmTone = "info" | "warning" | "danger";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  details?: string[];
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
}

const toneStyles: Record<ConfirmTone, { icon: string; panel: string; button: string }> = {
  info: {
    icon: "bg-blue-50 text-blue-600",
    panel: "border-blue-200/70 bg-blue-50/80 text-blue-800",
    button: "",
  },
  warning: {
    icon: "bg-amber-50 text-amber-700",
    panel: "border-amber-200 bg-amber-50/90 text-amber-900",
    button: "bg-amber-600 hover:bg-amber-700",
  },
  danger: {
    icon: "bg-red-50 text-red-700",
    panel: "border-red-200 bg-red-50/90 text-red-900",
    button: "bg-red-600 hover:bg-red-700",
  },
};

export function ConfirmDialog({
  open,
  title,
  description,
  details,
  confirmLabel,
  cancelLabel = "取消",
  tone = "info",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const styles = toneStyles[tone];
  const Icon = tone === "info" ? Info : AlertTriangle;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <Card className="w-[460px] max-w-full overflow-hidden rounded-2xl border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
        <CardHeader className="border-b border-slate-200/70 bg-white/90 px-5 py-4">
          <CardTitle className="flex items-center gap-3 text-base font-semibold text-slate-950">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
              <Icon className="h-4 w-4" />
            </span>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          {description && (
            <div className={`whitespace-pre-line rounded-xl border px-4 py-3 text-sm leading-6 ${styles.panel}`}>
              {description}
            </div>
          )}
          {details && details.length > 0 && (
            <ul className={`max-h-48 space-y-1 overflow-y-auto rounded-xl border px-4 py-3 text-sm leading-6 ${styles.panel}`}>
              {details.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-200/70 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button type="button" onClick={onConfirm} className={styles.button}>
              {confirmLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
