# OMM 日报系统当前状态

## 当前版本

- 应用版本：5.3.5
- 版本号随实际更新或发布同步升级；三段版本号单段最大为 9，第三段最大为 5。
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
- 本地数据层已新增：账号/session 写入 `data/omm.db`，账户配置迁入 `data/profiles/`，个人清理日志/备份迁入 `data/logs` 和 `data/backups`，便携版 manifest 打包写入 `data/manifests/`。
- Apple-inspired UI 收尾阶段已实施：登录页、帮助中心、业务弹窗、表格、设置内部卡片和剩余小窗口继续统一到 Apple-inspired 风格。
- 预览页已简化结论区：默认只显示是否可生成、有效计入、最低要求、差额和必要建议，休息/缓冲/来源拆分收纳到“查看计算细项”。
- 登录页已简化：标题下方改为 Kaneshiro/禹欣水印，移除“已有账户”列表，账户管理入口保留在设置中心。
- 本地账户登录已新增：默认管理员 Kaneshiro/禹欣（PIN 114514），访客注册、忘记 PIN 管理员重置、每账户独立 profile 配置。
- sidecar 通讯已增加 180 秒命令超时保护。

## 最新便携版

- packaged_at：2026-07-01T22:00:30
- app：e125ee16b27627ddbccea431b5fa33e4f8b937a44191749cf151bfdebd28726e
- sidecar：644537501142832825169603daabcbd61259752344584c3640ab95d05b85a776
- template：18fa2857aad258bf517583f9263fb552cf397a8e0bbb8c1ee43e65b64a0894da
- personal_cleaner_script：2591299c99282220872747a3bc67f604e13dc89640698e4e46e7fa4a9ad3c5af
- personal_cleaner_launcher：c7781e5792081bf24e1d0264fdfa25ff5cc08b817639f451f70fe8eb361071ac
- 便携包：`releases/OMM日报系统_便携版_5.3.4.zip`
- 移动性检查：已解压到 `test-output/portable-move-check/`，manifest hash 通过；移动目录中的 sidecar `ping` 和 `get_template_info` 均通过，模板路径解析到移动后的 `resources/template.xlsx`。

## 常用验证

```powershell
npm.cmd run smoke
npx.cmd tsc --noEmit
cargo check --release
python -m py_compile sidecar\generate_report.py sidecar\sidecar_main.py
python sidecar\build_sidecar.py
npm.cmd run tauri build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\package-portable.ps1 -Version 5.3.5
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
