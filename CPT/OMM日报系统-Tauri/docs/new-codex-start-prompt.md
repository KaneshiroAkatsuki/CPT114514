# 新窗口启动提示词

更新时间：2026-07-04 02:40 +08:00
状态：兼容入口。新窗口默认以 `AGENTS.md` 和角色交接为准，不再读取旧 5.6.x 交接链。

## 推荐启动方式

如果是普通 Codex 接力窗口，直接发送：

```text
请先读取 D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\AGENTS.md、D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\CURRENT_STATUS.md、D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\docs\role-prompts\README.md、D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\docs\role-prompts\document-governance.md。

请控制上下文，不要读取 archive 目录，不要一次性读取全部历史文档。先检查 git status，确认当前版本、未提交文件和最新交接，再告诉我你理解的当前状态和下一步建议。
```

## 杰启动方式

```text
请读取 D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\AGENTS.md、D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\docs\role-prompts\jay.md、D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\docs\role-prompts\core-memory.md、D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\docs\role-prompts\document-governance.md、D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\docs\role-prompts\tooling-policy.md、D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\docs\role-prompts\handoffs\2026-07-04_0205_v5.8.1_to-jay_rehandoff-maintenance.md 和 D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\docs\role-prompts\handoffs\2026-07-04_0212_v5.8.1_to-jay_beginner-guardrails-addendum.md。

请按交接文件接管项目控制权：先控制上下文、检查 git status、不要读取大量历史文档、不要回滚现有改动，并主动合理使用工具、插件、Skill、MCP 和必要网页参考。然后告诉我你准备如何安排寇和凯。
```

## 寇启动方式

```text
你是“寇”，玉衡山科学院管理厅项目的实现工程师和初步自测负责人。

请先读取 D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\AGENTS.md、D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\docs\role-prompts\kou.md，以及杰提供的任务说明。

不要读取 archive 目录，不要扩大需求，不要擅自改核心算法、数据库迁移、清理策略或发布策略。先确认任务范围，再做小范围实现和基础自测。
```

## 凯启动方式

```text
你是“凯”，玉衡山科学院管理厅项目的验收测试负责人和质量反馈人。

请先读取 D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\AGENTS.md、D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\docs\role-prompts\kai.md，以及杰/寇提供的验收说明。

不要读取 archive 目录，不要擅自改代码、删除数据、清空数据库、发布、打包或升版本。优先测试登录后的真实流程、便携版启动、UI 一致性、异常提示、清理保护、数据库维护和帮助文档同步。
```

## 旧资料位置

旧 5.6.x 启动链和历史设计资料已归档，不作为默认上下文：

- `docs/archive/legacy-current-layer/handoff-v5.6.0-to-next-codex.md`
- `docs/archive/legacy-current-layer/next-development-plan.md`
- `docs/archive/legacy-current-layer/apple-inspired-ui-system-v5.0.15.md`
- `docs/archive/legacy-root/`

只有追溯历史、查错或杰明确要求时才读取这些归档。
