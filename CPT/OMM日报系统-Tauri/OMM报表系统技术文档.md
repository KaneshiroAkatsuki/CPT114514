# OMM日报系统技术文档

最后整理：2026-06-28

## 1. 项目概况

OMM日报系统是一个 Windows 桌面端报表生成工具，用于从日期班次文件夹中读取 OMM 测量数据，自动排程并生成 Excel 日报汇总表。

当前版本是 v5.0 系列，技术栈如下：

- 前端：React 18 + TypeScript + Vite + Tailwind CSS
- 桌面壳/后端：Tauri 2 + Rust
- 核心业务逻辑：Python sidecar，通过 stdin/stdout 传 JSON 行通信
- Excel 处理：Python `openpyxl`
- Python 打包：PyInstaller onefile
- Windows 打包：Tauri NSIS 安装包，另有人工整理的便携版目录

项目主目录：

```text
D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri
```

## 2. 目录结构

```text
OMM日报系统-Tauri/
├─ src/                         React 前端
│  ├─ components/
│  │  ├─ MainWindow.tsx          主窗口，队列、设置、模板管理、生成按钮
│  │  ├─ ReviewDialog.tsx        审核弹窗
│  │  ├─ PreviewDialog.tsx       预览弹窗
│  │  ├─ ConfigLocationDialog.tsx 配置文件位置弹窗
│  │  └─ SpecialItemsDialog.tsx  特殊大件物品管理
│  ├─ hooks/useSidecar.ts        前端调用 Tauri 命令的封装
│  └─ types/record.ts            前端类型定义
├─ src-tauri/                    Rust/Tauri 工程
│  ├─ src/lib.rs                 Tauri 入口、插件注册、模板路径解析
│  ├─ src/sidecar.rs             sidecar 进程启动和通信
│  ├─ src/commands/sidecar.rs    前端命令到 Python sidecar 的桥接
│  ├─ src/commands/config.rs     配置读写和迁移
│  ├─ src/commands/file.rs       文件夹选择、日期目录扫描、打开目录
│  ├─ resources/template.xlsx    内置 Excel 模板
│  └─ binaries/                  Tauri 打包使用的 sidecar 可执行文件
├─ sidecar/
│  ├─ sidecar_main.py            Python sidecar 命令入口
│  ├─ generate_report.py         核心解析、排程、报表生成逻辑
│  └─ build_sidecar.py           PyInstaller 构建脚本
├─ releases/                     已整理/构建出的安装包和便携版
├─ package.json                  前端/Tauri 命令
├─ src-tauri/tauri.conf.json     Tauri 配置
├─ HANDOVER.md                   旧交接文档
└─ AGENTS.md                     AI 开发提示文档
```

## 3. 程序运行链路

用户操作大致经过以下链路：

1. 前端 `MainWindow.tsx` 维护工作目录、日期队列、生成设置、模板信息。
2. 前端通过 `src/hooks/useSidecar.ts` 调用 Tauri 命令，例如 `sidecar_parse_folders`、`sidecar_generate`、`sidecar_preview`。
3. Rust 层 `src-tauri/src/commands/sidecar.rs` 确保 Python sidecar 已启动，并向 sidecar 写入 JSON 命令。
4. Rust 层 `src-tauri/src/sidecar.rs` 启动 `generate_report.exe` 或开发模式下的 `python sidecar_main.py`，通过 stdin/stdout 与它通信。
5. Python `sidecar/sidecar_main.py` 解析命令，调用 `generate_report.py` 中的函数。
6. `generate_report.py` 扫描数据、排程、复制模板、写入 Excel，最终输出 `.xlsx` 文件。

常用命令：

```powershell
npm run tauri-dev
npm run tauri-build
python sidecar\build_sidecar.py
```

注意：`package.json` 里实际脚本名是 `tauri-dev` 和 `tauri-build`，不是 `tauri dev` 这种直接脚本名。

## 4. 核心模块说明

### 4.1 前端

主要文件：`src/components/MainWindow.tsx`

职责：

