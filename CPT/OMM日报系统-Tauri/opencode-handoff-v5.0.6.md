# OMM日报系统 v5.0.6 当前状态交接（给新 opencode 上下文）

> 时间：2026-06-29
> 版本号：仍为 5.0.4（未升级）
> Git 根目录：D:\KSoftware\KMAA（Tauri 项目目录为未跟踪状态，不要 `git add .`）

---

## 1. 刚刚完成了什么

### 1.1 手量文件夹自动发现与确认（本轮核心）

实现原则：**自动发现、自动预填、人工确认**。手量文件夹不再被当作普通任务重复排程。

- **类型扩展**：新增 `ManualFolderCandidate`，`QueueItem` 增加 `manualCandidates`。
- **自动发现**：新增 `detectManualCandidates`，扫描日期文件夹直接子文件夹，文件夹名含“手量”即记为候选。
- **耗时识别增强**：新增 `recognizeManualDuration`，仅识别明确耗时格式：
  - `90分钟`、`90分`、`1.5H`、`1小时30分钟`
  - `耗时90`、`用时90分钟`、`手量1.5H`
  - `耗时1:30` → 90 分钟
  - 不识别：`6.30B`、`21:50`、`22点30`、`96PCS`
- **Rust 命令**：新增只读命令 `list_child_folders`。
- **发现时机**：所有添加日期到队列的入口都会扫描（选择添加、全选、拖拽、粘贴、手动选班次）。
- **队列 badge**：显示 `[手量待确认×N]`（琥珀色）和 `[真实手量×N]`（蓝色）。
- **过滤普通任务**：`preview`/`generate` 流程中，`parseFolders` 后按 `record.folder` 过滤掉手量候选，避免重复排程。
- **生成前阻止**：存在未确认手量候选时，`generate` 直接阻止该项。
- **预览提示**：`preview` 允许打开，但日志提示有手量候选未确认。
- **弹窗自动预填**：打开“手量任务管理 / 补录”时，自动把候选转换为真实手量草稿；已保存过的候选不再重复生成；顶部提示自动发现数量及自动识别耗时数。

### 1.2 上一轮：前端视觉美化与信息架构优化

- **MainWindow**：header 图标+标题/副标题，响应式两栏，蓝色强调“生成报表”，琥珀色用于警告，状态 pill 展示模板/特殊大件/队列标签。
- **HelpCenterDialog**：文档阅读器风格，左侧目录，右侧结构化内容。
- **ConfigLocationDialog**：明确默认 AppData，便携版优先识别自身目录 `config.json`。
- **PreviewDialog**：stat grid、缺口诊断主题色卡片、来源列 pill。
- **index.css**：`--primary` 调整为蓝色。

### 1.3 再上轮：真实手量 preview 修复

- 修复真实手量跨固定休息后续行数量重复显示问题：Excel 原本正确，preview 后续行数量改为 `/`。

### 1.4 本轮交接同步与配置提示补充

- **配置文件说明已同步**：默认配置目录仍是系统 AppData；便携版优先识别自身目录树内的 `config.json`，未来保存会写回识别到的配置文件所在目录。
- **输出目录提示已同步**：界面输出路径为空时，含义是输出到源日期文件夹；这不是程序目录。
- **帮助/提示文案已同步**：补充便携版配置识别、输出路径为空、真实手量续行、普通 CNC/整形 CNC/特殊大件优先级、缺口诊断等说明。
- **手量自动发现文档已纳入当前交接**：`OMM日报系统-v5.0.7-手量文件夹自动发现需求.md` 继续作为设计依据和验收清单保留。

### 1.5 本轮完成：预览诊断操作入口、单日设置弹窗、来源列补充、.gitignore

- **PreviewDialog 缺口诊断增加操作按钮**：
  - `仍按此结果生成`：仅生成当前预览的日期项，不继续处理队列其余项。
  - `打开手量补录`：关闭预览并打开对应日期的手量任务管理弹窗。
  - `打开单日设置`：关闭预览并打开单日设置弹窗。
