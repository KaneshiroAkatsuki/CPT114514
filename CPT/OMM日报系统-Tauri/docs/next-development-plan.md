# 后续开发计划

日期：2026-07-02

## 当前状态

当前源码 HEAD：

```text
d97fd56 feat(cleaner): add protected recycle bin cleanup
```

最新便携包：

```text
releases/OMM日报系统_便携版_5.6.0.zip
```

注意：

- 最新便携包构建于 `0ec655b`。
- `d97fd56` 在该便携包之后新增了回收站保护清理。
- 下一次给用户分发前，应升到 `5.6.1` 并重新打包。

## 下一阶段主目标

把当前单一 `OMM日报系统` 升级为：

```text
玉衡山科学院管理厅
```

登录后的第一屏改为主页，而不是直接进入日报工作台。

主页提供两个模块入口：

- `信息统计局`
- `数据管理局`

模块映射：

- `信息统计局`：当前 OMM 日报工作流。
- `数据管理局`：当前个人清理/OMM 机台清理工作流。

权限：

- `信息统计局`：普通用户可以进入。
- `数据管理局`：仅管理员可进入。
- 访客可以看到 `数据管理局` 入口，但点击时弹出权限提示。
- 权限弹窗建议：
  - 标题：`需要管理员权限`
  - 内容：`数据管理局包含本机清理、网络切换、进程维护等功能，仅管理员账户可进入。`
  - 按钮：`知道了`、`切换账户`

## 设置中心重组

目标四个栏目：

1. `账户设置`
2. `日报设置`
3. `数据管理局设置` 或 `清理设置`
4. `关于软件`

### 账户设置

- 当前账户。
- 欢迎语显示昵称还是真实姓名。
- 切换账户。
- 退出登录。
- 管理员重置访客 PIN。

### 日报设置

- 工作目录。
- 日期文件夹和来源路径。
- 模板来源、替换、恢复默认。
- 识别规则。
- 生成规则。
- 每件时间阈值。
- 手量和 OMM 相关设置。

### 数据管理局设置

- 推荐清理方案。
- 自定义清理方案和重命名。
- WiFi 忘记规则：
  - 默认 `kaneshiro*, cd*`。
- 公司 WiFi：
  - 默认 `cpt3-mobile`。
- 回收站保护规则：
  - `.xls`
  - `.xlsx`
  - `.csv`
  - `-OMM`
  - `送测`
  - `inspec`
- 备份根目录。
- 高风险操作确认。

### 关于软件

- 当前版本。
- 便携包 manifest。
- 数据目录。
- 帮助入口。
- 诊断日志入口。
- `玉衡山科学院` 和 `KANESHIRO·AKATSUKI` 这类淡水印或归属信息。

## UI 实施思路

建议先用较小改动引入顶层状态：

```text
home
daily
dataManagement
```

实现方式：

- 当前主窗口外壳升级为 `玉衡山科学院管理厅`。
- 当前日报主界面作为 `daily` 模块内容。
- 当前个人清理页面作为 `dataManagement` 模块内容。
- 顶部区域增加：
  - 总入口名称。
  - 当前模块面包屑。
  - 非主页时显示返回主页按钮。
  - 设置按钮。
  - 账户 chip 或账户菜单。

主页视觉：

- 做成真实软件主页，不做营销页。
- 两个干净模块入口卡片。
- `信息统计局` 可用 `BarChart3`、`FileSpreadsheet`、`ClipboardList` 等图标。
- `数据管理局` 可用 `Database`、`ShieldCheck`、`HardDrive`、`Wrench` 等图标。
- 卡片只写操作摘要，不要长篇说明。

## 必须保留的清理模块安全边界

不要回退这些安全设计：

- 管理员前端和后端双重校验。
- 默认先模拟运行。
- 真实执行前弹确认。
- 进程清理前显示候选进程、PID、路径。
- Windows 通知清理后尝试开启请勿打扰。
- 代理清理不动 `HTTP_PROXY` / `HTTPS_PROXY`。
- 公司 WiFi 默认目标 `cpt3-mobile`。
- WiFi 忘记规则默认 `kaneshiro*, cd*`。
- 回收站清理必须保护表格、日报/送测相关文件和 inspec 程序文件。
- 备份根目录保持在：

```text
C:\Program Files\Adobe\Acrobat DC\Bin\OMM日报系统备份\cleaner-backups
```

## 建议实施顺序

1. 新增主页外壳和模块状态，不急着重构内部逻辑。
2. 把现有日报工作台挂到 `信息统计局`。
3. 增加 `数据管理局` 入口和管理员权限弹窗。
4. 把个人清理从弹窗式入口整理为模块页面，尽量复用现有逻辑。
5. 增加返回主页和模块面包屑。
6. 设置中心重组为四个栏目。
7. 同步帮助中心和关于软件。
8. 用 dev 检查主要 UI。
9. 通过验证后升版并打包 `5.6.1`。

## 验证建议

功能开发后的最低验证：

```powershell
npm.cmd run build
cargo check
powershell.exe -NoProfile -ExecutionPolicy Bypass -File src-tauri\resources\tools\edge-cleaner\clean-edge.ps1 -NoMenu -DryRun -SkipEdgeCleaning -ClearRecycleBin
```

打包前验证：

```powershell
python sidecar\build_sidecar.py
npm.cmd run tauri build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\package-portable.ps1 -Version 5.6.1
```

## 仍需用户拍板的问题

- 第三个设置栏目最终叫：
  - `数据管理局设置`
  - `清理设置`
  - `机务设置`
- 主页是否显示用户角色标签。
- `数据管理局` 对访客是显示锁定态，还是显示正常卡片后再弹权限提示。
  - 当前倾向：正常显示卡片，点击后弹权限提示。
