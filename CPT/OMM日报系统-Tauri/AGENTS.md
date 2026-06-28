# OMM日报系统 v5.0 (Tauri) - AI 开发指南

## 项目概述

OMM 日报自动生成系统，用于工厂量测室日报汇总表的自动化生成。从 v4.9 (tkinter) 迁移到 v5.0 (Tauri + React)。

## 技术栈

- **前端**: React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **后端**: Tauri 2.x (Rust)
- **业务逻辑**: Python sidecar (通过 stdin/stdout JSON 通信)
- **构建工具**: Vite + npm

## 目录结构

```
OMM日报系统-Tauri/
├── src/                          # React 前端
│   ├── components/
│   │   ├── MainWindow.tsx        # 主界面（队列、设置、生成逻辑）
│   │   ├── ReviewDialog.tsx      # 分页审核对话框
│   │   ├── PreviewDialog.tsx     # 预览窗口
│   │   ├── HelpCenterDialog.tsx  # 帮助中心（8 章节硬编码）
│   │   ├── ConfigLocationDialog.tsx  # 配置位置选择
│   │   ├── ShiftChooseDialog.tsx # 班次选择
│   │   └── ui/                   # shadcn/ui 组件
│   ├── hooks/
│   │   └── useSidecar.ts         # Python sidecar 通信钩子
│   ├── types/
│   │   └── record.ts             # 类型定义（QueueItem, FolderRecord 等）
│   └── lib/                      # 工具函数
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── commands/
│   │   │   ├── config.rs         # 配置管理（load/save/migrate）
│   │   │   ├── file.rs           # 文件操作（list_date_folders 等）
│   │   │   └── sidecar.rs        # sidecar 命令封装
│   │   ├── lib.rs                # Tauri 插件注册
│   │   └── main.rs               # 入口
│   └── binaries/                 # sidecar 可执行文件
├── sidecar/                      # Python 业务逻辑
│   ├── sidecar_main.py           # 命令处理入口
│   ├── generate_report.py        # 核心生成逻辑（1300+ 行）
│   └── build/                    # PyInstaller 构建产物
├── dev.bat                       # 开发模式启动脚本
├── clear-cache.bat               # 清除 Vite 缓存
└── releases/                     # 构建的安装包
```

## 开发命令

```bash
# 启动开发模式（推荐双击 dev.bat）
npm run tauri dev

# 构建安装包
npm run tauri build

# 清除 Vite 缓存（UI 不更新时使用）
# 双击 clear-cache.bat 或手动删除 node_modules/.vite

# TypeScript 类型检查
npx tsc --noEmit
```

## 代码规范

### 前端 (React/TypeScript)
- 使用函数组件 + Hooks
- 状态管理：React useState/useEffect（无 Redux）
- UI 组件：优先使用 shadcn/ui（`src/components/ui/`）
- 样式：Tailwind CSS，避免内联 style
- 类型：严格 TypeScript，所有 props 和 state 需定义类型

### 后端 (Rust)
- 命令函数放在 `src-tauri/src/commands/` 下
- 使用 `#[tauri::command]` 宏暴露给前端
- 错误处理：返回 `Result<T, String>`

### Sidecar (Python)
- 命令处理在 `sidecar_main.py` 的 `handle_command()` 函数
- 新增命令需同时：
  1. 在 `handle_command()` 添加 `elif command == "xxx":` 分支
  2. 在 `useSidecar.ts` 添加对应的调用方法
  3. 在 `src-tauri/src/commands/sidecar.rs` 添加 Rust 封装（如需要）
- 通过 stdin/stdout JSON 行通信，格式：`{"command": "xxx", "params": {...}}`
- **注意**：打包后的 `generate_report.exe` 不支持 `--input` / `--output` 参数。不要用参数方式反复验证 sidecar；必须把一行 JSON 从 stdin 管道传入，并从 stdout 读取 JSON 结果。
- PowerShell 验证示例：`Get-Content -Encoding UTF8 .\test-output\preview_cmd.jsonl | .\binaries\generate_report.exe`