- **新增 DaySettingsDialog**：支持覆盖下班策略（智能/下早班/不下早班）、是否允许补时间手量、是否允许补其他事务；仅当与全局默认值不同时才写入 `settingsOverride`。
- **PreviewDialog 来源列补充**：新增 `break`（固定休息）、`supplement_manual`（补录手量）、`supplement_other`（补录事务）的 pill 显示与样式。
- **配置区域显示修复**：修复 `MainWindow` 配置目录按钮 JSX 结构错误；`buildConfigPatch` 返回类型修正为 `Config`。
- **新增 `.gitignore`**：排除 `node_modules`、`dist`、`src-tauri/target`、`releases`、`test-output`、构建产物与缓存。

### 1.6 本轮补充修复：手量候选确认匹配改为来源文件夹优先

- **发现的问题**：手量候选确认状态曾按 `product` 或“候选数 - 手量数”判断；当同一天有两个手量文件夹同品名、品名未识别、或用户在弹窗里修改品名时，队列 badge、生成前阻止、弹窗去重可能误判。
- **修复方式**：自动发现生成的真实手量草稿新增 `source_folder`，确认状态优先按来源文件夹名匹配；旧数据没有 `source_folder` 时，才回退用已识别 `product` 匹配。
- **影响范围**：只改前端类型、手量弹窗和主界面确认判断；未触碰 sidecar 排程核心、CNC/整形 CNC/特殊大件/缺口诊断算法。
- **顺手清理**：删除 Rust 配置命令里已废弃的 `find_config_recursive`，消除 `cargo check` unused warning，不改变配置加载行为。

### 1.7 本轮补充修复：预览取整、失败明细、手量补录入口、默认设置持久化

- **预览统计取整**：`PreviewDialog` 的分钟展示统一四舍五入，修复 `9h10.000988...` 这类浮点误差直接露出的问题。
- **生成前手量补录入口**：直接点击生成时，如果某日期有未确认手量候选，不再只写日志失败；会暂停生成、打开手量任务管理弹窗，并在生成结果中显示“手量文件夹未确认”的中文原因。
- **生成失败明细**：生成结果弹窗现在区分成功文件和失败原因；扫描失败、真实手量字段不完整、sidecar 返回失败、运行异常都会记录为可读原因。手量类失败提供“打开手量补录”按钮。
- **默认设置持久化**：新增“保存默认设置”按钮；下班策略、每件时间范围、手量/其他事务开关、默认班次、审核模式、包间休息、手量/其他上限等会写入配置文件，下次打开恢复。
- **配置结构补充**：`Config` / Rust `AppConfig` 增加 `leave_strategy`、`enable_hand`、`enable_other`、`shift_default`，只影响 GUI 配置读写，不改 sidecar 排程算法。
- **帮助文档同步**：更新快速开始、流程、FAQ，说明默认设置保存、手量待确认弹窗、失败明细查看。

---

## 2. 已验证项目