- 加载和保存配置
- 选择工作目录、输出目录
- 列出日期文件夹
- 管理待生成队列
- 执行预览、生成、审核流程
- 管理模板：更新模板、重置模板、查看位置、刷新模板状态
- 管理特殊大件物品、手量/其他事务、班次、每件时间等参数

前端调用后端的封装在 `src/hooks/useSidecar.ts`：

- `parseFolders(baseDir, operatorName)`
- `generate(baseDir, records, settings)`
- `preview(baseDir, records, settings)`
- `getTemplateInfo()`
- `replaceTemplate(templatePath)`
- `resetTemplate()`
- `getTemplatePaths()`
- `loadConfig()` / `saveConfig()`

### 4.2 Rust/Tauri 后端

主要文件：

- `src-tauri/src/lib.rs`
- `src-tauri/src/sidecar.rs`
- `src-tauri/src/commands/sidecar.rs`
- `src-tauri/src/commands/config.rs`
- `src-tauri/tauri.conf.json`

Rust 层主要负责：

- 注册 Tauri 命令
- 管理配置路径
- 查找内置模板路径
- 启动 Python sidecar
- 给 sidecar 注入环境变量
- 前端与 Python 之间的 JSON 桥接

关键环境变量：

- `YX_BUNDLED_TEMPLATE`：内置模板绝对路径，由 Rust 注入给 sidecar
- `YX_USER_TEMPLATE_DIR`：用户模板保存目录，由 Rust 注入
- `YX_USER_TEMPLATE`：用户已替换模板的绝对路径
- `YX_WORK_DIR`：当前工作目录，Python 端设置

### 4.3 Python sidecar

主要文件：

- `sidecar/sidecar_main.py`
- `sidecar/generate_report.py`

`sidecar_main.py` 支持的命令：

- `ping`
- `parse_folders`
- `generate`
- `preview`
- `get_template_info`
- `replace_template`
- `reset_template`
- `get_config`
- `save_config`

`generate_report.py` 的关键函数：

- `_find_template(work_dir)`：查找模板
- `refresh_template()`：重新计算模板路径
- `set_work_dir(work_dir)`：切换工作目录并刷新模板路径
- `parse_all_folders(...)`：扫描日期文件夹中的数据
- `schedule_tasks(...)`：排程
- `preview(...)`：生成预览数据
- `generate_report(...)`：复制模板并写入 Excel

## 5. 模板查找机制

模板查找是当前最关键的路径问题。

源码中 `sidecar/generate_report.py` 的 `_find_template(work_dir)` 当前逻辑为：

1. 优先使用 `YX_USER_TEMPLATE` 指向的用户自定义模板。
2. 在工作目录根目录查找候选模板名。
3. 在工作目录的直接子目录查找候选模板名。
4. 在工作目录根目录查找任意文件名包含 `日报汇总表` 的 `.xlsx`。
5. 最后使用 `YX_BUNDLED_TEMPLATE` 指向的内置模板。

内置模板文件：

```text
src-tauri/resources/template.xlsx
```

Tauri 配置中通过 `bundle.resources` 打包：

```json
"resources": [
  "resources/template.xlsx"
]
```

Rust 端 `src-tauri/src/lib.rs` 的 `resolve_bundled_template()` 会尝试这些位置：

1. Tauri `resource_dir()/resources/template.xlsx`
2. Tauri `resource_dir()/template.xlsx`
3. 便携版 exe 同级 `resources/template.xlsx`
4. 便携版 exe 同级 `template.xlsx`
5. 开发模式 `src-tauri/resources/template.xlsx`
6. 当前目录推导出的 `src-tauri/resources/template.xlsx`

用户点击“更新模板”后，模板会复制为：

```text
<用户配置目录>\user_template.xlsx
```

## 6. 配置文件机制

Rust `AppConfig::effective_config_dir()` 当前优先级：

1. 用户显式指定的 `config_dir`
2. `%APPDATA%\OMM日报系统`
3. exe 同级目录

配置文件名：

```text
config.json
```

重要风险：

- 前端 `persistConfig()` 保存配置时没有保存 `config_dir`，可能导致迁移后的配置目录状态不稳定。
- `AppState::new()` 创建时先用空配置，`setup()` 时计算 `user_template_dir`。如果用户后来在前端迁移配置目录，Rust 内存中的 `user_template_dir` 不会自动更新，直到程序重启。

