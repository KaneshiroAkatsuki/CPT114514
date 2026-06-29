# OMM日报系统 v5.0.6 当前状态交接（给新 opencode 上下文）

> 时间：2026-06-30
> 版本号：5.0.7（已正式升级）
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

### 1.8 本轮补充修复：前端流程缺陷（A-E）

按 9.4 节缺陷解决方案，优先修复以下 5 项，未触碰 sidecar 排程核心：

- **A. ReviewDialog “跳过此包” 真的跳过**：`handleReviewConfirm` / `handleReviewSkip` 现在都会用 `effectiveRecords = updatedRecords.filter(r => !skippedFolders.includes(r.folder))` 过滤，再交给生成逻辑；过滤后为空则记录“本日期所有任务都被跳过”。
- **B. ReviewDialog “确认并继续” 字段校验**：新增 `validateCurrentRecord`，要求 `quantity` 和 `manual_duration` 至少有一个合法正值；缺失字段仍提示；不合法时弹窗底部显示红字错误，不调用 onConfirm。
- **C. ManualTaskDialog “保存并预览” 使用最新手量**：`onPreview` 签名改为 `onPreview?: (tasks: RealManualTask[]) => void`；`handleSaveAndPreview` 直接传 `tasks`；`MainWindow` 用最新 tasks 构造 `nextItem` 并立即 `handlePreviewForItem(nextItem, idx)`，不再等待 React state 刷新。
- **D. 批量生成暂停状态与未处理日期**：扩展 `GenerateResult`（`status: 'complete' | 'paused' | 'failed'`，`pendingItems`）。遇到未确认手量或真实手量字段不完整时，状态记为 `paused`，`pendingItems = queue.slice(index).map(...)`，失败计数不再 +1；弹窗标题显示“生成已暂停，需要先处理手量”，并列出尚未处理的日期。
- **E. 预览/生成前统一校验数字设置**：新增 `validateGlobalSettings()`，在 `handlePreview`、`handlePreviewForItem`、`handleGenerate`、`handleGenerateSingleFromPreview` 前调用；校验 `tpp_min/tpp_max` 为正数且 `min <= max`、`pkg_rest >= 0`、`hand_max/other_max > 0`、非源输出时 `outputDir` 非空；不合法时只写日志，不调用 sidecar。

### 1.9 gpt 复核热修：ReviewDialog 缺失字段校验读取编辑后的实际值

- **发现的问题**：op 的 `validateCurrentRecord` 会把 `reviewMap[currentFolder].missing` 中的字段一直视作缺失，即使用户已经在审核弹窗输入框里补了值，也可能继续拦截“确认并继续”。
- **修复方式**：新增 `hasUsableFieldValue(record, field)`，校验时读取 `editedRecords` 当前值；`quantity` / `manual_duration` 继续互为兜底，只要其中一个合法正值，就不强制另一个也填写。
- **影响范围**：仅修改 `src/components/ReviewDialog.tsx` 的前端校验逻辑；未触碰 sidecar 排程核心、Excel 写入、CNC/整形 CNC/特殊大件/缺口诊断算法。

### 1.10 gpt 本轮：正式升级 5.0.7 并清理 releases

- **版本号升级**：`package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`、帮助页版本展示统一更新为 `5.0.7`。
- **窗口标题更新**：Tauri 主窗口标题改为 `OMM日报系统 v5.0.7`。
- **重新构建发布物**：重新执行 TypeScript、Rust、Tauri build、便携版打包。
- **releases 清理**：清空旧 alpha/v5.0.1-v5.0.4 发布残留，仅保留当前有用的 `releases\OMM日报系统_便携版_5.0.7` 和 `releases\OMM日报系统_便携版_5.0.7.zip`。
- **影响范围**：只做版本与发布产物整理；未触碰 sidecar 排程核心、CNC/整形 CNC/特殊大件/缺口诊断算法。

### 1.11 本轮补充修复：手量文件夹识别规则细化（v5.0.7）

按 gpt 复核要求，对手量文件夹自动识别做最小必要修正，未触碰 sidecar 排程核心、CNC/整形 CNC/特殊大件/缺口诊断算法。

