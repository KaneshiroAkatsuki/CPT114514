# OMM日报系统 v5.0.5 手量补录与按天设置 实现交接

> 生成时间：2026-06-28  
> 主导 AI：opencode (k2p7)  
> 基于需求：《OMM日报系统-v5.0.5-手量与按天设置需求.md》  
> 当前版本：v5.0.4（源码、安装包、便携版 manifest 已统一为 5.0.4；暂作为测试版）
> 审查反馈处理：已修复 P1/P2 问题（只有真实手量也能生成/预览、跨休息后续行不重复数量、生成前强制校验字段完整性）

---

## 1. 已实现内容

### P0/P1：手量耗时解析、数据结构、校验、补录窗口

1. **手量耗时解析函数** `src/lib/utils.ts::parseManualDuration(input)`
   - 支持格式：`1.5H`、`1.5h`、`1小时30分钟`、`1小时`、`90分钟`、`1:30`、`01:30`、纯数字（默认分钟）
   - 返回分钟数，解析失败返回 `null`

2. **真实手量记录类型** `src/types/record.ts::RealManualTask`
   - 字段：id、product（品名）、sender（送测人）、work_order、mold、machine、test_type、send_project、send_date、send_time、quantity、duration_minutes、operator、note、from_recognition

3. **字段校验函数** `src/lib/utils.ts::validateRealManualTask(task)`
   - 必填校验：品名、送测人、送测日期、测试数量、测试耗时、测量员
   - 合理性校验：耗时 < 5 分钟提示不合理，耗时 > 180 分钟提示超过 3 小时

4. **文件夹名识别函数** `src/lib/utils.ts::recognizeManualTaskFromFolder(folderName)`
   - 强特征：`-手量-姓名`
   - 识别：测量员、品名（手量前一段）、数量（`xPCS`）、日期（`M月D日` / `M.D`）
   - 不涉及 `-OMM-姓名` 的误判
   - 返回部分字段，必须经用户确认补录

5. **手量任务管理/补录弹窗** `src/components/ManualTaskDialog.tsx`
   - 左侧：粘贴文件夹名识别区 + 识别日志
   - 右侧：手量记录表格，可 inline 编辑品名、送测人、日期、数量、耗时、测量员
   - 底部：添加记录、删除记录、保存到当前日期、保存并预览、取消
   - 未补齐字段高亮（表格行琥珀色背景）

6. **队列项单独保存**
   - 右键菜单新增「手量任务管理 / 补录」
   - 保存到 `item.settingsOverride.real_manual_tasks`
   - `MainWindow.tsx::buildItemSettings()` 合并全局设置与覆盖项时，自动把 `real_manual_tasks` 传入 preview/generate

### P2/P3：后端排程接入与 Excel 写入

7. **sidecar 接收 `real_manual_tasks`**
   - `sidecar/sidecar_main.py` 的 `generate` 和 `preview` 命令读取 `settings.real_manual_tasks`
   - `sidecar/generate_report.py::schedule_tasks()` 新增 `real_manual_tasks` 参数

8. **真实手量参与排程**
   - 真实手量被规范化为 `station='手量'`、`note='真实手量'`、`manual_kind='real'`、`_dur=duration_minutes`
   - 拼接到 records 末尾，作为独立任务参与排程
   - 真实手量不触发 `pkg_rest` 包间休息
   - 有效时长计入 `total_effective`

9. **真实手量写入 Excel**
   - `generate_report()` 中真实手量行写入完整字段：工站、品名、送测人、工单号、模号、机台号、检测类型、送测项目、送测日期、送测时间、测试数量、测试日期、开始/结束时间、测量员、备注
   - 补时间手量（`manual_kind != 'real'`）仍保持旧逻辑：大部分字段填 `/`

10. **预览显示真实手量**
    - `preview()` 返回的 rows 中，真实手量行 `type` 为 `"真实手量"`
    - `PreviewDialog.tsx` 中真实手量行以蓝色加粗显示

---

## 2. 修改文件清单