## 关键业务逻辑

### 队列模型
- 队列项类型：`QueueItem`（定义在 `src/types/record.ts`）
- `scheme` 字段：从文件夹名后缀读取（如 `6.15B` → `scheme='B'`），表示班次
- `complexDefault` 设置：控制复杂文件夹的审核模式（弹窗审核 / 留坑自填），与 `scheme` 是独立概念

### 模板文件
- 模板搜索逻辑：`sidecar/generate_report.py` 的 `_find_template()` 函数
- 查找优先级：① 用户自定义模板（`YX_USER_TEMPLATE` 环境变量，由「替换模板」按钮设置）→ ② 工作目录候选名 → ③ 工作目录子目录候选名 → ④ 兜底含"日报汇总表"的 xlsx → ⑤ 内置打包模板（`YX_BUNDLED_TEMPLATE`，由 Rust 注入）
- 内置模板位置：`src-tauri/resources/template.xlsx`（通过 `tauri.conf.json` 的 `bundle.resources` 打包）
- 用户模板存放目录：`YX_USER_TEMPLATE_DIR`（Rust 端 = config_dir），文件名 `user_template.xlsx`
- 候选文件名列表：`_TEMPLATE_CANDIDATES`（`滁州量测室总体日报汇总表-OMM-禹欣1.xlsx`、`滁州量测室总体日报汇总表-OMM.xlsx` 等）
- **重要**：`sidecar_main.py` 中用 `gr.TEMPLATE_PATH`（模块属性访问）而非 `from generate_report import TEMPLATE_PATH`（值绑定，不会跟随 `set_work_dir` 更新）
- 模板只需表头和格式：`generate_report()` 会清空第 3-40 行重新写入数据，不依赖模板里的数据

### 日期文件夹识别
- 命名格式：`\d+\.\d+[AB]`（如 `6.15B`）
- 无 A/B 后缀时弹出 `ShiftChooseDialog` 让用户选择班次
- 扫描逻辑：`src-tauri/src/commands/file.rs` 的 `list_date_folders`

## 已知问题

1. ~~**审核模式 UI 混淆**~~：已修复（2026-06-17）。标签改为「审核模式: 弹窗审核 / 留坑自填」，`processQueueItem` 用 `item.scheme ?? complexDefault`，`getSchemeLabel` 显示生效方案。曾因 Vite 缓存未生效，已清除 `node_modules/.vite`。
2. ~~**模板文件未集成**~~：已修复（2026-06-17）。模板打包到 `src-tauri/resources/template.xlsx`，通过 `bundle.resources` 配置。`_find_template` 增加内置模板兜底（`YX_BUNDLED_TEMPLATE` 环境变量）和用户自定义模板（`YX_USER_TEMPLATE`）。设置界面新增「替换模板」「重置为内置」「刷新」按钮。同时修复 `sidecar_main.py` 中 `TEMPLATE_PATH` import 值绑定 bug（改用 `gr.TEMPLATE_PATH`）。
3. **Vite 热更新问题**：修改代码后 UI 不更新，需手动清缓存（删除 `node_modules/.vite`）或杀残留 node 进程。

## 用户偏好

- 工作目录：`D:\KSoftwarv\NUAA\OMM日报系统`（旧版），测试数据在 `换一个名字/` 子目录
- 生成后自动打开输出目录
- 窗口尺寸：700×800px
- 配置文件默认与程序同目录

## 相关路径

- 旧版 v4.9：`D:\KSoftwarv\NUAA\OMM日报系统\`
- 旧版 AGENTS.md：`D:\KSoftwarv\NUAA\OMM日报系统\AGENTS.md`（含更多用户偏好）
- 测试数据：`D:\KSoftwarv\NUAA\OMM日报系统\换一个名字\`（含日期文件夹和模板）
- 备份目录：`D:\KSoftwarv\NUAA\OMM日报系统_备份_v4.9_Beta\`
