export interface FolderRecord {
  folder: string;
  station: string;
  product: string;
  sender: string;
  work_order: string;
  mold: string;
  machine: string;
  test_type: string;
  send_date: string;
  send_time: string;
  quantity: number | '/';
  actual_quantity: number | null;
  nonstandard_xlsx: boolean;
  operator: string;
  manual_duration: number | null;
  manual_quantity: number | null;
}

export interface ReviewInfo {
  missing: string[];
  placeholders: string[];
  warnings?: string[];
}

export interface ParseFoldersResponse {
  success: boolean;
  data: {
    records: FolderRecord[];
    review_map: Record<string, ReviewInfo>;
  };
  error: string | null;
}

export interface GenerateSettings {
  early_leave: boolean;
  /** 下班策略：auto 智能判断但不自动下早班 / early 下早班 / normal 不下早班 */
  leave_strategy?: 'auto' | 'early' | 'normal';
  enable_hand: boolean;
  enable_other: boolean;
  tpp_min: number;
  tpp_max: number;
  pkg_rest: number;
  operator_name: string;
  output_dir: string | null;
  use_src_output: boolean;
  shift_override: string | null;
  special_items?: SpecialItem[];
  duration_rules?: DurationRule[];
  /** 手量单次最大时长（分钟），默认 120 */
  hand_max?: number;
  /** 其他事务单次最大时长（分钟），默认 90 */
  other_max?: number;
  /** 其他事务补时备注，默认“其他事务” */
  other_note?: string;
  /** 系统补时间手量/其他事务插入位置 */
  filler_position?: FillerPosition;
  /** 真实手量任务列表，按日期单独绑定 */
  real_manual_tasks?: RealManualTask[];
}

export type FillerPosition = 'head' | 'middle' | 'tail' | 'random';

/** 真实手量任务记录 */
export interface RealManualTask {
  id: string;
  /** 品名 */
  product: string;
  /** 送测人 */
  sender: string;
  /** 工单号，无则 / */
  work_order: string;
  /** 模号，无则 / */
  mold: string;
  /** 机台号，无则 / */
  machine: string;
  /** 检测类型，默认 测试尺寸 */
  test_type: string;
  /** 送测项目，固定 OMM */
  send_project: string;
  /** 送测日期 */
  send_date: string;
  /** 送测时间，无则 / */
  send_time: string;
  /** 测试数量 */
  quantity: string;
  /** 测试耗时（分钟） */
  duration_minutes: number;
  /** 计时方式：separate=OMM 与手量都计时；manual_only=只计手量，跳过匹配的普通 OMM 记录 */
  counting_mode?: 'separate' | 'manual_only';
  /** 测量员 */
  operator: string;
  /** 工站 */
  station: string;
  /** 备注/来源 */
  note: string;
  /** 是否来自文件夹识别 */
  from_recognition: boolean;
  /** 自动发现手量文件夹的来源文件夹名，用于区分同品名或未识别品名的多个候选 */
  source_folder?: string;
  /** 仅用于编辑时的临时输入值，不持久化 */
  durationInput?: string;
  /** 识别命中的规则说明 */
  matched_rules?: string[];
  /** 识别提醒 */
  recognition_warnings?: string[];
}

export type DurationOverrideMode = 'package_total' | 'per_piece';

/** 预览页本日包耗时覆盖，绑定到当前日期队列项内的单个文件夹 */
export interface DurationOverride {
  folder: string;
  mode: DurationOverrideMode;
  minutes: number;
  computed_total_minutes?: number;
}

/** 队列项单独覆盖设置（用于多天不同策略） */
export interface QueueItemSettingsOverride {
  leave_strategy?: 'auto' | 'early' | 'normal';
  enable_hand?: boolean;
  enable_other?: boolean;
  tpp_min?: number;
  tpp_max?: number;
  pkg_rest?: number;
  hand_max?: number;
  other_max?: number;
  other_note?: string;
  filler_position?: FillerPosition;
  duration_rules?: DurationRule[];
  special_items?: SpecialItem[];
  /** 真实手量任务列表，绑定到该日期 */
  real_manual_tasks?: RealManualTask[];
  /** 当前日期内单包耗时覆盖，key 为文件夹名 */
  duration_overrides?: Record<string, DurationOverride>;
  /** 当前日期内已确认暂不写入本日报的包，通常来自任务量过多省略清单 */
  omitted_folders?: string[];
}

