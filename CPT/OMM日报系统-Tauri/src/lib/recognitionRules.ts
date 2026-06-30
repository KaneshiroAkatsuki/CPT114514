import type { RealManualTask, RecognitionRules } from "@/types/record";

const DEFAULT_IGNORED_TOKENS = [
  "EVT",
  "ALT",
  "ALT-1",
  "ALT-2",
  "SLIDER",
  "X168",
  "BIN2",
  "BIN4",
  "AOI",
  "FAI9",
  "CMM",
  "OMM",
  "PCS",
  "ST",
  "MO",
  "T0",
  "T1",
  "IQC",
  "OQC",
];

const COMMON_ACTION_TYPOS = ["送检", "送檢", "送样", "送樣", "生成", "上传", "上傳", "提交", "送", "传"];
const MACHINE_NAME_TOKENS = ["EVT", "ALT", "ALT-1", "ALT-2", "SLIDER", "EVT-SLIDER", "EVT ALT-2"];
const KNOWN_STATION_WORDS = ["开发", "CNC", "射出", "整形", "烧结盘", "烧结", "焊接", "电镀", "镭雕", "二维", "FAI"];

export function emptyRecognitionRules(): RecognitionRules {
  return {
    version: 1,
    station_aliases: [],
    product_aliases: [],
    ignored_tokens: [],
    welding_rules: [],
    sinter_plate_rules: [],
  };
}

function splitName(name: string): string[] {
  return name.split(/[-_\s]+/).map((p) => p.trim()).filter(Boolean);
}

function pushUnique(list: string[], value?: string | null) {
  const v = value?.trim();
  if (v && !list.includes(v)) list.push(v);
}

function matchPattern(input: string, pattern: string): boolean {
  const p = pattern.trim();
  if (!p) return false;
  try {
    return new RegExp(p, "i").test(input);
  } catch {
    return input.toLowerCase().includes(p.toLowerCase());
  }
}

function normalizeStation(value: string): string {
  if (value.includes("测试片")) return "开发";
  if (value === "FAI" || value.includes("FAI")) return "开发";
  if (value.includes("开发")) return "开发";
  if (value.includes("二维")) return "镭雕";
  if (value.includes("射出")) return "射出";
  if (value.includes("整形")) return "整形";
  if (value.includes("烧结盘")) return "烧结盘";
  if (value.includes("烧结")) return "烧结";
  if (value.includes("焊接")) return "焊接";
  if (value.includes("电镀")) return "电镀";
  if (value.includes("镭雕")) return "镭雕";
  if (value.toUpperCase() === "CNC") return "CNC";
  return value;
}

function pushWarning(warnings: string[], warning: string) {
  if (!warnings.includes(warning)) warnings.push(warning);
}

function isLikelyChineseName(value?: string): boolean {
  const v = value?.trim();
  if (!v) return false;
  if (!/^[\u4e00-\u9fa5]{2,4}$/.test(v)) return false;
  if (KNOWN_STATION_WORDS.some((word) => v.includes(word))) return false;
  if (["手量", "手测", "送测", "测试", "测试片", "尺寸", "制程", "首件", "复测"].includes(v)) return false;
  return true;
}

function isLikelyProductName(value?: string): boolean {
  const v = value?.trim();
  if (!v) return false;
  if (v === "测试片") return true;
  if (/^\d{3}$/.test(v)) return true;
  if (/^0\.(?:2|25)$/.test(v)) return true;
  if (/^\d{3}(?:\s*,\s*\d{3})+$/.test(v)) return true;
  return false;
}

function collectNormalProductCandidates(name: string, rules?: RecognitionRules): string[] {
  const parts = splitName(name);
  const candidates: string[] = [];
  for (const part of parts) {
    const clean = part.replace(/^X/, "");
    if (isIgnoredToken(clean, rules)) continue;
    if (/^\d{3}$/.test(clean)) pushUnique(candidates, clean);
  }
  return candidates;
}

