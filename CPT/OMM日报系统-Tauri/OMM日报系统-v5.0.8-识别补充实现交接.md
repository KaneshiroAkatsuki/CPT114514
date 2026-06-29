# OMM日报系统 v5.0.8 识别补充实现交接

> 日期：2026-06-30  
> 编写：gpt  
> 当前项目目录：`D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri`  
> Git 根目录：`D:\KSoftware\KMAA`  
> 当前版本号：`5.0.7`，本轮未升级版本号。  
> 最新实现提交：`030940f Add recognition rules supplement file`

---

## 1. 背景

用户提供了最新模板文件夹用于推导常用品名/工站规则：

```text
C:\Users\Administrator\Desktop\勿动\识别文件夹
```

用户确认的关键业务规则：

1. 品名通常是三位数字。
2. `806-xxxxx-xx` 或 `806-xxxxx` 中，取 `xxxxx` 后三位作为品名，例如：
   - `806-65036-04 -> 036`
   - `806-65037 -> 037`
   - `806-63452-06 -> 452`
3. `EVT-SLIDER`、`EVT ALT-2`、`X168` 是机器/阶段/项目信息，不是品名。
4. CNC 工站固定品名为 `035`；整形工站里的 CNC 也按 `035`。
5. `FAI` 代表 `开发`。
6. `首件` / `制程` / `尺寸` 规则：
   - 出现 `首件` 填 `首件`
   - 出现 `制程` 填 `制程`
   - 否则填 `尺寸` 或 `测试尺寸`
7. 烧结盘允许特殊品名 `0.2`、`0.25`，也可能一个模板对应多个品名。
8. 焊接较特殊，当前按 `289`、`290`、`424`-`429` 识别。
9. 同一品名会出现在多个工站，所以识别结果必须同时保留 `工站 + 品名 + 测试类型`。
10. 用户担心补充规则随着配置重置/更新丢失，所以补充规则必须独立保存，不直接塞进 `config.json`。

---

## 2. 已实现内容

### 2.1 独立补充规则文件

新增独立文件策略：

```text
config.json                  # 普通界面配置，可随设置修改/重置
recognition-rules.json       # 用户识别补充规则，长期保存
```

两者位于同一个配置目录：

```text
AppData 模式：
%APPDATA%\OMM日报系统\config.json
%APPDATA%\OMM日报系统\recognition-rules.json

便携版模式：
<当前识别到的便携版配置目录>\config.json
<当前识别到的便携版配置目录>\recognition-rules.json
```

普通“恢复默认配置”不应删除 `recognition-rules.json`。只有用户在“识别补充”窗口内删除单条或清空全部，才修改该文件。

### 2.2 Rust 命令

在 `src-tauri/src/commands/config.rs` 新增：

```text
load_recognition_rules
save_recognition_rules
```

特点：

- 使用当前 `AppConfig.effective_config_dir()` 计算目录。
- 默认文件名为 `recognition-rules.json`。
- `config.json` 只通过 `recognition_rules_path` 可选指定规则文件名/路径，不保存规则正文。

### 2.3 前端类型

在 `src/types/record.ts` 新增：

```text
RecognitionRules
RecognitionRulesLoadInfo
StationAliasRule
ProductAliasRule
WeldingRule
SinterPlateRule
```

`RealManualTask` 增加：

```text
matched_rules?: string[]
recognition_warnings?: string[]
```

### 2.4 识别规则模块

新增：

```text
src/lib/recognitionRules.ts
```

内置规则包括：

- 806 料号取中间五位后三位
- CNC / 整形 CNC 固定 `035`
- `FAI -> 开发`
- `二维 -> 镭雕`
- 烧结盘小数品名、多品名
- 焊接 `289/290/41424-41429`
- `首件/制程/测试尺寸`
- 忽略 `EVT`、`ALT`、`X168`、`BIN2`、`BIN4`、`AOI`、`CMM`、`OMM`、`PCS` 等非品名词

原入口 `recognizeManualTaskFromFolder()` 仍保留，内部转调新模块，避免大面积改调用点。

### 2.5 识别补充窗口

新增：

```text
src/components/RecognitionRulesDialog.tsx
```