/// 旧版固定件时物品配置，仅用于兼容迁移前的配置文件
export interface SpecialItem {
  name: string;
  minutes: number;
}

export interface DurationRuleMatcher {
  field: 'folder' | 'station' | 'product' | 'test_type' | 'sender' | 'operator';
  op: 'contains' | 'not_contains' | 'equals' | 'regex';
  value: string;
}

export interface DurationRuleDuration {
  mode: 'per_package' | 'per_piece' | 'max_package_piece' | 'package_piece';
  minutes?: number | null;
  minMinutes?: number | null;
  maxMinutes?: number | null;
  packageMinutes?: number | null;
  packageMinMinutes?: number | null;
  packageMaxMinutes?: number | null;
  pieceMinutes?: number | null;
  pieceMinMinutes?: number | null;
  pieceMaxMinutes?: number | null;
  quantityPolicy?: 'package_first' | 'piece_first' | 'max' | 'min' | null;
  compressible?: boolean | null;
  missingQuantityPolicy?: string | null;
}

export interface DurationRule {
  id: string;
  builtinKey?: string | null;
  name: string;
  enabled: boolean;
  source: 'builtin' | 'user' | 'migrated' | string;
  priority: number;
  matchMode: 'all' | 'any';
  matchers: DurationRuleMatcher[];
  duration: DurationRuleDuration;
  userModified: boolean;
  builtinVersion: number;
  deprecated: boolean;
}

export interface GenerateResponse {
  success: boolean;
  data: {
    output_path: string;
    warnings: string[];
    sched_warnings: string[];
  };
  error: string | null;
}

export interface Config {
  work_dir: string;
  output_dir: string;
  src_output: boolean;
  leave_strategy?: 'auto' | 'early' | 'normal';
  enable_hand?: boolean;
  enable_other?: boolean;
  shift_default?: 'A' | 'B';
  complex_default: 'A' | 'B';
  operator_name: string;
  config_dir?: string;
  config_dir_ever_set?: boolean;
  special_items?: SpecialItem[];
  hand_max?: number;
  other_max?: number;
  tpp_min?: number;
  tpp_max?: number;
  pkg_rest?: number;
  recognition_rules_path?: string;
}

export interface ConfigLoadInfo {
  config: Config;
  source: string;
  path: string;
  duplicate_paths: string[];
}

export type AccountRole = 'admin' | 'guest';
export type DisplayNameMode = 'nickname' | 'real_name';

export interface PublicAccount {
  id: string;
  nickname: string;
  real_name: string;
  role: AccountRole;
  display_name_mode: DisplayNameMode;
  display_name: string;
}

export interface AccountsInfo {
  accounts: PublicAccount[];
  current_account?: PublicAccount | null;
  storage_root: string;
}

export interface AccountSession {
  account: PublicAccount;
  profile_dir: string;
}

export interface DataStoreInfo {
  dataRoot: string;
  databasePath: string;
  profilesDir: string;
  logsDir: string;
  backupsDir: string;
  manifestsDir: string;
  schemaVersion: number;
  accountCount: number;
  knownSenderCount: number;
  measurementPersonCount: number;
  legacyRoot: string;
  legacyAccountsExists: boolean;
  legacyProfilesExists: boolean;
  isPortable: boolean;
}

export interface KnownSender {
  id: string;
  name: string;
  normalizedName: string;
  source: string;
  note: string;
  enabled: boolean;
  usageCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
  sampleFolder: string;
}

export type KnownSenderSortBy = 'name' | 'usageCount' | 'firstSeenAt' | 'lastSeenAt' | 'updatedAt';

export type MeasurementPersonRole = 'ordinary' | 'manager' | 'extra';

export interface MeasurementPerson {
  id: string;
  name: string;
  normalizedName: string;
  role: MeasurementPersonRole | string;
  aliases: string[];
  source: string;
  note: string;
  enabled: boolean;
  usageCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
}

