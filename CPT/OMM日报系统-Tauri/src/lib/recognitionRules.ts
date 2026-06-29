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
  if (value === "FAI" || value.includes("FAI")) return "开发";
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

  const keywordStations = ["CNC", "射出", "整形", "烧结盘", "烧结", "焊接", "电镀", "镭雕", "二维", "FAI"];
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

  warnings.push("未识别明确工站，按开发兜底");
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

  const manualMatch = folderName.match(/[-_](?:手量)-([^-_]+)/);
  if (manualMatch) result.operator = manualMatch[1].trim();

  const senderMatch = folderName.match(/[-_](?:送测|ST)-([^-_]+)/);
  if (senderMatch) {
    result.sender = senderMatch[1].trim();
  } else {
    const senderInline = folderName.match(/([^\-_\d]{2,6})送测/);
    if (senderInline) result.sender = senderInline[1].trim();
  }

  const qtyMatch = folderName.match(/(\d+)\s*(?:PCS|pcs|件)/);
  if (qtyMatch) result.quantity = `${qtyMatch[1]}PCS`;

  return result;
}