功能：

- 显示当前 `recognition-rules.json` 路径。
- 提示该文件独立保存，不随普通配置重置。
- 可添加/删除：
  - 工站别名
  - 品名补充规则
  - 忽略词
  - 烧结盘特殊规则
  - 焊接特殊规则
- 可输入文件夹名进行测试识别。
- 测试结果显示：
  - 工站
  - 品名
  - 类型
  - 送测人
  - 数量
  - 测量员
  - 命中的规则
  - 警告提示

### 2.6 主界面接入

在 `src/components/MainWindow.tsx`：

- 启动后读取 `recognition-rules.json`。
- 配置区域显示识别补充文件路径。
- 新增“识别补充”按钮。
- 切换配置目录后刷新识别补充文件路径。
- 自动发现手量候选时传入当前识别补充规则。

### 2.7 手量弹窗接入

在 `src/components/ManualTaskDialog.tsx`：

- `recognitionRules` 作为 prop 传入。
- “粘贴文件夹名识别”使用当前补充规则。

### 2.8 帮助页同步

在 `src/components/HelpCenterDialog.tsx`：

- 更新手量耗时说明：`2` 默认表示 2 小时，分钟需写 `90分钟` 或 `90m`。
- 增加识别补充规则说明。
- 说明 `recognition-rules.json` 与 `config.json` 同目录，但独立保存。
- 明确普通配置重置不会清空补充规则。

---

## 3. 最新构建与 manifest

验证命令已通过：

```powershell
npx.cmd tsc --noEmit
cargo check --release
npm.cmd run tauri build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\package-portable.ps1 -Version 5.0.7
```

`npm.cmd run tauri build` 仍只有 Vite chunk size 警告，不影响构建。

最新便携版：

```text
releases\OMM日报系统_便携版_5.0.7
releases\OMM日报系统_便携版_5.0.7.zip
```

最新 manifest（`packaged_at=2026-06-30T02:22:02`）：

```text
[app] OMM日报系统.exe
sha256=c01153cbe02c441a05cb62945cbfbeec7d850e3315f8d990adc2295fc1257bda

[sidecar] binaries\generate_report.exe
sha256=39ddecb307f87797d9861f70d570b89b45f2c72c467c82fe1ccde9e997c7acab

[template] resources\template.xlsx
sha256=e96e5eab2f6535ecef77bfd495bdd1893990bde6fcbebb317d9f44d011eac982
```

---

## 4. 仍需真实 GUI 验收

下一轮建议优先做真实 GUI 验收：

1. 打开程序，确认“生成设置”区域显示 `识别补充` 按钮和 `recognition-rules.json` 路径。
2. 点击“识别补充”，新增一条工站别名规则并保存。
3. 关闭窗口后重新打开，确认规则仍在。
4. 在测试识别输入：

```text
565-开发-MO-T0模具测试-安容克送测-96PCS-CMM-郑安午-手量-禹欣
```

期望：

```text
工站：开发
品名：565
类型：测试尺寸
送测人：安容克
数量：96PCS
测量员：禹欣
```

5. 测试 806 规则：

```text
X806-65036-04_EVT-ALT-2_射出-首件-工单号-机台号-模号-送测日期时间-送测人员-数量-OMM量测人员
```

期望：

```text
工站：射出
品名：036
类型：首件
```

6. 测试烧结盘：

```text
X511-512-562-563烧结盘-2026-04-22
```

期望：

```text
工站：烧结盘
品名：511, 512, 562, 563
```

7. 测试清空补充：只清空 `recognition-rules.json` 的用户补充，不影响内置规则。
8. 切换配置目录后，确认 `recognition-rules.json` 路径刷新到新目录。
9. 重置/保存普通配置，确认不会清空 `recognition-rules.json`。

---

## 5. 风险与后续改进

