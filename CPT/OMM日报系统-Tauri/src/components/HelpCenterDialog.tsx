import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, BookOpen, CheckCircle2, FolderOpen, HelpCircle, Info, Keyboard, ListTodo, Settings2 } from "lucide-react";

interface HelpCenterDialogProps {
  open: boolean;
  initialSection?: string;
  onClose: () => void;
}

const SECTIONS: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: "quickstart", label: "快速开始", icon: <BookOpen className="h-4 w-4" /> },
  { key: "workflow", label: "完整工作流程", icon: <ListTodo className="h-4 w-4" /> },
  { key: "naming", label: "命名规则", icon: <FolderOpen className="h-4 w-4" /> },
  { key: "fields", label: "字段说明", icon: <Info className="h-4 w-4" /> },
  { key: "complex", label: "复杂文件夹", icon: <Settings2 className="h-4 w-4" /> },
  { key: "shortcuts", label: "快捷键", icon: <Keyboard className="h-4 w-4" /> },
  { key: "faq", label: "常见问题", icon: <HelpCircle className="h-4 w-4" /> },
  { key: "about", label: "关于", icon: <CheckCircle2 className="h-4 w-4" /> },
];

function Content({ section }: { section: string }) {
  const p = "text-sm leading-7 text-slate-700";
  const h2 = "text-base font-semibold text-slate-900 mt-6 mb-3 first:mt-0";
  const h3 = "text-sm font-semibold text-slate-800 mt-4 mb-2";
  const ul = "list-disc list-inside space-y-1.5 text-sm leading-7 text-slate-700 mb-4";
  const code = "rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-700";
  const info = "rounded-md border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm leading-6 text-blue-800 mb-4";
  const warn = "rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-6 text-amber-900 mb-4";

  switch (section) {
    case "quickstart":
      return (
        <div className="space-y-4">
          <h2 className={h2}>快速开始</h2>
          <p className={p}>欢迎使用 OMM 日报系统。三步即可生成日报：</p>
          <ol className="list-decimal list-inside space-y-2 text-sm leading-7 text-slate-700">
            <li><strong className="text-slate-900">选择工作目录</strong>：点击工作目录右侧的“选择”，选择包含模板文件和日期文件夹的根目录。</li>
            <li><strong className="text-slate-900">添加日期文件夹</strong>：在“待生成队列”区，从下拉框选择一个日期，点击“添加”；也可以点击“全选”一次性添加所有识别到的日期。</li>
            <li><strong className="text-slate-900">生成报表</strong>：核对件数、时间等信息后，点击“生成报表”输出 Excel。想先看效果而不生成文件，可点击“预览”。</li>
          </ol>
          <div className={info}>
            全局默认设置修改后，请在“生成设置”中点击“保存默认设置”。程序会写入配置文件，下次打开继续沿用。配置默认保存在 <code className={code}>%APPDATA%\OMM日报系统</code>。
          </div>
        </div>
      );

    case "workflow":
      return (
        <div className="space-y-3">
          <h2 className={h2}>完整工作流程</h2>

          <h3 className={h3}>1. 准备数据</h3>
          <ul className={ul}>
            <li>在工作目录中放置日报模板文件（程序会自动在根目录或子目录中查找）。</li>
            <li>日期文件夹命名需符合规则，例如 <code className={code}>6.13A</code>（白班）或 <code className={code}>6.13B</code>（夜班）。</li>
          </ul>

          <h3 className={h3}>2. 核对设置</h3>
          <ul className={ul}>
            <li><strong>使用者姓名</strong>：默认显示上次使用的姓名，只处理尾缀为 <code className={code}>-OMM-姓名</code> 的文件夹。</li>
            <li><strong>下早班</strong>：勾选后夜班会在 05:20 结束，且当天最少工作 9 小时。</li>
            <li><strong>手量 / 其他事务</strong>：当总工时不足 11 小时时，会自动插入手量或其他事务行补齐。</li>
            <li><strong>真实手量</strong>：可在队列项右键菜单中补录真实手量；跨固定休息时会拆成多段，续行数量显示为 "/"。</li>
            <li><strong>每件时间范围</strong>：件数越少每件时间越长，件数越多每件时间越短，程序会按文件数量自动分配。</li>
            <li><strong>保存默认设置</strong>：修改下班策略、每件时间范围、手量/其他事务开关、默认班次等全局默认值后，点击“保存默认设置”写入配置文件。</li>
            <li><strong>CNC 规则</strong>：普通 CNC 固定 30 分钟/包；文件夹名同时包含“整形”和“CNC”时，按 <code className={code}>max(30, 数量×5分钟)</code> 计算；特殊大件规则优先于整形 CNC。</li>
            <li><strong>包间休息</strong>：每包任务之间插入的休息分钟数，设为 0 可关闭。</li>
            <li><strong>复杂文件夹处理方案</strong>：见“复杂文件夹”章节。</li>
          </ul>

          <h3 className={h3}>3. 生成与预览</h3>
          <ul className={ul}>
            <li><strong>预览</strong>：仅打开临时窗口查看排程结果，不会生成文件。数据不足时会显示可见有效时长、目标有效时长、缺口及处理方式。</li>
            <li><strong>生成报表</strong>：在输出目录生成 Excel 文件，并自动打开文件夹。</li>
            <li><strong>手量待确认</strong>：如果日期文件夹内发现“手量”子文件夹，直接生成会暂停并打开手量补录；请确认耗时、数量、测量员后再生成。</li>
            <li><strong>失败明细</strong>：如果部分日期成功、部分失败，生成结果弹窗会分别列出成功文件和失败原因；手量相关失败可从弹窗继续打开补录。</li>
            <li><strong>输出到源文件夹</strong>：默认启用，每份报表保存到对应日期文件夹；取消后可手动指定统一输出目录。</li>
            <li>输出目录输入框为空且被禁用时，表示正在使用“输出到源文件夹”，不是输出到程序目录。</li>
          </ul>
        </div>
      );

    case "naming":
      return (
        <div className="space-y-3">
          <h2 className={h2}>文件夹命名规则</h2>
          <p className={p}>程序通过文件夹名自动提取字段，标准格式如下：</p>
          <div className={code + " block w-fit mb-3"}>品名-工站-类型-工单号-机台号-模号-日期-送测人-数量-OMM-姓名</div>
          <p className={p}>示例：</p>
          <div className={code + " block w-fit mb-3"}>ABC-成型-初测-ww12345-#01-M06-6.13B-张三送测-50件-OMM-禹欣</div>

          <h3 className={h3}>日期文件夹要求</h3>
          <ul className={ul}>
            <li>日期文件夹必须以 A 或 B 结尾，例如 <code className={code}>6.13A</code>（白班）、<code className={code}>6.13B</code>（夜班）。</li>
            <li>没有 A/B 后缀的文件夹无法判断班次，添加队列时会让你手动选择。</li>
            <li>一个日期文件夹下可以包含多个任务子文件夹。</li>
          </ul>

          <h3 className={h3}>任务子文件夹要求</h3>
          <p className={p}>子文件夹名最好包含上述字段，字段缺失时可启用“复杂文件夹处理方案”进行补全。</p>
        </div>
      );

    case "fields":
      return (
        <div className="space-y-3">
          <h2 className={h2}>字段说明</h2>
          <p className={p}>程序会从文件夹名或 Excel 文件中自动提取以下字段：</p>
          <ul className={ul}>
            <li><strong>工站</strong> — 工序所在工站</li>
            <li><strong>产品</strong> — 产品名称</li>
            <li><strong>送测人</strong> — 送测人员姓名（某某送测）</li>
            <li><strong>工单号</strong> — 工单编号（ww 开头）</li>
            <li><strong>模号</strong> — 模具编号（M 开头）</li>
            <li><strong>机台号</strong> — 机台编号（#号 或 DC/DV）</li>
            <li><strong>检测类型</strong> — 初测/复测等</li>
            <li><strong>送测日期 / 时间</strong> — 日期与时间信息</li>
            <li><strong>件数</strong> — 任务数量（文件夹名或 .xlsx 文件）</li>
            <li><strong>测量时间</strong> — 单件测量分钟数（文件夹名或手动补全）</li>
          </ul>

          <h3 className={h3}>补全规则</h3>
          <ul className={ul}>
            <li>件数和测量时间至少填一个。</li>
            <li>两个都填时，优先按测量时间计算。</li>
            <li>留空表示该字段为 "/"（无）。</li>
          </ul>
        </div>
      );

    case "complex":
      return (
        <div className="space-y-3">
          <h2 className={h2}>复杂文件夹处理方案</h2>
          <p className={p}>当文件夹命名不规范、关键字段识别不到时，程序提供两种处理方式：</p>

          <h3 className={h3}>方案 A：弹窗确认补全（推荐）</h3>
          <ul className={ul}>
            <li>识别不完整时，弹出窗口让你补全数据。</li>
            <li>至少填写“件数”或“测量时间”中的一个。</li>
            <li>确认后再生成完整报表。</li>
          </ul>

          <h3 className={h3}>方案 B：留坑自填</h3>
          <ul className={ul}>
            <li>直接生成报表，识别不到的数据留空（/）。</li>
            <li>生成后你自己到 Excel 中填写。</li>
            <li>表格中自带时间公式，方便后续计算。</li>
          </ul>

          <h3 className={h3}>单独设置某个文件夹</h3>
          <ul className={ul}>
            <li>在队列中右键点击某个文件夹，可选择该文件夹使用方案 A 或方案 B。</li>
            <li>选择“恢复默认”则沿用全局设置。</li>
          </ul>

          <div className={warn}>
            <AlertTriangle className="inline-block h-4 w-4 mr-1.5 -mt-0.5" />
            选择方案 B 时，报表中的占位符需要生成后手动补全。
          </div>
        </div>
      );

    case "shortcuts":
      return (
        <div className="space-y-3">
          <h2 className={h2}>快捷键</h2>
          <ul className={ul}>
            <li><strong>Ctrl + V</strong> — 粘贴文件夹路径到队列</li>
            <li><strong>Delete</strong> — 删除队列中选中的项目</li>
            <li><strong>右键点击队列</strong> — 设置该文件夹的复杂处理方案、下班策略、手量补录等</li>
            <li><strong>拖拽文件夹</strong> — 把文件夹直接拖进队列区添加</li>
          </ul>
        </div>
      );

    case "faq":
      return (
        <div className="space-y-5">
          <h2 className={h2}>常见问题</h2>

          <div className="space-y-1">
            <h3 className={h3}>Q1：为什么我的文件夹没有出现在下拉框里？</h3>
            <p className={p}>请检查文件夹名是否以 A 或 B 结尾，例如 6.13A 或 6.13B。没有 A/B 后缀的文件夹无法判断班次。</p>
          </div>

          <div className="space-y-1">
            <h3 className={h3}>Q2：为什么生成时报“没有可生成的有效任务”？</h3>
            <p className={p}>请确认队列中已添加日期文件夹，并且每个文件夹下有可识别的任务子文件夹。</p>
          </div>

          <div className="space-y-1">
            <h3 className={h3}>Q3：件数和测量时间都填了，为什么耗时计算和预期不一样？</h3>
            <p className={p}>两个都填时，程序优先按“测量时间”计算，件数仅作为辅助信息。</p>
          </div>

          <div className="space-y-1">
            <h3 className={h3}>Q4：Excel 生成后，修改时间会怎样？</h3>
            <p className={p}>生成后的 Excel 中，修改“开始时间”或“结束时间”后，“耗时”会自动重新计算。跨天（结束 &lt; 开始）会按 +24 小时处理。如果耗时超过 12 小时，会显示“检查”，提示可能时间输错。</p>
          </div>

          <div className="space-y-1">
            <h3 className={h3}>Q5：配置会自动保存吗？配置文件在哪里？</h3>
            <p className={p}>全局默认设置支持保存到配置文件。修改“每件时间范围”“下班策略”“手量/其他事务开关”“默认班次”等设置后，请点击“保存默认设置”，下次打开会自动恢复。</p>
            <div className={info}>
              默认保存在系统用户配置目录：<br />
              <code className={code}>%APPDATA%\OMM日报系统\config.json</code><br />
              界面“配置文件”一栏会显示实际目录。如需让便携版带着配置一起走，可在“生成设置”中点击“浏览…”选择程序文件夹或 U 盘目录。<br />
              便携版启动时会优先识别自身目录内任意位置的 config.json，并把后续保存写回该配置所在目录。
            </div>
          </div>

          <div className="space-y-1">
            <h3 className={h3}>Q6：为什么输出目录输入框是空白的？</h3>
            <p className={p}>如果勾选了“输出到源文件夹”，输入框会被禁用，空白是正常状态。生成结果会保存到对应日期文件夹，不会保存到程序目录。取消勾选后，才能选择统一输出目录。</p>
          </div>

          <div className="space-y-1">
            <h3 className={h3}>Q7：为什么点击生成后弹出了手量补录？</h3>
            <p className={p}>这通常表示当天日期文件夹内发现了名称包含“手量”的子文件夹，但还没有人工确认。程序不会自动相信文件夹名里的耗时，会先让你确认数量、耗时和测量员，避免真实手量漏排或重复排程。</p>
          </div>

          <div className="space-y-1">
            <h3 className={h3}>Q8：生成失败时怎么看原因？</h3>
            <p className={p}>生成结果弹窗会分开显示成功报表和失败明细。失败原因会尽量写成人能看懂的说明，例如“手量未确认”“真实手量字段不完整”“扫描日期文件夹失败”等；手量类失败可以直接从弹窗打开手量补录。</p>
          </div>

          <div className="space-y-1">
            <h3 className={h3}>Q9：弹窗提示“非标准表格无法识别”是什么意思？</h3>
            <p className={p}>程序只能识别公司标准首件尺寸报告模板（第一行含“安徽中耀智能科技有限公司”和“首件尺寸报告”，并有“测量值”表头）。如果任务文件夹里的 .xlsx 不是这个格式，程序无法自动统计件数，需要你在弹窗中手动填写件数或测量时间。</p>
          </div>

          <div className="space-y-1">
            <h3 className={h3}>Q10：标准表格有什么特征？</h3>
            <ul className={ul}>
              <li>第一行有 CPT 标识和“安徽中耀智能科技有限公司首件尺寸报告”字样；</li>
              <li>有“检测工具”列，行内标记 OMM 或 CMM；</li>
              <li>有“测量值”表头及编号行、数据行；</li>
              <li>复测/丢料等异常列会标注文字，不计入件数。</li>
            </ul>
          </div>
        </div>
      );

    case "about":
      return (
        <div className="space-y-4">
          <h2 className={h2}>关于</h2>
          <ul className={ul}>
            <li><strong>软件名称</strong>：OMM 日报系统</li>
            <li><strong>版本</strong>：v5.0.4</li>
            <li><strong>功能</strong>：自动从文件夹名提取信息并生成 OMM 日报 Excel。</li>
            <li><strong>配置路径</strong>：默认在 <code className={code}>%APPDATA%\OMM日报系统</code>，可在“生成设置”中自定义。</li>
          </ul>
          <p className={p}>如有问题或建议，请反馈给管理员。</p>
        </div>
      );

    default:
      return null;
  }
}

