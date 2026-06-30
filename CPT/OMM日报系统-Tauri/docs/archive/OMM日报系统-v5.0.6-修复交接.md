# OMM日报系统 v5.0.6 修复交接

> 生成时间：2026-06-29  
> 接手来源：`opencode-bug-report-v5.0.6.md`  
> 当前版本号：已于 2026-06-30 升级为 5.0.7

## 1. 本轮处理内容

opencode 在 v5.0.6 实现中已做了大部分代码修改，但验证阶段反复调用了 sidecar 不支持的 `--input/--output` 参数，导致无效循环。本轮接手后完成了：

- 修复 `preview()` 中 `target_clock_end` / `actual_last_end` 未初始化就使用导致的崩溃。
- 修复 `preview()` 中 `start_offset` 未定义导致的崩溃。
- 调整缺口诊断计算口径：
  - 使用 `可见有效时长 = total_effective - hidden_buffer_total` 计算缺口。
  - 避免少量数据被隐形缓冲补满后误显示“时长充足”。
- 修复真实手量预览行 `source` 可能显示为普通 `tpp` 的问题。
- 重新构建 sidecar。
- 重新构建 Tauri 安装包。
- 重新打包便携版。

## 2. 关键规则确认

### 2.1 整形 CNC

普通 CNC：

```text
30 分钟/包
```

整形 CNC：

```text
如果 folder/folder_name 同时包含“整形”和“CNC”：
耗时 = max(30, quantity × 5) 分钟
```

验证结果：

- 普通 CNC 6PCS：`cnc_effective = 30`
- 整形 CNC 6PCS：`zhengxing_cnc_effective = 30`
- 整形 CNC 8PCS：`zhengxing_cnc_effective = 40`
- 特殊大件匹配 `035 = 10 分钟/件` 时，整形 CNC 8PCS 走特殊大件：`special_effective = 80`，`zhengxing_cnc_effective = 0`

优先级：

```text
真实手量 > 特殊大件 > 整形 CNC > 普通 CNC > 普通 TPP
```

### 2.2 数据不足缺口诊断

缺口诊断现在不再被隐形缓冲掩盖。

示例：普通 CNC 6PCS，下早班目标 450 分钟：

- `total_effective = 470`
- `hidden_buffer_total = 440`
- 可见有效时长 = 30
- `need_minutes = 420`
- `shortage_level = extreme`

预览中应显示“数据严重不足”及可选处理方式。

### 2.3 真实手量

已验证：

- 只有真实手量、没有普通 records 时，preview/generate 可用。
- 真实手量跨固定休息拆分后：
  - 第一行保留数量，如 `96PCS`
  - 续行数量写 `/`
  - 续行备注为 `真实手量续行`
- 预览行 `source = real_manual`

## 3. 修改文件

- `sidecar/generate_report.py`
  - 修复 preview 变量顺序。
  - 缺口诊断改为基于可见有效时长。
  - 修复真实手量 source。

opencode 本轮此前已修改：

- `sidecar/generate_report.py`
  - 整形 CNC 规则。
  - 耗时来源 `duration_source`。
  - 缺口诊断 `decision`。
- `src/types/record.ts`
  - Preview 类型新增 `source` 和 `decision` 字段。
- `src/components/PreviewDialog.tsx`
  - 显示缺口诊断和来源列。

## 4. 验证命令与结果

### 4.1 构建

```powershell
npx.cmd tsc --noEmit
python sidecar\build_sidecar.py
cargo check --release
npm.cmd run tauri build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\package-portable.ps1 -Version 5.0.7
```

结果：

- TypeScript 通过。
- sidecar 构建成功。
- Rust release check 通过。
- Tauri 安装包构建成功：
  - `src-tauri\target\release\bundle\nsis\OMM日报系统_5.0.7_x64-setup.exe`
- 便携版打包成功：
  - `releases\OMM日报系统_便携版_5.0.7`
  - `releases\OMM日报系统_便携版_5.0.7.zip`

最新便携版 manifest hash：

```text
[app] OMM日报系统.exe
sha256=eb702a16633df040f0a032ab6e5e4998a534a35f97336a8ddcb79a496045432d

[sidecar] binaries\generate_report.exe
sha256=39ddecb307f87797d9861f70d570b89b45f2c72c467c82fe1ccde9e997c7acab

[template] resources\template.xlsx
sha256=e96e5eab2f6535ecef77bfd495bdd1893990bde6fcbebb317d9f44d011eac982
```

### 4.2 sidecar exe 验证

使用 `subprocess.run(input=...)` 走 stdin JSONL，不使用无效的 `--input/--output`。

验证结果：

- 普通 CNC 6PCS：
  - `cnc_effective = 30`
  - `need_minutes = 420`
  - `shortage_level = extreme`
- 整形 CNC 6PCS：
  - `zhengxing_cnc_effective = 30`
  - warnings 包含整形 CNC 规则提示
- 整形 CNC 8PCS：
  - `zhengxing_cnc_effective = 40`
  - warnings 包含整形 CNC 规则提示