## 7. 构建和发布

推荐构建顺序：

1. 先重新打包 Python sidecar：

```powershell
python sidecar\build_sidecar.py
```

2. 确认生成/更新：

```text
src-tauri\binaries\generate_report.exe
```

3. 为 Tauri externalBin 准备目标三元组命名文件：

```text
src-tauri\binaries\generate_report-x86_64-pc-windows-msvc.exe
```

4. 再执行 Tauri 构建：

```powershell
npm run tauri-build
```

5. 如果要整理便携版，至少应包含：

```text
OMM日报系统.exe
binaries\generate_report.exe
resources\template.xlsx
```

并且 `binaries\generate_report.exe` 必须是最新 sidecar。

## 8. 当前已确认的问题

### P0：便携版 sidecar 是旧版本

现象：

- 便携版提示未找到模板，但目录里实际有 `resources\template.xlsx`。
- 便携版模板管理相关命令不可用或状态不正确。

已验证：

```powershell
$env:YX_BUNDLED_TEMPLATE='...\releases\...\resources\template.xlsx'
'{"command":"get_template_info"}' | releases\...\binaries\generate_report.exe
```

返回：

```json
{"success": false, "data": null, "error": "Unknown command: get_template_info"}
```

说明 release 便携版里的 `binaries\generate_report.exe` 不支持当前源码中的模板命令，是旧 sidecar。

对比时间：

- `sidecar/generate_report.py`：2026-06-22
- `sidecar/sidecar_main.py`：2026-06-22
- `src-tauri/binaries/generate_report.exe`：2026-06-21，支持 `get_template_info`
- `src-tauri/binaries/generate_report-x86_64-pc-windows-msvc.exe`：2026-06-16，旧版本
- `releases/.../binaries/generate_report.exe`：2026-06-16，旧版本

建议修复：

- 重新运行 `python sidecar\build_sidecar.py`
- 将生成的 `src-tauri\binaries\generate_report.exe` 同步复制为：
  - `src-tauri\binaries\generate_report-x86_64-pc-windows-msvc.exe`
  - 便携版 `binaries\generate_report.exe`
- 重新打包 Tauri 安装包和便携版。
- 加一个发布脚本，避免以后人工漏复制。

### P0：便携版构建流程缺少自动化

当前 `tauri.conf.json` 的 `bundle.targets` 只有 `nsis`，便携版目录像是人工从 `target/release` 整理出来的。

风险：

- 主程序、sidecar、模板三者版本容易不一致。
- 现在的便携版正是这种问题：模板是新文件，sidecar 是旧文件。

建议修复：

- 新增 `scripts/package-portable.ps1`，自动：
  - 清理旧便携目录
  - 复制最新 `app.exe` 并重命名为 `OMM日报系统.exe`
  - 复制最新 `src-tauri\binaries\generate_report.exe`
  - 复制 `src-tauri\resources\template.xlsx`
  - 生成 zip
  - 输出文件 hash 和版本清单

### P1：Tauri externalBin 与自定义 sidecar 查找路径不完全一致

`tauri.conf.json` 配置了：

```json
"externalBin": [
  "binaries/generate_report"
]
```

但生产模式 `src-tauri/src/sidecar.rs` 自己查找：

```text
exe同级\binaries\generate_report.exe
```

而 Tauri 侧生成的 capability 中出现的是：

```text
$RESOURCE/generate_report.exe
```

建议修复：

- 不要只查 `exe同级\binaries\generate_report.exe`。
- 生产模式查找顺序建议改为：
  1. `exe_dir\binaries\generate_report.exe`
  2. `resource_dir()\generate_report.exe`
  3. `resource_dir()\binaries\generate_report.exe`
  4. `exe_dir\generate_report.exe`
- 同时在启动失败错误里输出所有尝试过的路径。

### P1：配置目录迁移后模板目录不会实时更新

Rust `AppState` 中 `user_template_dir` 在启动 setup 时确定。前端之后迁移配置目录，不会同步更新这个 state。

影响：

- 用户刚迁移配置目录后，点击“更新模板”，模板可能仍写到旧目录。
- 重启后才可能恢复。