| 项目 | 结果 |
|---|---|
| `npx.cmd tsc --noEmit` | 通过 ✓ |
| `npm.cmd run tauri build` | 成功 ✓ |
| Tauri 安装包 | `src-tauri\target\release\bundle\nsis\OMM日报系统_5.0.4_x64-setup.exe` ✓ |
| 便携版重新打包 | 成功 ✓ |
| 耗时识别：耗时90分钟 → 90 | ✓ |
| 耗时识别：手量1.5H → 90 | ✓ |
| 耗时识别：耗时1:30 → 90 | ✓ |
| 耗时识别：21:50 → null | ✓ |
| 耗时识别：96PCS → null | ✓ |
| 文件夹识别：565-手量-张三-耗时90分钟 → product=565, duration_minutes=90 | ✓ |
| 文件夹识别：565-手量-张三-96PCS → quantity='96PCS', 无 duration | ✓ |
| `cargo check --release` | 通过 ✓ |
| 便携版 `manifest.json` 读取 | 通过 ✓ |
| 最新便携版 manifest hash 与本文档 4.3 一致 | 通过 ✓ |
| PreviewDialog 诊断按钮（如实生成/手量补录/单日设置） | 通过 ✓ |
| DaySettingsDialog 保存与恢复默认 | 通过 ✓ |
| 来源列补充 break/supplement_manual/supplement_other | 通过 ✓ |
| `.gitignore` 创建 | 完成 ✓ |
| 手量候选确认按 `source_folder` 优先匹配 | 通过 ✓ |
| 同品名/未识别品名候选误判风险 | 已修复 ✓ |
| `cargo check --release` 无 warning | 通过 ✓ |
| 便携版重新打包（5.0.4） | 成功 ✓ |
| 预览统计分钟取整 | 通过 ✓ |
| 未确认手量候选生成前打开补录入口 | 通过 ✓ |
| 生成结果失败明细 | 通过 ✓ |
| 默认设置保存到配置文件字段补充 | 通过 ✓ |
| 帮助文档同步 | 完成 ✓ |

---

## 3. 复核结论

- 手量自动发现遵循“自动发现、自动预填、人工确认”原则，不自动相信耗时，不瞎编。
- 仅新增前端发现逻辑和一个 Rust 只读目录命令，未触碰 sidecar 排程核心、CNC/整形 CNC/特殊大件/缺口诊断规则。
- **Git 提醒**：项目在 `D:\KSoftware\KMAA` 下仍显示为整个目录未跟踪，后续千万不要 `git add .`，需要提交时只精确 add 本次修改的文件。
- 本项目很怕大范围重构，最小刀法是对的。

---

## 4. 当前构建结果

### 4.1 安装包

```text
src-tauri\target\release\bundle\nsis\OMM日报系统_5.0.4_x64-setup.exe
```

### 4.2 便携版

```text
releases\OMM日报系统_便携版_5.0.4
releases\OMM日报系统_便携版_5.0.4.zip
```

### 4.3 最新便携版 manifest hash

来源：`releases\OMM日报系统_便携版_5.0.4\manifest.json`，`packaged_at=2026-06-29T22:59:30`。

```text
[app] OMM日报系统.exe
sha256=5ab96946a84c68ddce03066055d307aa97d8a4dac8d491b8e1cb597a9165948a

[sidecar] binaries\generate_report.exe
sha256=39ddecb307f87797d9861f70d570b89b45f2c72c467c82fe1ccde9e997c7acab

[template] resources\template.xlsx
sha256=e96e5eab2f6535ecef77bfd495bdd1893990bde6fcbebb317d9f44d011eac982
```

---

## 5. 仍需完成（如果你要继续本轮）

1. 对手量文件夹自动发现做一轮真实 GUI 验收：把含“手量”的子文件夹放入日期文件夹后，确认队列 badge、弹窗预填、生成前阻止、普通任务过滤都符合预期。
2. 考虑 `settingsOverride.real_manual_tasks` 持久化问题：当前单日设置关闭程序后仍可能丢失。
3. 版本号仍保持 5.0.4，如需对外发布建议统一升级到 5.0.6 或 5.0.7。
4. 对 DaySettingsDialog 和 PreviewDialog 新增按钮做真实交互验收。

---

## 6. 关键约束（务必遵守）

- **sidecar exe 只从 stdin 读取 JSONL**，不支持 `--input`/`--output` 参数。
- 正确调用方式：
  - Python: `subprocess.run([exe_path], input=json.dumps(payload)+'\n', ...)`
  - PowerShell: `Get-Content -Encoding UTF8 xxx.jsonl | .\binaries\generate_report.exe`
  - cmd: `type xxx.jsonl | .\binaries\generate_report.exe`
