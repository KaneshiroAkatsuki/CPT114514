# OMM日报系统 v5.0 - 交接文档

> 本文档供下一个 AI（WorkBuddy 或其他）阅读，包含项目全貌、已完成工作、未解决问题和待办需求。

---

## 一、项目背景

OMM 日报自动生成系统，用于工厂量测室日报汇总表的自动化生成。原为 v4.9 版本（Python + tkinter），现迁移到 v5.0（Tauri + React + TypeScript + Python sidecar）。

### 为什么迁移？
- v4.9 的 tkinter 界面老旧，交互体验差
- 需要现代化的 UI 和更好的用户体验
- Tauri 可以打包成单个 exe，部署方便

---

## 二、项目结构

```
D:\KSoftwarv\NUAA\
├── OMM日报系统-Tauri/          # v5.0 项目（当前开发中）
│   ├── src/                    # React 前端
│   ├── src-tauri/              # Rust 后端
│   ├── sidecar/                # Python 业务逻辑
│   ├── dev.bat                 # 开发模式启动脚本
│   ├── clear-cache.bat         # 清除 Vite 缓存
│   ├── AGENTS.md               # AI 开发指南（刚创建）
│   └── releases/               # 构建的安装包
├── OMM日报系统/                # v4.9 旧版（已停止开发）
│   ├── AGENTS.md               # 旧版用户偏好记录
│   ├── 换一个名字/             # 测试数据目录（含日期文件夹和模板）
│   └── OMM日报系统.pyw         # 旧版主程序
├── OMM日报系统_备份_v4.9_Beta/ # v4.9 备份
├── OMM日报系统_备份_原始版本/   # 更早的备份
└── OMM日报系统_备份_帮助与配置优化前/ # 另一个备份
```

**关键文件：**
- `src/components/MainWindow.tsx` - 主界面（1100+ 行，包含队列、设置、生成逻辑、模板管理）
- `sidecar/generate_report.py` - 核心业务逻辑（1300+ 行，含 `_find_template` 多级查找）
- `sidecar/sidecar_main.py` - Python 命令处理入口（含 `get_template_info`/`replace_template`/`reset_template` 命令）
- `src-tauri/resources/template.xlsx` - 内置打包模板（通过 `bundle.resources` 打包）
- `src-tauri/src/lib.rs` - Tauri 入口（含 `resolve_bundled_template`、AppState 模板字段）
- `src-tauri/src/commands/sidecar.rs` - sidecar 命令封装（含环境变量注入、模板命令）
- `src-tauri/src/sidecar.rs` - SidecarManager（含 `start_with_envs`）

---

## 三、已完成工作（阶段 0-5）

上一个 AI 已完成 v4.9 → v5.0 的功能迁移，具体包括：

### 阶段 0：基础设施
- 安装 pinyin-pro（拼音首字母）
- 实现 sidecar preview 命令
- Rust sidecar_preview/migrate_config 命令
- 动态 config_path()
- Preview/QueueItem 类型定义
- 窗口尺寸 700×800

### 阶段 1：队列模型重构
- QueueItem[] 状态替代 FolderRecord[]
- 顺序生成多文件夹，失败继续下一个
- 进度条分步推进

### 阶段 2：设置控件补齐
- 每件时间 tpp_min/tpp_max
- 包间休息 pkg_rest
- 复杂方案 A/B 单选（已改名为「审核模式：弹窗审核 / 留坑自填」）
- 首字母实时显示（pinyin-pro）
- 下早班 danger 样式
- 配置路径浏览按钮
- 黄色关键提示条

### 阶段 3：队列交互补齐
- 右键菜单切换方案 A/B/恢复默认
- Delete 键删除选中
- Ctrl+V 粘贴路径
- Tauri 拖拽文件夹
- ShiftChooseDialog 弹窗
- 无后缀文件夹处理

