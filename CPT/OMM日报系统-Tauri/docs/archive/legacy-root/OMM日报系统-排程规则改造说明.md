# OMM日报系统排程规则改造说明

最后整理：2026-06-28

本文档用于明天继续改造 OMM日报系统排程逻辑。请基于当前项目继续，不要重开思路，不要大规模重构。

## 1. 改造目标

当前程序已有路径、模板、便携版等 P0/P1 修复。下一步重点是改造排程规则，让报表时间更符合真实班次。

核心目标：

- 支持“下班策略”：智能判断 / 强制下早班 / 强制不下早班。
- 正确处理 A/B 班固定休息时间。
- 报表最低有效工作时间不包含固定休息。
- 最后一项结束时间尽量控制在目标下班前 10-15 分钟。
- 允许插入不写入 Excel 的隐形缓冲时间，用于自然填满时间。
- 每件最低耗时不得低于 2.5 分钟。
- 任务过多时给出明确 warning，提示拆包到下一天。

## 2. 现有问题

当前 `sidecar/generate_report.py` 中：

- `early_leave` 是 boolean，只能“下早班/不下早班”。
- `MIN_WORK = 660`、`EARLY_MIN = 540` 是旧逻辑，不符合新规则。
- A 班午休时间写错：旧代码是 `11:10-12:40`，实际应为 `11:40-12:40`。
- B 班夜间吃饭时间写错：旧代码是 `23:00-00:00`，实际应为 `23:20-00:20`。
- `pkg_rest` 当前会写入 Excel 作为休息行，不适合作为“隐形缓冲”。
- 当前达标判断使用总跨度 `total_shift`，会把固定休息算进去；新规则要求最低有效时间不包含固定休息。

## 3. 正确班次与休息时间

代码中班次开始时间：

```python
A班 start_offset = 480   # 08:00
B班 start_offset = 1200  # 20:00
```

### A班正常班固定休息

实际时间：

```text
10:00-10:10
11:40-12:40
15:10-15:20
17:00-17:40
```

相对班次开始分钟：

```python
[(120, 130), (220, 280), (430, 440), (540, 580)]
```

合计 120 分钟。

### B班正常班固定休息

实际时间：

```text
22:00-22:10
23:20-00:20
03:10-03:20
05:40-06:20
```

相对班次开始分钟：

```python
[(120, 130), (200, 260), (430, 440), (580, 620)]
```

合计 120 分钟。

### 下早班固定休息

下早班只经过前三段休息，不经过最后 40 分钟休息。

A班下早班：

```python
[(120, 130), (220, 280), (430, 440)]
```

B班下早班：

```python
[(120, 130), (200, 260), (430, 440)]
```

## 4. 下班策略

把现在的 `early_leave: boolean` 升级为 `leave_strategy`。

可选值：

```text
auto    智能判断，可以下早班也可以不下早班
early   强制下早班
normal  强制不下早班
```

为了兼容旧代码：

- 如果前端仍传 `early_leave=true`，等价于 `leave_strategy="early"`。
- 如果前端仍传 `early_leave=false` 且没有 `leave_strategy`，可先等价于 `leave_strategy="normal"`，后续 UI 默认值再决定是否改成 `auto`。

建议 UI 从 checkbox：

```text
[ ] 下早班
```

改为单选或下拉：

```text
下班策略：
○ 智能判断
○ 下早班
○ 不下早班
```

## 5. 下班时间与最低有效工作时间

### 强制下早班

目标下班时间：

```text
A班：17:20
B班：05:20
```

有效工作最低：

```text
7.5小时 = 450分钟
```

含义：

- 实际工作 8 小时，不包括固定休息。
- 报表最低有效时间是 7.5 小时。
- 允许 30 分钟冗余。
- 最后一项结束时间尽量落在下班前 10-15 分钟，即：
  - A班：17:05-17:10 左右
  - B班：05:05-05:10 左右

### 强制不下早班

目标下班时间：

```text
A班：20:00
B班：08:00
```

有效工作最低：

```text
9.5小时 = 570分钟
```

含义：

- 实际工作 10 小时，不包括固定休息。
- 报表最低有效时间是 9.5 小时。
- 允许 30 分钟冗余。
- 最后一项结束时间尽量落在下班前 10-15 分钟，即：
  - A班：19:45-19:50 左右
  - B班：07:45-07:50 左右

### 智能判断

智能判断先尝试下早班：

- 如果任务量能合理满足下早班规则，就采用下早班。
- 如果下早班会超时或明显不合理，再尝试正常班。
- 如果正常班也不合理，返回 warning。

