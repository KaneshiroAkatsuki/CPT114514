import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  FolderOpen,
  HelpCircle,
  Keyboard,
  Search,
  Settings2,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HelpCenterDialogProps {
  open: boolean;
  initialSection?: string;
  onClose: () => void;
}

type HelpTopic = {
  id: string;
  categoryId: string;
  title: string;
  summary: string;
  keywords: string[];
  body: React.ReactNode;
};

type HelpCategory = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

const text = {
  p: "text-sm leading-7 text-slate-700",
  h2: "text-base font-semibold text-slate-900",
  h3: "text-sm font-semibold text-slate-800",
  ul: "list-disc space-y-1.5 pl-5 text-sm leading-7 text-slate-700",
  ol: "list-decimal space-y-2 pl-5 text-sm leading-7 text-slate-700",
  code: "rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-700",
  note: "rounded-md border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm leading-6 text-blue-800",
  warn: "rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-6 text-amber-900",
};

const CATEGORIES: HelpCategory[] = [
  { id: "quickstart", title: "快速上手", description: "第一次使用和最短生成路径", icon: <BookOpen className="h-4 w-4" /> },
  { id: "daily", title: "日常生成", description: "队列、预览、生成、输出目录", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "recognition", title: "文件夹识别", description: "命名、字段、warning 和补充规则", icon: <FolderOpen className="h-4 w-4" /> },
  { id: "manual", title: "手量与补时间", description: "真实手量、补时间手量、计时方式", icon: <Sparkles className="h-4 w-4" /> },
  { id: "schedule", title: "时间与排程", description: "每件时间、下班策略、CNC 规则", icon: <CalendarClock className="h-4 w-4" /> },
  { id: "template", title: "模板与报表", description: "模板来源、WPS 样式、报表输出", icon: <FileSpreadsheet className="h-4 w-4" /> },
  { id: "config", title: "配置与便携版", description: "配置文件、识别规则、路径选择", icon: <Settings2 className="h-4 w-4" /> },
  { id: "cleaner", title: "个人清理工具", description: "Edge、截图、剪贴板、WiFi、私人浏览器", icon: <Wrench className="h-4 w-4" /> },
  { id: "faq", title: "常见问题", description: "按现象快速定位原因", icon: <HelpCircle className="h-4 w-4" /> },
  { id: "about", title: "关于", description: "版本和快捷键", icon: <CheckCircle2 className="h-4 w-4" /> },
];