- 特殊大件优先：
  - `special_effective = 80`
  - `zhengxing_cnc_effective = 0`
- 只有真实手量：
  - preview 成功
  - `hidden_buffer_total = 380`
  - `need_minutes = 360`
  - `shortage_level = extreme`
- 真实手量跨休息生成 Excel：
  - 第一段：数量 `96PCS`，备注 `真实手量`
  - 续行：数量 `/`，备注 `真实手量续行`

### 4.3 便携版模板验证

使用便携版：

```text
releases\OMM日报系统_便携版_5.0.7\OMM日报系统_便携版\binaries\generate_report.exe
```

在不设置 `YX_BUNDLED_TEMPLATE` 的情况下生成成功，说明仍能从：

```text
resources\template.xlsx
```

找到内置模板。

## 5. 发现的问题

### 5.1 预览表格中的隐形缓冲 source 为空

`rows[].source` 目前主要用于工作行。隐形缓冲行的来源列可能为空，但类型列已经显示“隐形缓冲”，不影响理解。

如需更完整，可以后续给休息/隐形缓冲行也补 `source`。

### 5.2 缺口诊断目前只是文本选项

预览中显示：

- 如实填写
- 补充真实手量
- 补充其他事务 / 补时间手量

但这些目前只是文字说明，不是可点击按钮。当前符合“预览显示选择”的需求；如果用户要交互式按钮，需要后续继续做。

### 5.3 版本号已升级

项目已于 2026-06-30 统一升级为 `5.0.7`，发布物也改为 5.0.7 命名。

## 6. 仍存在的风险

- `settingsOverride` 仍不持久化，关闭程序后单日设置丢失。
- 整形 CNC 识别依赖原始文件夹名同时包含“整形”和“CNC”；如果命名不含其中一个词，不会命中。
- 数据不足时虽然能提示缺口，但“如实填写/补手量/补其他事务”还没有一键交互。
- 当前 Git 仓库根目录在 `D:\KSoftware\KMAA`，大量项目和日期数据都是未跟踪状态，不能直接 `git add .`，提交必须精确指定文件。

## 7. 下一轮建议

如果继续开发，建议优先：

1. 给预览缺口诊断增加实际按钮：
   - 如实生成
   - 打开手量补录
   - 打开单日设置启用补时间
2. 在预览表格里给隐形缓冲、休息行也补充 `source`，保持列语义完整。
3. 准备 `.gitignore`，排除 `test-output`、`releases`、构建产物和日期测试数据，避免误提交。

## 附：后续 UI 改进与最新构建（2026-06-29 接续）

在 v5.0.6 修复交接后，继续完成了以下 UI/UX 改进：

- PreviewDialog 缺口诊断增加三个操作按钮：
  - `仍按此结果生成`：仅生成当前预览的日期项。
  - `打开手量补录`：打开对应日期的真实手量弹窗。
  - `打开单日设置`：打开新增的单日设置弹窗。
- 新增 `DaySettingsDialog`：支持覆盖下班策略、补时间手量开关、补其他事务开关。
- PreviewDialog 来源列补充 `break`、`supplement_manual`、`supplement_other` 的 pill 显示。
- 修复 `MainWindow` 配置目录按钮 JSX 结构错误，`buildConfigPatch` 类型修正为 `Config`。
- 新增 `.gitignore`。

重新验证结果：

- `npx.cmd tsc --noEmit`：通过
- `cargo check --release`：通过（1 个未使用函数警告）
- `npm.cmd run tauri build`：成功
- `scripts/package-portable.ps1 -Version 5.0.4`：成功

最新便携版 manifest hash（`packaged_at=2026-06-29T05:46:42`）：

```text
[app] OMM日报系统.exe
sha256=ed605fdfb2f4c344e0f3ce06c6d9e94473db6b46656c6b3b16128d4f2dfcecd0

[sidecar] binaries\generate_report.exe
sha256=39ddecb307f87797d9861f70d570b89b45f2c72c467c82fe1ccde9e997c7acab

[template] resources\template.xlsx
sha256=e96e5eab2f6535ecef77bfd495bdd1893990bde6fcbebb317d9f44d011eac982
```

## 附：前端流程缺陷修复（2026-06-29 再次接续）

继续按 opencode-handoff-v5.0.6.md 9.4 节完成 A-E 修复：

- **A. ReviewDialog “跳过此包” 真的跳过**：`handleReviewConfirm` / `handleReviewSkip` 统一过滤 `skippedFolders` 后再生成；过滤后为空则给出可读失败。
- **B. ReviewDialog “确认并继续” 字段校验**：数量与测量时间至少填一个合法正值，缺失字段继续提示，不合法时弹窗底部显示红字错误。
- **C. ManualTaskDialog “保存并预览” 使用最新手量**：`onPreview` 改为接收 `tasks`，`MainWindow` 用最新 tasks 构造临时 item 立即预览。
- **D. 批量生成暂停状态与未处理日期**：扩展 `GenerateResult`，手量未确认/字段不完整时状态为 `paused`，列出当前及后续未处理日期，失败计数不再 +1。
- **E. 预览/生成前统一校验数字设置**：`validateGlobalSettings()` 校验 `tpp_min/tpp_max/pkg_rest/hand_max/other_max/outputDir`，不合法不调用 sidecar。