建议返回解释：

```text
系统判断：下早班。原因：任务量适合下早班。
系统判断：正常班。原因：下早班会超过目标下班时间，已按正常班排程。
```

## 6. 有效时长定义

新规则中，不要用旧的 `total_shift` 直接判断达标。

有效时长应包含：

- 真实测量工作段
- 手量
- 其他事务
- `hidden_buffer` / 隐形缓冲

有效时长不包含：

- 固定休息 `rest`
- 不应算作工作时长的显示休息

建议新增 summary 字段：

```text
total_effective       有效时长
required_effective    450 或 570
total_rest            固定休息时长
hidden_buffer_total   隐形缓冲总时长
meets_required        是否满足最低有效时长
target_clock_end      目标下班时间
actual_last_end       实际最后结束时间
finish_delta_minutes  距离目标下班还差多少分钟
```

## 7. 隐形缓冲 hidden_buffer

允许在小包之间插入 `hidden_buffer`。

规则：

- 每次最多 10 分钟。
- 不是每包都必须插入，按需分配。
- 计入有效工作时间。
- 用于把最后结束时间自然推近目标下班前 10-15 分钟。
- 不写入最终 Excel 报表。
- 可以在预览中显示，方便用户理解。

建议内部结构：

```python
{
    "type": "hidden_buffer",
    "start": cur,
    "end": cur + duration,
    "hidden": True,
    "note": "隐形缓冲"
}
```

`generate_report()` 必须跳过：

```python
if task.get("hidden") or task.get("type") == "hidden_buffer":
    continue
```

`preview()` 可以显示为：

```text
隐形缓冲
```

并在 summary 中统计 `hidden_buffer_total`。

## 8. 每件耗时下限

每件最低耗时不得低于 2.5 分钟。

规则：

- 如果用户设置 `tpp_min < 2.5`，自动提升为 2.5。
- 返回 `sched_warnings`：

```text
每件最低耗时不能低于 2.5 分钟，已自动按 2.5 分钟计算。
```

- 算法压缩任务时，也不能低于 2.5 分钟/件。

## 9. 任务过多时的处理

如果任务太多：

- 可以适当压缩每件耗时。
- 但不能低于 2.5 分钟/件。
- 如果压缩到 2.5 后仍超过目标下班时间，返回明确 warning：

```text
任务量过多，即使按每件 2.5 分钟压缩仍会超过目标结束时间，建议将部分包移到下一天，或手动删除/省略部分包后重新生成。
```

不要强行生成明显不合理的时间。

## 10. 建议实现路径

优先修改：

- `sidecar/generate_report.py`
  - `SHIFTS`
  - `schedule_tasks()`
  - `preview()`
  - `generate_report()`
- `src/types/record.ts`
- `src/components/PreviewDialog.tsx`
- 如有必要，再改 `src/components/MainWindow.tsx` 的 warning 展示和下班策略 UI。

不要改：

- 模板路径逻辑
- 便携版路径查找
- 更新模板 / 重置为内置逻辑
- 打包脚本
- 无关 UI 大重构

## 11. 验收要求

必须验证：

1. A班正常班 breaks 合计 120 分钟。
2. B班正常班 breaks 合计 120 分钟。
3. A/B 下早班只包含前三段固定休息。
4. 强制下早班：`total_effective >= 450`，固定 rest 不计入 effective。
5. 强制不下早班：`total_effective >= 570`，固定 rest 不计入 effective。
6. 智能判断能根据任务量选择 early 或 normal。
7. hidden_buffer 每段 `<= 10` 分钟。
8. hidden_buffer 不出现在最终 Excel。
9. tpp 不低于 2.5。
10. 任务过多时有明确 warning。
11. 原有模板、便携版、更新模板、重置为内置功能不要改坏。

测试数据目录：

```text
C:\Users\Administrator\Desktop\勿动\日期文件
```

约束：

- 不要移动、删除、重命名原始测试数据。
- 测试输出放到：

```text
D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output
```

## 12. 每个日期条目的单独设置

新增需求：支持队列中每个日期条目单独覆盖生成设置。

### 背景

当前界面上的下班策略、手量、其他事务、每件时间等设置是全局设置。队列中如果有多天，例如：

```text
6.25B
6.26B
6.27B
```

它们会共用同一套设置。

但真实情况可能是：

- 6.25B 正常班
- 6.26B 下早班
- 6.27B 有手量
- 6.28B 有其他事务

因此需要支持“全局设置作为默认值，每个日期条目可以单独覆盖部分设置”。

