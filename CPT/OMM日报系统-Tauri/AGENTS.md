# 玉衡山科学院管理厅 - AGENTS.md

更新时间：2026-07-10 19:05 +08:00
当前应用版本：5.8.4
适用范围：Codex、opencode，以及其他会读取 `AGENTS.md` 的代码代理。

## 入口原则

本文件是项目的最小入口，不是历史仓库。不要把聊天记录、长需求、长测试日志或大段代码塞进这里。

## 上下文恢复硬规则

当前三角色协作、文档治理、小事自治、模块维护方向和给杰的再交接内容是重要项目记忆。即使上下文被压缩或换新窗口，也必须通过本文件、`CURRENT_STATUS.md` 和当前给杰交接重新恢复，不可凭模糊记忆继续开发。

如果发现自己不知道当前维护约定，先读取：

1. `CURRENT_STATUS.md`
2. `docs/role-prompts/README.md`
3. `docs/role-prompts/core-memory.md`
4. `docs/role-prompts/document-governance.md`
5. `docs/role-prompts/activity-log.md`
6. `docs/role-prompts/handoffs/2026-07-04_0205_v5.8.1_to-jay_rehandoff-maintenance.md`
7. `docs/role-prompts/handoffs/2026-07-04_0212_v5.8.1_to-jay_beginner-guardrails-addendum.md`

新窗口默认先读：

1. `AGENTS.md`
2. `CURRENT_STATUS.md`，但要意识到它可能滞后，版本信息需以 `package.json`、`src-tauri/tauri.conf.json` 和 release manifest 复核。
3. `docs/role-prompts/README.md`
4. `docs/role-prompts/core-memory.md`
5. `docs/role-prompts/document-governance.md`
6. 当前角色文件或当前交接文件，仅在任务需要时读取。

不要默认读取 `docs/archive/`、`docs/role-prompts/handoffs/archive/` 或整份长工作记忆。需要追溯历史时先说明目的，再读最小范围。

## 项目位置

- 项目目录：`D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri`
- Git 根目录：`D:\KSoftware\KMAA`
- 当前便携包：`D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\releases\玉衡山科学院管理厅_便携版_5.8.4.zip`

## 技术栈

- 前端：React 18 + TypeScript + Vite + Tailwind CSS
- 桌面壳：Tauri 2.x + Rust
- 业务生成：Python sidecar，通过 stdin/stdout JSONL 通信
- 数据层：Tauri/Rust 本地命令、SQLite/本地配置、sidecar 规则逻辑

## 常用命令

```powershell
npm.cmd run smoke
npx.cmd tsc --noEmit
Push-Location src-tauri; cargo check --release; Pop-Location
npm.cmd run tauri-build-portable
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\package-portable.ps1 -Version 5.8.4
```

sidecar exe 只从 stdin 读取 JSONL，不支持 `--input` 或 `--output`。PowerShell 验证不要使用 `< file`。

## 换电脑 / 上传前 AI 部署检查

每次准备 `git push` 或打包前，先确认这轮改动在另一台电脑可恢复：

1. `git status --short`：只精确暂存本轮文件，不要 `git add .`；不要把 `node_modules/`、`dist/`、`src-tauri/target/`、`releases/` 加入提交。
2. 若改到依赖、模板、打包或测试样本，确认对应文件已被 git 跟踪：`package-lock.json`、`src-tauri/Cargo.lock`、`src-tauri/resources/template.xlsx`、`scripts/*.ps1`、必要的 `CPT/日期文件夹/` 回归样本。
3. 新电脑本机工具链先检测再安装：`node -v`、`npm -v`、`rustc -V`、`cargo -V`、`python --version`；Python 还需能 `import PyInstaller, openpyxl, lxml, PIL`。
4. 新电脑首次构建建议顺序：`npm ci`，缺 Python 包时再装 `pyinstaller openpyxl lxml pillow`，然后运行 `python sidecar\build_sidecar.py`、`npm.cmd run smoke`、`npm.cmd run tauri-build-portable`、便携包脚本。
5. 如果本机能跑、另一台电脑不行，优先检查未提交资源、Python 包、Rust/MSVC/WebView2 工具链、sidecar exe 是否重建，而不是先改业务逻辑。

## 硬性约束

- 不要 `git add .`，只精确暂存本次修改的文件。
- 不要移动、删除、重命名 `C:\Users\Administrator\Desktop\勿动\日期文件`。
- 不要写回原始测试数据目录，测试输出放到 `test-output` 或临时目录。
- 未经明确要求，不要触碰 sidecar 排程核心、CNC/整形 CNC/特殊大件/缺口诊断算法。
- `CPT/日期文件夹/` 有更新时，需要随代码一起提交或交接说明。
- 当前工作区可能是 dirty 状态，不要回滚、重置或覆盖用户/其他窗口改动。
- 涉及清理、数据库迁移、登录权限、日报生成、打包发布时要保守，先验证再交付。

## 三角色协作

- 杰：项目总控、架构设计、任务拆分、主要文档、发布决策。
- 寇：代码实现、简单检查、简单修复，遇到设计问题反馈给杰。
- 凯：登录验收、功能测试、打包测试、UI 一致性检查，反馈给杰。

角色文件统一在 `docs/role-prompts/`。交接文件统一在 `docs/role-prompts/handoffs/`，旧交接归档到 `docs/role-prompts/handoffs/archive/`。当前给杰的主交接是 `docs/role-prompts/handoffs/2026-07-04_0205_v5.8.1_to-jay_rehandoff-maintenance.md`，必读补充是 `docs/role-prompts/handoffs/2026-07-04_0212_v5.8.1_to-jay_beginner-guardrails-addendum.md`。

三角色首轮互动要互相提醒：少读历史、少建文档、交接短而清楚、长了就开新文件并归档旧文件。

## 文档治理

详细规则见 `docs/role-prompts/document-governance.md`。稳定结论才进入长期文档；临时讨论只放交接或任务消息。一个文档过长时优先拆分、归档或替换，不继续堆内容。

## 工具与网页

详细规则见 `docs/role-prompts/tooling-policy.md`。

涉及新技术、插件、Skill、MCP、opencode/Codex 行为、外部标准或不确定事实时，要主动访问网页参考。网页只能作为证据来源，不能直接当真；优先官方文档、维护活跃的 GitHub 仓库和本地验证结果。长期工具、插件、Skill 或 MCP 的引入由杰确认。

## 发布策略

- 数据库规则、帮助文案、预设耗时、清理规则、模板配置：优先考虑热更新/小打包。
- UI、登录流程、Tauri/React 程序本体、核心逻辑、exe 嵌入资源：需要升版本并完整打便携包。
- 默认只交付便携包；除非用户明确要求安装包，否则不要运行会产出 NSIS/MSI 的完整安装包构建。
- 版本号三段均需同步；第二位最高为 9，第三位最高为 5。