| 文件路径 | 主要改动 |
|---|---|
| `src/types/record.ts` | 新增 `RealManualTask` 类型；`GenerateSettings` 和 `QueueItemSettingsOverride` 增加 `real_manual_tasks`；`RealManualTask` 增加临时 `durationInput` 字段 |
| `src/lib/utils.ts` | 新增 `parseManualDuration`、`validateRealManualTask`、`recognizeManualTaskFromFolder` |
| `src/lib/utils.test.ts` | 新增前端解析/校验/识别单元测试（可选，可删除） |
| `src/components/ui/dialog.tsx` | 新增轻量 Dialog 组件（用于手量弹窗） |
| `src/components/ManualTaskDialog.tsx` | 新增手量任务管理/补录弹窗 |
| `src/components/MainWindow.tsx` | 右键菜单新增「手量任务管理 / 补录」；集成 `ManualTaskDialog`；`buildItemSettings` 透传 `real_manual_tasks`；新增 `handlePreviewForItem`；`generateWithRecords` 生成前强制校验真实手量字段完整并 warning 超 180 分钟 |
| `src/components/PreviewDialog.tsx` | 真实手量行蓝色加粗显示 |
| `sidecar/generate_report.py` | `schedule_tasks()` 支持 `real_manual_tasks`；真实手量参与排程；`generate_report()` 区分真实手量与补时间手量；`preview()` 显示 `真实手量` 类型；修复 `preview()` 多传 `operator_name` 给 `schedule_tasks()` 的 bug；修复只有真实手量时生成/预览失败；修复跨休息真实手量续行重复数量 |
| `sidecar/sidecar_main.py` | `generate`/`preview` 命令读取并传递 `real_manual_tasks` |
| `src/components/MainWindow.tsx` | 右键菜单新增「手量任务管理 / 补录」；集成 `ManualTaskDialog`；`buildItemSettings` 透传 `real_manual_tasks`；新增 `handlePreviewForItem`；`generateWithRecords` 生成前强制校验真实手量字段完整并 warning 超 180 分钟 |
| `src/lib/utils.ts` | 新增 `parseManualDuration`、`validateRealManualTask`、`recognizeManualTaskFromFolder` |
| `package.json` / `src-tauri/Cargo.toml` / `src-tauri/tauri.conf.json` | 版本号统一为 5.0.4 |

---

## 3. 验证结果

### 3.1 前端解析测试

命令：

```bash
cd D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri
npx tsx src\lib\utils.test.ts
```

输出（关键项）：

```text
OK "1.5H" -> 90
OK "1.5h" -> 90
OK "1小时30分钟" -> 90
OK "1小时" -> 60
OK "90分钟" -> 90
OK "1:30" -> 90
OK "01:30" -> 90
OK "90" -> 90
```

### 3.2 真实数据生成测试

命令：

```powershell
cd releases\OMM日报系统_便携版_5.0.4\OMM日报系统_便携版
$env:YX_BUNDLED_TEMPLATE="$PWD\resources\template.xlsx"
Get-Content -Encoding UTF8 D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output\manual_generate_cmd.jsonl | .\binaries\generate_report.exe
```

输出：

```text
报表已生成: D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output\generated\滁州量测室总体日报汇总表-OMM-禹欣-6.12B.xlsx
共填入 12 行数据
{"success": true, "data": {"output_path": "...", "warnings": [], "sched_warnings": []}, "error": null}
```

Excel 检查结果（第 14 行）：

```python
14 ['手量', '565', '安睿克', '/', '/', '/', '测试尺寸', 'OMM', '6月12日', '/', '96PCS', datetime.datetime(2026, 6, 12, 0, 0), datetime.time(6, 29), datetime.time(7, 59), '...', '已完成', '卫阳', '真实手量']
```

### 3.3 预览测试

命令：

```powershell
cd releases\OMM日报系统_便携版_5.0.4\OMM日报系统_便携版
$env:YX_BUNDLED_TEMPLATE="$PWD\resources\template.xlsx"
Get-Content -Encoding UTF8 D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output\manual_preview_cmd.jsonl | .\binaries\generate_report.exe > D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output\manual_preview_portable_result.json
```

`rows` 最后一行：

```json
{"seq": 12, "product": "565", "qty": "96PCS", "start": "06:29", "end": "07:59", "tpp": "—", "type": "真实手量"}
```

### 3.4 构建检查

- `npx tsc --noEmit`：通过
- `python sidecar\build_sidecar.py`：成功
- `npm run tauri build`：成功，产出 `OMM日报系统_5.0.4_x64-setup.exe`
- `scripts/package-portable.ps1`：成功，产出 `releases\OMM日报系统_便携版_5.0.4`

### 3.5 审查反馈验证

1. **只有真实手量时 preview/generate 不失败**
   - 验证命令（cmd）：
     ```cmd
     cd /d D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri
     type test-output\manual_only_preview_cmd_utf8.jsonl | src-tauri\binaries\generate_report-x86_64-pc-windows-msvc.exe > test-output\manual_only_preview_result2.json 2>test-output\manual_only_preview_err2.txt
     ```
   - 结果：`success=true`，`rows` 包含 55 行（全为隐形缓冲），最后结束于 07:50。

2. **跨固定休息真实手量后续行数量不重复**
   - 使用 `manual_preview_cmd.jsonl` 验证，`rows` 最后一行真实手量：`{"seq": 12, "product": "565", "qty": "96PCS", ...}`，仅一行，无续行重复。

3. **生成前字段完整性校验**
   - 代码位置：`src/components/MainWindow.tsx::generateWithRecords` 第 653-666 行
   - 行为：任意真实手量缺少品名/送测人/送测日期/测试数量/测试耗时/测量员时，阻止生成并记录日志。

4. **PowerShell 验证命令修正**
   - 交接文档中所有 `binaries\generate_report.exe < file.jsonl` 已改为 `Get-Content -Encoding UTF8 file.jsonl | .\binaries\generate_report.exe`，避免中文路径/stdin 编码问题。