- **品名识别**：优先识别文件夹开头的数字/料号段；新增 `looksLikeProduct()` 排除 `CMM`、`OMM`、`PCS`、`ST`、`MO`、`T0`、`T1`、`IQC`、`OQC` 等关键词；不再把 `CMM-郑安午` 当作品名。
- **工站识别**：`RealManualTask` 新增 `station` 字段；`recognizeManualTaskFromFolder()` 将第二段识别为工站（如 `开发`、`CNC`、`射出` 等）；弹窗增加“工站”输入框。
- **送测人识别**：新增支持 `姓名送测` 格式（如 `安容克送测`），仍保留 `-送测-姓名`、`-ST-姓名`。
- **测量员识别**：继续只从 `-手量-姓名` 识别；`CMM/OMM` 后面的人名不再误放入品名，也不自动当测量员。
- **测试日期默认值**：手量弹窗的测试日期默认使用队列日期（从 `6.13A` 解析），解析失败则用当天日期；UI 文案改为“测试日期”。
- **字段精简**：手量弹窗只保留工站、品名、送测人、测试日期、数量、耗时、测量员；送测项目固定 `OMM`，不在弹窗作为输入框。
- **真实手量 station 写入 Excel**：`generate_report.py` 中真实手量行 station 优先使用任务自带 `station`，未提供时默认 `'手量'`。
- **帮助文档同步**：命名规则章节增加手量文件夹命名说明。

版本号升级到 **5.0.7**，同步更新了 `package.json`、`src-tauri/tauri.conf.json`、安装包和便携版命名。

### 1.12 本轮补充修正：手量耗时输入体验（v5.0.7）

按 gpt 要求，不再指望从文件夹名识别手量耗时，改为人工确认/填写，默认按小时输入：

- **不再从文件夹名识别耗时**：`recognizeManualTaskFromFolder()` 移除耗时识别；`recognizeManualDuration()` 保留但仅作为通用工具，不再用于手量文件夹。
- **`parseManualDuration()` 改为默认按小时理解**：
  - `2` → 120 分钟
  - `2.5` → 150 分钟
  - `3h` / `3H` → 180 分钟
  - `150分钟` / `150分` → 150 分钟
  - `90m` / `90M` → 90 分钟
- **ManualTaskDialog 耗时输入**：
  - 标签改为“耗时”，placeholder：`例如 2、2.5、3h、150分钟`。
  - 下方提示：`手量耗时默认按小时输入；如需按分钟，请写“90分钟”或“90m”。`
  - 实时显示换算结果：`将按 120 分钟计入`。
- **候选信息**：未识别耗时显示“耗时：待填写”，不再列入橙色强警告。
- **校验调整**：未填写耗时提示 `请填写手量耗时`；小于 5 分钟提示不合理；超过 8 小时提示请确认（不强制拦截）。
- 未触碰 sidecar 排程核心。

### 1.13 gpt 本轮：识别补充规则独立文件与窗口

按用户要求，识别补充内容不再设计为直接写入 `config.json`，而是与配置文件同目录独立保存：

```text
config.json
recognition-rules.json
```

- **Rust 命令**：新增 `load_recognition_rules` / `save_recognition_rules`，使用当前有效配置目录，默认文件名 `recognition-rules.json`。
- **配置结构**：`Config` / `AppConfig` 增加 `recognition_rules_path`，仅用于指定规则文件名/路径；规则正文不塞入普通配置。
- **前端类型**：新增 `RecognitionRules`、工站别名、品名别名、烧结盘规则、焊接规则、加载信息等类型。
- **识别模块**：新增 `src/lib/recognitionRules.ts`，内置 806 料号后三位、CNC=035、FAI=开发、烧结盘、焊接、首件/制程/尺寸规则；`recognizeManualTaskFromFolder()` 保持旧入口，内部转调新模块。
- **识别补充窗口**：新增 `RecognitionRulesDialog`，支持添加/删除工站别名、品名规则、忽略词、烧结盘规则、焊接规则，并可输入文件夹名测试识别结果和命中规则。
- **主界面入口**：配置区域显示 `recognition-rules.json` 路径，提供“识别补充”按钮；切换配置目录后会刷新规则文件路径。
- **手量识别接入**：自动发现手量候选和手量弹窗粘贴识别都会使用当前补充规则。
- **帮助文档同步**：说明补充规则文件与 `config.json` 同目录、普通配置重置不会清空补充规则，只能在识别补充窗口删除单条或清空全部。
- **影响范围**：只改配置/前端识别与 UI；未触碰 sidecar 排程核心、CNC/整形 CNC/特殊大件/缺口诊断算法。

### 1.14 op 本轮：识别补充 GUI 验收与焊接规则修复

按 gpt 提示词要求，对 v5.0.8 识别补充功能做代码级审查与关键用例验证，并修复发现的问题：

- **验收 1-3：UI 入口与保存**
  - 主界面配置区域已显示 `recognition-rules.json` 路径和“识别补充”按钮（`MainWindow.tsx:1772-1782`）。
  - `RecognitionRulesDialog` 支持工站别名、品名补充、忽略词、烧结盘/焊接规则的新增/删除。
  - 保存调用 `saveRecognitionRules` 写入独立文件；关闭再打开通过 `loadRecognitionRules` 读取，规则持久。
  - `save_config` 只写 `config.json`，不会触碰 `recognition-rules.json`。
  - 切换配置目录后，`refreshRecognitionRules` 会重新读取新目录下的规则文件路径。