export interface PersonalCleanerBackupInfo {
  root: string;
  exists: boolean;
  entryCount: number;
  totalBytes: number;
  oldestModifiedMs: number | null;
  newestModifiedMs: number | null;
}

export interface StationAliasRule {
  alias: string;
  station: string;
  default_test_type?: string;
}

export interface ProductAliasRule {
  pattern: string;
  product: string;
  station?: string;
  note?: string;
}

export interface WeldingRule {
  pattern: string;
  product: string;
  note?: string;
}

export interface SinterPlateRule {
  pattern: string;
  products: string[];
  note?: string;
}

export interface RecognitionRules {
  version: number;
  updated_at?: string;
  station_aliases?: StationAliasRule[];
  product_aliases?: ProductAliasRule[];
  ignored_tokens?: string[];
  welding_rules?: WeldingRule[];
  sinter_plate_rules?: SinterPlateRule[];
}

export interface RecognitionRulesLoadInfo {
  rules: RecognitionRules;
  path: string;
  exists: boolean;
}

export const FIELD_LABELS: Record<string, string> = {
  station: '工站',
  product: '产品',
  sender: '送测人',
  operator: '测量员',
  work_order: '工单号',
  mold: '模号',
  machine: '机台号',
  test_type: '检测类型',
  send_date: '送测日期',
  send_time: '送测时间',
  quantity: '件数',
  manual_duration: '测量时间(分钟)',
};

export const FIELD_HINTS: Record<string, string> = {
  station: '文件夹名中没有识别到工站（如 CNC、射出、整形等）',
  product: '文件夹名中没有识别到产品编号',
  sender: '文件夹名中没有找到"送测"前的人名',
  operator: '文件夹名中没有识别到 OMM/CMM 后的测量员',
  work_order: '文件夹名中没有找到工单号（ww 开头）',
  mold: '文件夹名中没有找到模号',
  machine: '文件夹名中没有找到机台号（#号 或 DC/DV）',
  test_type: '文件夹名中没有识别到检测类型（首件/制程/尺寸）',
  send_date: '文件夹名中没有找到送测日期',
  send_time: '文件夹名中没有找到送测时间',
  quantity: '文件夹名中没有件数（如 10PCS），且 xlsx 无法识别',
  manual_duration: '需要手动填写测量时间',
};

// ============ Queue types ============

/** 日期文件夹内自动发现的手量文件夹候选 */
export interface ManualFolderCandidate {
  folderName: string;
  fullPath: string;
  recognized?: Partial<RealManualTask>;
}

export interface QueueItem {
  dateFolder: string;        // e.g. "6.13A"
  fullPath: string;           // e.g. "D:\\...\\6.13A"
  shift: 'A' | 'B' | null;   // 从文件夹名后缀读取的班次（A=早班, B=晚班），null = 无后缀
  shiftOverride?: 'A' | 'B'; // 手动选择的班次（用于无 A/B 后缀的文件夹）
  reviewMode?: 'A' | 'B' | null; // 文件夹级审核模式覆盖：A=弹窗审核, B=留坑自填, null=跟随全局
  /** 该日期条目的生成设置覆盖，未设置字段使用全局默认值 */
  settingsOverride?: QueueItemSettingsOverride;
  /** 自动发现的手量文件夹候选（未确认前不参与排程） */
  manualCandidates?: ManualFolderCandidate[];
}

// ============ Preview types ============

export interface PreviewRow {
  seq: number;
  product: string | '—';
  qty: number | '/' | '—';
  start: string;
  end: string;
  tpp: number | string | '—';
  /** 类型：工作、手量、其他事务、休息、包间休息、隐形缓冲 等 */
  type: string;
  /** 耗时来源：tpp、special、zhengxing_cnc、cnc、real_manual、filler 等（可选，旧数据可能不存在） */
  source?: string;
}

export interface TimeAnomalyAdjustmentItem {
  folder: string;
  quantity: number;
  current_per_piece: number;
  recommended_per_piece: number;
  current_total_minutes: number;
  recommended_total_minutes: number;
  add_minutes: number;
  reason: string;
}

