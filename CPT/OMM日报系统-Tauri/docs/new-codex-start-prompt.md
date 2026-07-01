# 新 Codex 窗口启动提示词

下面这段可以直接复制到新的 Codex 窗口作为第一条消息。

```text
你是 Codex，接力开发/审查当前项目。请先不要改代码，先读取并理解交接文档，然后向我简短确认当前状态、风险点和下一步建议。

项目目录：
D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri

Git 根目录：
D:\KSoftware\KMAA

绿色版 Git：
C:\Program Files\Adobe\Acrobat DC\Adobi\PortableGit\cmd\git.exe

请优先读取这些文档：
1. D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\docs\handoff-v5.6.0-to-next-codex.md
2. D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\docs\codex-working-memory.md
3. D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\docs\next-development-plan.md
4. D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\docs\new-codex-start-prompt.md
5. D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\CURRENT_STATUS.md

当前重要状态：
- 当前源码版本为 5.6.3；最新便携包应以 `CURRENT_STATUS.md` 中记录为准。
- “玉衡山科学院管理厅”主页外壳已经落地，登录后先进入主页。
- 主页有两个模块：“信息统计局”（OMM 日报工作台）和“数据管理局”（管理员本机数据维护）。
- “数据管理局”只允许管理员进入，访客点击时显示统一 Apple 风格权限提示。
- 设置中心已重组为四个分区：账户登录、信息统计局设置、数据管理局设置、关于软件；后续新增模块时按“模块名 + 设置”扩展。
- 个人清理执行入口不在设置中心，统一从主页“数据管理局”进入。
- 待实现：手量补录/偏低确认要给推荐时间；每件时间下次默认建议 `2~5 分钟/件`，普通测料最低 `1 分钟/件`，CNC 最低 `20 分钟/任务`，时间不够时倾向补足日报缺口。

重要约束：
- 不要 git add .，只精确 add 修改过的文件。
- 不要移动、删除、重命名 C:\Users\Administrator\Desktop\勿动\日期文件。
- 不要写回原始测试数据目录，测试输出只能放到项目 test-output。
- sidecar exe 只从 stdin 读取 JSONL，不支持 --input / --output。
- PowerShell 不要用 < file。
- 不要触碰 sidecar 排程核心、CNC、整形 CNC、特殊大件、缺口诊断算法，除非我明确要求。
- 日期文件夹如有更新，需要随代码一起提交上传。
- 一般只需要便携包，不需要专门交付安装包。

协作习惯：
- 小 bug 和普通代码你可以直接改。
- 大量重复实现可以提醒我交给 op/Kimi。
- 复杂但范围不大的代码，先提醒我切到“高”，再设计和执行。
- 关键架构、核心模块、安全边界、清理模块大改，先提醒我切到“超高”，先方案后执行。
- UI 要保持 Apple-inspired 风格，页面不要拥挤，帮助文档要同步更新。
- 有实际成果后尽量 commit 并 push。

现在请先读取上述文档和 git 状态，不要改代码，然后告诉我：
1. 你理解的当前项目状态。
2. 目前最应该优先做什么。
3. 如果继续做“玉衡山科学院管理厅”外壳，你建议使用高还是超高。
```

## 如果要直接开始实现

如果用户已经明确说“可以开始”，新窗口可以把最后一段改成：

```text
现在我已经确认方向，可以开始实现。请按交接文档中的建议顺序推进：
1. 先读取 CURRENT_STATUS.md 和 git 状态，确认最新版本与便携包。
2. 继续完善“信息统计局”和“数据管理局”的模块体验，并保持管理员权限限制。
3. 新增模块时同步设置中心，按“模块名 + 设置”添加独立设置分区。
4. 同步帮助中心、关于软件和状态文档。
5. 先用 dev / release 验证，打包前再升版本并生成便携包。
```