- **验收 4-7：关键识别用例代码级验证**
  - 565-开发-MO-T0... → 工站=开发，品名=565，送测人=安容克，数量=96PCS，测量员=禹欣 ✓
  - X806-65036-04_EVT-ALT-2_射出-首件... → 工站=射出，品名=036，类型=首件 ✓
  - X511-512-562-563烧结盘-2026-04-22 → 工站=烧结盘，品名=511, 512, 562, 563 ✓
  - 613-41428-(035-625)-焊接 → 工站=焊接，品名=428 ✓

- **发现的 bug：焊接 41424-41429 规则输出错误**
  - `src/lib/recognitionRules.ts` 中焊接分支原代码：`pushUnique(products, \`4${m[1].slice(1)}\`)`。
  - 问题：当 `m[1] = "28"` 时，`slice(1) = "8"`，结果变成 `"48"`，而不是期望的 `"428"`。
  - 修复：改为 `pushUnique(products, \`42${m[1].slice(1)}\`)`，使 `41424 → 424`、`41428 → 428`、`41429 → 429`。
  - 影响范围：仅修改 `src/lib/recognitionRules.ts` 一行；未触碰 sidecar 排程核心、CNC/整形 CNC/特殊大件/缺口诊断算法。

- **重新构建**：修复后重新执行 TypeScript 类型检查、Rust check、Tauri build、便携版打包，均通过。

### 1.15 op 本轮：真实手量归属逻辑明确化

按 gpt 提示词要求，修复/明确真实手量归属逻辑，确保 `-OMM-姓名-手量-测量员` 的场景正确处理：

- **归属规则确认**
  - 日报归属优先看 `-OMM-姓名`，不是看 `-手量-姓名`。
  - 当前代码中：
    - `detectManualCandidates` 只按文件夹名含“手量”/“手测”发现候选，不依赖测量员姓名，不会把 `-手量-王业陈` 的候选排除出禹欣日报。
    - `isManualCandidateConfirmed` 按 `source_folder` / `product` 匹配，不依赖 `operator`，确认状态不受测量员影响。
    - sidecar `parse_all_folders` 用 `_is_operator_folder` 匹配 `-OMM-姓名`，`-OMM-禹欣-手量-王业陈` 会被识别为禹欣的文件夹。
    - 真实手量写入 Excel 时，`task.get('operator', operator_name)` 优先使用真实手量任务自带的 `operator`（王业陈），而不是日报归属人（禹欣）。

- **修复：手量弹窗不强制要求识别到测量员**
  - 原 `handleRecognize` 在粘贴识别时，如果文件夹名没有 `-手量-姓名` 就跳过整条记录。
  - 这会导致只有 `-OMM-姓名` 但没有 `-手量-测量员` 的文件夹无法被粘贴识别为手量候选。
  - 改为：即使没识别到测量员，也生成手量草稿，只是 `operator` 为空，后续由用户在弹窗里补；不再直接跳过。

- **新增：手量弹窗显示日报归属人和归属提示**
  - `ManualTaskDialog` 新增 `ownerName` prop，接收当前界面的 `operatorName`。
  - 弹窗标题下方显示“日报归属人：{ownerName}”。
  - 候选信息卡片和每条手量记录卡片中，当 `operator !== ownerName` 时，显示蓝色提示：
    > 该手量将写入 {ownerName} 日报，量测员按 {operator} 填写
  - 帮助文档“手量文件夹命名”章节增加归属规则说明。

- **A/B 班时间推测**
  - 当前班次已能从日期文件夹后缀 `6.28A` / `6.28B` 自动识别，并复用现有 `shiftOverride` / `shift` 状态传给 sidecar。
  - 送测时间识别已支持 `刘前程2点30送测` / `张三14:00送测` 等写法，由 `recognitionRules.ts` 的 `applySenderRecognition` 处理。
  - 本轮未新增孤立的时间推测逻辑；有歧义时仍由用户在弹窗中确认 `send_time` 字段。

- **影响范围**：只修改前端 `ManualTaskDialog`、`MainWindow`、`HelpCenterDialog`；未触碰 sidecar 排程核心、CNC/整形 CNC/特殊大件/缺口诊断算法。

