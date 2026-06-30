# OMM日报系统 v5.0.3 修复交接文档

> 生成时间：2026-06-28  
> 修复范围：P0 便携版发布不可用问题 + P1 路径与配置稳定性问题 + 排程算法/隐形缓冲/目标时长规则 + leave_strategy 与队列项单独设置覆盖  
> 主导 AI：opencode (k2p7)  
> 当前版本：v5.0.4（源码、安装包、便携版 manifest 均已统一为 5.0.4；但暂不做正式发布，仅作为测试版）

---

## 1. 背景与目标

原 `releases\\OMM日报系统_便携版_v5.0.1` 中的 `binaries\\generate_report.exe` 是旧版本（2026-06-16），不支持当前源码中的 `get_template_info` 等模板命令，导致便携版提示"找不到模板"但实际模板存在。

本次修复分三批：

1. **P0/P1（v5.0.2）**：重新打包 sidecar、同步到所有位置、增强生产模式 sidecar 查找路径、新增便携版打包脚本、修复配置目录实时同步与字段丢失、移除默认工作目录硬编码。
2. **排程算法（v5.0.3）**：实现新业务规则——正常班目标跨度 570 分钟、下早班 450 分钟；在自然任务不足时插入"隐形包间休息/缓冲"；仍不足时使用手量/其他事务补时；过度超长时返回 `sched_warnings`；隐形缓冲不入 Excel 但可在预览中显示。
3. **leave_strategy 与单独设置覆盖（v5.0.4）**：将全局"下早班"复选框改为下班策略（auto/early/normal），支持队列中每个日期单独覆盖下班策略、手量、其他事务等；sidecar 接收 `leave_strategy`。

---

## 2. 插件/工具自检说明

本次任务执行前已检查以下插件/工具是否可用：

- flowdeck：不可用
- harness-memory：不可用
- opencode-notify：不可用
- @bgerona/opencode-shell-non-interacti：不可用

因此全部使用普通 shell（PowerShell/bash）和文件操作完成，未调用上述插件。

---

## 3. 修改文件清单

### 3.1 源码修改

| 文件路径 | 主要改动 |
|---|---|
| `sidecar/build_sidecar.py` | PyInstaller 构建完成后，自动复制 `generate_report.exe` 为 `generate_report-x86_64-pc-windows-msvc.exe`，避免 Tauri externalBin 目标文件遗漏。 |
| `src-tauri/src/sidecar.rs` | `find_sidecar_path()` 增加 `resource_dir` 参数；生产模式按顺序查找多个候选路径；失败时返回所有尝试过的路径。 |
| `src-tauri/src/lib.rs` | `AppState` 新增 `resource_dir` 和 `Mutex<AppConfig>`；setup 阶段写入 `resource_dir` 与当前配置目录；注册 `sync_config_state` 命令。 |
| `src-tauri/src/commands/sidecar.rs` | `collect_sidecar_envs()` 与 `get_template_paths()` 改为根据当前 `AppConfig.effective_config_dir()` 实时计算用户模板目录。 |
| `src-tauri/src/commands/config.rs` | `migrate_config` 增加 `State<'_, AppState>`，迁移成功后同步更新内存状态；新增 `sync_config_state` 命令。 |
| `src/hooks/useSidecar.ts` | `useConfigManager` 新增 `syncConfigState()`；`migrateConfig()` 改为显式传入完整配置对象。 |
| `src/types/record.ts` | 新增 `GenerateSettings.leave_strategy`、`QueueItemSettingsOverride`、`QueueItem.settingsOverride`；`PreviewSummary` 增加 `total_effective`、`required_effective`、`hidden_buffer_total`、`target_clock_end`、`actual_last_end`、`finish_delta_minutes`。 |
| `src/hooks/useSidecar.ts` | 预览/生成函数支持传入 `leave_strategy`。 |
| `src/components/MainWindow.tsx` | 全局"下早班"改为"下班策略"单选组（auto/early/normal）；新增队列项单独设置覆盖机制与右键菜单；预览/生成时合并全局设置与 `item.settingsOverride`。 |
| `src/components/PreviewDialog.tsx` | summary 区域显示新的统计字段（总有效时长、隐形缓冲、目标下班时间、实际结束时间、结束差值）。 |
| `src/components/MainWindow.tsx` | 默认工作目录改为空字符串；新增 `buildConfigPatch()` 统一配置保存；加载/迁移配置后同步 Rust 状态；生成完成对话框新增醒目的排程警告块。 |
| `src/components/PreviewDialog.tsx` | "隐形缓冲"行使用琥珀色斜体样式，便于与真实任务区分。 |
| `sidecar/generate_report.py` | **v5.0.3/v5.0.4 核心改动**：新增目标时长常量；`schedule_tasks()` 改为以自然 tpp 为基准，新增隐形缓冲阶段；`generate_report()` 跳过 hidden segment；`preview()` 显示"隐形缓冲"行；v5.0.4 支持 `leave_strategy='auto'|'early'|'normal'`，每段 hidden_buffer 不超过 10 分钟。 |
| `sidecar/sidecar_main.py` | `generate` 与 `preview` 命令解析并传递 `leave_strategy`，兼容旧 `early_leave`。 |
| `scripts/package-portable.ps1` | **新增** 便携版打包脚本，自动复制主程序、sidecar、模板，生成 zip 与 `manifest.json`。 |