1. **未做真实 GUI 验收**：目前已通过编译和构建，但识别补充窗口需要人工点一遍。
2. **规则窗口是第一版**：可用为主，UI 还可以继续美化。
3. **正则输入风险**：品名/工站规则支持正则；非法正则会回退为普通包含匹配。后续可加“正则是否合法”的即时提示。
4. **补充规则导入模板文件夹未实现**：当前只能手工添加规则；以后可支持扫描模板目录生成候选。
5. **真实手量持久化未实现**：当前识别规则持久化已解决，但单日真实手量任务仍在队列内存中，关闭程序后会丢。
6. **版本号仍为 5.0.7**：本轮没有升级。若发布给外部用户，可继续用 5.0.7 内部修正版，或由用户明确要求升级。

---

## 6. 必须遵守的约束

- sidecar exe 只从 stdin 读取 JSONL，不支持 `--input` / `--output`。
- PowerShell 不要用 `< file`。
- 测试输出目录：

```text
D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output
```

- 不要写回原始测试数据目录。
- 不要移动、删除、重命名：

```text
C:\Users\Administrator\Desktop\勿动\日期文件
```

- Git 根目录：

```text
D:\KSoftware\KMAA
```

- 绿色版 Git：

```text
C:\Program Files\Adobe\Acrobat DC\Adobi\PortableGit\cmd\git.exe
```

- 不要 `git add .`，必须精确 add 修改文件。
- 不要触碰 sidecar 排程核心、CNC/整形 CNC/特殊大件/缺口诊断算法，除非用户明确要求。

---

## 7. 给下一位 op/gpt 的提示词

```text
你是一名接力开发/审查 AI。当前项目目录：
D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri

Git 根目录：
D:\KSoftware\KMAA

绿色版 Git：
C:\Program Files\Adobe\Acrobat DC\Adobi\PortableGit\cmd\git.exe

协作简称：
- gpt = ChatGPT/Codex 窗口
- op = opencode 窗口

请先阅读：
1. opencode-handoff-v5.0.6.md
2. OMM日报系统-v5.0.8-品名工站识别规则与补充窗口设计.md
3. OMM日报系统-v5.0.8-识别补充实现交接.md

当前状态：
- 当前版本号仍是 5.0.7，除非用户明确要求，不要升级版本号。
- 已实现识别补充规则独立文件 recognition-rules.json。
- recognition-rules.json 与 config.json 放在同一配置目录。
- 普通配置重置不能清空 recognition-rules.json。
- 识别补充窗口 RecognitionRulesDialog 已实现。
- 自动手量候选识别和手量弹窗粘贴识别已接入补充规则。
- 最新提交：030940f Add recognition rules supplement file。

本轮优先目标：
只做真实 GUI 验收和必要最小修复，不要大规模重构。

重点验收：
1. 生成设置区域是否显示 recognition-rules.json 路径和“识别补充”按钮。
2. 打开识别补充窗口后，新增工站别名/品名规则/忽略词是否能保存。
3. 保存后关闭再打开，规则是否仍存在。
4. 测试识别：
   565-开发-MO-T0模具测试-安容克送测-96PCS-CMM-郑安午-手量-禹欣
   应识别：工站=开发，品名=565，送测人=安容克，数量=96PCS，测量员=禹欣。
5. 测试 806 料号：
   X806-65036-04_EVT-ALT-2_射出-首件-...
   应识别：工站=射出，品名=036，类型=首件。
6. 测试烧结盘：
   X511-512-562-563烧结盘-2026-04-22
   应识别：工站=烧结盘，品名=511,512,562,563。
7. 清空补充规则后，内置规则仍应生效。
8. 切换配置目录后，recognition-rules.json 路径应刷新到新目录。
9. 普通保存默认设置/重置配置不应清空 recognition-rules.json。

建议验证命令：
- npx.cmd tsc --noEmit
- cargo check --release
- npm.cmd run tauri build
- powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\package-portable.ps1 -Version 5.0.7

必须遵守：
- sidecar exe 只从 stdin 读取 JSONL，不支持 --input / --output。
- PowerShell 不要用 < file。
- 测试输出目录：
  D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output
- 不要写回原始测试数据目录。
- 不要移动、删除、重命名：
  C:\Users\Administrator\Desktop\勿动\日期文件
- 不要 git add .
- 精确 add 修改文件，commit，push。
- 不要触碰 sidecar 排程核心、CNC/整形 CNC/特殊大件/缺口诊断算法。
```