### 阶段 4：弹窗组件
- ReviewDialog 分页导航（上一个/下一个/确认并继续/跳过）
- PreviewDialog
- HelpCenterDialog（8 章节硬编码）
- ConfigLocationDialog（首次弹窗）

### 阶段 5：视觉微调
- 标题水印间距 gap-1.5
- 输出目录卡片标题按钮
- 生成完成弹窗 + 自动打开输出目录

---

## 四、未解决问题（优先级排序）

### P0 - 阻塞性问题

#### 1. ~~审核模式 UI 逻辑 bug~~（已修复 2026-06-17）
**修复内容：**
- 确认 `MainWindow.tsx` 三处修改已写入代码（标签重命名、`item.scheme ?? complexDefault`、`getSchemeLabel` 修复）
- 清除 `node_modules/.vite` 缓存目录（曾导致修改未生效）
- 重启 `dev.bat` 后 UI 应显示「审核模式: 弹窗审核 / 留坑自填」

#### 2. ~~模板文件未集成~~（已修复 2026-06-17）
**修复内容：**
1. 将模板复制到 `src-tauri/resources/template.xlsx`，通过 `tauri.conf.json` 的 `bundle.resources` 打包进安装包
2. `generate_report.py` 的 `_find_template()` 增加查找优先级：
   - 用户自定义模板（`YX_USER_TEMPLATE` 环境变量）
   - 工作目录候选名 / 子目录候选名 / 兜底含"日报汇总表"的 xlsx
   - 内置打包模板（`YX_BUNDLED_TEMPLATE` 环境变量，最终兜底）
3. 修复 `sidecar_main.py` 中 `TEMPLATE_PATH` import 值绑定 bug：改用 `gr.TEMPLATE_PATH` 访问运行时最新值
4. Rust 端 `lib.rs` 新增 `resolve_bundled_template()`，在 setup 时解析内置模板路径（dev 模式从 `CARGO_MANIFEST_DIR/resources/`，打包后从 `resource_dir()`）
5. `sidecar.rs` 新增 `start_with_envs()` 方法，`commands/sidecar.rs` 的 `start_sidecar()` 注入 `YX_BUNDLED_TEMPLATE`、`YX_USER_TEMPLATE_DIR`、`YX_USER_TEMPLATE` 环境变量
6. 新增三个 sidecar 命令：`get_template_info`、`replace_template`、`reset_template`
7. 新增 Rust 命令：`sidecar_get_template_info`、`sidecar_replace_template`、`sidecar_reset_template`、`select_xlsx_file`
8. 设置界面新增「报表模板」管理区：显示模板来源标签（用户自定义/工作目录/内置）和路径，提供「替换模板」「重置为内置」「刷新」按钮
9. 确认只有表头的模板不影响生成逻辑：`generate_report()` 会清空第 3-40 行重新写入数据，只依赖表头结构（H2/K2 等单元格位置）

**模板查找优先级（高→低）：**
1. 用户自定义模板（`YX_USER_TEMPLATE`，由「替换模板」按钮复制到 `user_template_dir/user_template.xlsx`）
2. 工作目录根的候选名精确匹配
3. 工作目录直接子目录的候选名精确匹配
4. 兜底：工作目录任意含"日报汇总表"的 xlsx
5. 内置打包模板（`YX_BUNDLED_TEMPLATE`）

---

### P1 - 重要但非阻塞

#### 3. Vite 热更新不稳定
**问题描述：**
修改代码后 UI 不更新，需要手动清缓存或杀残留 node 进程。

**临时解决方案：**
- 双击 `clear-cache.bat` 清除 Vite 缓存
- 杀掉残留 node 进程：`Get-Process -Name node | Stop-Process -Force`
- 重启 `dev.bat`

**根本解决方案：**
排查 Vite HMR 配置，或改用其他热更新方案。

---

#### 4. 预览功能未完全测试
**问题描述：**
`preview` 命令在 `sidecar_main.py` 中未导入，导致预览报错 `name 'preview' is not defined`。