function validateClockTime(raw: string): boolean {
  const value = raw.replace(/点/g, ":").replace(/：/g, ":").replace(/分$/, "");
  const m = value.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return false;
  const hour = Number(m[1]);
  const minute = m[2] === undefined || m[2] === "" ? 0 : Number(m[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function recognizeTestType(name: string): string {
  if (name.includes("首件")) return "首件";
  if (name.includes("制程")) return "制程";
  return "测试尺寸";
}

export function recognizeStation(name: string, rules?: RecognitionRules): { station?: string; matchedRules: string[]; warnings: string[] } {
  const matchedRules: string[] = [];
  const warnings: string[] = [];
  const parts = splitName(name);

  for (const rule of rules?.station_aliases || []) {
    if (rule.alias && matchPattern(name, rule.alias)) {
      matchedRules.push(`补充工站规则：${rule.alias} -> ${rule.station}`);
      return { station: rule.station, matchedRules, warnings };
    }
  }

  if (name.includes("测试片")) {
    matchedRules.push("内置测试片工站规则：测试片 -> 开发");
    return { station: "开发", matchedRules, warnings };
  }

  const keywordStations = KNOWN_STATION_WORDS;
  for (const keyword of keywordStations) {
    if (name.toUpperCase().includes(keyword.toUpperCase())) {
      const station = normalizeStation(keyword);
      matchedRules.push(`内置工站关键词：${keyword} -> ${station}`);
      return { station, matchedRules, warnings };
    }
  }

  if (parts.length >= 2 && /^[\u4e00-\u9fa5]{1,6}$/.test(parts[1]) && parts[1] !== "手量") {
    const station = normalizeStation(parts[1]);
    matchedRules.push(`第二段工站：${parts[1]} -> ${station}`);
    return { station, matchedRules, warnings };
  }

  pushWarning(warnings, "未识别明确工站，按开发兜底；请确认工站是否应为开发");
  return { station: "开发", matchedRules: ["工站兜底：开发"], warnings };
}

function isIgnoredToken(token: string, rules?: RecognitionRules): boolean {
  const t = token.toUpperCase();
  const ignored = [...DEFAULT_IGNORED_TOKENS, ...(rules?.ignored_tokens || [])].map((v) => v.toUpperCase());
  return ignored.some((v) => t === v || t.startsWith(`${v}-`) || t.includes(`${v}量测`));
}

export function recognizeProductCodes(name: string, station?: string, rules?: RecognitionRules): { products: string[]; matchedRules: string[]; warnings: string[] } {
  const products: string[] = [];
  const matchedRules: string[] = [];
  const warnings: string[] = [];

  for (const rule of rules?.product_aliases || []) {
    if (rule.station && station && rule.station !== station) continue;
    if (matchPattern(name, rule.pattern)) {
      pushUnique(products, rule.product);
      matchedRules.push(`补充品名规则：${rule.pattern} -> ${rule.product}`);
    }
  }
  if (products.length > 0) {
    return { products, matchedRules, warnings };
  }

  if (name.includes("测试片")) {
    pushUnique(products, "测试片");
    matchedRules.push("内置测试片品名规则");
    return { products, matchedRules, warnings };
  }

  if (station === "CNC" || (station === "整形" && name.toUpperCase().includes("CNC"))) {
    pushUnique(products, "035");
    matchedRules.push("内置 CNC 品名：035");
    return { products, matchedRules, warnings };
  }

  if (station === "烧结盘" || name.includes("烧结盘")) {
    for (const rule of rules?.sinter_plate_rules || []) {
      if (matchPattern(name, rule.pattern)) {
        for (const p of rule.products || []) pushUnique(products, p);
        matchedRules.push(`补充烧结盘规则：${rule.pattern}`);
      }
    }
    if (name.includes("0.25")) pushUnique(products, "0.25");
    else if (name.includes("0.2")) pushUnique(products, "0.2");
    for (const m of name.matchAll(/(?<!\d)X?(\d{3})(?!\d)/g)) {
      const code = m[1];
      if (code !== "202") pushUnique(products, code);
    }
    if (products.length > 0) matchedRules.push("内置烧结盘品名规则");
    return { products, matchedRules, warnings };
  }

  if (station === "焊接" || name.includes("焊接")) {
    for (const rule of rules?.welding_rules || []) {
      if (matchPattern(name, rule.pattern)) {
        pushUnique(products, rule.product);
        matchedRules.push(`补充焊接规则：${rule.pattern} -> ${rule.product}`);
      }
    }
    for (const m of name.matchAll(/(?<!\d)414(2[4-9])(?!\d)/g)) {
      pushUnique(products, `42${m[1].slice(1)}`);
      matchedRules.push("内置焊接 41424-41429 规则");
    }
    for (const m of name.matchAll(/(?<!\d)(289|290)(?!\d)/g)) {
      pushUnique(products, m[1]);
      matchedRules.push("内置焊接 289/290 规则");
    }
    return { products, matchedRules, warnings };
  }

  for (const m of name.matchAll(/(?<!\d)806[-_]?(\d{5})(?:[-_]?(\d{1,2}))?(?!\d)/gi)) {
    const mid = m[1];
    pushUnique(products, mid.slice(-3));
  }
  if (products.length > 0) {
    matchedRules.push("内置 806 料号后三位规则");
    return { products, matchedRules, warnings };
  }

  const parts = splitName(name);
  const normalCandidates = collectNormalProductCandidates(name, rules);
  if (normalCandidates.length > 1) {
    pushWarning(warnings, `识别到多个三位数字品名候选：${normalCandidates.join("、")}；普通任务仅自动取第一个，请确认品名`);
  }
  for (const part of parts) {
    const clean = part.replace(/^X/, "");
    if (isIgnoredToken(clean, rules)) continue;
    if (/^\d{3}$/.test(clean)) {
      pushUnique(products, clean);
      matchedRules.push("内置三位数字品名规则");
      break;
    }
  }

  return { products, matchedRules, warnings };
}

function normalizeSendTime(raw?: string, warnings?: string[]): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (warnings && !validateClockTime(value)) {
    pushWarning(warnings, `送测时间“${value}”格式异常，请确认时间`);
  }
  return value.replace(/点/g, ":").replace(/：/g, ":");
}

function applySenderRecognition(folderName: string, result: Partial<RealManualTask>, warnings: string[]) {
  const senderMatch = folderName.match(/[-_](?:送测|ST)-([^-_]+)/);
  if (senderMatch) {
    const sender = senderMatch[1].trim();
    if (isLikelyChineseName(sender)) {
      result.sender = sender;
    } else {
      pushWarning(warnings, `送测人“${sender}”不像有效姓名，请人工确认`);
    }
    return;
  }

  const inlineWithTime = folderName.match(/([\u4e00-\u9fa5]{2,6})(\d{1,2}(?:点\d{0,2}|[:：]\d{1,2}))送测/);
  if (inlineWithTime) {
    const sender = inlineWithTime[1].trim();
    if (isLikelyChineseName(sender)) {
      result.sender = sender;
    } else {
      pushWarning(warnings, `送测人“${sender}”不像有效姓名，请人工确认`);
    }
    result.send_time = normalizeSendTime(inlineWithTime[2], warnings) || result.send_time;
    return;
  }

  const senderInline = folderName.match(/([\u4e00-\u9fa5]{2,6})送测/);
  if (senderInline) {
    const sender = senderInline[1].trim();
    if (isLikelyChineseName(sender)) {
      result.sender = sender;
    } else {
      pushWarning(warnings, `送测人“${sender}”不像有效姓名，请人工确认`);
    }
    return;
  }

  const actionPattern = COMMON_ACTION_TYPOS.join("|");
  const suspiciousSender = folderName.match(new RegExp(`([\\u4e00-\\u9fa5]{2,4}?)(${actionPattern})(?=$|[-_\\s])`));
  if (suspiciousSender && isLikelyChineseName(suspiciousSender[1])) {
    result.sender = result.sender || suspiciousSender[1];
    pushWarning(warnings, `疑似送测人写法不完整：${suspiciousSender[0]}，已按“${suspiciousSender[1]}”预填送测人，请确认是否应为“${suspiciousSender[1]}送测”`);
  }
}

function applyManualOperatorRecognition(folderName: string, result: Partial<RealManualTask>, warnings: string[]) {
  const manualMatch = folderName.match(/[-_](?:手量|手测)-([^-_]+)/);
  if (manualMatch) {
    const operator = manualMatch[1].trim();
    if (isLikelyChineseName(operator)) {
      result.operator = operator;
      const ommOperator = extractOmmOperator(folderName);
      if (ommOperator && ommOperator === operator) {
        pushWarning(warnings, `检测到 OMM 与手量测量员同为“${operator}”；请在手量弹窗确认是“OMM+手量都计时”还是“只计手量（OMM已登记）”`);
      }
    } else {
      pushWarning(warnings, `手量测量员“${operator}”不像有效姓名，请人工确认`);
    }
    return;
  }

  if (folderName.includes("手量") || folderName.includes("手测")) {
    pushWarning(warnings, "检测到手量/手测，但未识别到“-手量-姓名”格式的测量员，请人工补充");
  }
}

function extractOmmOperator(folderName: string): string | undefined {
  const ommMatch = folderName.match(/[-_](?:OMM|OM)-?([^-_\s]+)/i);
  const operator = ommMatch?.[1]?.trim();
  return isLikelyChineseName(operator) ? operator : undefined;
}

function applyQuantityRecognition(folderName: string, result: Partial<RealManualTask>, warnings: string[]) {
  const qtyMatches = [...folderName.matchAll(/(\d+)\s*(?:PCS|pcs|件)/g)];
  if (qtyMatches.length > 0) {
    const quantities = qtyMatches.map((m) => `${m[1]}PCS`);
    result.quantity = quantities[0];
    if (quantities.length > 1) {
      pushWarning(warnings, `识别到多个数量：${quantities.join("、")}；已取第一个，请确认数量`);
    }
  } else if (/(^|[-_\s])PCS($|[-_\s])/i.test(folderName)) {
    pushWarning(warnings, "文件夹名里出现 PCS，但未识别到明确数量，请人工填写");
  }
}

function auditRecognitionResult(result: Partial<RealManualTask>, warnings: string[]) {
  const product = result.product?.trim();
  if (!product) {
    pushWarning(warnings, "未识别到品名，请人工确认");
  } else {
    const productParts = product.split(/\s*,\s*/).filter(Boolean);
    for (const part of productParts) {
      if (isLikelyChineseName(part)) {
        pushWarning(warnings, `品名“${part}”像人名，文件名可能分段错误，请人工确认`);
      }
      if (MACHINE_NAME_TOKENS.some((token) => part.toUpperCase() === token.toUpperCase())) {
        pushWarning(warnings, `品名“${part}”像机器/模板名称，不像实际品名，请人工确认`);
      }
      if (!isLikelyProductName(part)) {
        pushWarning(warnings, `品名“${part}”不符合常见规则（三位数字、测试片、0.2/0.25 或多品名烧结盘），请人工确认`);
      }
    }
  }

  // CMM/OMM 后的人名通常是日报归属或设备段姓名。识别逻辑不会把它当作品名或手量测量员；
  // 这里不作为 warning 展示，避免正常命名也打扰用户。
}

export function recognizeManualTaskWithRules(folderName: string, rules?: RecognitionRules): Partial<RealManualTask> {
  const stationResult = recognizeStation(folderName, rules);
  const productResult = recognizeProductCodes(folderName, stationResult.station, rules);
  const matchedRules = [...stationResult.matchedRules, ...productResult.matchedRules];
  const warnings = [...stationResult.warnings, ...productResult.warnings];

  const result: Partial<RealManualTask> = {
    work_order: "/",
    mold: "/",
    machine: "/",
    station: stationResult.station || "",
    product: productResult.products.join(", "),
    test_type: recognizeTestType(folderName),
    send_project: "OMM",
    send_time: "/",
    note: `识别来源: ${folderName}`,
    from_recognition: true,
    matched_rules: matchedRules,
    recognition_warnings: warnings,
  };

  applyManualOperatorRecognition(folderName, result, warnings);

  applySenderRecognition(folderName, result, warnings);
  applyQuantityRecognition(folderName, result, warnings);
  auditRecognitionResult(result, warnings);

  result.recognition_warnings = warnings;

  return result;
}