- 测试输出目录：`D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output`
- 不要写回原始测试数据目录。
- 不要移动/删除/重命名 `C:\Users\Administrator\Desktop\勿动\日期文件`。
- Git 根目录是 `D:\KSoftware\KMAA`，不要 `git add .`，如需提交请精确指定文件。
- 用户新约定：本窗口简称 **gpt**，opencode 里的接力 AI 简称 **op**；每轮完成后要尽量精确提交并 `git push`。如果项目内日期测试样例确实被修改，也要精确 add/push；仍禁止把原始 `C:\Users\Administrator\Desktop\勿动\日期文件` 或无关日期数据整目录加入提交。
- 当前 Git 是绿色版：`C:\Program Files\Adobe\Acrobat DC\Adobi\PortableGit\cmd\git.exe`，op 也应优先使用这个可执行路径或当前 PATH 中的 `git`。
- 本项目很怕大范围重构，只做最小必要改动。
- 不要触碰 sidecar 排程核心、CNC/整形 CNC/特殊大件/缺口诊断等业务逻辑，除非本轮明确要求修改。
- PowerShell 不要用 `< file` 这种重定向方式调用 sidecar。

---

## 7. 相关文件

- 后端核心：`sidecar/generate_report.py`（本轮未改动）
- 类型：`src/types/record.ts`
- 工具函数：`src/lib/utils.ts`
- 前端主界面：`src/components/MainWindow.tsx`
- 前端手量弹窗：`src/components/ManualTaskDialog.tsx`
- 前端预览：`src/components/PreviewDialog.tsx`
- 前端帮助：`src/components/HelpCenterDialog.tsx`
- 前端配置位置：`src/components/ConfigLocationDialog.tsx`
- 前端 hook：`src/hooks/useSidecar.ts`
- Rust 文件命令：`src-tauri/src/commands/file.rs`
- Rust 配置命令：`src-tauri/src/commands/config.rs`
- Rust 入口：`src-tauri/src/lib.rs`
- 样式：`src/index.css`
- UI 组件：`src/components/ui/card.tsx`、`src/components/ui/button.tsx`、`src/components/ui/input.tsx`
- 需求文档：`OMM日报系统-v5.0.7-手量文件夹自动发现需求.md`
- 修复交接文档：`OMM日报系统-v5.0.6-修复交接.md`
- 当前交接文档：`opencode-handoff-v5.0.6.md`

---

## 8. 如果需要继续开发的其他方向

1. 对 DaySettingsDialog 和 PreviewDialog 诊断按钮做真实 GUI 验收。
2. 考虑 `settingsOverride.real_manual_tasks` 持久化方案：先写设计，再落代码。
3. 版本号仍保持 5.0.4，如需对外发布建议统一升级。
4. 对便携版配置识别做实机验收：在便携版目录任意子目录放置 `config.json`，确认启动后界面显示识别到的配置目录，保存配置时不会误写 AppData。
5. 对手量文件夹自动发现做实机验收：日期文件夹内直接子文件夹含“手量”时，应进入待确认流程；确认前不应作为普通任务写入最终报表。

---

## 9. 产品/设计复盘与改进建议

这一节是给下一位接力 AI 的产品判断，不要求一次性全做。优先级从高到低，仍然遵循“少改核心、多改提示和边界”的原则。

### 9.1 当前最值得补强的地方

1. **手量文件夹识别后的用户闭环还要更清楚**
   - 日期文件夹一旦发现含“手量”的子文件夹，队列项应明确显示“本日内有手量待确认”。
   - 预览可以允许打开，但生成必须阻止，并提示“先确认/忽略这些手量文件夹”。
   - 手量弹窗里要能看到来源文件夹名、识别出的产品/数量/耗时、是否需要人工补充。
   - 不建议自动把识别结果直接当最终真实手量，必须保留人工确认。