export function HelpCenterDialog({ open, initialSection = "quickstart", onClose }: HelpCenterDialogProps) {
  const [activeSection, setActiveSection] = useState(initialSection);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-[780px] max-w-full h-[620px] max-h-[90vh] flex flex-col overflow-hidden rounded-lg border-slate-200 shadow-xl">
        <CardHeader className="shrink-0 border-b border-slate-100 bg-white px-5 py-3">
          <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-600" />
            使用说明
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0 flex">
          {/* Left sidebar */}
          <div className="w-52 shrink-0 border-r border-slate-100 bg-slate-50/70 p-3 overflow-y-auto">
            <nav className="space-y-1">
              {SECTIONS.map((section) => {
                const active = activeSection === section.key;
                return (
                  <button
                    key={section.key}
                    onClick={() => setActiveSection(section.key)}
                    className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors border ${
                      active
                        ? "bg-white border-blue-200 text-blue-700 font-medium shadow-sm"
                        : "border-transparent text-slate-600 hover:bg-white hover:border-slate-200 hover:text-slate-900"
                    }`}
                  >
                    <span className={active ? "text-blue-600" : "text-slate-400"}>{section.icon}</span>
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right content area */}
          <div className="flex-1 overflow-y-auto bg-white p-6">
            <div className="max-w-2xl">
              <Content section={activeSection} />
            </div>
          </div>
        </CardContent>

        <div className="shrink-0 border-t border-slate-100 bg-slate-50/50 px-5 py-3 flex justify-end">
          <Button onClick={onClose}>关闭</Button>
        </div>
      </Card>
    </div>
  );
}