重新验证结果：

- `npx.cmd tsc --noEmit`：通过
- `cargo check --release`：通过（无 warning）
- `npm.cmd run tauri build`：成功
- `scripts/package-portable.ps1 -Version 5.0.4`：成功

最新便携版 manifest hash（`packaged_at=2026-06-29T23:26:21`）：

```text
[app] OMM日报系统.exe
sha256=d274c985dfbbd29bb19c6ffde05f82c26d0bb6f2736255cfca219f3ae86e5e1d

[sidecar] binaries\generate_report.exe
sha256=39ddecb307f87797d9861f70d570b89b45f2c72c467c82fe1ccde9e997c7acab

[template] resources\template.xlsx
sha256=e96e5eab2f6535ecef77bfd495bdd1893990bde6fcbebb317d9f44d011eac982
```

## 附：手量文件夹识别规则细化（v5.0.7，2026-06-30）

按 gpt 复核要求，对手量文件夹自动识别做最小必要修正：

- **品名识别**：优先识别文件夹开头的数字/料号段；排除 `CMM`、`OMM`、`PCS`、`ST`、`MO`、`T0`、`T1`、`IQC`、`OQC` 等关键词；不再把 `CMM-郑安午` 当作品名。
- **工站识别**：`RealManualTask` 新增 `station` 字段；第二段识别为工站（如 `开发`、`CNC` 等）；弹窗增加“工站”输入框。
- **送测人识别**：新增支持 `姓名送测` 格式（如 `安容克送测`），仍保留 `-送测-姓名`、`-ST-姓名`。
- **测量员识别**：继续只从 `-手量-姓名` 识别；`CMM/OMM` 后面的人名不再误放入品名。
- **测试日期默认值**：手量弹窗的测试日期默认使用队列日期（从 `6.13A` 解析），解析失败则用当天日期；UI 文案改为“测试日期”。
- **字段精简**：手量弹窗只保留工站、品名、送测人、测试日期、数量、耗时、测量员；送测项目固定 `OMM`。
- **真实手量 station 写入 Excel**：`generate_report.py` 中真实手量行 station 优先使用任务自带 `station`，未提供时默认 `'手量'`。
- **帮助文档同步**：命名规则章节增加手量文件夹命名说明。

版本号升级到 **5.0.7**。

重新验证结果：

- `npx.cmd tsc --noEmit`：通过
- `cargo check --release`：通过（无 warning）
- `npm.cmd run tauri build`：成功
- `scripts/package-portable.ps1 -Version 5.0.7`：成功

最新便携版 manifest hash（`packaged_at=2026-06-30T01:30:29`）：

```text
[app] OMM日报系统.exe
sha256=ee7540b213706839d2d0bf245b4ff1e8388dc5e131fe3c824b1c0cd35d6c1b01

[sidecar] binaries\generate_report.exe
sha256=39ddecb307f87797d9861f70d570b89b45f2c72c467c82fe1ccde9e997c7acab

[template] resources\template.xlsx
sha256=e96e5eab2f6535ecef77bfd495bdd1893990bde6fcbebb317d9f44d011eac982
```

## 附：版本升级与 releases 清理（2026-06-30）

用户确认需要收束版本号后，已将项目正式升级为 `5.0.7`：

- `package.json` / `package-lock.json`
- `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock`
- `src-tauri/tauri.conf.json`
- `src/components/HelpCenterDialog.tsx`

重新验证结果：

- `npx.cmd tsc --noEmit`：通过
- `cargo check --release`：通过
- `npm.cmd run tauri build`：成功（仅 Vite chunk size 警告）
- `scripts/package-portable.ps1 -Version 5.0.7`：成功

当前发布物：

```text
src-tauri\target\release\bundle\nsis\OMM日报系统_5.0.7_x64-setup.exe
releases\OMM日报系统_便携版_5.0.7
releases\OMM日报系统_便携版_5.0.7.zip
```

`releases` 已清理旧 alpha/v5.0.1-v5.0.4 残留，仅保留 5.0.7 便携版目录与 zip。

最新便携版 manifest hash（`packaged_at=2026-06-30T00:54:52`）：

```text
[app] OMM日报系统.exe
sha256=eb702a16633df040f0a032ab6e5e4998a534a35f97336a8ddcb79a496045432d

[sidecar] binaries\generate_report.exe
sha256=39ddecb307f87797d9861f70d570b89b45f2c72c467c82fe1ccde9e997c7acab

[template] resources\template.xlsx
sha256=e96e5eab2f6535ecef77bfd495bdd1893990bde6fcbebb317d9f44d011eac982
```
