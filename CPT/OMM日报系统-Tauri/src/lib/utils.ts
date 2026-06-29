import { type ManualFolderCandidate, type RealManualTask, type RecognitionRules } from "@/types/record";
import { recognizeManualTaskWithRules } from "@/lib/recognitionRules";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 解析手量耗时输入字符串，默认按小时理解，统一返回分钟数。
 *  支持格式：2（=120分钟）、2.5（=150分钟）、3h/H（=180分钟）、
 *  150分钟/150分（=150分钟）、90m（=90分钟）。
 *  解析失败返回 null。
 */
export function parseManualDuration(input: string): number | null {
  const s = input.trim().replace(/\s+/g, '');
  if (!s) return null;

  // 150分钟 / 150分 / 90m —— 明确分钟单位
  const minMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:分钟|分|m|M)$/);
  if (minMatch) {
    return Math.round(parseFloat(minMatch[1]));
  }

  // 3h / 3H
  const hMatch = s.match(/^(\d+(?:\.\d+)?)\s*[Hh]$/);
  if (hMatch) {
    return Math.round(parseFloat(hMatch[1]) * 60);
  }

  // 1小时30分钟 / 1小时 / 1时30分 / 1时
  const hourMinMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:小时|时)\s*(\d+(?:\.\d+)?)?\s*(?:分钟|分)?$/);
  if (hourMinMatch) {
    const hours = parseFloat(hourMinMatch[1] || '0');
    const minutes = parseFloat(hourMinMatch[2] || '0');
    return Math.round(hours * 60 + minutes);
  }

  // 纯数字默认按小时理解（如 2 = 120 分钟）
  const numMatch = s.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) {
    return Math.round(parseFloat(numMatch[1]) * 60);
  }

  return null;
}

/** 校验真实手量字段，返回错误信息列表（空数组表示通过）。 */
export function validateRealManualTask(task: Partial<RealManualTask>): string[] {
  const errors: string[] = [];
  if (!task.product || task.product.trim() === '' || task.product === '/') {
    errors.push('品名未填写');
  }
  if (!task.sender || task.sender.trim() === '' || task.sender === '/') {
    errors.push('送测人未填写');
  }
  if (!task.send_date || task.send_date.trim() === '' || task.send_date === '/') {
    errors.push('测试日期未填写');
  }
  if (!task.quantity || task.quantity.trim() === '' || task.quantity === '/') {
    errors.push('数量未填写');
  }
  if (task.duration_minutes === undefined || task.duration_minutes === null || Number.isNaN(task.duration_minutes)) {
    errors.push('请填写手量耗时');
  } else {
    const hours = task.duration_minutes / 60;
    if (task.duration_minutes < 5) errors.push('耗时小于5分钟，可能不合理');
    if (hours > 8) errors.push('耗时超过8小时，请确认');
  }
  if (!task.operator || task.operator.trim() === '' || task.operator === '/') {
    errors.push('测量员未填写');
  }
  return errors;
}

/** 从文件夹名识别真实手量信息。
 *  强特征：-手量-姓名 / -手测-姓名
 *  返回部分字段，需要用户补录确认。
 */
export function recognizeManualTaskFromFolder(folderName: string, recognitionRules?: RecognitionRules): Partial<RealManualTask> {
  return recognizeManualTaskWithRules(folderName, recognitionRules);
}

/** 判断文件夹名是否包含强手量特征。 */
export function isManualFolder(folderName: string): boolean {
  return folderName.includes('手量') || folderName.includes('手测');
}

/** 从日期文件夹路径扫描直接子文件夹，自动发现手量候选。 */
export async function detectManualCandidates(
  dateFolderPath: string,
  listChildren: (path: string) => Promise<string[]>,
  recognitionRules?: RecognitionRules
): Promise<ManualFolderCandidate[]> {
  try {
    const names = await listChildren(dateFolderPath);
    const candidates: ManualFolderCandidate[] = [];
    for (const name of names) {
      if (isManualFolder(name)) {
        candidates.push({
          folderName: name,
          fullPath: `${dateFolderPath}\\${name}`,
          recognized: recognizeManualTaskFromFolder(name, recognitionRules),
        });
      }
    }
    return candidates;
  } catch {
    return [];
  }
}
