import { type ManualFolderCandidate, type RealManualTask } from "@/types/record";
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
 *  强特征：-手量-姓名
 *  返回部分字段，需要用户补录确认。
 */
export function recognizeManualTaskFromFolder(folderName: string): Partial<RealManualTask> {
  const result: Partial<RealManualTask> = {
    work_order: '/',
    mold: '/',
    machine: '/',
    test_type: '测试尺寸',
    send_project: 'OMM',
    send_time: '/',
    note: `识别来源: ${folderName}`,
    from_recognition: true,
  };

  // 按 - _ 分割
  const parts = folderName.split(/[-_]/).filter(Boolean);

  // 测量员：强特征 -手量-姓名
  const manualMatch = folderName.match(/-手量-([^-_]+)/);
  if (manualMatch) {
    result.operator = manualMatch[1].trim();
  }

  // 品名：优先从头开始找数字/料号段
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (looksLikeProduct(p)) {
      result.product = p;
      break;
    }
  }

  // 工站：第二段如果是工站名称，则取为工站
  if (parts.length >= 2 && looksLikeStation(parts[1])) {
    result.station = parts[1];
  }

  // 送测人：支持 -送测-姓名、-ST-姓名、姓名送测
  const senderMatch = folderName.match(/[-_](?:送测|ST)-([^-_]+)/);
  if (senderMatch) {
    result.sender = senderMatch[1].trim();
  } else {
    const senderInline = folderName.match(/([^\-_\d]{2,4})送测/);
    if (senderInline) {
      result.sender = senderInline[1].trim();
    }
  }

  // 数量：数字+PCS/pcs/件
  const qtyMatch = folderName.match(/(\d+)\s*(?:PCS|pcs|件)/);
  if (qtyMatch) {
    result.quantity = `${qtyMatch[1]}PCS`;
  }

  // 手量耗时通常不写进文件夹名，需要人工填写，这里不自动识别
  return result;
}

/** 判断分段是否像品名/料号：纯数字，或数字+字母混合，不以 CMM/OMM 等开头。 */
function looksLikeProduct(part: string): boolean {
  if (!part) return false;
  const s = part.toUpperCase();
  const exclude = ['CMM', 'OMM', 'PCS', 'ST', 'MO', 'T0', 'T1', 'IQC', 'OQC'];
  if (exclude.some((k) => s === k || s.startsWith(k))) return false;
  return /^\d+$/.test(part) || /^\d+[A-Za-z0-9\-]+$/.test(part);
}

/** 判断分段是否像工站名称。 */
function looksLikeStation(part: string): boolean {
  if (!part) return false;
  const s = part.trim();
  if (s.length > 10) return false;
  const stations = ['开发', 'CNC', '射出', '镭雕', '整形', '烧结', 'IQC', 'OQC', '手量'];
  if (stations.includes(s.toUpperCase())) return true;
  return /^[\u4e00-\u9fa5]{1,6}$/.test(s);
}

/** 判断文件夹名是否包含强手量特征。 */
export function isManualFolder(folderName: string): boolean {
  return folderName.includes('手量');
}

/** 从日期文件夹路径扫描直接子文件夹，自动发现手量候选。 */
export async function detectManualCandidates(
  dateFolderPath: string,
  listChildren: (path: string) => Promise<string[]>
): Promise<ManualFolderCandidate[]> {
  try {
    const names = await listChildren(dateFolderPath);
    const candidates: ManualFolderCandidate[] = [];
    for (const name of names) {
      if (isManualFolder(name)) {
        candidates.push({
          folderName: name,
          fullPath: `${dateFolderPath}\\${name}`,
          recognized: recognizeManualTaskFromFolder(name),
        });
      }
    }
    return candidates;
  } catch {
    return [];
  }
}
