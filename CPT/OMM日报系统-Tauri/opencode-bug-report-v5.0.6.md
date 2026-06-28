# opencode 处理 v5.0.6 时出现的问题与交接说明

> 编写时间：2026-06-29
> 当前状态：代码已修改，但未完成验证。因 opencode 自身重复执行同一无效命令，用户要求停止并转交。

---

## 1. 本轮目标

基于 `OMM日报系统-v5.0.6-预览决策与整形CNC补充需求.md` 实现：

1. 数据严重不足时的预览决策提示。
2. 整形 CNC 特殊耗时规则（`max(30, 数量×5)` 分钟）。
3. 预览中显示耗时来源。
4. 保持现有 v5.0.5 修复不变。

---

## 2. 已完成修改

### 2.1 后端：sidecar/generate_report.py

- 新增 `_is_zhengxing_cnc(folder_name)` 函数（约第 143 行），判断文件夹名同时包含「整形」和「CNC」。
- 预处理 records 时标记 `_is_zhengxing_cnc`（约第 931 行）。
- 修改 `natural_tpps` 计算，排除整形 CNC。
- 修改 `make_durations(scale, ...)`：
  - 现在返回 `(durations, duration_sources)` 两个列表。
  - 优先级：真实手量 > 特殊大件 > 整形 CNC > 普通 CNC > 普通 TPP。
- 修改 `try_schedule(...)` 增加 `duration_sources` 参数，并在 segment 中写入 `duration_source`。
- 新增 `compute_detailed_stats(segs)` 函数，分类统计：
  - regular_effective
  - real_manual_effective
  - special_effective
  - zhengxing_cnc_effective
  - cnc_effective
  - hand_filler_minutes
  - other_filler_minutes
  - hidden_buffer_total
- `_schedule_meta` 中增加上述详细统计字段。
- `preview()` 函数增加 `decision` 对象，包含：
  - level: ok | shortage | severe | extreme
  - need_minutes
  - 各类时长贡献
  - 目标/实际下班时间
  - options：如实填写 / 补充真实手量 / 补充其他事务/补时间手量
- preview rows 增加 `source` 字段表示耗时来源。
- 新增 `format_minutes(minutes)` 辅助函数。

### 2.2 前端类型：src/types/record.ts

- `PreviewRow` 增加 `source?: string`。
- `PreviewSummary` 增加以下可选字段：
  - regular_effective, real_manual_effective, special_effective
  - zhengxing_cnc_effective, cnc_effective
  - hand_filler_minutes, other_filler_minutes
  - need_minutes, shortage_level
  - decision 对象

### 2.3 前端 UI：src/components/PreviewDialog.tsx

- 增加 `sourceLabel()` 和 `shortageClass()` 辅助函数。
- Summary 区域新增「缺口诊断」卡片，显示：
  - 标题与消息（数据严重不足 / 数据不足 / 有效时长不足 / 时长充足）
  - 各类时长贡献
  - 可选处理方式
- 预览表格增加「来源」列，兼容旧数据（无 source 时显示空）。

---

## 3. 已通过的检查

- `npx tsc --noEmit`：通过。
- `python sidecar\build_sidecar.py`：成功。
- `npm run tauri build`：成功，产出 `OMM日报系统_5.0.4_x64-setup.exe`。

---

## 4. 未完成的验证

### 4.1 验证失败/卡住的地方

opencode 在尝试用打包后的 sidecar exe 验证时，反复执行了同一无效命令：

```powershell
.\src-tauri\binaries\generate_report-x86_64-pc-windows-msvc.exe --input test-output\manual_preview_cmd.jsonl --output test-output\v506_manual_preview_result.json 2> test-output\v506_manual_preview_err.txt
```

该 exe 实际**不支持** `--input`/`--output` 参数，它只从 stdin 读取 JSONL 行。因此命令无输出、未生成结果文件，但 opencode 未察觉并持续重试，浪费了大量 token。

**已确认正确的调用方式（cmd 管道）应为：**

```cmd
cd /d D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri
type test-output\manual_preview_cmd.jsonl | src-tauri\binaries\generate_report-x86_64-pc-windows-msvc.exe > test-output\v506_manual_preview_result.json 2>test-output\v506_manual_preview_err.txt
```

### 4.2 尚未验证的项目

- [ ] 普通 CNC 仍为 30 分钟。
- [ ] 整形+CNC，6PCS 为 30 分钟。
- [ ] 整形+CNC，8PCS 为 40 分钟。
- [ ] 特殊大件规则优先于整形 CNC。
- [ ] 数据不足时预览显示缺口诊断（need_minutes >= 60 / >= 180）。
- [ ] 真实手量跨休息续行仍正确。
- [ ] 只有真实手量也能生成。
- [ ] 便携版模板能从 resources/template.xlsx 找到。
- [ ] 便携版打包 `scripts/package-portable.ps1` 后验证。

---

## 5. 已知风险 / 可能需要修正的地方

1. **决策提示未联动前端按钮**
   - 当前 `PreviewDialog` 只是显示 options 文本，没有实际按钮让用户选择「如实填写 / 补充真实手量 / 补充其他事务」。
   - 需求只要求「预览中显示选择」，未要求按钮交互，但如果用户希望可点击，需要再改。

2. **整形 CNC 与 station='CNC' 的关系**
   - 当前 `parse_folder_name` 优先识别 `station='CNC'`，整形语义通过 `_is_zhengxing_cnc` 标记保留。
   - 如果业务上希望 station 显示为「整形CNC」而不是「CNC」，需要额外处理 Excel 写入和 preview 类型显示。

3. **`format_minutes` 函数位置**
   - 放在模块顶部，可能被其他导入引用，但当前仅用于 preview/decision 消息。

4. ** shortage_level 阈值硬编码 **
   - 60 分钟和 180 分钟是硬编码的，需求暂未要求可配置。

5. **尚未确认 sidecar 打包后是否包含最新修改**
   - build_sidecar.py 已成功，但未用正确方式调用验证。

---

## 6. 建议下一个 AI 接手后的步骤

1. 用 **cmd 管道** 或 **Python 直接 import** 的方式验证，不要再使用 `--input`/`--output` 参数。
2. 先跑 Python 直接验证：

```python
import json, sys
sys.path.insert(0, r'D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\sidecar')
from generate_report import preview

# 构造测试 payload，包含普通 CNC、整形+CNC 6PCS、整形+CNC 8PCS、特殊大件等
result = preview(...)
print(json.dumps(result, ensure_ascii=False, indent=2))
```

3. 确认 preview 的 `summary.decision` 和 `rows[].source` 字段符合预期。
4. 再用 cmd 管道验证打包后的 exe：

```cmd
cd /d D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri
type test-output\manual_preview_cmd.jsonl | src-tauri\binaries\generate_report-x86_64-pc-windows-msvc.exe > test-output\v506_manual_preview_result.json 2>test-output\v506_manual_preview_err.txt
```

5. 运行 `scripts/package-portable.ps1` 打包便携版并验证。
6. 按用户要求的格式输出最终交接文档：已实现内容、修改文件、验证命令与输出、发现的问题、仍存在的风险、需要用户确认的问题。

---

## 7. 相关文件路径

- 需求：`D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\OMM日报系统-v5.0.6-预览决策与整形CNC补充需求.md`
- 后端：`D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\sidecar\generate_report.py`
- 前端类型：`D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\src\types\record.ts`
- 前端预览：`D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\src\components\PreviewDialog.tsx`
- 测试输出目录：`D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output`