建议修复：

- 在 `migrate_config` 成功后，增加一个 Rust 命令同步更新 `AppState.user_template_dir`。
- 或者让 `collect_sidecar_envs()` 每次都从当前配置实时计算用户模板目录。

### P1：配置保存会丢失部分字段

`MainWindow.tsx` 的 `persistConfig()` 保存了常用字段，但没有保存：

- `config_dir`
- `config_dir_ever_set`

`handleSaveSpecialItems()` 也没有保存 `hand_max`、`other_max`、`config_dir` 等字段。

建议修复：

- 把配置保存统一成一个 `buildConfigPatch()` 或完整 `buildConfig()`。
- 所有保存入口复用同一套字段，避免某个按钮保存时覆盖掉其他配置。

### P1：工作目录默认值是历史硬编码路径

前端初始值：

```text
D:\KSoftwarv\NUAA\OMM日报系统
```

风险：

- 换机器或改路径后，新用户启动会看到不存在的旧路径。
- 如果配置读取失败，会回退到这个旧路径。

建议修复：

- 初始值改为空字符串或用户文档目录。
- 首次启动引导用户选择工作目录。
- 列表扫描前给出清晰错误，而不是假设旧路径存在。

### P2：`generate_report.py` 过大，业务逻辑难维护

当前 `generate_report.py` 约 1300 行，混合了：

- 文件夹解析
- Excel 数量读取
- 业务规则判断
- 排程
- 预览
- Excel 写入
- 模板查找

建议拆分：

```text
sidecar/
├─ template_resolver.py
├─ folder_parser.py
├─ scheduler.py
├─ report_writer.py
├─ preview_builder.py
└─ generate_report.py
```

### P2：缺少自动化回归测试

建议至少增加这些测试：

- Python `_find_template()` 各优先级测试
- `sidecar_main.py` JSON 命令测试
- 便携版目录结构检查测试
- 用一份固定测试数据生成报表，并检查输出文件存在、关键单元格有值
- Tauri/Rust `find_sidecar_path()` 路径查找测试

## 9. 给其他 AI/开发者的优先改动清单

### 第一批，先修发布不可用

1. 重新打包 Python sidecar。
2. 同步 `generate_report.exe` 到 Tauri externalBin 目标文件和便携版目录。
3. 写一个便携版打包脚本，禁止手工拼目录。
4. 修改 `find_sidecar_path()`，兼容 Tauri resource_dir 和便携版目录。
5. 重新打包后验证 `get_template_info` 在便携版中返回内置模板路径。

### 第二批，修路径和配置稳定性

1. 配置迁移后同步 `user_template_dir`。
2. 统一前端保存配置的字段。
3. 去掉或弱化旧硬编码默认工作目录。
4. 在“查看模板位置”中显示 sidecar exe 路径和版本，方便排查。

### 第三批，降低后续维护成本

1. 拆分 `generate_report.py`。
2. 增加模板解析、sidecar 命令、报表生成的测试。
3. 增加 release smoke test：启动 sidecar，发送 `ping` 和 `get_template_info`。
4. 给发布产物写 `manifest.json`，记录主程序版本、sidecar hash、模板 hash。

## 10. 建议验收步骤

便携版修复后，至少执行：

```powershell
cd releases\OMM日报系统_便携版_vNext\OMM日报系统_便携版
$env:YX_BUNDLED_TEMPLATE="$PWD\resources\template.xlsx"
'{"command":"get_template_info"}' | .\binaries\generate_report.exe
```

期望返回：

```json
{
  "success": true,
  "data": {
    "path": "...\\resources\\template.xlsx",
    "exists": true,
    "source": "bundled"
  },
  "error": null
}
```

然后启动 `OMM日报系统.exe`，验证：

1. 设置区“报表模板”显示 `[内置模板]` 或 `[用户自定义]`。
2. 点击“查看位置”，内置模板存在。
3. 在没有工作目录模板的情况下也能生成报表。
4. 点击“更新模板”后，模板来源变成 `[用户自定义]`。
5. 点击“重置为内置”后，模板来源回到 `[内置模板]`。