---

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
| ReviewDialog “跳过此包” 过滤后不生成本日期 | 通过 ✓ |
| ReviewDialog “确认并继续” 数量/耗时校验 | 通过 ✓ |
| ManualTaskDialog “保存并预览” 使用最新手量 | 通过 ✓ |
| 批量生成暂停状态与未处理日期列表 | 通过 ✓ |
| 预览/生成前数字设置校验 | 通过 ✓ |
| gpt 复核：ReviewDialog 缺失字段校验读取编辑后实际值 | 通过 ✓ |
| `cargo check --release` 无 warning | 通过 ✓ |
| 版本号统一升级到 5.0.7 | 完成 ✓ |
| `npx.cmd tsc --noEmit`（5.0.7） | 通过 ✓ |
| `cargo check --release`（5.0.7） | 通过 ✓ |
| `npm.cmd run tauri build`（5.0.7） | 成功 ✓，仅 Vite chunk size 警告 |
| `scripts/package-portable.ps1 -Version 5.0.7` | 成功 ✓ |
| releases 清理后仅保留 5.0.7 便携版目录与 zip | 完成 ✓ |
| 手量文件夹识别细化：565-开发-MO-T0模具测试-安容克送测-96PCS-CMM-郑安午-手量-禹欣 → 品名=565, 工站=开发, 送测人=安容克, 测量员=禹欣 | 通过 ✓ |
| RealManualTask 新增 station 字段 | 完成 ✓ |
| 真实手量 station 写入 Excel | 完成 ✓ |
| 测试日期默认使用队列日期 | 完成 ✓ |
| 帮助文档手量命名规则同步 | 完成 ✓ |
| 手量耗时不再从文件夹名自动识别 | 完成 ✓ |
| `parseManualDuration` 默认按小时理解 | 通过 ✓ |
| ManualTaskDialog 耗时输入实时换算提示 | 通过 ✓ |
| 手量耗时未识别不列入强警告 | 通过 ✓ |
| 手量耗时校验：0.5-8 小时建议范围 | 通过 ✓ |
| `npx.cmd tsc --noEmit`（v5.0.7 耗时修正后） | 通过 ✓ |
| `cargo check --release`（v5.0.7 耗时修正后） | 通过 ✓ |
| `npm.cmd run tauri build`（v5.0.7 耗时修正后） | 成功 ✓ |
| 识别补充规则独立保存到 `recognition-rules.json` | 完成 ✓ |
| `RecognitionRulesDialog` 增删/测试识别入口 | 完成 ✓ |
| 自动手量候选识别接入补充规则 | 完成 ✓ |
| 帮助文档同步 `config.json` / `recognition-rules.json` 区别 | 完成 ✓ |
| `npx.cmd tsc --noEmit`（识别补充窗口后） | 通过 ✓ |
| `cargo check --release`（识别补充窗口后） | 通过 ✓ |
| `npm.cmd run tauri build`（识别补充窗口后） | 成功 ✓，仅 Vite chunk size 警告 |
| `scripts/package-portable.ps1 -Version 5.0.7`（识别补充窗口后） | 成功 ✓ |
| `scripts/package-portable.ps1 -Version 5.0.7`（耗时修正后） | 成功 ✓ |
| 识别补充 GUI 验收：主界面显示路径和按钮 | 通过 ✓ |
| 识别补充 GUI 验收：新增/删除/保存规则后重新读取仍存在 | 通过 ✓ |
| 识别补充 GUI 验收：清空补充后内置规则仍生效 | 通过 ✓ |
| 识别补充 GUI 验收：切换配置目录后路径刷新 | 通过 ✓ |
| 识别补充 GUI 验收：保存默认设置不清空 `recognition-rules.json` | 通过 ✓ |
| 识别用例：565-开发-MO-T0... → 工站=开发，品名=565，送测人=安容克，数量=96PCS，测量员=禹欣 | 通过 ✓ |
| 识别用例：X806-65036-04...射出-首件 → 工站=射出，品名=036，类型=首件 | 通过 ✓ |
| 识别用例：X511-512-562-563烧结盘 → 工站=烧结盘，品名=511,512,562,563 | 通过 ✓ |
| 识别用例：613-41428-(035-625)-焊接 → 工站=焊接，品名=428 | 通过 ✓ |
| 识别用例：613-41424-(036-623)-焊接 → 工站=焊接，品名=424 | 通过 ✓ |
| 识别用例：613-41429-(037-626)-焊接 → 工站=焊接，品名=429 | 通过 ✓ |
| 焊接规则 bug 修复：`41428` 不再误识别为 `48` | 已修复 ✓ |
| `npx.cmd tsc --noEmit`（焊接规则修复后） | 通过 ✓ |
| `cargo check --release`（焊接规则修复后） | 通过 ✓ |
| `npm.cmd run tauri build`（焊接规则修复后） | 成功 ✓，仅 Vite chunk size 警告 |
| `scripts/package-portable.ps1 -Version 5.0.7`（焊接规则修复后） | 成功 ✓ |
| 真实手量归属：`-OMM-禹欣-手量-王业陈` 归入禹欣日报，量测员王业陈 | 通过 ✓ |
| 手量弹窗显示日报归属人 | 通过 ✓ |
| 手量弹窗显示归属提示（写入某日报，量测员按某人填写） | 通过 ✓ |
| 粘贴识别不再因未识别测量员而跳过整条记录 | 通过 ✓ |
| 帮助文档说明归属规则（-OMM-姓名 vs -手量-测量员） | 完成 ✓ |
| `npx.cmd tsc --noEmit`（归属逻辑优化后） | 通过 ✓ |
| `npm.cmd run tauri build`（归属逻辑优化后） | 成功 ✓，仅 Vite chunk size 警告 |
| `scripts/package-portable.ps1 -Version 5.0.7`（归属逻辑优化后） | 成功 ✓ |

