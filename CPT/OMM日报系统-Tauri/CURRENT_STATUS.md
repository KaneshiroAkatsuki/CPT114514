# OMM 日报系统当前状态

## 当前版本

- 应用版本：5.0.13
- 版本号随实际更新或发布同步升级；除非明确要求不升版本。
- 历史交接、需求稿和 opencode 记录已归档到 `docs/archive/`。

## 最近重点

- 模板/WPS 样式已按同事模板口径补齐。
- 每件时间偏低风险确认已实现。
- 文件名疑似错误/需确认 warning 已实现。
- 个人电脑清理功能已集成到单独页面。
- 个人清理已支持本机私人浏览器 profile 清理和可选备份。
- 帮助中心已按任务分类重构，并新增关键词搜索。
- 设置中心已新增：默认规则/路径/模板/工具入口集中管理，改动先进入草稿，关闭时会提示保存/放弃/继续编辑。
- 设置中心已新增“关于软件”：显示版本、当前账户、配置文件、识别补充和模板来源。
- 主界面已隐藏日志展示；诊断日志收纳到设置中心“关于软件”中按需查看。
- 本地账户登录已新增：默认管理员 Kaneshiro/禹欣（PIN 114514），访客注册、忘记 PIN 管理员重置、每账户独立 profile 配置。
- sidecar 通讯已增加 180 秒命令超时保护。

## 最新便携版

- packaged_at：2026-07-01T04:32:12
- app：5d42a26043138ea9aa18b78e1984a1f45083dc1cceac087d5f286447d829a428
- sidecar：dc0e250f9285c7df7f804d86829444ae8ac028f092bb8e7457982538e75d924a
- template：18fa2857aad258bf517583f9263fb552cf397a8e0bbb8c1ee43e65b64a0894da
- personal_cleaner_script：2591299c99282220872747a3bc67f604e13dc89640698e4e46e7fa4a9ad3c5af
- personal_cleaner_launcher：c7781e5792081bf24e1d0264fdfa25ff5cc08b817639f451f70fe8eb361071ac

## 常用验证

```powershell
npm.cmd run smoke
npx.cmd tsc --noEmit
cargo check --release
python -m py_compile sidecar\generate_report.py sidecar\sidecar_main.py
python sidecar\build_sidecar.py
npm.cmd run tauri build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\package-portable.ps1 -Version 5.0.13
```

## 重要约束

- 不要 `git add .`，只精确 add 修改过的项目文件。
- 不要移动、删除、重命名 `C:\Users\Administrator\Desktop\勿动\日期文件`。
- 不要写回原始测试数据目录。
- 测试输出放到 `test-output`。
- sidecar exe 只从 stdin 读取 JSONL，不支持 `--input` / `--output`。
- PowerShell 不要用 `< file`。
- 不要触碰 sidecar 排程核心、CNC/整形 CNC/特殊大件/缺口诊断算法，除非明确要求。
- `CPT/日期文件夹/` 有更新时需要随代码一起提交上传。
