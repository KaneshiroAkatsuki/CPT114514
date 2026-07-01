import * as React from "react";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, className, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <div className={cn("relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.24)]", className)}>
        {children}
        <button
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-slate-400 transition hover:border-slate-200/80 hover:bg-white/80 hover:text-slate-700 hover:shadow-sm"
          onClick={() => onOpenChange?.(false)}
          aria-label="关闭"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export const DialogHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn("border-b border-slate-200/70 bg-white/90 px-6 py-4", className)}>{children}</div>
);

export const DialogTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <h2 className={cn("text-lg font-semibold tracking-normal text-slate-950", className)}>{children}</h2>
);

export const DialogContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn("p-6", className)}>{children}</div>
);

export const DialogFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn("border-t border-slate-200/70 bg-white/70 px-6 py-4 flex justify-end gap-2", className)}>{children}</div>
);