---

## 3. 复核结论

- 手量自动发现遵循“自动发现、自动预填、人工确认”原则，不自动相信耗时，不瞎编。
- 仅新增前端发现逻辑和一个 Rust 只读目录命令，未触碰 sidecar 排程核心、CNC/整形 CNC/特殊大件/缺口诊断规则。
- **Git 提醒**：Git 根目录是 `D:\KSoftware\KMAA`，后续千万不要 `git add .`，需要提交时只精确 add 本次修改的文件。
- 本项目很怕大范围重构，最小刀法是对的。

---

## 4. 当前构建结果

### 4.1 安装包

```text
src-tauri\target\release\bundle\nsis\OMM日报系统_5.0.7_x64-setup.exe
```

### 4.2 便携版

```text
releases\OMM日报系统_便携版_5.0.7
releases\OMM日报系统_便携版_5.0.7.zip
```

### 4.3 最新便携版 manifest hash

来源：`releases\OMM日报系统_便携版_5.0.7\manifest.json`，`packaged_at=2026-06-30T03:46:37`。

```text
[app] OMM日报系统.exe
sha256=10794e5643aca7fd0d0a0f6c350e9b3bb7b48c7fea281895ada1e56f71ac0ba1

[sidecar] binaries\generate_report.exe
sha256=39ddecb307f87797d9861f70d570b89b45f2c72c467c82fe1ccde9e997c7acab

[template] resources\template.xlsx
sha256=e96e5eab2f6535ecef77bfd495bdd1893990bde6fcbebb317d9f44d011eac982
```

---

## 5. 仍需完成（如果你要继续本轮）

1. 对识别补充窗口做真实 GUI 点测：在真实运行程序中新增规则、保存、重新打开、测试识别、清空补充、切换配置目录后路径刷新（代码级审查已通过）。
2. 对手量文件夹自动发现做一轮真实 GUI 验收：把含“手量”的子文件夹放入日期文件夹后，确认队列 badge、弹窗预填、生成前阻止、普通任务过滤都符合预期。
3. 考虑 `settingsOverride.real_manual_tasks` 持久化问题：当前单日设置关闭程序后仍可能丢失。
4. 对 DaySettingsDialog 和 PreviewDialog 新增按钮做真实交互验收。
5. 对 A-E 修复做真实 GUI 验收：跳过此包、审核校验、保存并预览、暂停状态、数字校验。
6. 如果要分发安装版，也可从 `src-tauri\target\release\bundle\nsis\OMM日报系统_5.0.7_x64-setup.exe` 取用；`releases` 当前只保留便携版目录与 zip。

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
- 识别规则模块：`src/lib/recognitionRules.ts`
- 前端主界面：`src/components/MainWindow.tsx`
- 前端手量弹窗：`src/components/ManualTaskDialog.tsx`
- 前端识别补充窗口：`src/components/RecognitionRulesDialog.tsx`
- 前端预览：`src/components/PreviewDialog.tsx`
- 前端帮助：`src/components/HelpCenterDialog.tsx`
- 前端配置位置：`src/components/ConfigLocationDialog.tsx`
- 前端 hook：`src/hooks/useSidecar.ts`
- Rust 文件命令：`src-tauri/src/commands/file.rs`
- Rust 配置命令：`src-tauri/src/commands/config.rs`
- Rust 入口：`src-tauri/src/lib.rs`
- 版本配置：`package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`
- 样式：`src/index.css`
- UI 组件：`src/components/ui/card.tsx`、`src/components/ui/button.tsx`、`src/components/ui/input.tsx`
- 需求文档：`OMM日报系统-v5.0.7-手量文件夹自动发现需求.md`
- 识别规则设计：`OMM日报系统-v5.0.8-品名工站识别规则与补充窗口设计.md`
- 识别补充交接：`OMM日报系统-v5.0.8-识别补充实现交接.md`
- 修复交接文档：`OMM日报系统-v5.0.6-修复交接.md`
- 当前交接文档：`opencode-handoff-v5.0.6.md`