### 3.2 二进制/发布产物更新

- `src-tauri\binaries\generate_report.exe`（2026-06-28 构建）
- `src-tauri\binaries\generate_report-x86_64-pc-windows-msvc.exe`（同上）
- `releases\OMM日报系统_便携版_v5.0.1\OMM日报系统_便携版\binaries\generate_report.exe`（同上）
- 新增完整便携版：`releases\OMM日报系统_便携版_v5.0.4\OMM日报系统_便携版\`（含 `OMM日报系统.exe`、`binaries\generate_report.exe`、`resources\template.xlsx`）
- 新增 zip：`releases\OMM日报系统_便携版_v5.0.4.zip`
- 新增清单：`releases\OMM日报系统_便携版_v5.0.4\manifest.json`
- 安装包：`src-tauri\target\release\bundle\nsis\OMM日报系统_5.0.0-alpha_x64-setup.exe`

---

## 4. v5.0.3/v5.0.4 排程算法与下班策略改动

### 4.1 `schedule_tasks()` 新逻辑说明

当前实现以 **scale=1.0（自然 tpp）** 排程，不再为了填满班次而全局放大 tpp。当自然任务不足时，优先插入 `hidden_buffer`；仍不足则插入手量/其他事务；自然任务超长则返回 warning。

4. **隐形缓冲阶段**：若 `cur < ideal_min_end`，计算 `gap` 并将其分散为若干段 `hidden_buffer`：
   - 插入位置：真实任务之间（含最后一项之后）
   - 不要求每包都有
   - 每段限制不超过 10 分钟
   - segment 标记 `hidden=True`，不入 Excel
   - 当 `gap` 较大而真实任务很少时，会生成较多短段

5. **下班策略 `leave_strategy`**：
   - `'early'`：按早班休息表排程，目标 450 分钟
   - `'normal'`：按正常班休息表排程，目标 570 分钟
   - `'auto'`：先尝试早班；若自然任务已超过早班目标则回退到正常班

6. **手量/其他事务补时**：若经过隐形缓冲后仍不足 `target_work`，按现有逻辑插入"手量"/"其他事务"填充。

7. **不达标警告**：若手量/其他事务也补不满，写入 `sched_warnings`。

8. **目标与统计字段（preview summary）**：
   - `required_effective`：目标有效时长（570 或 450）
   - `total_effective`：实际有效时长（工作 + hidden_buffer）
   - `hidden_buffer_total`：隐形缓冲总时长
   - `target_clock_end`：目标下班时刻（自班次起分钟数）
   - `actual_last_end`：实际最后一项结束时刻
   - `finish_delta_minutes`：实际结束与目标结束的差值（正为延后）

### 4.2 正常班/下早班/自动策略测试输出

#### 正常班（合成数据 8 个 CNC 任务，B 班）

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_shift": 570,
      "min_work": 570,
      "meets_min": true
    },
    "schedule_warnings": [],
    "rows": [
      ...,
      { "seq": 21, "start": "03:20", "end": "05:30", "type": "隐形缓冲" }
    ]
  }
}
```

最后一项结束时间：`05:30`（B 班 20:00 + 570 分钟）。