### 设计原则

1. 全局设置继续保留，作为默认值。
2. 队列中的每个日期条目可以单独覆盖部分设置。
3. 如果某个条目没有单独设置，就使用全局默认值。
4. 单独设置只影响该条目，不影响其他日期。
5. 不要大重构，优先复用现有队列和右键菜单。

### 建议数据结构

在 `QueueItem` 中新增覆盖设置字段：

```ts
settings_override?: Partial<GenerateSettings>
```

或者更显式：

```ts
per_item_settings?: {
  leave_strategy?: "auto" | "early" | "normal";
  enable_hand?: boolean;
  enable_other?: boolean;
  pkg_rest?: number;
  tpp_min?: number;
  tpp_max?: number;
  hand_max?: number;
  other_max?: number;
  special_items?: SpecialItem[];
}
```

生成时合并：

```ts
const finalSettings = {
  ...globalSettings,
  ...queueItem.settings_override,
};
```

重点字段：

- `leave_strategy`：智能判断 / 下早班 / 不下早班
- `enable_hand`：该日期是否有手量
- `enable_other`：该日期是否有其他事务
- `pkg_rest` 或后续 hidden buffer 相关设置
- `tpp_min` / `tpp_max`
- `hand_max` / `other_max`
- `special_items` 如有必要也可覆盖

### UI 建议

优先扩展现有队列右键菜单，而不是大改界面。

右键日期条目可增加：

```text
下班策略
- 跟随全局
- 智能判断
- 下早班
- 不下早班

手量
- 跟随全局
- 开启
- 关闭

其他事务
- 跟随全局
- 开启
- 关闭

清除单独设置
```

队列条目上显示覆盖标签，例如：

```text
[跟随全局]
[智能]
[下早班]
[正常班]
[手量]
[其他事务]
[自定义设置]
```

如果没有覆盖，显示“跟随全局”或不显示特殊标签。

### 预览和生成要求

1. 预览某个日期时，必须使用该日期自己的最终 settings。
2. 批量生成队列时，每个 `QueueItem` 都用自己的最终 settings。
3. 生成日志应说明每一天采用了什么策略，例如：

```text
6.26B：下早班，手量=开，其他事务=关
6.27B：正常班，手量=关，其他事务=开
```

### 兼容要求

1. 旧队列数据没有 `settings_override` 时不报错。
2. 不影响模板路径、便携版、更新模板、重置为内置。
3. 不影响现有审核模式右键菜单；可以在同一个右键菜单中扩展。
4. 不要为了这个需求重构整个状态管理。

## 13. 给接力 AI 的提示词

```text
请阅读项目根目录的《OMM日报系统-排程规则改造说明.md》，基于该文档继续改造排程逻辑。

当前任务只做排程规则改造，不要动模板路径、便携版路径查找、更新模板、重置为内置、打包脚本。

重点实现：
1. 修正 A/B 班 breaks 和 early_breaks。
2. 把 early_leave boolean 升级/兼容为 leave_strategy: auto | early | normal。
3. 有效时长不包含固定 rest。
4. 强制下早班 required_effective=450，目标下班 A=17:20/B=05:20。
5. 强制不下早班 required_effective=570，目标下班 A=20:00/B=08:00。
6. 智能判断先试 early，不合理再试 normal。
7. hidden_buffer 每段最多 10 分钟，计入有效时长，但不写入 Excel。
8. 每件耗时最低 2.5 分钟。
9. 任务过多时 warning 建议拆包到下一天。
10. 预览 summary 显示 total_effective、required_effective、hidden_buffer_total、target_clock_end、actual_last_end。
11. 支持队列中每个日期条目的单独设置覆盖：
    - 全局设置作为默认值。
    - 每个 QueueItem 可设置 settings_override 或 per_item_settings。
    - 支持单独覆盖 leave_strategy、enable_hand、enable_other、tpp_min/tpp_max、pkg_rest、hand_max/other_max 等。
    - 预览和生成时使用 finalSettings = globalSettings + item override。
    - UI 优先扩展现有队列右键菜单，不要大重构。
    - 队列条目显示覆盖标签，如 [下早班] [正常班] [手量] [其他事务] [自定义设置]。

最终交接必须包含：
- 修改文件
- 新排程算法说明
- A/B 班休息时间验证
- early/normal/auto 三种策略测试结果
- hidden_buffer 不写入 Excel 的验证结果
- 每个日期条目单独设置覆盖的验证结果
- 任务过多 warning 测试结果
- 未完成风险
```