---

## 8. 如果需要继续开发的其他方向

1. 对 DaySettingsDialog 和 PreviewDialog 诊断按钮做真实 GUI 验收。
2. 考虑 `settingsOverride.real_manual_tasks` 持久化方案：先写设计，再落代码。
3. 版本号已统一升级到 5.0.7；后续如再发布，需要继续保持源码版本、Tauri 版本、帮助页、安装包、便携版目录/zip、manifest 一致。
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

7. **版本号和发布物关系已收束**
   - 项目已于 2026-06-30 正式升级到 `5.0.7`。
   - 当前源码版本、Tauri 版本、帮助页 About、安装包、便携版目录/zip、manifest 均已按 `5.0.7` 对齐。
   - 后续发布时继续保持这些位置同步，不要再打出“5.0.4 名称但包含 v5.0.7 修复”的混合包。

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

1. 对 A-E 修复做真实 GUI 验收：跳过此包、审核校验、保存并预览、暂停状态、数字校验。
2. 做手量文件夹自动发现的真实 GUI 验收，发现问题只修前端闭环。
3. 考虑真实手量持久化方案，先写设计，不急着落代码。
4. 如需再次发布，沿用 5.0.7 或按用户明确要求升级下一版本，并同步所有版本位置与发布物命名。

### 9.4 下一轮缺陷解决方案设计（优先做，本轮已完成 A-E）

这一节是 gpt 对当前功能风险的具体解决办法。请 op 优先按这里做，不要直接大改 sidecar 核心。

#### A. ReviewDialog “跳过此包”必须真的跳过（已完成）

**现状风险**：`ReviewDialog` 的 `onSkip(skippedFolders, updatedRecords)` 会把跳过的文件夹名传回主界面，但主界面随后仍可能把 `updatedRecords` 全量交给 `generateWithRecords`，导致“跳过此包”实际只是跳过审核，并没有跳过生成。

**建议修法**：

1. 在 `handleReviewSkip` 和 `handleReviewConfirm` 之后进入生成前，统一过滤记录：
   - `const effectiveRecords = updatedRecords.filter(r => !skippedFolders.includes(r.folder))`
   - 后续传给 `generateWithRecords` / `generateSingleItemFinal` 的必须是 `effectiveRecords`。
2. 如果某次审核后所有问题记录都被跳过，仍允许生成剩余正常记录；如果过滤后没有任何记录，给出可读失败：
   - “本日期所有任务都被跳过，未生成报表。”
3. 结果弹窗里把跳过项列为“已跳过”，不要混在失败里；如果暂时不做新状态，也至少写入日志。

**验收**：

- 准备一个日期文件夹，其中一个子文件夹缺字段触发方案 A。
- 生成时点击“跳过此包”。
- 最终 Excel 不应包含被跳过的产品/文件夹。

#### B. ReviewDialog “确认并继续”必须做字段校验（已完成）

**现状风险**：审核弹窗可以什么都不填就点确认，后续可能继续生成留坑或触发难懂错误。

**建议修法**：

1. 在 `ReviewDialog` 内新增当前记录校验函数，例如 `validateReviewRecord(record, problemFields)`。
2. 最低校验：
   - 如果 `quantity` 和 `manual_duration` 都是空、`/`、`null`、`NaN`，不允许确认。
   - 对 `quantity`：必须是正数，或明确允许 `/` 但必须有 `manual_duration`。
   - 对 `manual_duration`：必须是正数。
3. 对其他字段：
   - 缺失字段建议提示，但可以允许 `/`；如果字段本来在 `missing` 内，确认时至少给用户明确红字提示。
4. UI 上在当前弹窗底部显示错误，不要只写日志。

**验收**：

- 触发方案 A 后，不填数量/测量时间，点“确认并继续”应被拦住。
- 填 `quantity=16` 或 `manual_duration=80` 后才能继续。

#### C. 手量弹窗“保存并预览”必须使用最新手量（已完成）

**现状风险**：`ManualTaskDialog` 点“保存并预览”时，先 `onSave(tasks)` 再 `onPreview()`，但 React `queue` 更新是异步的，预览可能拿到旧 `manualTaskItem`，导致刚保存的真实手量没参与预览。

**建议修法**：