#### 下早班（同一合成数据，`leave_strategy='early'`）

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_shift": 450,
      "min_work": 450,
      "meets_min": true
    },
    "schedule_warnings": [],
    "rows": [
      ...,
      { "seq": 21, "start": "03:20", "end": "03:30", "type": "隐形缓冲" }
    ]
  }
}
```

最后一项结束时间：`03:30`（B 班 early 20:00 + 450 分钟）。

#### 自动策略（任务量较少时，`leave_strategy='auto'`）

当真实任务自然时长 ≤ 450 分钟时，`auto` 会按 `early` 排程（目标 450）；
当真实任务自然时长 ＞ 450 分钟但 ≤ 570 分钟时，`auto` 会回退到 `normal`（目标 570）。

示例（3 个 OMM 任务，B 班，natural_tpp 约 5 分钟/件）：

```text
shift='B' strategy='auto': eff=149 分钟, hidden=401 分钟, total_shift=670 分钟
策略选择：normal（因为自然任务已超 450 分钟目标）
```

#### 真实测试数据 6.27B（任务过多，超长）

```json
{
  "success": true,
  "data": {
    "sched_warnings": [
      "真实任务总时长(922分钟)已超过目标下班时间(570分钟)，请减少任务量或调低每件时间"
    ]
  }
}
```

报表仍成功生成：`test-output/generated/滁州量测室总体日报汇总表-OMM-禹欣-6.27B.xlsx`。

### 4.3 生成 Excel 的路径

- 合成正常班测试输出：
  - `test-output/generated/滁州量测室总体日报汇总表-OMM-禹欣-6.30B.xlsx`
- 真实数据测试输出：
  - `test-output/generated/滁州量测室总体日报汇总表-OMM-禹欣-6.27B.xlsx`

### 4.4 隐形休息是否写入 Excel 的验证结果

**未写入。**

以合成正常班 6.30B 为例：
- sidecar 输出"共填入 21 行数据"（含 10 行隐形缓冲）
- Excel 实际只有 11 行可见数据（8 行工作 + 3 行休息），无"隐形缓冲"行
- 隐形缓冲仅用于拉长总跨度，不进入最终报表

验证命令（Python）：

```python
import openpyxl
wb = openpyxl.load_workbook('test-output/generated/滁州量测室总体日报汇总表-OMM-禹欣-6.30B.xlsx')
ws = wb.active
for r in range(3, 15):
    print(r, ws.cell(row=r, column=8).value, ws.cell(row=r, column=18).value)