export interface TimeAnomalyOmitItem {
  folder: string;
  quantity: number | '/';
  current_per_piece?: number | null;
  current_total_minutes: number;
  reason: string;
}

export interface TimeAnomalyInfo {
  kind: 'ok' | 'too_little' | 'too_much';
  title: string;
  message: string;
  current_effective?: number;
  min_effective?: number;
  shortage_minutes?: number;
  overrun_minutes?: number;
  target_clock_end?: string;
  actual_last_end?: string;
  adjustment_items?: TimeAnomalyAdjustmentItem[];
  omit_items?: TimeAnomalyOmitItem[];
  supplemental_minutes?: number;
  note?: string;
}

export interface PreviewSummary {
  total_shift: number;   // total on-duty time in minutes
  total_work: number;   // total effective work time in minutes
  total_effective: number; // 有效时长（不含固定休息）
  required_effective: number; // 要求最低有效时长（450 或 570）
  total_rest: number;   // total fixed rest time in minutes
  hidden_buffer_total: number; // 隐形缓冲总时长
  meets_min: boolean;   // whether minimum is met
  meets_required: boolean; // 是否满足最低有效时长
  estimates: {
    optimistic: number;
    conservative: number;
    need_minutes: number;
  };
  target_clock_end: string; // 目标下班时间 HH:MM
  actual_last_end: string; // 实际最后结束时间 HH:MM
  finish_delta_minutes: number; // 距离目标下班还差多少分钟
  // v5.0.6 新增：缺口诊断
  regular_effective?: number;
  real_manual_effective?: number;
  special_effective?: number;
  zhengxing_cnc_effective?: number;
  cnc_effective?: number;
  hand_filler_minutes?: number;
  other_filler_minutes?: number;
  regular_quantity?: number;
  regular_avg_tpp?: number;
  regular_tpp_max?: number;
  regular_tpp_headroom_minutes?: number;
  regular_tpp_at_upper?: boolean;
  need_minutes?: number;
  shortage_level?: 'ok' | 'shortage' | 'severe' | 'extreme';
  time_anomaly?: TimeAnomalyInfo;
  decision?: {
    level: 'ok' | 'shortage' | 'severe' | 'extreme';
    need_minutes: number;
    regular_effective: number;
    real_manual_effective: number;
    special_effective: number;
    zhengxing_cnc_effective: number;
    cnc_effective: number;
    hand_filler_minutes: number;
    other_filler_minutes: number;
    regular_quantity?: number;
    regular_avg_tpp?: number;
    regular_tpp_max?: number;
    regular_tpp_headroom_minutes?: number;
    regular_tpp_at_upper?: boolean;
    hidden_buffer_total: number;
    target_clock_end: string;
    actual_last_end: string;
    message?: string;
    title?: string;
    options: { key: string; label: string; description: string }[];
    time_anomaly?: TimeAnomalyInfo;
  };
}

export interface PreviewData {
  folder_name: string;
  shift_label: string;
  early_leave: boolean;
  leave_strategy?: 'auto' | 'early' | 'normal';
  records: FolderRecord[];
  warnings: [string, string[]][];  // [folder, warnings][]
  schedule_warnings: string[];
  rows: PreviewRow[];
  summary: PreviewSummary;
}

export interface PreviewResponse {
  success: boolean;
  data: PreviewData | null;
  error: string | null;
}

// ============ Template types ============

export interface TemplateInfo {
  path: string | null;
  exists: boolean;
  source: string | null;  // 'user' | 'workdir' | 'bundled' | null
}

/// 模板位置信息：当前生效模板 + 内置打包模板 + 用户自定义模板目录
export interface TemplatePaths {
  /** 当前生效的模板路径 */
  current_path: string | null;
  /** 当前生效模板来源 */
  current_source: string | null;
  /** 内置打包模板路径（resources/template.xlsx） */
  bundled_path: string | null;
  /** 内置打包模板是否存在 */
  bundled_exists: boolean;
  /** 用户自定义模板存放目录 */
  user_template_dir: string;
  /** 用户自定义模板文件路径（user_template.xlsx） */
  user_template_path: string | null;
  /** 用户自定义模板是否存在 */
  user_template_exists: boolean;
}