1. 修改 `ManualTaskDialog` 的 `onPreview` 回调签名为 `onPreview?: (tasks: RealManualTask[]) => void`。
2. `handleSaveAndPreview` 调用 `onPreview?.(tasks)`。
3. `MainWindow` 里构造一个带最新手量的临时 item：
   - `const nextItem = { ...manualTaskItem, settingsOverride: { ...(manualTaskItem.settingsOverride || {}), real_manual_tasks: tasks.length > 0 ? tasks : undefined } }`
   - 先 `updateQueueItemOverride(...)`。
   - 再 `handlePreviewForItem(nextItem, idx)`，不要等 state 刷新。

**验收**：

- 手量弹窗内新增/修改一条真实手量，点“保存并预览”。
- 预览表格应立即出现这条真实手量，并计入有效时长。

#### D. 批量生成遇到未确认手量时，应显示“暂停”和未处理项（已完成）

**现状风险**：批量生成第 N 项遇到手量未确认时会停止并打开补录，但结果弹窗可能显示“成功 X、失败 1”，没有说明后续队列项尚未处理。

**建议修法**：

1. 扩展 `GenerateResult`，增加：
   - `status: "complete" | "paused" | "failed"`
   - `pendingItems?: string[]`
2. 当未确认手量或真实手量字段不完整导致中断时：
   - `status = "paused"`
   - `pendingItems = queue.slice(index).map(item => item.dateFolder)`，包含当前项和后续未处理项。
3. 弹窗标题：
   - complete 且无失败：`生成完成`
   - complete 且部分失败：`生成完成（部分失败）`
   - paused：`生成已暂停，需要先处理手量`
4. 弹窗正文：
   - 成功文件继续列出。
   - 失败/暂停原因继续列出。
   - 未处理项单独列出：“以下日期尚未生成”。

**验收**：

- 队列中至少 3 天，第 2 天有未确认手量。
- 点击生成后，第 1 天可成功，第 2 天暂停并打开补录，第 3 天应显示为未处理，而不是失败或成功。

#### E. 预览/生成前统一校验数字设置（已完成）

**现状风险**：`tpp_min`、`tpp_max`、`pkg_rest` 等输入框如果被清空，state 可能变成 `NaN`，保存默认时虽有部分校验，但预览/生成不一定拦截。

**建议修法**：

1. 新增 `validateGlobalSettings()`，在 `handlePreview`、`handlePreviewForItem`、`handleGenerate`、`handleGenerateSingleFromPreview` 前调用。
2. 校验项：
   - `tpp_min`、`tpp_max` 必须是有限正数。
   - `tpp_min <= tpp_max`。
   - `pkg_rest >= 0`。
   - `hand_max > 0`、`other_max > 0`。
   - 如果 `useSrcOutput === false`，`outputDir` 必须非空。
3. 失败时：
   - 不调用 sidecar。
   - 打开或显示一个明确错误，可以先用运行日志 + 生成结果失败明细。

**验收**：

- 清空每件时间最小值后点预览/生成，应被拦截并提示“每件时间范围不合法”。
- 设置最小值 7、最大值 3，应被拦截。

#### F. 真实手量持久化先不要急着实现，但要有方案

**现状风险**：真实手量目前绑定在队列 item 的 `settingsOverride.real_manual_tasks`，关闭程序后会丢失。

**建议方案（先设计，后实现）**：

1. 不写回原始日期文件夹。
2. 在配置目录新增单独文件，例如：
   - `%APPDATA%\OMM日报系统\manual_tasks.json`
   - 便携版则写到当前识别到的配置目录。
3. 数据结构按日期文件夹绝对路径或稳定 key 保存：
   - `fullPath`
   - `dateFolder`
   - `manualTasks`
   - `updatedAt`
4. 添加日期到队列时，如果存在保存过的真实手量，自动加载并显示 `[真实手量×N]`。
5. UI 必须显示“已保存到本机配置”，避免用户误以为写回了生产目录。

#### G. 版本号/发布建议（已完成）

当前功能已经超过 5.0.4 的语义范围。项目已于 2026-06-30 正式升级为 `5.0.7`，已同步：

- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/tauri.conf.json`
- 便携版目录/zip 名称
- manifest version
- 帮助页 About 版本

后续不要再使用 5.0.4 发布物命名；如果继续发版，按用户要求升级下一个版本并重新打包。

---

## 10. 给 gpt 的提示词

```text
当前项目目录：D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri
Git 根目录：D:\KSoftware\KMAA
绿色版 Git：C:\Program Files\Adobe\Acrobat DC\Adobi\PortableGit\cmd\git.exe

你叫 gpt。当前 opencode 窗口里只有一位 op，就是现在和你交接的这位 op。用户直接对 opencode 说话时，默认是在和 op 对话。如果用户说“gpt”，指的是你当前这个 ChatGPT/Codex 窗口。