```

输出显示：第 3~12 行为可见数据（OMM 工作或休息），第 13 行起为空，无"隐形缓冲"文本。

### 4.5 单独日期设置覆盖（v5.0.4 新增）

### 4.5.1 前端覆盖字段

在 `src/types/record.ts` 中定义 `QueueItemSettingsOverride`：

```typescript
export interface QueueItemSettingsOverride {
  leave_strategy?: 'auto' | 'early' | 'normal';
  enable_hand?: boolean;
  enable_other?: boolean;
  tpp_min?: number;
  tpp_max?: number;
  pkg_rest?: number;
  hand_max?: number;
  other_max?: number;
  special_items?: SpecialItem[];
}
```

每个 `QueueItem` 可带 `settingsOverride?: QueueItemSettingsOverride`。未覆盖字段沿用全局设置。

### 4.5.2 右键菜单操作

在队列区域右键点击某一项，可：
- 设置下班策略：智能判断 / 下早班 / 不下早班 / 恢复默认
- 切换手量覆盖（开/关）
- 切换其他事务覆盖（开/关）
- 清除所有单独设置

### 4.5.3 合并规则

在 `MainWindow.tsx` 的 `buildItemSettings(item)` 中：

```typescript
const base = buildGlobalSettings();
const ov = item.settingsOverride || {};
return {
  ...base,
  ...ov,
  shift_override: item.shiftOverride || item.shift || shiftDefault,
  early_leave: (ov.leave_strategy ?? leaveStrategy) === 'early',
  leave_strategy: ov.leave_strategy ?? leaveStrategy,
};
```

即：`settingsOverride` 浅合并到全局设置上，`shift_override` 优先级最高（item.shiftOverride > item.shift > shiftDefault），`early_leave` 与 `leave_strategy` 保持一致。

### 4.5.4 仍存在风险（单独覆盖）

1. **当前只暴露了最常用的覆盖项**：下班策略、手量、其他事务。若业务需要覆盖 `pkg_rest`、`tpp_min/max`、`special_items` 等，目前只能通过右键菜单的代码继续扩展。
2. **覆盖标签较多时队列项可能换行**：当一条队列项同时有 `[A班]`、`[方案A:弹窗]`、`[下早班]`、`[手量:开]` 等标签时，标签区域可能挤占文件路径显示空间。后续可考虑把标签换行或折叠。
3. **单独设置不持久化**：队列项的 `settingsOverride` 仅在当前程序生命周期有效，关闭后丢失。若用户需要保存多天默认策略，需后续把覆盖项写入配置。

1. **当前只暴露了最常用的覆盖项**：下班策略、手量、其他事务。若业务需要覆盖 `pkg_rest`、`tpp_min/max`、`special_items` 等，目前只能通过右键菜单的代码继续扩展。
2. **覆盖标签较多时队列项可能换行**：当一条队列项同时有 `[A班]`、`[方案A:弹窗]`、`[下早班]`、`[手量:开]` 等标签时，标签区域可能挤占文件路径显示空间。后续可考虑把标签换行或折叠。
3. **单独设置不持久化**：队列项的 `settingsOverride` 仅在当前程序生命周期有效，关闭后丢失。若用户需要保存多天默认策略，需后续把覆盖项写入配置。

---

## 4.6 仍存在风险

1. **小数据量/极少任务时缓冲可能跨越休息导致超长**：当真实任务总时长远小于目标（如只有 60 分钟工作），分散插入的缓冲会跨越多个法定休息，最终跨度可能超过 `target_end`。当前实现会返回 `sched_warnings` 提示用户，但生成的 Excel 仍会较长。
2. **正常班 A 班（08:00 开始）目标结束 17:30 正好落在法定休息 17:00~17:40 区间内**：若任务排程使结束点落在该休息附近，最后一项真实任务可能被迫提前到 17:00 前结束，或推后到 17:40 后。"理想结束窗口"的实现受班次休息表限制。
3. **手量/其他事务触发频率下降**：由于隐形缓冲优先，且缓冲段跨越休息时会"吸收"额外时间，很多原本会触发手量/其他事务的场景现在被缓冲填满。这符合新规则，但需要人工确认业务上是否可接受。
4. **预览中隐形缓冲行较多时表格较长**：建议后续给 PreviewDialog 增加折叠/筛选功能。
5. **`leave_strategy='auto'` 的回退阈值固定为 450 分钟**：当前 auto 策略仅在自然任务超过 450 分钟目标时才回退 normal。如果业务希望更复杂的判断（例如根据剩余 gap 动态选择），需要进一步调整。

---

## 5. 验证结果汇总

### 5.1 构建检查

- `cargo check --release`：通过
- `npx tsc --noEmit`：通过
- `npm run tauri-build`：成功，产出 `src-tauri\target\release\app.exe` 和 NSIS 安装包
- `python sidecar\build_sidecar.py`：成功，sidecar 同步到 `src-tauri\binaries\generate_report.exe` 和 `generate_report-x86_64-pc-windows-msvc.exe`
- `scripts/package-portable.ps1 -Version 'v5.0.4'`：成功，生成 `releases\OMM日报系统_便携版_v5.0.4`
- 安装包：`src-tauri\target\release\bundle\nsis\OMM日报系统_5.0.0-alpha_x64-setup.exe`

### 5.2 便携版 sidecar 验收

```powershell
cd releases\OMM日报系统_便携版_v5.0.4\OMM日报系统_便携版
$env:YX_BUNDLED_TEMPLATE="$PWD\resources\template.xlsx"
'{"command":"get_template_info"}' | .\binaries\generate_report.exe
```

输出：

```json
{"success": true, "data": {"path": "D:\\KSoftware\\KMAA\\CPT\\OMM日报系统-Tauri\\releases\\OMM日报系统_便携版_v5.0.4\\OMM日报系统_便携版\\resources\\template.xlsx", "exists": true, "source": "bundled"}, "error": null}
```

### 5.3 主程序启动

启动 `releases\OMM日报系统_便携版_v5.0.4\OMM日报系统_便携版\OMM日报系统.exe`，进程持续运行 8 秒未退出，未观察到崩溃。

---

## 6. 验收命令参考

### 6.1 预览正常班/下早班/自动策略

```powershell
cd releases\OMM日报系统_便携版_v5.0.4\OMM日报系统_便携版
$env:YX_BUNDLED_TEMPLATE="$PWD\resources\template.xlsx"
$baseDir = 'D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output\synthetic_test2\6.30B'
$settings = @{
    leave_strategy='auto'  # 'auto' | 'early' | 'normal'
    enable_hand=$true; enable_other=$true
    tpp_min=3.0; tpp_max=7.0; pkg_rest=0
    operator_name='禹欣'
    special_items=@(@{name='烧结盘'; minutes=8})
    hand_max=120; other_max=90
}
$json = @{command='preview'; params=@{base_dir=$baseDir; settings=$settings}} | ConvertTo-Json -Compress -Depth 10
$json | .\binaries\generate_report.exe
```

### 6.2 生成报表

```powershell
$parse = @{command='parse_folders'; params=@{base_dir=$baseDir; operator_name='禹欣'}} | ConvertTo-Json -Compress
$parsed = $parse | .\binaries\generate_report.exe | ConvertFrom-Json
$records = $parsed.data.records
$genSettings = @{...; output_dir='D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output\generated'}
$gen = @{command='generate'; params=@{base_dir=$baseDir; records=$records; settings=$genSettings}} | ConvertTo-Json -Compress -Depth 10
$gen | .\binaries\generate_report.exe
```

---

## 7. 交给另一个 AI 的提示词

```text
你是一名审查/接力开发 AI。请基于项目根目录的《OMM日报系统-v5.0.3-修复交接.md》继续工作。

