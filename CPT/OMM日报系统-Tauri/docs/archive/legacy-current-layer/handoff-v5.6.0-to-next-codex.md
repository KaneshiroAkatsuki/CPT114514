# OMM 日报系统交接文档

日期：2026-07-02

这份文档用于在新的 Codex 窗口接力当前项目。当前线程已经经历多次上下文压缩，新窗口应先读本文，再读 `codex-working-memory.md`、`next-development-plan.md` 和 `new-codex-start-prompt.md`。

## 项目位置

项目目录：

```text
D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri
```

Git 根目录：

```text
D:\KSoftware\KMAA
```

绿色版 Git：

```text
C:\Program Files\Adobe\Acrobat DC\Adobi\PortableGit\cmd\git.exe
```

本文写入时的源码 HEAD：

```text
d97fd56 feat(cleaner): add protected recycle bin cleanup
```

## 当前版本状态

> 2026-07-02 追加：本文是 5.6.0 时的历史交接稿。最新状态请以 `CURRENT_STATUS.md` 为准；当前开发已推进到 5.6.3，主页外壳、信息统计局/数据管理局入口、设置中心四分区已落地。

- 源码版本文件目前仍是 `5.6.0`。
- 最新便携包是 `releases/OMM日报系统_便携版_5.6.0.zip`。
- 该便携包是在 `0ec655b chore(release): package portable 5.6.0` 时打出的。
- 之后又提交了 `d97fd56 feat(cleaner): add protected recycle bin cleanup`。
- 所以当前最新便携包不包含“回收站保护清理”功能。
- 下一次分发前应先升到 `5.6.1`，重新构建便携包，更新 manifest，再 commit/push。

## 当前软件定位

项目最初是 `OMM日报系统`，核心功能是识别日期文件夹、解析 OMM/CMM/手量记录、预览当日报表、生成 Excel 日报。

现在又加入了管理员专用的本机清理工具。用户希望后续把软件升级为统一入口：

```text
玉衡山科学院管理厅
```

计划中的两个模块：

- `信息统计局`：现有 OMM 日报系统。
- `数据管理局`：现有个人清理/OMM 机台清理工具。

计划中的设置栏目：

- `账户设置`
- `日报设置`
- `数据管理局设置` 或 `清理设置`
- `关于软件`

## 已实现重点功能

### 日报模块

- 已支持 OMM/CMM/手量文件名识别。
- 已支持可解释 warning：品名异常、多候选、送测人疑似错字、送测时间异常、手量测量员异常、工站兜底等。
- `安容克送 / 送检 / 上传 / 生成` 等会预填送测人为 `安容克`，同时提示确认是否应为 `安容克送测`。
- `首件` 不再误报为数量缺失。
- 每件时间偏低风险确认已实现：当 `tpp_max` 很低且当天任务/数量较多时，预览/生成前弹窗确认。
- 模板/WPS 样式已按同事模板口径修复。
- 预览结论区已简化，默认只显示能否生成、有效计入、最低要求、差额和必要建议，详细时间计算收进详情入口。

### 账户系统

- 支持本地账户登录，可用昵称或真实姓名登录。
- 有管理员账户，普通员工可注册访客账户。
- 管理员专用功能必须同时做前端和后端校验。
- 不要在文档、日志或提交信息里扩散 PIN 或密码。
- 账户/session 存入本地数据层，账户 profile 配置迁移到 `data/profiles/`。

### 设置和帮助

- 当前 UI 已大范围改为 Apple-inspired 风格。
- 设置中心后续已重组为账户登录、信息统计局设置、数据管理局设置、关于软件；业务执行入口保留在对应模块，不再从设置中心打开个人清理。
- 帮助中心已经按任务分类重构，并加入搜索。
- 日志不再常驻主界面，诊断日志入口收进设置或关于软件区域。

### 数据管理/清理模块

当前代码里还常叫 personal cleaner，但产品方向应改成 `数据管理局`。

已实现：

