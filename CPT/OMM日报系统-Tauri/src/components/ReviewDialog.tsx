import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FolderRecord, ReviewInfo } from "@/types/record";
import { FIELD_LABELS, FIELD_HINTS } from "@/types/record";

interface ReviewDialogProps {
  open: boolean;
  records: FolderRecord[];
  reviewMap: Record<string, ReviewInfo>;
  onConfirm: (updatedRecords: FolderRecord[], skippedFolders: string[]) => void;
  onSkip: (skippedFolders: string[], updatedRecords: FolderRecord[]) => void;
  onCancel: () => void;
}

const EDITABLE_FIELDS = [
  "quantity",
  "manual_duration",
  "station",
  "product",
  "sender",
  "work_order",
  "mold",
  "machine",
  "test_type",
  "send_date",
  "send_time",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

function isEditableField(field: string): field is EditableField {
  return (EDITABLE_FIELDS as readonly string[]).includes(field);
}

function fieldValue(record: FolderRecord, field: EditableField): string {
  const value = record[field];
  if (value === null || value === undefined) return "";
  return String(value);
}

function setFieldValue(
  record: FolderRecord,
  field: EditableField,
  value: string
): FolderRecord {
  const updated = { ...record };
  if (field === "quantity") {
    const num = Number(value);
    (updated as Record<string, unknown>)[field] =
      value === "" || Number.isNaN(num) ? "/" : num;
  } else if (field === "manual_duration") {
    const num = Number(value);
    (updated as Record<string, unknown>)[field] =
      value === "" || Number.isNaN(num) ? null : num;
  } else {
    (updated as Record<string, unknown>)[field] = value;
  }
  return updated;
}

function hasUsableFieldValue(record: FolderRecord, field: EditableField): boolean {
  if (field === "quantity") {
    return typeof record.quantity === "number" && Number.isFinite(record.quantity) && record.quantity > 0;
  }
  if (field === "manual_duration") {
    return typeof record.manual_duration === "number" && Number.isFinite(record.manual_duration) && record.manual_duration > 0;
  }
  const value = record[field];
  return value !== null && value !== undefined && String(value).trim().length > 0;
}

export function ReviewDialog({
  open,
  records,
  reviewMap,
  onConfirm,
  onSkip,
  onCancel,
}: ReviewDialogProps) {
  const [editedRecords, setEditedRecords] = useState<FolderRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pendingFolders, setPendingFolders] = useState<string[]>([]);
  const [skippedFolders, setSkippedFolders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const folders = Object.keys(reviewMap).filter(
        (k) => reviewMap[k].missing.length > 0 || reviewMap[k].placeholders.length > 0
      );
      setEditedRecords(records.map((r) => ({ ...r })));
      setPendingFolders(folders);
      setCurrentIndex(0);
      setSkippedFolders([]);
      setError(null);
    }
  }, [open, records, reviewMap]);

  const handleFieldChange = useCallback(
    (folder: string, field: EditableField, value: string) => {
      setEditedRecords((prev) =>
        prev.map((r) =>
          r.folder === folder ? setFieldValue(r, field, value) : r
        )
      );
      if (error) setError(null);
    },
    [error]
  );

  const validateCurrentRecord = (): string | null => {
    const currentFolder = pendingFolders[currentIndex];
    const record = editedRecords.find((r) => r.folder === currentFolder);
    if (!record) return '当前记录不存在';
    const info = reviewMap[currentFolder];
    const problemFields = [...info.missing, ...info.placeholders];
    const hasQuantity = typeof record.quantity === 'number' && record.quantity > 0 && Number.isFinite(record.quantity);
    const hasDuration = typeof record.manual_duration === 'number' && record.manual_duration > 0 && Number.isFinite(record.manual_duration);
    if (!hasQuantity && !hasDuration) {
      return '数量和测量时间至少要填写一个合法值';
    }
    const missingEditable = problemFields.filter((f) => {
      if (!isEditableField(f) || !info.missing.includes(f)) return false;
      // 件数和测量时间互为兜底：只要其中一个合法，就不强制另一个也填写。
      if ((f === 'quantity' || f === 'manual_duration') && (hasQuantity || hasDuration)) return false;
      return !hasUsableFieldValue(record, f);
    });
    if (missingEditable.length > 0) {
      return `以下字段仍需补充：${missingEditable.map((f) => FIELD_LABELS[f] || f).join('、')}`;
    }
    return null;
  };

  const handleConfirm = () => {
    const err = validateCurrentRecord();
    if (err) {
      setError(err);
      return;
    }
    const currentFolder = pendingFolders[currentIndex];
    const newPending = pendingFolders.filter((f) => f !== currentFolder);
    setPendingFolders(newPending);

    if (newPending.length === 0) {
      onConfirm(editedRecords, skippedFolders);
    } else if (currentIndex >= newPending.length) {
      setCurrentIndex(newPending.length - 1);
    }
  };

  const handleSkip = () => {
    const currentFolder = pendingFolders[currentIndex];
    const newSkipped = [...skippedFolders, currentFolder];
    setSkippedFolders(newSkipped);
    const newPending = pendingFolders.filter((f) => f !== currentFolder);
    setPendingFolders(newPending);
    if (error) setError(null);

    if (newPending.length === 0) {
      onSkip(newSkipped, editedRecords);
    } else if (currentIndex >= newPending.length) {
      setCurrentIndex(newPending.length - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < pendingFolders.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  if (!open) return null;
  if (pendingFolders.length === 0) return null;

  const currentFolder = pendingFolders[currentIndex];
  const record = editedRecords.find((r) => r.folder === currentFolder);
  if (!record) return null;
  const info = reviewMap[currentFolder];
  const problemFields = [...info.missing, ...info.placeholders];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <Card className="mx-4 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <CardHeader className="shrink-0 border-b border-slate-200/70 bg-white/90">
          <CardTitle className="flex items-center justify-between">
            <span>审核缺失字段</span>
            <span className="text-sm font-normal text-slate-500">
              审核 {currentIndex + 1}/{pendingFolders.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto pt-4">
          <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white/70 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="font-medium text-sm text-slate-900">
              {currentFolder}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {problemFields.map((field) => {
                if (!isEditableField(field)) return null;
                const label = FIELD_LABELS[field] || field;
                const hint = FIELD_HINTS[field] || "";
                const isMissing = info.missing.includes(field);
                const isPlaceholder = info.placeholders.includes(field);

                return (
                  <div key={field} className="space-y-0.5">
                    <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                      {label}
                      {isMissing && (
                        <span className="text-red-500 text-[10px]">
                          缺失
                        </span>
                      )}
                      {isPlaceholder && (
                        <span className="text-amber-500 text-[10px]">
                          占位
                        </span>
                      )}
                    </label>
                    <Input
                      value={fieldValue(record, field)}
                      onChange={(e) =>
                        handleFieldChange(
                          currentFolder,
                          field,
                          e.target.value
                        )
                      }
                      placeholder={hint}
                      className="text-sm h-8"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
        {error && (
          <div className="shrink-0 border-t border-red-200 bg-red-50/90 px-4 py-2">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}
        <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200/70 bg-slate-50/80 p-4">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentIndex === 0}
          >
            上一个
          </Button>
          <Button
            variant="outline"
            onClick={handleNext}
            disabled={currentIndex === pendingFolders.length - 1}
          >
            下一个
          </Button>
          <Button variant="outline" onClick={handleSkip}>
            跳过此包
          </Button>
          <Button onClick={handleConfirm}>确认并继续</Button>
        </div>
      </Card>
    </div>
  );
}
