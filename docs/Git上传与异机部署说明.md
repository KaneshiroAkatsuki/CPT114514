# Git 上传与异机部署说明

编写时间：2026-06-29

本文只说明“哪些文件应该进 Git”和“另一台电脑如何运行/重新打包”。业务需求交接文档仍放在 `CPT/OMM日报系统-Tauri/` 内。

## 1. 当前仓库范围

仓库根目录：

```text
D:\KSoftware\KMAA
```

主要项目目录：

```text
CPT/OMM日报系统-Tauri/
```

当前 `.gitignore` 已排除构建产物、依赖缓存、测试输出和发布包。`CPT/日期文件夹/` 是项目参考案例，需要上传，用于异机验证和 AI 接力理解真实数据结构。

## 2. 不建议上传的内容

### 2.1 `node_modules/`

原因：

- 这是 npm 安装出来的依赖缓存，不是源码。
- 体积大、文件多，上传会让仓库很慢。
- 另一台电脑可以通过 `package-lock.json` 和 `npm install` 重新安装。

### 2.2 `src-tauri/target/`

原因：

- 这是 Rust/Tauri 编译产物。
- 体积非常大，里面有 `.rlib`、`.pdb`、中间对象文件。
- 换电脑、换 Rust 版本、换架构后也应该重新编译。

### 2.3 `dist/`

原因：

- 这是前端 Vite 构建结果。
- 可以通过 `npm run build` 重新生成。
- 上传它容易和源码不同步。

### 2.4 `src-tauri/binaries/*.exe`

原因：

- 这是 Python sidecar 打包出来的 `generate_report.exe`。
- 它应由 `python sidecar/build_sidecar.py` 从源码重新生成。
- 如果把 exe 放进 Git，容易出现“源码已改，但 exe 还是旧版”的问题。

注意：发布便携版时必须包含 `binaries/generate_report.exe`，但源码仓库不建议提交它。

### 2.5 `releases/`

原因：

- 这里是发布包、便携版 zip、安装包。
- 它们是给最终用户运行的产物，不是源码。
- 需要发布时可以单独上传 zip 到 GitHub Release、网盘或其他发布位置。

### 2.6 `test-output/`

原因：

- 这是本地验证输出目录。
- 里面可能包含生成的报表、临时 JSON、复制出来的测试目录。
- 不应该长期保存在源码仓库里。

### 2.7 临时验证文件

例如：

```text
stdin_out.txt
stdin_err.txt
version_out.txt
version_err.txt
manual_preview_py_stderr.txt
```

原因：

- 这些是调试 sidecar 时留下的输出。
- 内容可随时重新生成。
- 长期提交会污染仓库历史。

## 3. 应该上传的内容

### 3.1 源码

```text
src/
src-tauri/src/
sidecar/
```

原因：

- React 前端、Rust/Tauri 后端、Python sidecar 业务逻辑都在这里。

### 3.2 配置和锁定文件

```text
package.json
package-lock.json
src-tauri/Cargo.toml
src-tauri/Cargo.lock
tsconfig.json
vite.config.ts
tailwind.config.js
postcss.config.js
src-tauri/tauri.conf.json
```

原因：

- 另一台电脑需要这些文件安装相同依赖并重新构建。
- `package-lock.json` 和 `Cargo.lock` 应保留，用来锁定依赖版本。

### 3.3 内置模板

```text
src-tauri/resources/template.xlsx
```

原因：

- 这是程序运行和打包便携版需要的内置 Excel 模板。
- 如果缺少它，另一台电脑重新打包后可能出现“找不到模板”。

### 3.4 构建/打包脚本

```text
scripts/package-portable.ps1
sidecar/build_sidecar.py
```

原因：

- `build_sidecar.py` 用于生成 `generate_report.exe`。
- `package-portable.ps1` 用于把主程序、sidecar、模板打成便携版。

### 3.5 交接和说明文档

```text
AGENTS.md
HANDOVER.md
OMM日报系统-*.md
docs/
```

