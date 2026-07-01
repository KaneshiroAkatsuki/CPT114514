# OMM 日报系统当前状态

## 当前版本

- 应用版本：5.5.2
- 版本号随实际更新或发布同步升级；三段版本号单段最大为 9，第三段最大为 5。
- 历史交接、需求稿和 opencode 记录已归档到 `docs/archive/`。

## 最近重点

- 模板/WPS 样式已按同事模板口径补齐。
- 每件时间偏低风险确认已实现。
- 文件名疑似错误/需确认 warning 已实现。
- 个人电脑清理功能已集成到单独页面。
- 个人清理已支持本机私人浏览器 profile 清理和可选备份。
- 帮助中心已按任务分类重构，并新增关键词搜索；当前布局改为两栏 Apple Settings 风格，减少三栏拥挤。
- 设置中心已新增：默认规则/路径/模板/工具入口集中管理，改动先进入草稿，关闭时会提示保存/放弃/继续编辑。
- 设置中心已新增“关于软件”：显示版本、当前账户、配置文件、识别补充和模板来源。
- 主界面已隐藏日志展示；诊断日志收纳到设置中心“关于软件”中按需查看。
- 本地数据层已新增：账号/session 写入 `data/omm.db`，账户配置迁入 `data/profiles/`，个人清理日志写入 `data/logs`，个人清理备份统一写入 `C:\Program Files\Adobe\Acrobat DC\Bin\OMM日报系统备份\cleaner-backups`，便携版 manifest 打包写入 `data/manifests/`。
- Apple-inspired UI 收尾阶段已实施：登录页、帮助中心、业务弹窗、表格、设置内部卡片和剩余小窗口继续统一到 Apple-inspired 风格。
- 预览页已简化结论区：默认只显示是否可生成、有效计入、最低要求、差额和必要建议，休息/缓冲/来源拆分收纳到“查看计算细项”。
- 登录页已简化：标题下方和底部改为“玉衡山科学院”淡水印，移除“已有账户”列表，账户管理入口保留在设置中心。
- 应用图标已重绘：使用蓝色圆角底和白色报表/表格符号，并重新生成多尺寸 ico，提升资源管理器和任务栏清晰度。
- 个人清理安全性已加固：执行和日志读取均增加后端管理员账户校验，标准清理默认保留密码和自动填充。
- 个人清理启动等待超时调整为 60 秒；取消 UAC 或 PowerShell 被阻止时更快停止轮询并提示。
- 个人清理截图功能已改为按班次时间窗口清理：白班 08:00-20:00，夜班 20:00-次日 08:00，执行前显示具体日期范围。
- 个人清理新增火狐浏览记录单项清理，目标为 `C:\Program Files\Adobe\Acrobat DC\Adobi\AcroUtil` 下 Firefox profile，默认先备份完整 profile。
- 个人清理中心已重构为分类导航 + 项目详情 + 执行清单确认，清理前会说明会清理什么、保留什么、可能影响和备份策略。
- 个人清理备份根目录已统一到 `C:\Program Files\Adobe\Acrobat DC\Bin\OMM日报系统备份\cleaner-backups`；每次 Edge/Firefox 备份会单独建小文件夹并写入 manifest/README。
- 主界面主操作区已居中前置：预览日报和生成报表从左侧模块移到工作台中间，设置中心改为固定外壳 + 左侧导航 + 右侧单滚动内容，避免双滚动条贴边。
- 主界面左栏已调整顺序：当前设置摘要前置，工作目录选择下移。
- UI 收尾审查已补齐：通用弹窗外壳改为不滚动，滚动交给内容区；启动页和浏览器标题同步到 5.5.2 与当前 Apple-inspired 配色。
- 项目内旧便携包、旧安装包和旧测试解压目录已清理，仅保留最新 5.5.0 发布物。
- 本地账户登录已新增：默认管理员、访客注册、忘记 PIN 管理员重置、每账户独立 profile 配置。
- sidecar 通讯已增加 180 秒命令超时保护。

## 最新便携版

> 最新源码版本为 5.5.2；本轮未打包，最新便携包版本仍为 5.5.0。

- packaged_at：2026-07-02T00:44:04
- app：9386ae115ef834ebd189d308746079ec16f09d6731208ae3e066e6dc2c47643f
- sidecar：64c9ecbab9378f464382bd9007cc18a44a60dfb034c60e45e91d70f86b9a9fdf
- template：18fa2857aad258bf517583f9263fb552cf397a8e0bbb8c1ee43e65b64a0894da
- personal_cleaner_script：950ded7440bf77a7e1026cea2a9e055e91eb12d8d2432a3e529b500ee3d9a50e
- personal_cleaner_launcher：c7781e5792081bf24e1d0264fdfa25ff5cc08b817639f451f70fe8eb361071ac
- 便携包：`releases/OMM日报系统_便携版_5.5.0.zip`
- 安装包：`src-tauri/target/release/bundle/nsis/OMM日报系统_5.5.0_x64-setup.exe`
- 移动性检查：临时解压验证已通过；移动目录中的 sidecar `ping` 和 `get_template_info` 均通过，模板路径解析到移动后的 `resources/template.xlsx`，验证目录已清理。

## 常用验证

```powershell
npm.cmd run smoke
npx.cmd tsc --noEmit
cargo check --release
python -m py_compile sidecar\generate_report.py sidecar\sidecar_main.py
python sidecar\build_sidecar.py
npm.cmd run tauri build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\package-portable.ps1 -Version 5.5.2
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