当前任务：
1. 通读交接文档，理解 v5.0.2（P0/P1）、v5.0.3（排程算法/隐形缓冲）和 v5.0.4（leave_strategy / 队列项单独设置覆盖）的修复范围。
2. 重点检查 sidecar/generate_report.py 的 schedule_tasks()：
   - 目标时长 570/450 是否正确
   - leave_strategy='auto'|'early'|'normal' 分支是否正确
   - 隐形缓冲是否只在 cur < ideal_min_end 时插入
   - 隐形缓冲 segment 是否标记 hidden=True，且每段不超过 10 分钟
   - generate_report() 是否跳过 hidden segment
   - preview() 是否正确显示"隐形缓冲"行和新的 summary 字段
3. 重点检查前端 src/components/MainWindow.tsx：
   - 全局下班策略 UI 是否为 auto/early/normal 单选组
   - 队列项右键菜单是否有下班策略、手量、其他事务覆盖
   - buildItemSettings() 是否正确合并全局设置与 settingsOverride
   - preview/generate 是否使用 buildItemSettings(item)
4. 用真实测试数据验证：
   - C:\Users\Administrator\Desktop\勿动\日期文件
   - 复制样本到 D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output
   - 验证 leave_strategy=normal 时 total_shift 是否接近 570
   - 验证 leave_strategy=early 时 total_shift 是否接近 450
   - 验证 leave_strategy=auto 在任务少时选 early、任务多时回退 normal
   - 验证 Excel 中无"隐形缓冲"行
   - 验证任务过多时返回 sched_warnings
5. 启动 GUI（releases\OMM日报系统_便携版_v5.0.4\OMM日报系统.exe），验证：
   - 设置区"下班策略"单选组正常
   - 队列项右键菜单可设置单独下班策略、手量、其他事务
   - 预览对话框中"隐形缓冲"行以琥珀色显示
   - summary 显示总有效时长、隐形缓冲、目标/实际下班时间
   - 生成完成后如果有 sched_warnings，完成对话框中有醒目的黄色警告块
6. 若发现 bug 或风险，定位到具体文件和行号，给出最小改动修复方案，不要大规模重构。
7. 最终回复按以下格式：已检查项、发现的问题、修复内容、验证命令与输出、仍存在的风险。

约束：
- 不要移动、删除、重命名 C:\Users\Administrator\Desktop\勿动\日期文件 中的文件。
- 测试输出放到 D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output。
- 不要写回原始测试数据目录。
- 所有命令必须非交互式。
```

---

## 附录 A：v5.0.2 原始 P0/P1 关键修复点（供参考）

1. **sidecar 版本不一致**：三个关键位置的 `generate_report.exe` 已全部更新，支持 `get_template_info`。
2. **sidecar 查找路径增强**：生产模式同时兼容 `resource_dir()` 和便携版布局。
3. **打包自动化**：新增 `scripts/package-portable.ps1`。
4. **配置目录实时同步**：`migrate_config` 和 `sync_config_state` 同步 Rust `AppState`。
5. **配置字段完整保存**：所有保存入口复用 `buildConfigPatch()`。
6. **默认工作目录去硬编码**：初始值改为空字符串，首次启动弹配置位置选择。
