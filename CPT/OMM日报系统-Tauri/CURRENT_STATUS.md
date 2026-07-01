# OMM 日报系统当前状态

## 当前版本

- 应用版本：5.5.4
- 版本号随实际更新或发布同步升级；三段版本号单段最大为 9，第三段最大为 5。
- 历史交接、需求稿和 opencode 记录已归档到 `docs/archive/`。

## 最近重点

- 模板/WPS 样式已按同事模板口径补齐。
- 每件时间偏低风险确认已实现。
- 文件名疑似错误/需确认 warning 已实现。
- 个人电脑清理功能已集成到单独页面。
- 个人清理已支持本机私人浏览器 profile 清理和可选备份。
- 帮助中心已按任务分类重构，并新增关键词搜索；当前布局改为两栏 Apple Settings 风格，减少三栏拥挤。
- 设置中心已新增：默认规则/路径/模板/其他功能集中管理，改动先进入草稿，关闭时会提示保存/放弃/继续编辑。
- 设置中心左侧栏目名称已统一为四字风格，并新增独立“账户管理”栏目，放在“关于软件”上方；账户显示和切换账户集中在这里。
- 设置中心“关于软件”顶部显示帮助入口，下方显示版本、配置文件、识别补充和模板来源；普通用户界面已移除 dev 打包提示。
- 主界面已隐藏日志展示；诊断日志收纳到设置中心“关于软件”中按需查看。
- 本地数据层已新增：账号/session 写入 `data/omm.db`，账户配置迁入 `data/profiles/`，个人清理日志写入 `data/logs`，个人清理备份统一写入 `C:\Program Files\Adobe\Acrobat DC\Bin\OMM日报系统备份\cleaner-backups`，便携版 manifest 打包写入 `data/manifests/`。
- Apple-inspired UI 收尾阶段已实施：登录页、帮助中心、业务弹窗、表格、设置内部卡片和剩余小窗口继续统一到 Apple-inspired 风格。
- 预览页已简化结论区：默认只显示是否可生成、有效计入、最低要求、差额和必要建议，休息/缓冲/来源拆分收纳到“查看计算细项”。
- 登录页已简化：标题下方和底部改为“KANESHIRO·AKATSUKI”淡标签水印，移除“已有账户”列表，账户管理入口保留在设置中心。
- 主界面页头已加入“玉衡山科学院”淡机构标识，作为登录后的界面归属信息。
- 应用图标已重绘：使用蓝色圆角底和白色报表/表格符号，并重新生成多尺寸 ico，提升资源管理器和任务栏清晰度。
- 个人清理安全性已加固：执行和日志读取均增加后端管理员账户校验，标准清理默认保留密码和自动填充。
- 个人清理启动等待超时调整为 60 秒；取消 UAC 或 PowerShell 被阻止时更快停止轮询并提示。
- 个人清理截图功能已改为按班次时间窗口清理：白班 08:00-20:00，夜班 20:00-次日 08:00，执行前显示具体日期范围。
- 个人清理新增火狐浏览记录单项清理，目标为 `C:\Program Files\Adobe\Acrobat DC\Adobi\AcroUtil` 下 Firefox profile，默认先备份完整 profile。
- 个人清理中心已收敛为顶部分类 + 左侧项目选择 + 右侧影响/执行清单确认；运行日志仅在执行后显示，减少页面拥挤感。
- 个人清理 Windows 通知历史已改为优先调用通知中心“全部清除”按钮；按钮不可用时清空通知数据库兜底，不再重启 Explorer/任务栏；清理完成后会弹出结果摘要并清空真实执行清单。
- 个人清理新增“运行进程”栏目，可关闭 `C:\Program Files\Adobe\Acrobat DC\Adobi` 目录下运行的软件进程，并包含 Edge/Codex 前后台进程；真实执行前会先弹出候选进程名、PID 和路径，该项只结束进程，不删除文件。
- 个人清理“私人入口快捷方式”会清理开始菜单中的 OpenCode、Firefox 隐私浏览和异常空引号样式入口，不删除程序文件。
- 个人清理“关闭 Adobi / Edge / Codex 进程”已补充代理残留收尾：会清当前用户系统代理和 WinHTTP 代理，避免 lmclient 等代理软件退出后遗留代理地址；不会清 HTTP_PROXY/HTTPS_PROXY 环境变量或 Codex 自身代理配置。
- 个人清理已新增“推荐清理 / 自定义清理”方案：推荐清理避开高风险项，自定义清理可保存当前选项和方案名称，并在下次打开时默认套用。
- 个人清理已新增“切换公司 WiFi”：清理完成后可连接 `cpt3-mobile` 并设为自动连接；这是独立选项，默认关闭，避免误断网。
- Windows 通知清理会在调用通知中心“全部清除/全部清理”后尝试开启“请勿打扰”，已开启时保持开启。
- 个人清理备份根目录已统一到 `C:\Program Files\Adobe\Acrobat DC\Bin\OMM日报系统备份\cleaner-backups`；每次 Edge/Firefox 备份会单独建小文件夹并写入 manifest/README。
- 主界面主操作区已居中前置：预览日报和生成报表从左侧模块移到工作台中间，设置中心改为固定外壳 + 左侧导航 + 右侧单滚动内容，避免双滚动条贴边。
- 主界面左栏已调整顺序：当前设置摘要前置，工作目录选择下移。
- UI 收尾审查已补齐：通用弹窗外壳改为不滚动，滚动交给内容区；启动页和浏览器标题同步到 5.5.4 与当前 Apple-inspired 配色。
- 项目内已生成最新 5.5.4 便携包。
- 本地账户登录已新增：默认管理员、访客注册、忘记 PIN 管理员重置、每账户独立 profile 配置。
- sidecar 通讯已增加 180 秒命令超时保护。

## 最新便携版

> 最新源码版本和最新便携包版本均为 5.5.4。

- packaged_at：2026-07-02T03:17:00
- app：4364e1bac053b8cfc69777d691ecb1155e9c525191673afd94b5c8b3568fcc2f
- sidecar：64c9ecbab9378f464382bd9007cc18a44a60dfb034c60e45e91d70f86b9a9fdf
- template：18fa2857aad258bf517583f9263fb552cf397a8e0bbb8c1ee43e65b64a0894da
- personal_cleaner_script：e605158c7b5e143dfd81161e3c6a512f35cf8e16f7a49b71fb1811e880f88e96
- personal_cleaner_launcher：c7781e5792081bf24e1d0264fdfa25ff5cc08b817639f451f70fe8eb361071ac
- 便携包：`releases/OMM日报系统_便携版_5.5.4.zip`
- 安装包：本轮交付便携包；安装包仅按需使用。
- 移动性检查：临时解压验证已通过；移动目录中的 sidecar `ping` 和 `get_template_info` 均通过，模板路径解析到移动后的 `resources/template.xlsx`，验证目录已清理。

## 常用验证

```powershell
npm.cmd run smoke
npx.cmd tsc --noEmit
cargo check --release
python -m py_compile sidecar\generate_report.py sidecar\sidecar_main.py
python sidecar\build_sidecar.py
npm.cmd run tauri build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\package-portable.ps1 -Version 5.5.4
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
