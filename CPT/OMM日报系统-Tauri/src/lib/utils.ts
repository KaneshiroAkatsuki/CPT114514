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

  // 找品名：手量前面的数字段
  if (manualMatch) {
    const idx = parts.findIndex((p) => p.includes('手量'));
    if (idx > 0) {
      result.product = parts[idx - 1];
    }
  }

  // 尝试识别送测人：-送测-姓名 或 -ST-姓名
  const senderMatch = folderName.match(/[-_](?:送测|ST)-([^-_]+)/);
  if (senderMatch) {
    result.sender = senderMatch[1].trim();
  }

  // 尝试识别数量：数字+PCS/pcs/件
  const qtyMatch = folderName.match(/(\d+)\s*(?:PCS|pcs|件)/);
  if (qtyMatch) {
    result.quantity = `${qtyMatch[1]}PCS`;
  }

  // 尝试识别日期：M月D日 或 M.D
  const dateMatch = folderName.match(/(\d{1,2})[月.](\d{1,2})日?/);
  if (dateMatch) {
    result.send_date = `${dateMatch[1]}月${dateMatch[2]}日`;
  }

  // 尝试识别明确耗时（仅在带耗时关键词或明确单位时）
  const duration = recognizeManualDuration(folderName);
  if (duration !== null) {
    result.duration_minutes = duration;
  }

  return result;
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
