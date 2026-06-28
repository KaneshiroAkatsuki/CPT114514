import * as React from "react";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        {children}
        <button
          className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
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
  <div className={cn("border-b px-6 py-4", className)}>{children}</div>
);

export const DialogTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <h2 className={cn("text-lg font-semibold", className)}>{children}</h2>
);

export const DialogContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn("p-6", className)}>{children}</div>
);

export const DialogFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn("border-t px-6 py-4 flex justify-end gap-2", className)}>{children}</div>
);
