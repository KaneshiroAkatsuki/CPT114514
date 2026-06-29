import { type ManualFolderCandidate, type RealManualTask } from "@/types/record";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 判断文本是否包含明确耗时关键词（耗时/用时/手量）。 */
function hasDurationKeyword(input: string): boolean {
  return /(?:耗时|用时|手量)/.test(input);
}

/** 解析手量耗时字符串，统一返回分钟数。
 *  支持格式：1.5H、1.5h、1小时30分钟、1小时、90分钟、1:30、01:30
 *  解析失败返回 null。
 */
export function parseManualDuration(input: string): number | null {
  const s = input.trim().replace(/\s+/g, '');
  if (!s) return null;

  // 1.5H / 1.5h
  const hMatch = s.match(/^(\d+(?:\.\d+)?)\s*[Hh]$/);
  if (hMatch) {
    return Math.round(parseFloat(hMatch[1]) * 60);
  }

  // 1小时30分钟 / 1小时 / 1时30分 / 1时 / 30分钟 / 30分
  // 先尝试 X小时Y分钟 / X时Y分
  const hourMinMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:小时|时)\s*(\d+(?:\.\d+)?)?\s*(?:分钟|分)?$/);
  if (hourMinMatch) {
    const hours = parseFloat(hourMinMatch[1] || '0');
    const minutes = parseFloat(hourMinMatch[2] || '0');
    return Math.round(hours * 60 + minutes);
  }

  // 30分钟 / 30分
  const minMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:分钟|分)$/);
  if (minMatch) {
    return Math.round(parseFloat(minMatch[1]));
  }

  // 1:30 / 01:30 —— 谨慎识别：只有带耗时关键词时才当耗时
  const hasKeyword = hasDurationKeyword(input);
  const timeMatch = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (timeMatch && hasKeyword) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    if (minutes >= 60) return null;
    return hours * 60 + minutes;
  }

  // 纯数字默认分钟
  const numMatch = s.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) {
    return Math.round(parseFloat(numMatch[1]));
  }

  return null;
}

/** 从文件夹名中识别明确耗时（分钟）。
 *  仅识别明确表达“耗时/用时/手量时长”的格式，避免误识别日期/班次/送测时间/数量。
 */
export function recognizeManualDuration(input: string): number | null {
  const s = input.trim().replace(/\s+/g, '');
  if (!s) return null;

  // 有明确关键词前缀的 1:30 / 01:30
  const keywordTimeMatch = s.match(/(?:耗时|用时|手量)(\d{1,2}):(\d{1,2})/);
  if (keywordTimeMatch) {
    const hours = parseInt(keywordTimeMatch[1], 10);
    const minutes = parseInt(keywordTimeMatch[2], 10);
    if (minutes >= 60) return null;
    return hours * 60 + minutes;
  }

  // 有明确关键词前缀的小时数或分钟数：耗时90 / 耗时90分钟 / 用时1.5H / 手量1小时30分
  const keywordNumberMatch = s.match(/(?:耗时|用时|手量)(\d+(?:\.\d+)?)([Hh]|小时|时|分钟|分)?/);
  if (keywordNumberMatch) {
    const num = parseFloat(keywordNumberMatch[1]);
    const unit = keywordNumberMatch[2] || '';
    if (/^[Hh]|小时|时$/.test(unit)) {
      return Math.round(num * 60);
    }
    return Math.round(num);
  }

  // 没有关键词的纯 1.5H / 90分钟 / 1小时30分钟 等 —— 注意避免 6.30B 被误判
  // 1.5H / 1.5h
  const hMatch = s.match(/(\d+(?:\.\d+)?)\s*[Hh]$/);
  if (hMatch) {
    return Math.round(parseFloat(hMatch[1]) * 60);
  }

  // 90分钟 / 90分 / 1小时30分钟 / 1小时 / 1时30分
  const hourMinMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:小时|时)\s*(\d+(?:\.\d+)?)?\s*(?:分钟|分)?$/);
  if (hourMinMatch) {
    const hours = parseFloat(hourMinMatch[1] || '0');
    const minutes = parseFloat(hourMinMatch[2] || '0');
    return Math.round(hours * 60 + minutes);
  }

  const minMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:分钟|分)$/);
  if (minMatch) {
    return Math.round(parseFloat(minMatch[1]));
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
    errors.push('送测日期未填写');
  }
  if (!task.quantity || task.quantity.trim() === '' || task.quantity === '/') {
    errors.push('测试数量未填写');
  }
  if (task.duration_minutes === undefined || task.duration_minutes === null || Number.isNaN(task.duration_minutes)) {
    errors.push('测试耗时未填写或无效');
  } else {
    if (task.duration_minutes < 5) errors.push('测试耗时小于5分钟，可能不合理');
    if (task.duration_minutes > 180) errors.push('测试耗时超过3小时，请确认');
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

  // 尝试识别 -手量-姓名 段落
  const manualMatch = folderName.match(/-手量-([^-_]+)/);
  if (manualMatch) {
    result.operator = manualMatch[1].trim();
  }

  // 尝试识别 -OMM-姓名 或 -CMM-姓名 前的产品/送测人（简单启发式）
  const parts = folderName.split(/[-_]/).filter(Boolean);

  // 找品名：优先从头开始找数字/料号段，不要把 CMM/OMM 后的姓名当品名
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

  // 明确耗时（仅在带耗时关键词或明确单位时）
  const duration = recognizeManualDuration(folderName);
  if (duration !== null) {
    result.duration_minutes = duration;
  }

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