当前已完成（含 op 本轮真实手量归属逻辑明确化）：
1. ReviewDialog “跳过此包” 正确过滤 records。
2. ReviewDialog “确认并继续” 校验数量和测量时间至少一项。
3. ManualTaskDialog “保存并预览” 使用最新 real_manual_tasks。
4. 批量生成遇到未确认手量时显示“生成已暂停”并列出未处理日期。
5. 预览/生成前统一校验数字设置。
6. 手量文件夹识别细化：品名优先数字/料号；第二段识别为工站；支持“姓名送测”；测量员只从“-手量-姓名”识别；排除 CMM/OMM/PCS/ST/MO/T0/T1/IQC/OQC 等作为品名。
7. 手量耗时输入体验：不再从文件夹名识别耗时；默认按小时输入（2=120 分钟、2.5=150 分钟、3h=180 分钟、150分钟=150 分钟）；实时显示换算结果；未识别不列为强警告。
8. 识别补充规则独立保存到 `recognition-rules.json`，与 `config.json` 同目录；普通配置保存/重置不会清空识别补充文件。
9. `RecognitionRulesDialog` 识别补充窗口已实现：工站别名、品名补充、忽略词、烧结盘/焊接规则、测试识别。
10. 自动手量候选识别和手量弹窗粘贴识别已接入补充规则。
11. 焊接 41424-41429 规则 bug 已修复：`41428` 不再误识别为 `48`，正确输出 `428`。
12. 关键识别用例已通过代码级验证：565-开发...、X806-65036-04...射出-首件、X511-512-562-563烧结盘、613-41428-(035-625)-焊接。
13. 真实手量归属逻辑明确化：`-OMM-姓名-手量-测量员` 归入 OMM 姓名日报；量测员按手量段姓名填写；弹窗显示日报归属人和归属提示。
14. 版本号仍保持 5.0.7。

最新完整提交链：
- 3964ca2 fix(manual): 明确真实手量归属逻辑，弹窗显示日报归属人和提示
- ced651f fix(recognition): handle manual sender variants
- f9f1b45 docs: 更新给 gpt 提示词中的最新提交链
- ed5dfbb fix(recognition): 修复焊接 41424-41429 规则输出错误
- 530d290 docs: 清理第 10 节，只保留给 gpt 的提示词
- 14948c5 docs: 更新第 10 节接力提示词
- deca90d fix(manual): 手量耗时输入默认按小时
- 5a80efd fix(manual): 细化手量文件夹识别规则并升级到 v5.0.7
- 1abae0a fix(frontend): 修复审核跳过/校验、手量预览、生成暂停状态、数字设置校验

当前版本号：5.0.7。后续除非用户明确要求，不要再改版本号。

最新便携版 manifest（packaged_at=2026-06-30T03:46:37）：
- app: 10794e5643aca7fd0d0a0f6c350e9b3bb7b48c7fea281895ada1e56f71ac0ba1
- sidecar: 39ddecb307f87797d9861f70d570b89b45f2c72c467c82fe1ccde9e997c7acab
- template: e96e5eab2f6535ecef77bfd495bdd1893990bde6fcbebb317d9f44d011eac982

注意：
- op 本轮已做代码级审查和关键用例验证，并修复焊接规则 bug、明确真实手量归属逻辑。
- 由于 CLI 环境限制，真实 GUI 点测（鼠标点击程序运行）尚未完成，仍需用户在真实运行程序中点一遍手量弹窗和识别补充窗口。

约束：
- 不要 git add .，只精确 add 修改过的文件。
- 不要触碰 sidecar 排程核心、CNC/整形 CNC/特殊大件/缺口诊断算法。
- 不要写回原始测试数据目录，不要动 C:\Users\Administrator\Desktop\勿动\日期文件。
- 如果用户让 op 做修改，op 会尽量 push；你这边看到的代码状态以上述 commit 为准。

op 留给你的几个注意点：
1. parseManualDuration 语义已变：纯数字现在默认按小时理解。该函数目前只用于 ManualTaskDialog，但如果以后复用到其他地方，需要留意。
2. 手量耗时超过 8 小时目前只提示、不强制拦截。如果用户后续希望强制，再补逻辑。
3. durationInput 是临时字段，保存在 task 对象上但不属于 RealManualTask 持久化字段；后续若做真实手量持久化，需要决定是否保存原始输入字符串。

建议下一轮工作：
1. 真实 GUI 验收（A-E + 手量识别/耗时输入）。
2. 真实手量持久化方案设计（先写文档，不写代码）。
3. 用户明确的新需求。
```