**已修复：**
在 `sidecar_main.py` 第 10-19 行添加了 `preview` 导入。

**待验证：**
重启 `dev.bat` 后测试预览功能是否正常工作。

---

### P2 - 低优先级

#### 5. Tooltip 未实现
**问题描述：**
v4.9 有 Tooltip 功能（延迟 500ms，鼠标移开后立即销毁），v5.0 未实现。

**状态：**
已延后，不影响核心功能。

---

## 五、代码 Review 发现的问题

### 1. `MainWindow.tsx` 过于庞大
- 1100+ 行，包含队列、设置、生成逻辑、所有弹窗接入
- 建议拆分为多个组件或 hooks

### 2. `generate_report.py` 过于庞大
- 1300+ 行，包含解析、调度、生成所有逻辑
- 建议拆分为多个模块

### 3. 硬编码路径
- `MainWindow.tsx` 第 21 行：`const [workDir, setWorkDir] = useState("D:\\KSoftwarv\\NUAA\\OMM日报系统");`
- 应从配置文件读取，而非硬编码默认值

### 4. 错误处理不完善
- 很多 `.catch(() => {})` 静默吞掉错误
- 建议添加用户友好的错误提示

### 5. 类型定义不完整
- `Config` 类型（`src/types/record.ts`）缺少 `tpp_min`, `tpp_max`, `pkg_rest` 等字段
- `persistConfig` 使用了 `as unknown as Record<string, unknown>` 强制转换

---

## 六、如何开始开发

### 1. 环境准备
```bash
# 确保已安装
- Node.js 18+
- Rust 1.70+
- Python 3.10+

# 安装依赖
cd D:\KSoftwarv\NUAA\OMM日报系统-Tauri
npm install
pip install -r sidecar/requirements.txt
```

### 2. 启动开发模式
```bash
# 双击 dev.bat 或运行
npm run tauri dev
```

### 3. 验证当前状态
- 检查 UI 是否显示「审核模式: 弹窗审核 / 留坑自填」
- 检查设置界面「报表模板」区域是否显示模板来源标签和路径
- 测试「替换模板」按钮：选择 xlsx 文件后应显示 [用户自定义] 标签
- 测试「重置为内置」按钮：应回退到 [内置模板] 标签
- 测试生成功能（使用 `换一个名字` 目录下的测试数据，即使工作目录无模板也应能生成）

### 4. 构建安装包
```bash
npm run tauri build
```

---

## 七、用户偏好和约束

- **工作目录**：`D:\KSoftwarv\NUAA\OMM日报系统`（旧版），测试数据在 `换一个名字/` 子目录
- **生成后操作**：自动打开输出目录
- **窗口尺寸**：700×800px
- **配置文件**：默认与程序同目录
- **安装权限**：管理员权限可用，安装依赖前需先征得用户同意

---

## 八、相关资源

- **旧版 v4.9 源码**：`D:\KSoftwarv\NUAA\OMM日报系统\OMM日报系统.pyw`
- **旧版 AGENTS.md**：`D:\KSoftwarv\NUAA\OMM日报系统\AGENTS.md`（含更多用户偏好和踩坑记录）
- **测试数据**：`D:\KSoftwarv\NUAA\OMM日报系统\换一个名字\`（含 9 个日期文件夹和模板）
- **备份目录**：`D:\KSoftwarv\NUAA\OMM日报系统_备份_v4.9_Beta\`

---

## 九、下一步建议

1. ~~**验证审核模式 UI 修复是否生效**（P0）~~ 已修复
2. ~~**实现模板文件集成**（P0）~~ 已修复
   - 打包模板进软件
   - 添加替换模板按钮
3. **测试预览功能**（P1）
4. **重构 MainWindow.tsx**（P2）
5. **重构 generate_report.py**（P2）

---

**文档版本**：2026-06-17（第二个 AI 会话更新）
**最后更新**：修复 P0 审核模式 UI bug 和模板文件集成