- 管理员权限校验，前端和后端都有防线。
- Edge 深度清理，默认保留密码和自动填充。
- Windows 通知清理：优先调用通知中心 `全部清除/全部清理`，随后开启 `请勿打扰`；按钮不可用时写入当前用户 QuietHours 兜底。
- 截图按班次清理：
  - 白班：08:00 到 20:00。
  - 夜班：20:00 到次日 08:00。
- 剪贴板历史清理。
- 私人入口快捷方式清理：OpenCode、Firefox 隐私浏览、异常空引号入口。
- Adobi/Edge/Codex 进程清理，真实执行前会先列出候选进程。
- 代理收尾：
  - 清理当前用户系统代理和 WinHTTP 代理。
  - 不清理 `HTTP_PROXY` / `HTTPS_PROXY`。
  - 不动 Codex 自己的代理配置。
- Firefox 私有浏览器清理，路径为 `C:\Program Files\Adobe\Acrobat DC\Adobi\AcroUtil`，默认先备份完整 profile。
- 备份根目录统一为 `C:\Program Files\Adobe\Acrobat DC\Bin\OMM日报系统备份\cleaner-backups`。
- 推荐清理和自定义清理方案。
- 公司 WiFi 切换，默认目标 `cpt3-mobile`，独立选项，默认关闭。
- WiFi 配置清理默认匹配 `kaneshiro*` 和 `cd*`，大小写不敏感。
- 回收站保护清理已提交但尚未打进便携包：
  - 保护 `.xls`、`.xlsx`、`.csv`。
  - 保护名称或路径包含 `-OMM`、`送测` 的项目。
  - 保护 `inspec` 相关程序文件或文件夹。
  - 建议先模拟运行确认清单。

## 重要约束

- 不要 `git add .`，只精确 add 修改过的文件。
- 不要移动、删除、重命名：

```text
C:\Users\Administrator\Desktop\勿动\日期文件
```

- 不要写回原始测试数据目录。
- 测试输出统一放到：

```text
D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri\test-output
```

- sidecar exe 只从 stdin 读取 JSONL，不支持 `--input` / `--output`。
- PowerShell 不要使用 `< file`。
- 除非用户明确要求，不要触碰 sidecar 排程核心、CNC、整形 CNC、特殊大件、缺口诊断算法。
- `CPT/日期文件夹/` 如有更新，需要随代码一起提交上传。

## 常用验证和打包

在项目目录执行：

```text
D:\KSoftware\KMAA\CPT\OMM日报系统-Tauri
```

常用验证：

```powershell
npm.cmd run build
cargo check
python sidecar\build_sidecar.py
npm.cmd run tauri build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\package-portable.ps1 -Version 5.6.1
```

更完整的历史验证：

```powershell
npm.cmd run smoke
npx.cmd tsc --noEmit
cargo check --release
python -m py_compile sidecar\generate_report.py sidecar\sidecar_main.py
```

打包习惯：

- 用户通常只需要便携包。
- `npm.cmd run tauri build` 可能顺带生成安装包，但交付重点是便携包。
- 用户要求打包或发布时应更新版本号。
- 版本规则：每一段最大为 9，第三段最大为 5。例如 `5.5.5` 后是 `5.6.0`，`5.6.5` 后是 `5.7.0`。

## 新窗口建议先做什么

下一轮如果继续功能开发，建议不要直接到处改页面，先按以下顺序做：

1. 先搭 `玉衡山科学院管理厅` 外壳。
2. 登录后进入主页，而不是直接进入日报模块。
3. 主页提供两个模块入口：
   - `信息统计局`
   - `数据管理局`
4. 模块内部提供返回主页入口。
5. 设置中心重组为四个栏目：
   - `账户设置`
   - `日报设置`
   - `数据管理局设置` 或 `清理设置`
   - `关于软件`
6. `数据管理局` 继续只允许管理员使用：
   - 访客可以看见入口。
   - 点击时弹出 Apple 风格权限提示。
   - 后端命令仍然必须校验管理员。
7. UI 改动后同步帮助中心和关于软件。
8. 完成后再打包为 `5.6.1`。