2. **真实手量需要持久化或至少有明确状态提示**
   - 当前 `settingsOverride.real_manual_tasks` 更像临时内存状态，关闭程序后可能丢失。
   - 如果用户以为已经保存，但下次打开没了，会造成报表漏项。
   - 建议最小方案：在界面提示“本次会话有效 / 已保存到配置”。
   - 更完整方案：将每个日期的真实手量确认结果写入本地配置或日期旁的轻量 sidecar 配置，但不要写回原始生产数据目录，除非用户明确允许。

3. **预览缺口诊断应从“信息展示”升级为“下一步操作”**
   - 当前诊断能看见有效时长、目标、缺口、隐形缓冲和各类贡献，但用户还要自己判断怎么办。
   - 建议增加按钮：
     - “如实生成”：接受不足，继续生成。
     - “打开手量补录”：补真实手量。
     - “打开单日设置”：启用补时间或调整班次。
   - 按钮只做前端导航和状态选择，不要改 sidecar 排程核心。

4. **配置文件策略需要做成可解释、可恢复**
   - 便携版支持扫描自身目录树里的 `config.json` 是对的，但要避免多个 `config.json` 时用户不知道用了哪个。
   - 建议启动后在设置区显示：
     - 当前配置来源：AppData / 便携版
     - 当前配置路径
     - 如果发现多个配置文件，提示“使用第一个，建议保留一个”
   - 设置页建议增加“打开配置所在文件夹”和“重新选择配置位置”。

5. **输出路径为空的语义要持续强化**
   - 用户自然会误会“空白 = 程序文件夹”。
   - 实际应是“输出到源日期文件夹”。
   - 建议在输入框 placeholder、帮助页、生成前确认/日志里统一口径。

6. **预览表格的来源列还可以更稳定**
   - 现在重点来源包括普通、普通CNC、整形CNC、特殊大件、真实手量。
   - 建议给隐藏缓冲、休息、补时间手量、其他事务也补完整 `source`，让表格和缺口诊断口径一致。
   - 这属于显示层增强，不应影响最终 Excel 写入规则。

7. **版本号和发布物关系需要收束**
   - 当前版本仍是 5.0.4，但交接内容已进入 v5.0.6/v5.0.7 范围。
   - 如果继续发布给实际用户，建议下一轮明确：
     - 要么保持 5.0.4，只当内部修正版。
     - 要么统一升级到 5.0.6 或 5.0.7，并同步 Tauri、package、manifest、压缩包命名。

8. **测试资产和 Git 边界仍然是高风险点**
   - Git 根目录是 `D:\KSoftware\KMAA`，项目目录目前可能整体未跟踪。
   - 日期数据目录和构建产物很多，误 `git add .` 风险很高。
   - 建议尽快补 `.gitignore`，但必须谨慎，不要误忽略源代码。

### 9.2 不建议近期做的事

1. 不建议重构 sidecar 排程核心。
2. 不建议把手量识别做成“全自动生成”，因为文件夹名可能包含时间、批次、数量、日期等混杂信息。
3. 不建议为了界面美化改动数据结构或 Excel 写入逻辑。
4. 不建议把配置文件散落识别做得太“聪明”，多个配置时应该提示用户，而不是静默猜测。
5. 不建议写回 `C:\Users\Administrator\Desktop\勿动\日期文件` 或任何原始日期数据目录。

### 9.3 推荐下一轮实施顺序

1. 对新增 UI（DaySettingsDialog、PreviewDialog 诊断按钮）做真实 GUI 验收。
2. 做手量文件夹自动发现的真实 GUI 验收，发现问题只修前端闭环。
3. 考虑真实手量持久化方案，先写设计，不急着落代码。
4. 如需发布，统一升级版本号到 5.0.6 或 5.0.7。

---

## 10. 给下一位 AI 的提示词