const TOPICS: HelpTopic[] = [
  {
    id: "quickstart",
    categoryId: "quickstart",
    title: "三步生成日报",
    summary: "选择工作目录，添加日期文件夹，预览或生成 Excel。",
    keywords: ["快速开始", "生成日报", "工作目录", "日期文件夹", "预览"],
    body: (
      <div className="space-y-4">
        <p className={text.p}>最短路径只需要三步，适合每天正常生成日报时使用。</p>
        <ol className={text.ol}>
          <li><strong>选择工作目录：</strong>选择包含日期文件夹和日报模板的根目录。</li>
          <li><strong>添加日期文件夹：</strong>从下拉框添加单个日期，也可以全选添加所有识别到的日期。</li>
          <li><strong>预览或生成：</strong>先用预览检查排程，确认无误后生成 Excel 报表。</li>
        </ol>
        <div className={text.note}>第一次使用建议先确认“生成设置”里的姓名、班次、每件时间和输出目录，再点击“保存默认设置”。</div>
      </div>
    ),
  },
  {
    id: "first-config",
    categoryId: "quickstart",
    title: "第一次使用要检查什么",
    summary: "姓名、班次、每件时间、模板来源和配置位置。",
    keywords: ["第一次", "默认设置", "姓名", "班次", "每件时间", "模板"],
    body: (
      <div className="space-y-4">
        <ul className={text.ul}>
          <li><strong>使用者姓名：</strong>只处理文件夹名里 <code className={text.code}>-OMM-姓名</code> 与当前使用者匹配的任务。</li>
          <li><strong>默认班次：</strong>日期文件夹没有 A/B 后缀时，会让你手动选择班次。</li>
          <li><strong>每件时间：</strong>常用范围建议保持在合理区间；设置明显偏低时，预览/生成前会二次确认。</li>
          <li><strong>模板来源：</strong>优先使用用户自定义模板，其次工作目录模板，最后使用软件内置模板。</li>
          <li><strong>配置位置：</strong>便携版可把配置放在程序目录或 U 盘目录，方便随软件一起带走。</li>
        </ul>
      </div>
    ),
  },
  {
    id: "daily-flow",
    categoryId: "daily",
    title: "日常生成流程",
    summary: "添加队列后，先处理手量待确认和识别 warning，再生成。",
    keywords: ["队列", "生成", "失败明细", "手量待确认", "warning"],
    body: (
      <div className="space-y-4">
        <ol className={text.ol}>
          <li>添加日期文件夹到待生成队列。</li>
          <li>查看队列中是否有“手量待确认”“识别提示”或特殊标记。</li>
          <li>先点“预览”检查排程、有效时长、缺口和 warning。</li>
          <li>确认无误后生成报表。若部分成功、部分失败，结果窗口会列出失败原因。</li>
        </ol>
        <div className={text.warn}>如果生成前弹出手量补录，请先确认真实手量的数量、耗时和测量员。未确认前不会参与正式排程。</div>
      </div>
    ),
  },
  {
    id: "output-folder",
    categoryId: "daily",
    title: "输出目录怎么理解",
    summary: "默认输出到源日期文件夹，也可以指定统一输出目录。",
    keywords: ["输出目录", "源文件夹", "空白", "保存位置"],
    body: (
      <div className="space-y-4">
        <ul className={text.ul}>
          <li><strong>输出到源文件夹：</strong>每份报表保存到对应日期文件夹中，这是默认推荐方式。</li>
          <li><strong>统一输出目录：</strong>取消“输出到源文件夹”后，可以选择一个固定目录集中保存。</li>
          <li><strong>输入框为空：</strong>如果输出目录输入框为空且被禁用，表示正在使用“输出到源文件夹”，不是输出到程序目录。</li>
        </ul>
      </div>
    ),
  },
  {
    id: "naming-standard",
    categoryId: "recognition",
    title: "标准文件夹命名",
    summary: "建议按品名、工站、送测人、数量、OMM 姓名组织字段。",
    keywords: ["命名", "文件夹", "品名", "工站", "送测人", "数量", "OMM"],
    body: (
      <div className="space-y-4">
        <p className={text.p}>推荐格式：</p>
        <div className={`${text.code} block w-fit`}>品名-工站-类型-工单号-机台号-模号-日期-送测人-数量-OMM-姓名</div>
        <ul className={text.ul}>
          <li>日期文件夹建议以 <code className={text.code}>A</code> 或 <code className={text.code}>B</code> 结尾，例如 <code className={text.code}>6.29B</code>。</li>
          <li>数量建议写成 <code className={text.code}>48PCS</code>、<code className={text.code}>12件</code> 这类明确形式。</li>
          <li>送测人支持“安容克送测”“安容克送检”“送测-安容克”等常见写法。</li>
          <li><code className={text.code}>首件</code> 是检测类型，不会再被误报为数量缺失。</li>
        </ul>
      </div>
    ),
  },
  {
    id: "recognition-warning",
    categoryId: "recognition",
    title: "哪些情况会提示人工确认",
    summary: "品名异常、多候选、送测人疑似错字、时间异常、工站兜底等会产生 warning。",
    keywords: ["warning", "人工确认", "品名异常", "多候选", "送测人", "安容克送", "工站兜底"],
    body: (
      <div className="space-y-4">
        <ul className={text.ul}>
          <li><strong>品名异常：</strong>识别结果不像数据库中的品名，或看起来像人名、机台名。</li>
          <li><strong>多候选：</strong>普通任务里出现多个三位数品名或多个数量。</li>
          <li><strong>送测人疑似错字：</strong>例如“安容克送 / 送检 / 送样 / 上传 / 生成”，会预填“安容克”并提示确认是否应为“安容克送测”。</li>
          <li><strong>时间异常：</strong>送测时间无法按 0:00-23:59 理解。</li>
          <li><strong>手量测量员异常：</strong>出现“手量/手测”但没有明确 <code className={text.code}>-手量-姓名</code>。</li>
          <li><strong>工站兜底：</strong>没有识别到明确工站时按“开发”兜底，并提示你确认。</li>
        </ul>
      </div>
    ),
  },
  {
    id: "recognition-rules",
    categoryId: "recognition",
    title: "识别补充规则",
    summary: "新工站、新品名或特殊模板可以通过识别补充规则扩展。",
    keywords: ["识别补充", "recognition-rules", "数据库", "品名", "工站", "规则"],
    body: (
      <div className="space-y-4">
        <ul className={text.ul}>
          <li>内置规则覆盖常见工站、CNC、测试片、烧结盘、焊接号段等。</li>
          <li>新增品名、工站或特殊命名时，可在“生成设置”的“识别补充”窗口添加规则。</li>
          <li>用户补充规则保存在 <code className={text.code}>recognition-rules.json</code>，不会随普通配置重置而清空。</li>
          <li>品名识别应优先匹配数据库或补充规则；无法确认时才提示人工确认。</li>
        </ul>
      </div>
    ),
  },
  {
    id: "manual-real",
    categoryId: "manual",
    title: "真实手量怎么处理",
    summary: "日期文件夹内发现手量候选时，生成前会要求人工确认。",
    keywords: ["手量", "真实手量", "手量待确认", "手测", "测量员", "耗时"],
    body: (
      <div className="space-y-4">
        <p className={text.p}>真实手量是当天实际发生的手量任务，不等同于系统自动补工时的“补时间手量”。</p>
        <ul className={text.ul}>
          <li>子文件夹名包含“手量”或“手测”时，会作为真实手量候选。</li>
          <li>正式生成前必须确认数量、耗时、工站、品名和测量员。</li>
          <li>耗时默认按小时输入，例如 <code className={text.code}>2</code> 表示 2 小时；按分钟可写 <code className={text.code}>90分钟</code> 或 <code className={text.code}>90m</code>。</li>
          <li>真实手量跨固定休息时会拆成多段，续行数量显示为 <code className={text.code}>/</code>。</li>
        </ul>
      </div>
    ),
  },
  {
    id: "manual-timing-mode",
    categoryId: "manual",
    title: "OMM 和手量同人时怎么计时",
    summary: "同日都做就分别计时；OMM 已在其他日期登记时可只计手量。",
    keywords: ["OMM", "手量", "同一个人", "分别计时", "只计手量", "跨日"],
    body: (
      <div className="space-y-4">
        <ul className={text.ul}>
          <li><strong>OMM+手量都计时：</strong>同一天 OMM 和手量都实际做了，默认应分别统计时间。</li>
          <li><strong>只计手量：</strong>OMM 前几天已经测过并登记，今天只是补手量时使用。</li>
          <li>即使文件夹名很像，只要尾缀有“手量/手测”，程序会优先要求你确认，不会静默合并。</li>
        </ul>
      </div>
    ),
  },
  {
    id: "manual-filler-limit",
    categoryId: "manual",
    title: "手量上限和其他上限是什么",
    summary: "只限制系统自动补时间，不限制真实手量。",
    keywords: ["手量上限", "其他上限", "补时间", "真实手量", "工时不足"],
    body: (
      <div className="space-y-4">
        <p className={text.p}>“手量上限 / 其他上限”只限制系统为了补足工时而自动插入的补时间行。</p>
        <ul className={text.ul}>
          <li>它不会限制手量补录窗口里的真实手量。</li>
          <li>如果当天真实手量耗时很长，仍按你确认的真实耗时排程。</li>
          <li>补时间手量和其他事务只是为了让日报工时更完整，不代表真实测量任务。</li>
        </ul>
      </div>
    ),
  },
  {
    id: "time-tpp",
    categoryId: "schedule",
    title: "每件时间和偏低提醒",
    summary: "每件时间按数量分配；设置过低且任务很多时会提醒确认。",
    keywords: ["每件时间", "tpp", "偏低", "预览", "生成", "确认"],
    body: (
      <div className="space-y-4">
        <ul className={text.ul}>
          <li>件数少时每件时间较长，件数多时每件时间较短。</li>
          <li>如果上限设置得很低，同时当天任务或 PCS 很多，程序会认为总耗时可能被压得过短。</li>
          <li>偏低提醒不会自动修改设置，只要求你在预览/生成前确认。</li>
        </ul>
      </div>
    ),
  },
  {
    id: "schedule-rules",
    categoryId: "schedule",
    title: "排程特殊规则",
    summary: "解释 CNC、整形 CNC、特殊大件和包间休息的行为。",
    keywords: ["CNC", "整形CNC", "特殊大件", "烧结盘", "包间休息", "报表不显示"],
    body: (
      <div className="space-y-4">
        <ul className={text.ul}>
          <li>普通 CNC 固定 30 分钟/包。</li>
          <li>文件夹名同时包含“整形”和“CNC”时，按 <code className={text.code}>max(30, 数量 x 5分钟)</code> 计算。</li>
          <li>特殊大件规则优先于整形 CNC，匹配到特殊物品时按单独耗时规则计算。</li>
          <li>包间休息只影响排程时间，不作为报表行写入 Excel，即使真的有也不显示在报表上。</li>
        </ul>
      </div>
    ),
  },
  {
    id: "template-source",
    categoryId: "template",
    title: "模板来源和 WPS 样式",
    summary: "用户模板、工作目录模板和内置模板的优先级。",
    keywords: ["模板", "WPS", "样式", "内置模板", "用户模板", "更新模板"],
    body: (
      <div className="space-y-4">
        <ol className={text.ol}>
          <li>用户自定义模板：通过“更新模板”复制到配置目录。</li>
          <li>工作目录模板：在工作目录根目录或子目录查找候选模板。</li>
          <li>内置模板：软件打包自带的兜底模板。</li>
        </ol>
        <p className={text.p}>当前内置模板和生成器已按同事模板口径补齐数据区样式，适配 WPS 查看。</p>
      </div>
    ),
  },
  {
    id: "report-output",
    categoryId: "template",
    title: "报表里会显示什么",
    summary: "真实任务写入报表，内部缓冲和包间休息不写入。",
    keywords: ["报表", "Excel", "备注", "真实手量", "包间休息", "隐形缓冲"],
    body: (
      <div className="space-y-4">
        <ul className={text.ul}>
          <li>普通 OMM、CMM、真实手量、补时间手量和其他事务会按排程结果写入。</li>
          <li>包间休息、隐形缓冲等内部排程辅助项不会显示在报表上。</li>
          <li>真实手量不需要在备注里刻意标注，按任务类型和时间正常呈现。</li>
        </ul>
      </div>
    ),
  },
  {
    id: "config-paths",
    categoryId: "config",
    title: "配置文件和便携版",
    summary: "config.json、recognition-rules.json 和便携版配置优先级。",
    keywords: ["配置", "config.json", "recognition-rules.json", "便携版", "默认打开"],
    body: (
      <div className="space-y-4">
        <ul className={text.ul}>
          <li>普通配置默认保存在 <code className={text.code}>%APPDATA%\OMM日报系统</code>。</li>
          <li>便携版启动时会优先识别自身目录内任意位置的 <code className={text.code}>config.json</code>，并把后续保存写回该配置所在目录。</li>
          <li>识别补充规则保存在 <code className={text.code}>recognition-rules.json</code>，与 config.json 位于同一配置目录。</li>
          <li>配置文件和工作目录选择窗口应默认打开当前显示的目录，方便核对和切换。</li>
        </ul>
      </div>
    ),
  },
  {
    id: "personal-cleaner",
    categoryId: "cleaner",
    title: "个人清理工具清什么",
    summary: "本机维护工具，和日报生成互相独立。",
    keywords: ["个人清理", "Edge", "截图", "剪贴板", "WiFi", "私人浏览器", "备份"],
    body: (
      <div className="space-y-4">
        <div className={text.warn}>建议先点“模拟运行”查看将处理的项目，再真实执行。危险项会在执行前二次确认。</div>
        <ul className={text.ul}>
          <li><strong>Edge 标准深度清理：</strong>历史、Cookie、站点存储、缓存、会话、密码、自动填充、扩展运行缓存、缩略图、安全隐私状态和诊断临时数据。</li>
          <li><strong>危险 Edge 操作：</strong>ResetEdge、清书签、清扩展本体、清微软账户/同步。</li>
          <li><strong>Windows 专项：</strong>通知历史、截图文件夹、剪贴板历史、opencode 快捷方式、WiFi 配置。</li>
          <li><strong>私人浏览器：</strong>清理本机 Firefox 便携 profile 的历史、Cookie、缓存、会话、站点存储、表单、保存登录和诊断临时数据；默认可先备份完整 profile。</li>
          <li><strong>日志和备份：</strong>日志写入 <code className={text.code}>personal-cleaner-logs</code>，备份写入 <code className={text.code}>personal-cleaner-backups</code>。</li>
        </ul>
      </div>
    ),
  },
  {
    id: "faq",
    categoryId: "faq",
    title: "常见问题速查",
    summary: "按现象定位：日期不出现、无法生成、手量弹窗、非标准表格等。",
    keywords: ["FAQ", "常见问题", "无法生成", "日期不出现", "非标准表格", "失败"],
    body: (
      <div className="space-y-5">
        {[
          ["日期文件夹没有出现在下拉框？", "检查文件夹名是否以 A/B 结尾，例如 6.29A 或 6.29B；没有后缀时可通过拖拽/粘贴路径后手动选择班次。"],
          ["提示没有可生成的有效任务？", "确认队列中已添加日期文件夹，并且日期文件夹下有可识别的任务子文件夹。"],
          ["为什么点击生成后弹出手量补录？", "当天发现了手量/手测候选，但还没有人工确认耗时、数量和测量员。"],
          ["非标准表格无法识别是什么意思？", "程序只能自动识别公司标准首件尺寸报告模板；其他 xlsx 需要在弹窗里手动补件数或测量时间。"],
          ["生成失败怎么看原因？", "生成结果窗口会分开显示成功文件和失败明细；手量类失败可从弹窗继续打开手量补录。"],
        ].map(([question, answer]) => (
          <div key={question} className="space-y-1">
            <h3 className={text.h3}>{question}</h3>
            <p className={text.p}>{answer}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "about",
    categoryId: "about",
    title: "版本和快捷键",
    summary: "当前版本、配置路径和常用操作。",
    keywords: ["关于", "版本", "快捷键", "Ctrl+V", "Delete", "右键"],
    body: (
      <div className="space-y-4">
        <ul className={text.ul}>
          <li><strong>版本：</strong>5.0.7。</li>
          <li><strong>Ctrl + V：</strong>粘贴文件夹路径到队列。</li>
          <li><strong>Delete：</strong>删除队列中选中的项目。</li>
          <li><strong>右键队列项：</strong>设置单日方案、下班策略、手量补录等。</li>
          <li><strong>拖拽文件夹：</strong>把日期文件夹直接拖进队列。</li>
        </ul>
      </div>
    ),
  },
];

const LEGACY_SECTION_MAP: Record<string, string> = {
  workflow: "daily-flow",
  naming: "naming-standard",
  fields: "naming-standard",
  complex: "daily-flow",
  "personal-cleaner": "personal-cleaner",
  shortcuts: "about",
  faq: "faq",
  about: "about",
  quickstart: "quickstart",
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function topicSearchText(topic: HelpTopic) {
  return normalize([topic.title, topic.summary, topic.keywords.join(" ")].join(" "));
}

function getCategory(id: string) {
  return CATEGORIES.find((category) => category.id === id) || CATEGORIES[0];
}

function getInitialTopicId(initialSection: string) {
  if (TOPICS.some((topic) => topic.id === initialSection)) return initialSection;
  return LEGACY_SECTION_MAP[initialSection] || "quickstart";
}

function TopicContent({ topic }: { topic: HelpTopic }) {
  const category = getCategory(topic.categoryId);
  return (
    <article className="space-y-4">
      <div className="space-y-1">
        <div className="text-xs font-medium text-blue-700">{category.title}</div>
        <h2 className="text-lg font-semibold text-slate-950">{topic.title}</h2>
        <p className="text-sm leading-6 text-slate-500">{topic.summary}</p>
      </div>
      {topic.body}
    </article>
  );
}

export function HelpCenterDialog({ open, initialSection = "quickstart", onClose }: HelpCenterDialogProps) {
  const [activeTopicId, setActiveTopicId] = useState(() => getInitialTopicId(initialSection));
  const [query, setQuery] = useState("");

  const activeTopic = TOPICS.find((topic) => topic.id === activeTopicId) || TOPICS[0];
  const activeCategoryId = activeTopic.categoryId;
  const normalizedQuery = normalize(query);

  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];
    const terms = normalizedQuery.split(/\s+/).filter(Boolean);
    return TOPICS
      .map((topic) => {
        const haystack = topicSearchText(topic);
        const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
        return { topic, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.topic.title.localeCompare(b.topic.title, "zh-Hans"))
      .map((item) => item.topic);
  }, [normalizedQuery]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="flex h-[700px] max-h-[92vh] w-[980px] max-w-full flex-col overflow-hidden rounded-lg border-slate-200 shadow-xl">
        <CardHeader className="shrink-0 border-b border-slate-100 bg-white px-5 py-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <BookOpen className="h-4 w-4 text-blue-600" />
              使用说明
            </CardTitle>
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                placeholder="搜索：手量、模板、warning、私人浏览器..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 overflow-hidden p-0">
          <aside className="w-64 shrink-0 overflow-y-auto border-r border-slate-100 bg-slate-50/70 p-3">
            <nav className="space-y-1">
              {CATEGORIES.map((category) => {
                const active = activeCategoryId === category.id && !normalizedQuery;
                const firstTopic = TOPICS.find((topic) => topic.categoryId === category.id);
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      setQuery("");
                      if (firstTopic) setActiveTopicId(firstTopic.id);
                    }}
                    className={`flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
                      active
                        ? "border-blue-200 bg-white text-blue-700 shadow-sm"
                        : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900"
                    }`}
                  >
                    <span className={`mt-0.5 ${active ? "text-blue-600" : "text-slate-400"}`}>{category.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{category.title}</span>
                      <span className="block truncate text-xs text-slate-400">{category.description}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="flex min-w-0 flex-1 overflow-hidden bg-white">
            <div className="w-64 shrink-0 overflow-y-auto border-r border-slate-100 p-3">
              {normalizedQuery ? (
                <div className="space-y-2">
                  <div className="px-1 text-xs font-medium text-slate-500">搜索结果 {searchResults.length}</div>
                  {searchResults.length > 0 ? (
                    searchResults.map((topic) => (
                      <button
                        key={topic.id}
                        onClick={() => setActiveTopicId(topic.id)}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                          activeTopicId === topic.id
                            ? "border-blue-200 bg-blue-50 text-blue-800"
                            : "border-slate-100 text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className="block font-medium">{topic.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{topic.summary}</span>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm leading-6 text-slate-500">
                      没有找到匹配内容。可以试试“手量”“模板”“配置”“warning”“私人浏览器”。
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="px-1 text-xs font-medium text-slate-500">{getCategory(activeCategoryId).title}</div>
                  {TOPICS.filter((topic) => topic.categoryId === activeCategoryId).map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => setActiveTopicId(topic.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        activeTopicId === topic.id
                          ? "border-blue-200 bg-blue-50 text-blue-800"
                          : "border-slate-100 text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="block font-medium">{topic.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{topic.summary}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl">
                <TopicContent topic={activeTopic} />
              </div>
            </div>
          </main>
        </CardContent>

        <div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Keyboard className="h-3.5 w-3.5" />
            <span>搜索会匹配标题、摘要和关键词。</span>
          </div>
          <Button onClick={onClose}>关闭</Button>
        </div>
      </Card>
    </div>
  );
}
