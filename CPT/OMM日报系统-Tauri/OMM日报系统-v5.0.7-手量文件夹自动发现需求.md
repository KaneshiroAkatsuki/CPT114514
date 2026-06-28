# OMM日报系统 v5.0.7 需求：手量文件夹自动发现与确认

> 编写时间：2026-06-29  
> 状态：接续开发需求  
> 核心原则：自动发现、自动预填、人工确认；不要让手量文件夹被普通任务重复排程。

## 1. 背景

当前真实手量需要用户在队列项右键菜单中打开“手量任务管理 / 补录”，再粘贴手量文件夹名进行识别。

如果用户已经把手量文件夹放进日期文件夹内，当前扫描逻辑可能会把它当普通任务解析，导致：

- 被识别成普通任务并参与 TPP 排程。
- 触发普通字段审核弹窗。
- 用户再补录真实手量时，可能出现普通任务 + 真实手量重复计算。

因此需要在用户添加日期文件夹到队列时，就自动扫描日期目录内是否存在手量文件夹，并在 UI 中提示。

## 2. 目标行为

当用户选择工作目录、添加日期文件夹、批量添加、拖拽添加、粘贴路径添加时：

1. 程序扫描该日期文件夹的直接子文件夹。
2. 如果子文件夹名包含强手量特征，则记录为“待确认真实手量”。
3. 队列项显示 badge，例如：

```text
[手量待确认×2]
```

4. 这些手量文件夹不应作为普通任务参与 `parseFolders` / preview / generate。
5. 用户打开“手量任务管理 / 补录”时，系统自动把这些待确认手量文件夹预填为真实手量记录。
6. 用户确认字段完整后，真实手量按现有 `real_manual_tasks` 流程参与 preview/generate。

一句话：

```text
自动发现手量文件夹，但真实耗时必须确认后才参与生成。
```

## 3. 手量文件夹识别规则

第一版只做简单强规则，避免误判：

- 文件夹名包含 `手量`。
- 最好继续兼容已有强特征：`-手量-姓名`。

不要把普通 OMM/CNC/整形/CMM 文件夹误判为手量。

## 4. 自动预填字段

打开手量弹窗时，对发现的手量文件夹调用/复用：

```ts
recognizeManualTaskFromFolder(folderName)
```

可以增强该函数，让它识别明确耗时格式。

### 4.1 可以自动识别为耗时的格式

仅识别明确表达“耗时/用时/手量时长”的格式：

```text
90分钟
90分
1.5H
1.5h
1小时30分钟
耗时90
耗时90分钟
用时90
用时90分钟
手量90分钟
手量1.5H
```

### 4.2 谨慎识别 `1:30`

`1:30` 本身可能是送测时间，也可能是耗时。建议第一版仅在附近有关键词时识别为耗时，例如：

```text
耗时1:30
用时1:30
手量1:30
```

不要把单独出现的 `21:50` / `22:30` 当作耗时。

### 4.3 不应误识别为耗时

```text
6.30B       # 日期/班次
21:50       # 送测时间
22点30      # 送测时间
96PCS       # 数量
```

如果耗时不明确，就留空，让用户填写。

## 5. UI 需求

### 5.1 队列项 badge

在待生成队列中，如果该日期发现未确认手量文件夹：

```text
[手量待确认×N]
```

如果用户已保存真实手量记录，可以显示：

```text
[真实手量×N]
```

如果实现成本低，也可以同时显示两类：

```text
[手量待确认×2] [真实手量×1]
```

### 5.2 手量弹窗提示

打开“手量任务管理 / 补录”时，如果有自动发现的手量文件夹，在弹窗顶部显示：

```text
已从日期文件夹发现 2 个手量文件夹，请确认耗时后保存。
```

自动识别出耗时的记录可以在行内或日志中提示：

```text
耗时已自动识别，仍需确认。
```

### 5.3 生成前阻止条件

如果存在“手量待确认×N”，且用户还没有保存为完整真实手量记录：

- preview 可以允许打开，但必须醒目提示有手量待确认。
- generate 建议阻止，提示用户先确认手量。

第一版如果担心影响旧流程，可以只在 generate 前阻止。

## 6. 技术建议

### 6.1 类型扩展

可在 `QueueItem` 中增加字段：

```ts
manualCandidates?: ManualFolderCandidate[];
```

新增类型：

```ts
interface ManualFolderCandidate {
  folderName: string;
  fullPath: string;
  recognized?: Partial<RealManualTask>;
}
```

### 6.2 发现时机

在这些入口添加日期文件夹时调用扫描：

- `addPathToQueue`
- `handleAddToQueue`
- `handleSelectAllToQueue`
- 拖拽添加
- 粘贴路径添加

为了避免重复写逻辑，建议封装：

```ts
async function buildQueueItemFromPath(path: string): Promise<QueueItem>
```

但不要大规模重构。若重构风险高，可以先加一个小函数：

```ts
async function detectManualCandidates(dateFolderPath: string): Promise<ManualFolderCandidate[]>
```

### 6.3 文件夹读取方式

优先复用现有 Tauri 文件/目录能力。如果当前前端只有 `listDateFolders`，可以考虑新增一个只列直接子文件夹的命令，或复用 sidecar 的 parse 前扫描。

注意：

- 不要递归扫描日期目录深层。
- 只扫直接子文件夹。
- 不要写入原始日期目录。

### 6.4 过滤普通任务

在 preview/generate 前，调用 `parseFolders` 得到 records 后，应过滤掉这些手量候选对应的普通 records，避免重复排程。

建议按 `record.folder` 与 `manualCandidates.folderName` 匹配过滤。

## 7. 验收用例

1. 日期文件夹内有两个手量文件夹：
   - 添加到队列后显示 `[手量待确认×2]`。
2. 打开“手量任务管理 / 补录”：
   - 自动出现两条真实手量记录。
3. 文件夹名包含 `耗时90分钟`：
   - 自动预填 `duration_minutes = 90`。
4. 文件夹名只包含 `21:50`：
   - 不应误填 `duration_minutes = 1310`。
5. 文件夹名包含 `96PCS`：
   - 识别数量为 `96PCS`，不识别为耗时。
6. 未确认手量时直接生成：
   - 应阻止或至少明确警告。
7. 确认真实手量后生成：
   - 手量按 `real_manual_tasks` 写入 Excel。
   - 手量文件夹不再作为普通任务重复写入。
8. 普通 OMM/CNC/整形CNC/特殊大件不受影响。

## 8. 验证命令

```powershell
npx.cmd tsc --noEmit
npm.cmd run tauri build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\package-portable.ps1 -Version 5.0.4
```

如果改动 Rust/Tauri 文件命令：

```powershell
cargo check --release
```

## 9. 禁止事项

- 不要改 sidecar 排程核心逻辑。
- 不要改 CNC、整形 CNC、特殊大件、隐形缓冲、缺口诊断规则。
- 不要移动、删除、重命名 `C:\Users\Administrator\Desktop\勿动\日期文件`。
- 测试输出只能放到 `D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output`。
- 不要写回原始测试数据目录。
- 不要升级版本号，仍保持 `5.0.4`。
- 不要 `git add .`。