---

## 4. 发现的问题

1. **真实手量任务被追加到 records 末尾，不会分散到班次中间**
   - 当前实现把所有真实手量放在普通任务之后。如果班次中间有休息时间，真实手量会统一排在最后。
   - 如果业务需要真实手量像普通任务一样穿插在班次中间，需要调整 `try_schedule` 中任务合并逻辑。

2. **真实手量任务跨越固定休息时会被拆分**
   - `build_segments` 会按固定休息拆分任何任务。当前测试未触发（真实手量恰好在休息之后），但如果真实手量很长且跨越休息，会出现多段。
   - 这是与正常任务一致的逻辑，但是否符合手量业务需要确认。

3. **`durationInput` 临时字段会随 `real_manual_tasks` 传给 sidecar**
   - `durationInput` 仅用于前端编辑，但 TypeScript 类型中它是 `RealManualTask` 的一部分，会一起 JSON 序列化传给 sidecar。
   - sidecar 目前只读取 `duration_minutes`，忽略 `durationInput`，不影响功能。若希望干净，可在保存前删除 `durationInput`。

4. **右键菜单较长**
   - 增加「手量任务管理 / 补录」后，队列项右键菜单项较多，小屏幕上可能超出可视区域。

---

## 5. 仍存在的风险

1. **单独设置不持久化**：`settingsOverride.real_manual_tasks` 仅在当前程序运行期间有效，关闭后丢失。符合当前需求，但用户若需要保存需后续做「本批次配置导入/导出」。
2. **文件夹识别准确率有限**：目前只稳定识别 `-手量-姓名` 强特征，复杂命名（如 `-OMM-王业陈`）不会误判为手量，但也可能漏识别。需用户人工补录。
3. **补时间手量与真实手量共存时的显示**：如果同时存在 `enable_hand` 补时间手量和 `real_manual_tasks` 真实手量，Excel 中两类都会显示，真实手量有完整字段，补时间手量字段为 `/`。用户需理解区别。
4. **大数量真实手量时的排程**：如果一天绑定很多条真实手量，总时长可能超过目标下班时间，会触发 `sched_warnings`。
5. **预览中真实手量行的 TPP 显示为 `—`**：因为真实手量不是按件计算，所以 TPP 列显示横杠，符合业务。

---

## 6. 需要用户确认的问题

1. **真实手量是否允许被固定休息拆分？**
   - 当前与正常任务一致，跨越休息则拆分。
   - 如果要求手量必须连续，需要修改 `build_segments` 对 `manual_kind='real'` 的任务特殊处理。
   - **用户确认**：是的，固定休息必须不工作。真实手量跨越休息时拆分是正确行为。

2. **真实手量是否应该穿插在普通任务中间，而不是统一排在最后？**
   - 当前统一排在普通任务之后。
   - 如果业务上手量可能在班次中间进行，需要调整插入位置算法。
   - **用户确认**：随机均可。当前统一排在最后可接受。

3. **是否需要在生成前强制校验真实手量字段完整？**
   - 当前预览会提示未补齐，但生成时不会阻止。
   - 如果要求生成前必须完整，否则阻止或二次确认，需要在 `generateWithRecords` 中增加校验逻辑。
   - **用户确认**：不知道是什么意思，暂不改动。

4. **`durationInput` 是否要在保存时清理？**
   - 当前会传给 sidecar 但 sidecar 忽略，功能正常。
   - 若要数据更干净，可在 `onSave` 时 map 删除 `durationInput`。
   - **用户确认**：不知道是什么意思，暂不改动。

5. **右键菜单是否需要折叠/分组？**
   - 当前菜单项较多，是否需要改成「单日设置」子菜单？
   - **用户确认**：不知道是什么意思，暂不改动。

---

## 7. 验收命令参考

### 7.1 前端解析函数

```bash
cd D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri
npx tsx src\lib\utils.test.ts
```

### 7.2 便携版预览带真实手量

```powershell
cd releases\OMM日报系统_便携版_5.0.4\OMM日报系统_便携版
$env:YX_BUNDLED_TEMPLATE="$PWD\resources\template.xlsx"
Get-Content -Encoding UTF8 D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output\manual_preview_cmd.jsonl | .\binaries\generate_report.exe > D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output\manual_preview_portable_result.json
```

### 7.3 便携版生成带真实手量

```powershell
cd releases\OMM日报系统_便携版_5.0.4\OMM日报系统_便携版
$env:YX_BUNDLED_TEMPLATE="$PWD\resources\template.xlsx"
Get-Content -Encoding UTF8 D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output\manual_generate_cmd.jsonl | .\binaries\generate_report.exe
```

### 7.4 检查 Excel

```python
import openpyxl
wb = openpyxl.load_workbook(r'D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output\generated\滁州量测室总体日报汇总表-OMM-禹欣-6.12B.xlsx')
ws = wb.active
for r in range(3, 15):
    print(r, [ws.cell(row=r, column=c).value for c in range(1, 19)])
```
