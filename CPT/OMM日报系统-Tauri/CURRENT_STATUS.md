# 玉衡山科学院管理厅当前状态

更新时间：2026-07-10 18:37 +08:00

## 当前版本

- 应用版本：5.8.3
- 应用名称：玉衡山科学院管理厅
- 包名：`yuhengshan-academy-manager`
- Tauri 标识：`com.kaneshiro.yuhengshan.academy.manager`
- 版本号规则：三段版本号；第二位最高为 9，第三位最高为 5。

版本信息以以下文件互相复核：

- `package.json`
- `src-tauri/tauri.conf.json`
- 最新便携版 `data/manifests/portable-manifest.json`

## 最新便携版

- 便携包：`releases/玉衡山科学院管理厅_便携版_5.8.3.zip`
- SHA256：`632BBF33CB0C414D4008DB4E93FB2CCC209A7C2573B7A64050CE6FC178C52225`
- packaged_at：`2026-07-10T18:37:12`
- app：`bc516c9bceea48f5b8d4096fde89896065280e855884adc3416c13f845dcd4eb`
- sidecar：`5bfbd3d8a87d57a56ebd3344aaefe298ef8fbaf33b976ee5cb3c30a8928dbda8`
- template：`18fa2857aad258bf517583f9263fb552cf397a8e0bbb8c1ee43e65b64a0894da`
- personal_cleaner_script：`3feed427724db51f876224f3e93c4e9e7b732aecec55826840ee44c901154a03`
- personal_cleaner_launcher：`c7781e5792081bf24e1d0264fdfa25ff5cc08b817639f451f70fe8eb361071ac`

## 近期重点

- 登录后主界面是“玉衡山科学院管理厅”主页外壳。
- 主页模块为“信息统计局”和“数据管理局”。
- 设置中心按普通软件方式分区：账户登录、信息统计局设置、数据管理局设置、数据库设置、关于软件。
- 数据库设置包含补充规则表、送测人库、耗时规则库。
- 数据管理局承接原个人清理入口；设置中心只保留模块设置、备份和说明入口。
- 个人清理已支持通知清理/勿扰模式、回收站保护、进程处理、WiFi 切换、浏览器 profile 清理和备份。
- Windows 通知清理会优先使用通知中心清理按钮，并在需要时开启请勿打扰；检测到已开启时不重复处理。
- 个人清理真实执行前应有清单和确认，执行后要有结果反馈。
- 手量补录、耗时规则、常见送测人和识别补充正在向数据库规则化迁移。
- 根 `AGENTS.md` 已更新为 Codex/opencode 共用入口。
- 三角色协作文件夹已建立：`docs/role-prompts/`。
- 深度记忆已建立：`docs/role-prompts/core-memory.md`。

## 不可丢失的协作记忆

- 现在的三角色体系是长期协作设计：杰控方向和文档，寇实现，凯验收。
- 文档必须严格分层，不能把聊天记录、流水账和长历史塞进入口文档。
- 当前给杰的再交接包含维护方向和三角色启动约束；新窗口或上下文压缩后必须先找回它。
- 给杰的初学者保护补充包含决策分层、用户解释方式、三角色工作流、完成定义、数据和文档护栏；这也是当前协作基础。
- 三角色可以在职责范围内直接处理低风险小事项，减少用户来回切换；处理后要写入 `docs/role-prompts/activity-log.md` 或当前交接。
- 低风险小事项不包括数据库结构、真实清理、发布/升版本、权限、核心算法、大范围 UI 或用户数据操作。
- 凯当前不要直接开始检查或 UI 自动化；用户正在操作电脑，等用户明确允许后再测试。
- 信息统计局、数据管理局、设置中心、数据库设置和手量耗时算法的维护方向，以当前给杰交接为准。

## 文档状态

- 当前入口：`AGENTS.md`
- 新窗口兼容提示：`docs/new-codex-start-prompt.md`
- 文档治理：`docs/role-prompts/document-governance.md`
- 深度记忆：`docs/role-prompts/core-memory.md`
- 工具/网页/Skill/MCP 规则：`docs/role-prompts/tooling-policy.md`
- 当前给杰主交接：`docs/role-prompts/handoffs/2026-07-04_0205_v5.8.1_to-jay_rehandoff-maintenance.md`
- 当前给杰交接补充：`docs/role-prompts/handoffs/2026-07-04_0212_v5.8.1_to-jay_beginner-guardrails-addendum.md`
- 旧根文档已归档到 `docs/archive/legacy-root/`
- 旧 5.6.x 接力链和 UI 阶段记录已归档到 `docs/archive/legacy-current-layer/`
- `docs/archive/` 和 `docs/role-prompts/handoffs/archive/` 非必要不读取。

## 常用验证

```powershell
npm.cmd run smoke
npx.cmd tsc --noEmit
Push-Location src-tauri; cargo check --release; Pop-Location
python -m py_compile sidecar\generate_report.py sidecar\sidecar_main.py
npm.cmd run tauri-build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\package-portable.ps1 -Version 5.8.3
```

## 发布策略

- 数据库规则、帮助文案、预设耗时、清理规则、模板配置：优先考虑热更新/小打包。
- UI、登录流程、Tauri/React 程序本体、核心逻辑、exe 嵌入资源：需要升版本并完整打便携包。
- 用户一般只需要便携版，安装包仅在必要时构建。
- 发布或打包时必须同步更新版本号、帮助/关于界面、状态文档和便携版 manifest。

## 重要约束

- 不要 `git add .`，只精确 add 修改过的项目文件。
- 不要移动、删除、重命名 `C:\Users\Administrator\Desktop\勿动\日期文件`。
- 不要写回原始测试数据目录。
- 测试输出放到 `test-output` 或临时目录。
- sidecar exe 只从 stdin 读取 JSONL，不支持 `--input` / `--output`。
- PowerShell 不要用 `< file`。
- 不要触碰 sidecar 排程核心、CNC/整形 CNC/特殊大件/缺口诊断算法，除非明确要求。
- `CPT/日期文件夹/` 有更新时需要随代码一起提交或在交接中明确说明。
- 清理、数据库迁移、登录权限、日报生成和打包发布相关改动要先确认边界，再验证。
