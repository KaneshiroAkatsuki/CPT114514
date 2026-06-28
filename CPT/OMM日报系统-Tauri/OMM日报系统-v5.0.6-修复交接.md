# OMM日报系统 v5.0.6 修复交接

> 生成时间：2026-06-29  
> 接手来源：`opencode-bug-report-v5.0.6.md`  
> 当前版本号：仍为 5.0.4（未升级版本号）

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
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\package-portable.ps1 -Version 5.0.4
```

结果：

- TypeScript 通过。
- sidecar 构建成功。
- Rust release check 通过。
- Tauri 安装包构建成功：
  - `src-tauri\target\release\bundle\nsis\OMM日报系统_5.0.4_x64-setup.exe`
- 便携版打包成功：
  - `releases\OMM日报系统_便携版_5.0.4`
  - `releases\OMM日报系统_便携版_5.0.4.zip`

最新便携版 manifest hash：

```text
[app] OMM日报系统.exe
sha256=d7c8c4f7b0bd4e36d9c6acba57cfcd20623c0872905d6d46d7a36458213a957b

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
releases\OMM日报系统_便携版_5.0.4\OMM日报系统_便携版\binaries\generate_report.exe
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

### 5.3 版本号未升级

项目仍统一使用 `5.0.4`。本轮按既定策略未升级版本号。

## 6. 仍存在的风险

- `settingsOverride` 仍不持久化，关闭程序后单日设置丢失。
- 整形 CNC 识别依赖原始文件夹名同时包含“整形”和“CNC”；如果命名不含其中一个词，不会命中。
- 数据不足时虽然能提示缺口，但“如实填写/补手量/补其他事务”还没有一键交互。
- 当前 Git 仓库根目录在 `D:\KSoftware\KMAA`，大量项目和日期数据都是未跟踪状态，不能直接 `git add .`。

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