原因：

- 这些文档记录了业务规则、排程规则、手量规则、AI 接力注意事项。
- 对后续维护非常重要。

### 3.6 参考案例数据

```text
CPT/日期文件夹/
```

原因：

- 这是当前程序的重要参考案例。
- 另一台电脑部署后可用它做 smoke test。
- AI 接力时也需要通过它理解真实文件夹命名、日期班次、CSV/XLSX 组合和异常数据形态。

注意：

- 该目录可能包含真实姓名、送测人、测量员、工单、日期等业务信息。
- 如果仓库要公开，建议先脱敏；如果仓库是私有的，可以作为参考案例上传。

## 4. 另一台电脑如何部署

### 4.1 只是给别人使用

不要发 Git 源码。直接发便携版 zip：

```text
CPT/OMM日报系统-Tauri/releases/OMM日报系统_便携版_*.zip
```

便携版里必须包含：

```text
OMM日报系统.exe
binaries/generate_report.exe
resources/template.xlsx
manifest.json
```

对方解压后运行：

```text
OMM日报系统.exe
```

这条路线不需要 Node、Rust、Python。

### 4.2 另一台电脑要继续开发/重新打包

需要准备：

```text
Git
Node.js LTS
npm
Python 3.10+ 或 3.11+
Rust stable
Microsoft C++ Build Tools / Visual Studio Build Tools
WebView2 Runtime
```

建议步骤：

```powershell
git clone <你的仓库地址>
cd KMAA\CPT\OMM日报系统-Tauri
npm install
python -m pip install -r sidecar\requirements.txt
python sidecar\build_sidecar.py
npm run tauri-build
powershell -ExecutionPolicy Bypass -File scripts\package-portable.ps1
```

打包成功后检查：

```text
releases/OMM日报系统_便携版_<版本号>/
```

其中应包含主程序、sidecar 和模板。

## 5. sidecar 验证方式

`generate_report.exe` 只支持 stdin/stdout JSON 行通信，不支持 `--input` / `--output` 参数。

正确验证方式：

```powershell
Get-Content -Encoding UTF8 .\test-output\preview_cmd.jsonl | .\binaries\generate_report.exe
```

不要使用：

```powershell
.\binaries\generate_report.exe --input xxx --output xxx
```

## 6. 还建议补充的文件

### 6.1 `README.md`

建议后续新增一个简短 README，内容包括：

- 项目是什么。
- 开发启动命令。
- 打包命令。
- 便携版发布位置。

### 6.2 脱敏测试样本

虽然当前 `CPT/日期文件夹/` 需要作为参考案例上传，但仍建议后续再准备一个很小的脱敏样本目录，例如：

```text
samples/sanitized-date-folders/
```

要求：

- 不包含真实姓名、工单、机台、客户或内部编号。
- 只保留足够触发解析逻辑的文件夹结构和最小 CSV/XLSX。
- 可以用于新电脑 smoke test。

公开分享仓库或给外部人员时，优先使用脱敏样本；私有仓库内可以保留当前参考案例。

### 6.3 发布检查清单

建议后续新增：

```text
docs/发布检查清单.md
```

至少包含：

- `npm run build` 是否通过。
- `python sidecar/build_sidecar.py` 是否通过。
- `npm run tauri-build` 是否通过。
- 便携版中是否有 `OMM日报系统.exe`、`binaries/generate_report.exe`、`resources/template.xlsx`。
- `manifest.json` 中 hash 是否生成。

## 7. 当前结论

源码仓库不应该上传构建产物、依赖缓存、发布包和测试输出。

`CPT/日期文件夹/` 当前按参考案例处理，需要上传，但建议仓库保持私有，或后续再补一份脱敏样本。

另一台电脑如果只是使用程序，发便携版 zip 即可。

另一台电脑如果要开发/打包，需要从 Git 源码重新安装依赖、重新构建 sidecar、重新构建 Tauri，并用 `scripts/package-portable.ps1` 生成便携版。