```text
你是一名接力开发 AI，当前项目目录是：
D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri

请先阅读：
1. opencode-handoff-v5.0.6.md
2. OMM日报系统-v5.0.7-手量文件夹自动发现需求.md
3. OMM日报系统-v5.0.6-最终审查接续问题.md

当前版本号仍保持 5.0.4，除非用户明确要求，不要升级版本号。

协作简称：
- 当前 ChatGPT/Codex 窗口简称 gpt。
- opencode 里的接力 AI 简称 op。
- 即使 gpt/op 换窗口，也要记住：完成一轮后尽量精确提交并 git push。

本轮目标：
只做最小必要改进，优先处理界面提示、配置文件解释、手量文件夹自动发现闭环、预览诊断操作入口。不要大规模重构，不要触碰 sidecar 排程核心。

重点检查和改进：
1. 日期文件夹内如果有直接子文件夹名称包含“手量”，队列项应提示“本日内有手量待确认”或类似清晰文案。
2. 手量候选应自动预填到手量任务弹窗，但必须人工确认；确认前生成应阻止，预览可打开并提示未确认。
3. 手量弹窗应显示候选来源文件夹名、识别出的产品/数量/耗时，以及哪些字段需要人工补充。
4. 配置区域应清楚显示当前配置来源：AppData / 便携版 config.json，并显示实际配置目录。
5. 如果便携版目录树中发现多个 config.json，不要静默猜测，应该提示用户当前使用哪个，并建议只保留一个。
6. 输出路径为空时，界面应明确提示“输出到源日期文件夹”，不是程序文件夹。
7. PreviewDialog 缺口诊断按钮（如实生成 / 打开手量补录 / 打开单日设置）只做前端导航或状态选择，不改 sidecar 排程算法。
8. 预览表格来源列已补充 break / supplement_manual / supplement_other 显示口径，但不要让隐形缓冲写入最终 Excel。
9. 考虑真实手量持久化前，请先写设计方案，不要直接大改数据结构。
10. `.gitignore` 已存在，后续提交前请再次核对不要误忽略源代码。
11. 预览统计数字应显示整数分钟，不要让浮点误差露到 UI。
12. 生成失败必须给用户能看懂的失败明细；如果是手量未确认或真实手量字段不完整，要提供打开手量补录的入口。
13. 全局默认设置修改后必须能保存到配置文件，包括每件时间范围、下班策略、手量/其他事务开关、默认班次等。

必须遵守：
- sidecar exe 只从 stdin 读取 JSONL，不支持 --input / --output。
- PowerShell 不要用 `< file`，可用：
  Get-Content -Encoding UTF8 xxx.jsonl | .\binaries\generate_report.exe
  或 Python subprocess.run(input=...)
- 测试输出目录：
  D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output
- 不要写回原始测试数据目录。
- 不要移动、删除、重命名：
  C:\Users\Administrator\Desktop\勿动\日期文件
- Git 根目录是：
  D:\KSoftware\KMAA
  不要 git add .，提交时必须精确指定文件。
- 当前可用 Git 是绿色版：
  C:\Program Files\Adobe\Acrobat DC\Adobi\PortableGit\cmd\git.exe
- 用户要求每轮完成后执行精确提交并 git push；如果项目内日期测试样例确实被修改，也要精确 add/push。仍不要把原始“勿动”日期数据目录或无关日期数据整目录加入提交。
- 本项目很怕大范围重构，只做最小必要改动。
- 不要触碰 sidecar 排程核心、CNC/整形 CNC/特殊大件/缺口诊断等业务逻辑，除非用户明确要求。

建议验证命令：
- npx.cmd tsc --noEmit
- cargo check --release
- npm.cmd run tauri build
- powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\package-portable.ps1 -Version 5.0.4

完成后请更新 opencode-handoff-v5.0.6.md：
- 保留原结构。
- 在“刚刚完成了什么”追加内容。
- 在“已验证项目”追加验证结果。
- 从 releases\OMM日报系统_便携版_5.0.4\manifest.json 更新 app / sidecar / template sha256。
- 写清仍需完成和风险。
```
