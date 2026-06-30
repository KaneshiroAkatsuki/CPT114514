# OMM日报系统 v5.0.6 最终审查接续问题

> 生成时间：2026-06-29  
> 审查范围：只审查和验证，未修改业务代码

## 1. 结论

v5.0.6 核心修复验证通过，可以继续发布当前 5.0.4 便携版。

~~发现 1 个非阻断预览展示问题：真实手量跨固定休息时，最终 Excel 已正确把续行数量写成 `/`、备注写成 `真实手量续行`；但预览表格中第二段仍显示原数量 `96PCS`，容易让用户误以为数量重复。~~

**已修复**：真实手量跨固定休息时，preview 表格后续段 `qty` 已改为显示 `/`，与 Excel 保持一致。

## 2. 复现方式

使用 sidecar stdin JSONL 调用 `preview`，传入仅真实手量任务：

- 班次：B，下早班
- 真实手量：150 分钟
- 开始排程后跨越夜班固定休息 `23:20-00:20`

验证结果：

```json
[
  {"type": "真实手量", "qty": "96PCS", "source": "real_manual", "start": "22:50", "end": "23:20"},
  {"type": "真实手量", "qty": "96PCS", "source": "real_manual", "start": "00:20", "end": "02:20"}
]
```

而最终 Excel 结果正确：

```text
第 1 段：数量 96PCS，备注 真实手量
续行：数量 /，备注 真实手量续行
```

## 3. 建议最小修复

只改 `sidecar/generate_report.py` 的 `preview()` 行生成逻辑：

1. 参考 `generate_report()` 中 `manual_task_id` 的续行判断。
2. 对 `manual_kind == 'real'` 的预览行：
   - 第一段保持原数量。
   - 后续段 `qty` 显示 `/`。
   - 如不新增备注列，可以把 `type` 保持 `真实手量`；如果后续要更清楚，可新增预览备注字段或把类型显示为 `真实手量续行`。

不要动 Excel 写入逻辑，当前 Excel 已验证正确。

### 3.1 给后续 AI 的精确落点

- Excel 写入续行判断位置：`sidecar/generate_report.py` 约 1489-1542 行，变量名为 `is_real_manual_continuation`。
- 预览行生成位置：`sidecar/generate_report.py` 约 1777-1796 行，目前真实手量 `qty` 直接取 `seg.get('quantity', '/')`。
- 最小做法：在 `preview()` 的 `rows = []` 循环前维护一个 `seen_manual_ids = set()` 或 `dict`；当 `manual_kind == 'real'` 时用 `manual_task_id` 判断是否为后续段，后续段预览 `qty` 写 `/`。
- 如果选择把 `type` 显示成 `真实手量续行`，需要同步检查前端 `PreviewDialog.tsx` 的蓝色高亮条件；当前只判断 `row.type === '真实手量'`。更稳妥的第一版是只改 `qty`，`type` 仍保留 `真实手量`。

### 3.2 修复验证（已完成）

已按最小修复完成：

- 修改位置：`sidecar/generate_report.py` 中 `preview()` 函数（约第 1757-1804 行）。
- 修改内容：在 rows 循环前维护 `seen_real_manual_ids` 集合，当 `manual_kind == 'real'` 且该 `manual_task_id` 已出现过时，将预览 `qty` 设为 `/`。
- 未改动 Excel 写入逻辑（`generate_report()` 中已正确处理续行）。

验证结果：

```json
// preview
[
  {"type": "真实手量", "qty": "96PCS", "source": "real_manual", "start": "00:50", "end": "03:10"},
  {"type": "真实手量", "qty": "/",     "source": "real_manual", "start": "03:20", "end": "03:30"}
]

// Excel
第 1 段：品名 565，数量 96PCS，备注 真实手量
续行：  品名 565，数量 /，   备注 真实手量续行
```

- `npx.cmd tsc --noEmit`：通过。
- `python sidecar\build_sidecar.py`：成功。

### 3.3 Git 注意事项

当前 Git 根目录是 `D:\KSoftware\KMAA`。审查时 `git -C D:\KSoftware\KMAA status --short -- CPT/OMM日报系统-Tauri` 显示：

```text
?? CPT/OMM日报系统-Tauri/
```

也就是说整个 Tauri 项目目录在该 Git 根下仍是未跟踪状态。后续如需提交，不要使用 `git add .`，只精确 add 本次修改文件，例如：

```powershell
git -C D:\KSoftware\KMAA add -- "CPT/OMM日报系统-Tauri/sidecar/generate_report.py" "CPT/OMM日报系统-Tauri/OMM日报系统-v5.0.6-最终审查接续问题.md"
```

## 4. 已验证通过项摘要

- GUI 预览数据结构包含 `summary.decision`，TypeScript 类型和渲染路径可兼容，不会因 decision 字段缺失/新增崩溃。
- 缺口诊断按 `total_effective - hidden_buffer_total` 计算可见有效时长。
- 普通 CNC 6PCS：普通 CNC 贡献 30 分钟。
- 整形 CNC 6PCS：整形 CNC 贡献 30 分钟。
- 整形 CNC 8PCS：整形 CNC 贡献 40 分钟。
- 特殊大件优先于整形 CNC：`035` 按 10 分钟/件、8PCS 时特殊大件贡献 80 分钟，整形 CNC 贡献 0。
- 预览工作行 `source` 分别返回 `cnc`、`zhengxing_cnc`、`special`、`real_manual`，GUI 映射为普通CNC、整形CNC、特殊大件、真实手量。
- 隐形缓冲未写入最终 Excel。
- 便携版在未设置 `YX_BUNDLED_TEMPLATE` 时可从 `resources/template.xlsx` 找到模板并生成成功。
