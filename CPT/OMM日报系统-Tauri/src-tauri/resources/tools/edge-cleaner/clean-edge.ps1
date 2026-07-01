#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Microsoft Edge 深度补充清理工具
.DESCRIPTION
    设计为在 Edge 自带"清除浏览数据"之后使用，清理其容易遗漏的底层隐私数据。

    默认行为（最常用）：
      清理：历史记录、Cookie、网站本地存储、缓存、会话、密码、自动填充、站点设置
      保留：书签、扩展本体、浏览器设置、微软账户登录状态

    可选开关允许手动清理/保留更多项目。
    除非明确使用 -ResetEdge，否则不会把 Edge 恢复出厂设置。
#>

param(
    # 隐私类：默认清理，加 -KeepXxx 可保留
    [switch]$KeepCookies,
    [switch]$KeepHistory,
    [switch]$KeepSiteStorage,
    [switch]$KeepSessions,
    [switch]$KeepPasswords,
    [switch]$KeepAutofill,

    # 用户资产类：默认保留，加 -ClearXxx 可清理
    [switch]$ClearBookmarks,
    [switch]$ClearExtensions,
    [switch]$ClearSettings,
    [switch]$ClearMicrosoftAccount,

    # 单独把“站点设置/权限”独立出来，因为直接删 Preferences 会导致界面重置
    [switch]$ClearSitePreferences,

    # 极端选项：把 Edge 恢复到接近初始状态（仍不会删除整个 User Data 目录）
    [switch]$ResetEdge,

    # 跳过交互菜单（命令行模式）
    [switch]$NoMenu,

    # 清理 Windows 通知历史记录（不影响通知权限设置）
    [switch]$ClearWindowsNotifications,

    # 关闭 Adobi 根目录下运行的软件进程，并包含 Edge / Codex 前后台进程
    [switch]$CloseAdobiProcesses,

    # Adobi 根目录
    [string]$AdobiRoot = "C:\Program Files\Adobe\Acrobat DC\Adobi",

    # 清理截图文件夹：按当班时间窗口清理；旧 Days 参数保留给交互菜单兼容
    [switch]$ClearScreenshots,
    [string]$ClearScreenshotsFrom,
    [string]$ClearScreenshotsTo,
    [string]$ClearScreenshotsLabel,

    # 清理截图文件夹：指定删除最近 N 天，0 表示不清理（默认）
    [int]$ClearScreenshotsDays = 0,

    # 清理 Windows 剪贴板历史（保留固定项，不影响剪贴板功能）
    [switch]$ClearClipboardHistory,

    # 清理回收站，但保留 Excel / OMM / 送测 / inspec 相关项目
    [switch]$ClearRecycleBin,

    # 清理 opencode 在开始菜单生成的快捷方式
    [switch]$ClearOpencodeShortcuts,

    # 清理本机私人浏览器（Firefox 便携版）profile 数据
    [switch]$CleanPrivateBrowser,

    # 仅清理本机私人浏览器（Firefox 便携版）浏览记录数据库
    [switch]$ClearPrivateBrowserHistory,

    # 跳过私人浏览器 profile 备份
    [switch]$SkipPrivateBrowserBackup,

    # 私人浏览器根目录
    [string]$PrivateBrowserRoot = "C:\Program Files\Adobe\Acrobat DC\Adobi\AcroUtil",

    # 旧交互菜单兼容：保留指定前缀的 WiFi，删除/忘记其他
    [string[]]$KeepWifiPrefixes,

    # 忘记匹配模式的 WiFi，例如 kaneshiro*, cd*；大小写不敏感
    [string[]]$ForgetWifiPatterns,

    # 清理完成后连接公司 WiFi，并设置为自动连接
    [switch]$ConnectCompanyWifi,
    [string]$CompanyWifiSsid = "cpt3-mobile",

    # 跳过清理前关键 Edge 数据备份（默认会备份 Bookmarks / Preferences / Extensions）
    [switch]$SkipBackup,

    # 跳过 Edge 浏览器数据模块，仅执行 Windows/个人专项清理
    [switch]$SkipEdgeCleaning,

    # 保留 Edge 模块但跳过标准隐私清理，仅执行显式勾选的 Edge 子项目
    [switch]$SkipStandardEdgeCleaning,

    # 日志输出路径（由 Tauri 页面传入，用于界面轮询显示）
    [string]$LogPath,

    # JSON 结果摘要路径（由 Tauri 页面传入，用于判断脚本是否结束）
    [string]$JsonSummaryPath,

    # 清理前备份根目录
    [string]$BackupRoot,

    # 模拟运行
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$script:TranscriptStarted = $false
if (-not [string]::IsNullOrWhiteSpace($LogPath)) {
    try {
        $logDir = Split-Path -Parent $LogPath
        if (-not [string]::IsNullOrWhiteSpace($logDir)) {
            New-Item -Path $logDir -ItemType Directory -Force | Out-Null
        }
        Start-Transcript -Path $LogPath -Force | Out-Null
        $script:TranscriptStarted = $true
    } catch {
        Write-Host "无法启动日志记录: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

if ($KeepWifiPrefixes) {
    $KeepWifiPrefixes = @(
        $KeepWifiPrefixes |
            ForEach-Object { $_ -split ',' } |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ -ne '' }
    )
} else {
    $KeepWifiPrefixes = @()
}

if ($ForgetWifiPatterns) {
    $ForgetWifiPatterns = @(
        $ForgetWifiPatterns |
            ForEach-Object { $_ -split ',' } |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ -ne '' }
    )
} else {
    $ForgetWifiPatterns = @()
}

$script:UserDataRoot = "$env:LOCALAPPDATA\Microsoft\Edge\User Data"
$script:ToolRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:BackupRoot = if ([string]::IsNullOrWhiteSpace($BackupRoot)) { Join-Path $script:ToolRoot "backups" } else { $BackupRoot }
$script:CleanEdgeModule = $true
$script:CleanEdgeCaches = $true
$script:CleanExtensionRuntime = $true
$script:CleanMetadata = $true
$script:CleanSecurityData = $true
$script:CleanDiagnostics = $true
$script:CleanOtherTempData = $true
$script:CleanGlobalEdgeData = $true
$script:CleanSystemTempData = $true

function Write-Step {
    param([string]$Message)
    Write-Host "`n[+] $Message" -ForegroundColor Cyan
}

function Write-SubStep {
    param([string]$Message)
    Write-Host "    - $Message" -ForegroundColor Gray
}

function Write-Deep {
    param([string]$Message)
    Write-Host "      [深度项] $Message" -ForegroundColor DarkYellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "    √ $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "    ! $Message" -ForegroundColor Yellow
}

function Stop-EdgeProcesses {
    Write-Step "正在关闭 Microsoft Edge 进程..."
    $edgeProcesses = Get-Process -Name "msedge" -ErrorAction SilentlyContinue
    if ($edgeProcesses) {
        if ($DryRun) {
            Write-Host "        [模拟关闭] 找到 $($edgeProcesses.Count) 个 Edge 进程" -ForegroundColor DarkCyan
            return
        }
        $edgeProcesses | ForEach-Object { $_.CloseMainWindow() | Out-Null }
        Start-Sleep -Seconds 2
        $stillRunning = Get-Process -Name "msedge" -ErrorAction SilentlyContinue
        if ($stillRunning) {
            $stillRunning | Stop-Process -Force
            Start-Sleep -Seconds 2
        }
        Write-Success "Edge 已关闭"
    } else {
        Write-Success "Edge 未运行"
    }
}

function Get-EdgeProfileDirs {
    if (-not (Test-Path $script:UserDataRoot)) { return @() }

    $profiles = @()
    $defaultProfile = Join-Path $script:UserDataRoot "Default"
    if (Test-Path $defaultProfile) { $profiles += $defaultProfile }

    Get-ChildItem -Path $script:UserDataRoot -Directory -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "Profile *" -or $_.Name -eq "Guest Profile" } |
        ForEach-Object { $profiles += $_.FullName }

    return $profiles | Sort-Object -Unique
}

function Backup-EdgeKeyData {
    param(
        [string[]]$ProfileDirs,
        [switch]$IsDryRun
    )

    if (-not $ProfileDirs -or $ProfileDirs.Count -eq 0) {
        Write-Host "        未找到 Edge Profile，跳过备份" -ForegroundColor Gray
        return 0
    }

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupRoot = Join-Path $script:BackupRoot "edge-$timestamp"
    $count = 0

    if ($IsDryRun) {
        Write-Host "        [模拟备份] $backupRoot" -ForegroundColor DarkCyan
    } else {
        New-Item -Path $backupRoot -ItemType Directory -Force | Out-Null
    }

    foreach ($profileDir in $ProfileDirs) {
        $profileName = Split-Path $profileDir -Leaf
        $profileBackup = Join-Path $backupRoot $profileName
        if (-not $IsDryRun) {
            New-Item -Path $profileBackup -ItemType Directory -Force | Out-Null
        }

        $itemsToBackup = @(
            "Bookmarks",
            "Bookmarks.bak",
            "Preferences",
            "Secure Preferences",
            "Extensions"
        )

        foreach ($name in $itemsToBackup) {
            $source = Join-Path $profileDir $name
            if (-not (Test-Path $source)) { continue }

            $destination = Join-Path $profileBackup $name
            try {
                if ($IsDryRun) {
                    Write-Host "        [模拟备份] $source -> $destination" -ForegroundColor DarkCyan
                } else {
                    Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force -ErrorAction Stop
                    Write-Host "        已备份: $source" -ForegroundColor DarkGreen
                }
                $count++
            } catch {
                Write-Host "        无法备份: $source - $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
    }

    if (-not $IsDryRun -and $count -gt 0) {
        $manifest = [ordered]@{
            BackupType = "EdgeKeyData"
            CreatedAt = (Get-Date).ToString("o")
            UserDataRoot = $script:UserDataRoot
            Profiles = @($ProfileDirs | ForEach-Object { Split-Path $_ -Leaf })
            Items = @("Bookmarks", "Bookmarks.bak", "Preferences", "Secure Preferences", "Extensions")
            Note = "Edge 关键数据备份，包含书签、浏览器偏好、Secure Preferences 和扩展本体。"
        }
        $manifest | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $backupRoot "manifest.json") -Encoding utf8
        @(
            "OMM 日报系统个人清理备份"
            "类型：Edge 关键数据备份"
            "来源：$script:UserDataRoot"
            "内容：Bookmarks、Bookmarks.bak、Preferences、Secure Preferences、Extensions"
            "用途：清理 Edge 前保留可手动恢复的关键数据。"
        ) | Set-Content -Path (Join-Path $backupRoot "README.txt") -Encoding utf8
        Write-Host "        备份目录: $backupRoot" -ForegroundColor Green
    }

    return $count
}

function Get-PrivateBrowserProfileDirs {
    param([string]$Root)

    if ([string]::IsNullOrWhiteSpace($Root) -or -not (Test-Path -LiteralPath $Root)) {
        return @()
    }

    $profiles = @()
    $portableProfile = Join-Path $Root "profile"
    if (Test-Path -LiteralPath $portableProfile) {
        $profiles += $portableProfile
    }

    $profilesRoot = Join-Path $Root "Profiles"
    if (Test-Path -LiteralPath $profilesRoot) {
        Get-ChildItem -LiteralPath $profilesRoot -Directory -Force -ErrorAction SilentlyContinue |
            ForEach-Object { $profiles += $_.FullName }
    }

    return $profiles | Sort-Object -Unique
}

function Stop-PrivateBrowserProcesses {
    param(
        [string]$Root,
        [switch]$IsDryRun
    )

    if ([string]::IsNullOrWhiteSpace($Root) -or -not (Test-Path -LiteralPath $Root)) {
        Write-Host "        私人浏览器目录不存在，跳过关闭进程" -ForegroundColor Gray
        return
    }

    $resolvedRoot = (Resolve-Path -LiteralPath $Root).Path
    $processes = Get-Process -Name "firefox", "private_browsing" -ErrorAction SilentlyContinue |
        Where-Object {
            try {
                $_.Path -and $_.Path.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)
            } catch {
                $false
            }
        }

    if (-not $processes) {
        Write-Host "        私人浏览器未运行" -ForegroundColor Gray
        return
    }

    if ($IsDryRun) {
        Write-Host "        [模拟关闭] 找到 $($processes.Count) 个私人浏览器进程" -ForegroundColor DarkCyan
        return
    }

    $processes | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 800
    Write-Host "        私人浏览器已关闭" -ForegroundColor DarkGreen
}

function Test-CodexProcess {
    param(
        [string]$Name,
        [string]$Path
    )

    if (-not [string]::IsNullOrWhiteSpace($Name) -and $Name -match '(?i)codex') {
        return $true
    }
    if (-not [string]::IsNullOrWhiteSpace($Path) -and $Path -match '(?i)(\\|/|^)codex(\\|/|\.|_|-|$| )') {
        return $true
    }
    if (-not [string]::IsNullOrWhiteSpace($Path) -and $Path -match '(?i)OpenAI\.Codex') {
        return $true
    }
    return $false
}

function Stop-AdobiEdgeAndCodexProcesses {
    param(
        [string]$Root,
        [switch]$IsDryRun
    )

    $targets = @{}
    $resolvedRoot = $null

    if (-not [string]::IsNullOrWhiteSpace($Root) -and (Test-Path -LiteralPath $Root)) {
        $resolvedRoot = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\')
    } else {
        Write-Host "        Adobi 根目录不存在或不可访问: $Root" -ForegroundColor Yellow
    }

    Get-Process -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $path = $_.Path
            if ($resolvedRoot -and $path -and $path.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
                $targets[[int]$_.Id] = $_
            }
        } catch { }
    }

    Get-Process -Name "msedge" -ErrorAction SilentlyContinue | ForEach-Object {
        $targets[[int]$_.Id] = $_
    }

    Get-Process -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $path = $_.Path
            if (Test-CodexProcess -Name $_.ProcessName -Path $path) {
                $targets[[int]$_.Id] = $_
            }
        } catch {
            if (Test-CodexProcess -Name $_.ProcessName -Path "") {
                $targets[[int]$_.Id] = $_
            }
        }
    }

    $processes = @($targets.Values | Sort-Object ProcessName, Id)
    if ($processes.Count -eq 0) {
        Write-Host "        未发现 Adobi 目录进程、Edge 进程或 Codex 进程" -ForegroundColor Gray
        return 0
    }

    foreach ($proc in $processes) {
        $path = ""
        try { $path = $proc.Path } catch { $path = "" }
        $label = "$($proc.ProcessName) (PID $($proc.Id))"
        if ($path) { $label = "$label - $path" }

        if ($IsDryRun) {
            Write-Host "        [模拟关闭] $label" -ForegroundColor DarkCyan
        } else {
            Write-Host "        准备关闭: $label" -ForegroundColor DarkYellow
        }
    }

    if ($IsDryRun) {
        return $processes.Count
    }

    foreach ($proc in $processes) {
        try {
            if ($proc.MainWindowHandle -ne 0) {
                $proc.CloseMainWindow() | Out-Null
            }
        } catch { }
    }

    Start-Sleep -Milliseconds 900
    $closed = 0
    foreach ($proc in $processes) {
        try {
            $current = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
            if ($current) {
                Stop-Process -Id $proc.Id -Force -ErrorAction Stop
            }
            $closed++
        } catch {
            Write-Host "        无法关闭 $($proc.ProcessName) (PID $($proc.Id)): $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    Write-Host "        已处理 $closed 个进程" -ForegroundColor DarkGreen
    return $closed
}

function Clear-SystemProxySettings {
    param(
        [switch]$IsDryRun
    )

    $internetSettingsPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
    $proxyValues = @("ProxyServer", "ProxyOverride", "AutoConfigURL")
    $changed = 0

    if (-not (Test-Path -LiteralPath $internetSettingsPath)) {
        Write-Host "        当前用户代理设置注册表路径不存在，跳过" -ForegroundColor Gray
        return 0
    }

    $settings = Get-ItemProperty -LiteralPath $internetSettingsPath -ErrorAction SilentlyContinue
    $proxyEnable = 0
    if ($settings -and $null -ne $settings.ProxyEnable) {
        $proxyEnable = [int]$settings.ProxyEnable
    }

    $existingValues = @()
    foreach ($name in $proxyValues) {
        if ($settings -and $settings.PSObject.Properties.Name -contains $name) {
            $value = [string]$settings.$name
            if (-not [string]::IsNullOrWhiteSpace($value)) {
                $existingValues += "$name=$value"
            }
        }
    }

    if ($proxyEnable -eq 0 -and $existingValues.Count -eq 0) {
        Write-Host "        未发现已启用的系统代理或 PAC 地址" -ForegroundColor Gray
    } elseif ($IsDryRun) {
        Write-Host "        [模拟清理] 将关闭当前用户系统代理开关，并清空 ProxyServer / ProxyOverride / AutoConfigURL" -ForegroundColor DarkCyan
        if ($proxyEnable -ne 0) {
            Write-Host "        [当前代理] ProxyEnable=$proxyEnable" -ForegroundColor DarkCyan
        }
        foreach ($item in $existingValues) {
            Write-Host "        [当前代理] $item" -ForegroundColor DarkCyan
        }
    } else {
        try {
            Set-ItemProperty -LiteralPath $internetSettingsPath -Name "ProxyEnable" -Type DWord -Value 0 -ErrorAction Stop
            $changed++
        } catch {
            Write-Host "        无法关闭当前用户系统代理开关: $($_.Exception.Message)" -ForegroundColor Yellow
        }

        foreach ($name in $proxyValues) {
            try {
                Remove-ItemProperty -LiteralPath $internetSettingsPath -Name $name -ErrorAction SilentlyContinue
                $changed++
            } catch {
                Write-Host "        无法清理 ${name}: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }

        try {
            $signature = @'
[DllImport("wininet.dll", SetLastError = true)]
public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);
'@
            $wininet = Add-Type -MemberDefinition $signature -Name "WinInetOptions" -Namespace "OMMCleaner" -PassThru -ErrorAction Stop
            $wininet::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0) | Out-Null
            $wininet::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0) | Out-Null
        } catch {
            Write-Host "        系统代理刷新失败，重新打开浏览器后仍会读取新设置: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    if ($IsDryRun) {
        Write-Host "        [模拟清理] 将执行 netsh winhttp reset proxy；不会清理 HTTP_PROXY/HTTPS_PROXY 环境变量或 Codex 配置" -ForegroundColor DarkCyan
        return 1
    }

    try {
        $netshOutput = & netsh winhttp reset proxy 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "        已重置 WinHTTP 代理" -ForegroundColor DarkGreen
            $changed++
        } else {
            Write-Host "        WinHTTP 代理重置返回异常: $netshOutput" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "        无法执行 WinHTTP 代理重置: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    Write-Host "        已清理系统代理设置；未触碰 HTTP_PROXY/HTTPS_PROXY 环境变量或 Codex 配置" -ForegroundColor DarkGreen
    return $changed
}

function Backup-PrivateBrowserProfile {
    param(
        [string]$Root,
        [string[]]$ProfileDirs,
        [switch]$IsDryRun
    )

    if (-not $ProfileDirs -or $ProfileDirs.Count -eq 0) {
        Write-Host "        未找到私人浏览器 profile，跳过备份" -ForegroundColor Gray
        return 0
    }

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupRoot = Join-Path $script:BackupRoot "private-browser-$timestamp"
    $count = 0

    if ($IsDryRun) {
        Write-Host "        [模拟备份] 私人浏览器 profile -> $backupRoot" -ForegroundColor DarkCyan
    } else {
        New-Item -Path $backupRoot -ItemType Directory -Force | Out-Null
    }

    foreach ($profileDir in $ProfileDirs) {
        if (-not (Test-Path -LiteralPath $profileDir)) { continue }
        $profileName = Split-Path $profileDir -Leaf
        $destination = Join-Path $backupRoot $profileName
        try {
            if ($IsDryRun) {
                Write-Host "        [模拟备份] 私人浏览器 profile: $profileName" -ForegroundColor DarkCyan
            } else {
                Copy-Item -LiteralPath $profileDir -Destination $destination -Recurse -Force -ErrorAction Stop
                Write-Host "        已备份私人浏览器 profile: $profileName" -ForegroundColor DarkGreen
            }
            $count++
        } catch {
            Write-Host "        无法备份私人浏览器 profile: $profileName - $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    if (-not $IsDryRun -and $count -gt 0) {
        $manifest = [ordered]@{
            BackupType = "PrivateFirefoxProfile"
            CreatedAt = (Get-Date).ToString("o")
            PrivateBrowserRoot = $Root
            Profiles = @($ProfileDirs | ForEach-Object { Split-Path $_ -Leaf })
            Note = "完整 profile 备份，包含书签、历史、登录、Cookie 和站点数据。"
        }
        $manifest | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $backupRoot "manifest.json") -Encoding utf8
        @(
            "OMM 日报系统个人清理备份"
            "类型：私人 Firefox profile 备份"
            "来源：$Root"
            "内容：完整 Firefox profile，可能包含书签、历史、Cookie、登录态、保存登录和站点数据"
            "用途：清理私人浏览器前保留可手动恢复的完整 profile。"
        ) | Set-Content -Path (Join-Path $backupRoot "README.txt") -Encoding utf8
        Write-Host "        私人浏览器备份目录: $backupRoot" -ForegroundColor Green
    }

    return $count
}

function Clear-PrivateBrowserProfile {
    param(
        [string[]]$ProfileDirs,
        [switch]$IsDryRun
    )

    $patterns = @(
        "places.sqlite*",
        "cookies.sqlite*",
        "formhistory.sqlite*",
        "favicons.sqlite*",
        "permissions.sqlite*",
        "content-prefs.sqlite*",
        "webappsstore.sqlite*",
        "storage.sqlite*",
        "protections.sqlite*",
        "SiteSecurityServiceState.txt",
        "sessionstore.jsonlz4",
        "sessionstore-backups",
        "cache2",
        "startupCache",
        "shader-cache",
        "thumbnails",
        "jumpListCache",
        "safebrowsing",
        "minidumps",
        "crashes",
        "datareporting",
        "saved-telemetry-pings",
        "storage\default",
        "storage\temporary",
        "storage\permanent",
        "storage\to-be-removed",
        "storage\ls-archive.sqlite*",
        "OfflineCache",
        "downloads.json",
        "logins.json",
        "key4.db",
        "cert9.db"
    )

    $count = 0
    foreach ($profileDir in $ProfileDirs) {
        if (-not (Test-Path -LiteralPath $profileDir)) { continue }
        $profileName = Split-Path $profileDir -Leaf
        Write-SubStep "处理私人浏览器 profile: $profileName"

        foreach ($pattern in $patterns) {
            $searchPath = Join-Path $profileDir $pattern
            $parent = Split-Path -Parent $searchPath
            $filter = Split-Path -Leaf $searchPath
            if (-not (Test-Path -LiteralPath $parent)) { continue }

            $items = Get-ChildItem -Path $parent -Filter $filter -Force -ErrorAction SilentlyContinue
            foreach ($item in $items) {
                try {
                    if ($IsDryRun) {
                        Write-Host "        [模拟删除] 私人浏览器数据: $($item.Name)" -ForegroundColor DarkCyan
                    } else {
                        Remove-Item -LiteralPath $item.FullName -Recurse -Force -ErrorAction Stop
                        Write-Host "        已删除私人浏览器数据: $($item.Name)" -ForegroundColor DarkGreen
                    }
                    $count++
                } catch {
                    Write-Host "        无法删除私人浏览器数据: $($item.Name) - $($_.Exception.Message)" -ForegroundColor Yellow
                }
            }
        }
    }

    return $count
}

function Clear-PrivateBrowserHistory {
    param(
        [string[]]$ProfileDirs,
        [switch]$IsDryRun
    )

    $patterns = @(
        "places.sqlite*",
        "favicons.sqlite*"
    )

    $count = 0
    foreach ($profileDir in $ProfileDirs) {
        if (-not (Test-Path -LiteralPath $profileDir)) { continue }
        $profileName = Split-Path $profileDir -Leaf
        Write-SubStep "处理私人浏览器浏览记录: $profileName"
        Write-Deep "Firefox 浏览历史和书签同在 places.sqlite 数据库中；清理前建议保留 profile 备份"

        foreach ($pattern in $patterns) {
            $searchPath = Join-Path $profileDir $pattern
            $parent = Split-Path -Parent $searchPath
            $filter = Split-Path -Leaf $searchPath
            if (-not (Test-Path -LiteralPath $parent)) { continue }

            $items = Get-ChildItem -Path $parent -Filter $filter -Force -ErrorAction SilentlyContinue
            foreach ($item in $items) {
                try {
                    if ($IsDryRun) {
                        Write-Host "        [模拟删除] 私人浏览器历史数据库: $($item.Name)" -ForegroundColor DarkCyan
                    } else {
                        Remove-Item -LiteralPath $item.FullName -Recurse -Force -ErrorAction Stop
                        Write-Host "        已删除私人浏览器历史数据库: $($item.Name)" -ForegroundColor DarkGreen
                    }
                    $count++
                } catch {
                    Write-Host "        无法删除私人浏览器历史数据库: $($item.Name) - $($_.Exception.Message)" -ForegroundColor Yellow
                }
            }
        }
    }

    return $count
}

function Remove-EdgeItems {
    param(
        [string]$BaseDir,
        [string[]]$Patterns
    )

    $count = 0
    foreach ($pattern in $Patterns) {
        $searchPath = Join-Path $BaseDir $pattern
        $parent = Split-Path -Parent $searchPath
        $filter = Split-Path -Leaf $searchPath

        if (-not (Test-Path $parent)) { continue }

        $items = Get-ChildItem -Path $parent -Filter $filter -Recurse -Force -ErrorAction SilentlyContinue
        foreach ($item in $items) {
            try {
                if ($DryRun) {
                    Write-Host "        [模拟删除] $($item.FullName)" -ForegroundColor DarkCyan
                } else {
                    Remove-Item -Path $item.FullName -Recurse -Force -ErrorAction Stop
                    Write-Host "        已删除: $($item.FullName)" -ForegroundColor DarkGreen
                }
                $count++
            } catch {
                Write-Host "        无法删除: $($item.FullName)" -ForegroundColor Red
            }
        }
    }
    return $count
}

function Remove-GlobalItems {
    param(
        [string[]]$Names
    )

    $count = 0
    foreach ($name in $Names) {
        $path = Join-Path $script:UserDataRoot $name
        if (-not (Test-Path $path)) { continue }
        try {
            if ($DryRun) {
                Write-Host "        [模拟删除] $path" -ForegroundColor DarkCyan
            } else {
                Remove-Item -Path $path -Recurse -Force -ErrorAction Stop
                Write-Host "        已删除: $path" -ForegroundColor DarkGreen
            }
            $count++
        } catch {
            Write-Host "        无法删除: $path" -ForegroundColor Red
        }
    }
    return $count
}

function Show-Summary {
    param(
        [System.Collections.Specialized.OrderedDictionary]$Results,
        [hashtable]$Skipped,
        [hashtable]$DeepItems,
        [hashtable]$Choices
    )

    Write-Host "`n========================================" -ForegroundColor White
    Write-Host "           清 理 结 果 汇 总              " -ForegroundColor White
    Write-Host "========================================" -ForegroundColor White

    foreach ($category in $Results.Keys) {
        $isDeep = if ($DeepItems[$category]) { "（深度项）" } else { "" }
        Write-Host "  √ $category $isDeep : $($Results[$category]) 项" -ForegroundColor Green
    }

    Write-Host "`n  本次处理策略：" -ForegroundColor Cyan
    foreach ($key in $Choices.Keys | Sort-Object) {
        if ($key -eq "清理前备份") {
            $status = if ($Choices[$key]) { "启用" } else { "跳过" }
        } else {
            $status = if ($Choices[$key]) { "清理" } else { "保留" }
        }
        $color = if ($Choices[$key]) { "Green" } else { "Yellow" }
        Write-Host "    - $key : $status" -ForegroundColor $color
    }

    Write-Host "========================================" -ForegroundColor White
}

function Show-DeepExplanation {
    Write-Host "`n[说明] 以下项目是 Edge 自带'清除浏览数据'容易遗漏的深度项：" -ForegroundColor Cyan
    Write-Host "  1. IndexedDB / Local Storage / Session Storage：网站本地数据库" -ForegroundColor Gray
    Write-Host "  2. Service Worker / File System / blob_storage：后台脚本与文件缓存" -ForegroundColor Gray
    Write-Host "  3. GPUCache / Code Cache / ShaderCache：渲染与着色器缓存" -ForegroundColor Gray
    Write-Host "  4. Extension State / Rules / Scripts：扩展的运行时缓存与规则" -ForegroundColor Gray
    Write-Host "  5. Safe Browsing / TransportSecurity / DIPS：安全与隐私状态" -ForegroundColor Gray
    Write-Host "  6. BrowserMetrics / crashpad / *.log：诊断、崩溃报告与日志" -ForegroundColor Gray
}

function Read-MultiSelect {
    param(
        [string]$Prompt,
        [string[]]$Allowed,
        [string[]]$Default = @()
    )

    $allowedSet = @{}
    foreach ($item in $Allowed) { $allowedSet[$item.ToLowerInvariant()] = $true }
    $defaultText = if ($Default.Count -gt 0) { " [$($Default -join ',')]" } else { "" }

    while ($true) {
        $inputText = Read-Host "$Prompt$defaultText"
        if ([string]::IsNullOrWhiteSpace($inputText)) { return $Default }

        $tokens = $inputText -split '[,，\s]+' | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ -ne '' }
        $invalid = @($tokens | Where-Object { -not $allowedSet.ContainsKey($_) })
        if ($invalid.Count -eq 0) { return @($tokens | Select-Object -Unique) }

        Write-Warn "无效输入: $($invalid -join ', ')"
    }
}

function Set-EdgeCleaningDisabled {
    $script:CleanEdgeModule = $false
    $script:KeepHistory = $true
    $script:KeepCookies = $true
    $script:KeepSiteStorage = $true
    $script:KeepSessions = $true
    $script:KeepPasswords = $true
    $script:KeepAutofill = $true
    $script:ClearSitePreferences = $false
    $script:ClearSettings = $false
    $script:ClearBookmarks = $false
    $script:ClearExtensions = $false
    $script:ClearMicrosoftAccount = $false
    $script:CleanEdgeCaches = $false
    $script:CleanExtensionRuntime = $false
    $script:CleanMetadata = $false
    $script:CleanSecurityData = $false
    $script:CleanDiagnostics = $false
    $script:CleanOtherTempData = $false
    $script:CleanGlobalEdgeData = $false
    $script:CleanSystemTempData = $false
}

function Show-EdgeSubMenu {
    Write-Host "`nEdge 子项目（可多选，直接回车使用推荐项）：" -ForegroundColor Cyan
    Write-Host "  1  历史记录、下载索引、Top Sites、预测数据" -ForegroundColor White
    Write-Host "  2  Cookie 与站点凭证" -ForegroundColor White
    Write-Host "  3  网站本地存储（IndexedDB / Local Storage / Service Worker）" -ForegroundColor White
    Write-Host "  4  缓存（Cache / Code Cache / GPUCache / ShaderCache）" -ForegroundColor White
    Write-Host "  5  会话与恢复数据" -ForegroundColor White
    Write-Host "  6  已保存密码" -ForegroundColor White
    Write-Host "  7  自动填充与付款表单" -ForegroundColor White
    Write-Host "  8  站点设置与权限（保留界面 Preferences）" -ForegroundColor White
    Write-Host "  9  浏览器界面设置（会删除 Preferences）" -ForegroundColor Yellow
    Write-Host "  10 书签" -ForegroundColor Yellow
    Write-Host "  11 扩展运行时缓存" -ForegroundColor White
    Write-Host "  12 扩展本体" -ForegroundColor Yellow
    Write-Host "  13 微软账户与同步数据" -ForegroundColor Yellow
    Write-Host "  14 缩略图、Favicons、Shortcuts 等站点元数据" -ForegroundColor White
    Write-Host "  15 安全与隐私状态（HSTS / DIPS / Reporting）" -ForegroundColor White
    Write-Host "  16 诊断日志、崩溃报告和临时数据" -ForegroundColor White
    Write-Host "  A  全选（激进，不等同 ResetEdge；扩展本体仍需包含 12）" -ForegroundColor Gray

    $default = @('1','2','3','4','5','6','7','11','14','15','16')
    $edgeChoices = Read-MultiSelect -Prompt "输入 Edge 子项目编号" -Allowed @('1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','a') -Default $default
    if ($edgeChoices -contains 'a') {
        $edgeChoices = @('1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16')
    }

    $script:KeepHistory = -not ($edgeChoices -contains '1')
    $script:KeepCookies = -not ($edgeChoices -contains '2')
    $script:KeepSiteStorage = -not ($edgeChoices -contains '3')
    $script:CleanEdgeCaches = ($edgeChoices -contains '4')
    $script:KeepSessions = -not ($edgeChoices -contains '5')
    $script:KeepPasswords = -not ($edgeChoices -contains '6')
    $script:KeepAutofill = -not ($edgeChoices -contains '7')
    $script:ClearSitePreferences = ($edgeChoices -contains '8')
    $script:ClearSettings = ($edgeChoices -contains '9')
    $script:ClearBookmarks = ($edgeChoices -contains '10')
    $script:CleanExtensionRuntime = ($edgeChoices -contains '11')
    $script:ClearExtensions = ($edgeChoices -contains '12')
    $script:ClearMicrosoftAccount = ($edgeChoices -contains '13')
    $script:CleanMetadata = ($edgeChoices -contains '14')
    $script:CleanSecurityData = ($edgeChoices -contains '15')
    $script:CleanDiagnostics = ($edgeChoices -contains '16')
    $script:CleanOtherTempData = ($edgeChoices -contains '16')
    $script:CleanGlobalEdgeData = ($edgeChoices | Where-Object { $_ -in @('14','15','16') }).Count -gt 0
    $script:CleanSystemTempData = ($edgeChoices -contains '16')
}

function Show-Menu {
    Write-Host "`n请选择要清理的大类（可多选，用逗号分隔）：" -ForegroundColor Cyan
    Write-Host "  1. Edge 浏览器数据（进入子菜单）" -ForegroundColor White
    Write-Host "  2. Windows 通知中心/操作中心通知卡片" -ForegroundColor White
    Write-Host "  3. 截图文件夹" -ForegroundColor White
    Write-Host "  4. Windows 剪贴板历史" -ForegroundColor White
    Write-Host "  5. 私人入口开始菜单快捷方式" -ForegroundColor White
    Write-Host "  6. WiFi 配置文件" -ForegroundColor White
    Write-Host "  7. Adobi / Edge / Codex 运行进程" -ForegroundColor White
    Write-Host "  D. 模拟运行（不会真删）" -ForegroundColor Gray
    Write-Host "  R. ResetEdge 激进模式" -ForegroundColor Yellow

    $modules = Read-MultiSelect -Prompt "输入大类编号" -Allowed @('1','2','3','4','5','6','7','d','r') -Default @('1')

    if ($modules -contains 'd') { $script:DryRun = $true }
    if ($modules -contains 'r') {
        $script:ResetEdge = $true
        if (-not ($modules -contains '1')) { $modules += '1' }
    }

    if ($modules -contains '1') {
        $script:CleanEdgeModule = $true
        if (-not $script:ResetEdge) { Show-EdgeSubMenu }
    } else {
        Set-EdgeCleaningDisabled
    }

    $script:ClearWindowsNotifications = ($modules -contains '2')
    $script:CloseAdobiProcesses = ($modules -contains '7')
    if ($modules -contains '3') {
        do {
            $daysInput = Read-Host "删除截图文件夹中最近 N 天的截图（0 = 不清理，1 = 今天，2 = 今天+昨天）"
        } while ($daysInput -notmatch '^\d+$')
        $script:ClearScreenshotsDays = [int]$daysInput
    } else {
        $script:ClearScreenshotsDays = 0
    }
    $script:ClearClipboardHistory = ($modules -contains '4')
    $script:ClearOpencodeShortcuts = ($modules -contains '5')
    if ($modules -contains '6') {
        $wifiInput = Read-Host "保留哪些 WiFi 前缀（多个用逗号分隔，如 cpt3；留空 = 不保留任何前缀）"
        $script:KeepWifiPrefixes = ($wifiInput -split ',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
        if ($script:KeepWifiPrefixes.Count -eq 0) {
            Write-Warn "未输入保留前缀；将忘记所有已保存 WiFi 配置文件"
            $script:KeepWifiPrefixes = @('__KEEP_NOTHING__')
        }
    }
}

function Clear-PreferencesSiteSettings {
    param(
        [string]$ProfileDir,
        [switch]$IsDryRun
    )

    $count = 0
    $prefsPath = Join-Path $ProfileDir "Preferences"

    if (-not (Test-Path $prefsPath)) { return 0 }

    try {
        if ($IsDryRun) {
            Write-Host "        [模拟修改] $prefsPath" -ForegroundColor DarkCyan
            return 1
        }

        $content = Get-Content -Path $prefsPath -Raw -Encoding utf8 -ErrorAction Stop
        $json = $content | ConvertFrom-Json -ErrorAction Stop

        $keysToRemove = @(
            'content_settings'
            'default_content_setting_values'
            'password_hash_data_list'
            'background_password_check'
            'edge_password_is_using_new_login_db_path'
            'edge_password_login_db_path_flip_flop_count'
            'were_old_google_logins_removed'
            'last_time_password_store_metrics_reported'
            'last_time_obsolete_http_credentials_removed'
        )

        foreach ($key in $keysToRemove) {
            if (Get-Member -InputObject $json.profile -Name $key -MemberType Properties -ErrorAction SilentlyContinue) {
                $json.profile.PSObject.Properties.Remove($key)
            }
        }

        $newContent = $json | ConvertTo-Json -Depth 100 -Compress
        Set-Content -Path $prefsPath -Value $newContent -Encoding utf8 -NoNewline -ErrorAction Stop
        Write-Host "        已清理站点设置: $prefsPath" -ForegroundColor DarkGreen
        $count++
    } catch {
        Write-Host "        无法修改 $prefsPath - $($_.Exception.Message)" -ForegroundColor Red
    }

    return $count
}

function Invoke-NotificationClearAllButton {
    param(
        [switch]$IsDryRun
    )

    if ($IsDryRun) {
        Write-Host "        [模拟点击] 打开通知中心并点击“全部清除”按钮" -ForegroundColor DarkCyan
        Write-Host "        [模拟开启] 点击“请勿打扰”按钮；如果已开启则保持开启" -ForegroundColor DarkCyan
        Write-Host "        [模拟兜底] 如果通知中心没有暴露按钮，则写入当前用户 QuietHoursServiceState=1" -ForegroundColor DarkCyan
        return 1
    }

    try {
        Add-Type -AssemblyName UIAutomationClient -ErrorAction Stop
        Add-Type -AssemblyName UIAutomationTypes -ErrorAction Stop

        if (-not ("CleanerKeyboard" -as [type])) {
            Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class CleanerKeyboard {
    [DllImport("user32.dll")]
    private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    private const uint KEYEVENTF_KEYUP = 0x0002;

    public static void WinN() {
        keybd_event(0x5B, 0, 0, UIntPtr.Zero);
        keybd_event(0x4E, 0, 0, UIntPtr.Zero);
        keybd_event(0x4E, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(0x5B, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }

    public static void Escape() {
        keybd_event(0x1B, 0, 0, UIntPtr.Zero);
        keybd_event(0x1B, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@ -ErrorAction Stop
        }

        [CleanerKeyboard]::WinN()
        Start-Sleep -Milliseconds 900

        $root = [System.Windows.Automation.AutomationElement]::RootElement
        $condition = New-Object System.Windows.Automation.PropertyCondition -ArgumentList @(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::Button
        )
        $buttons = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
        $aliases = @("全部清除", "全部清理", "全部清空", "清除全部", "Clear all", "Clear all notifications")
        $doNotDisturbAliases = @("请勿打扰", "勿扰", "Do not disturb", "Do Not Disturb", "Focus assist", "专注助手")

        $clickedClearAll = $false
        for ($i = 0; $i -lt $buttons.Count; $i++) {
            $button = $buttons.Item($i)
            $name = $button.Current.Name
            if ([string]::IsNullOrWhiteSpace($name)) { continue }

            $matched = $false
            foreach ($alias in $aliases) {
                if ($name -eq $alias -or $name -like "*$alias*") {
                    $matched = $true
                    break
                }
            }

            if ($matched) {
                $pattern = $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
                $pattern.Invoke()
                Start-Sleep -Milliseconds 300
                Write-Host "        已点击通知中心按钮: $name" -ForegroundColor DarkGreen
                $clickedClearAll = $true
                break
            }
        }

        $dndCount = 0
        $dndHandled = $false
        $buttons = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
        for ($i = 0; $i -lt $buttons.Count; $i++) {
            $button = $buttons.Item($i)
            $name = $button.Current.Name
            if ([string]::IsNullOrWhiteSpace($name)) { continue }

            $matched = $false
            foreach ($alias in $doNotDisturbAliases) {
                if ($name -eq $alias -or $name -like "*$alias*") {
                    $matched = $true
                    break
                }
            }
            if (-not $matched) { continue }

            if ($name -match '(关闭|Turn off|Disable|已开启|On)') {
                Write-Host "        请勿打扰已开启: $name" -ForegroundColor DarkGreen
                $dndHandled = $true
                break
            }

            try {
                $togglePattern = $button.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
                if ($togglePattern.Current.ToggleState -eq [System.Windows.Automation.ToggleState]::Off) {
                    $togglePattern.Toggle()
                    Start-Sleep -Milliseconds 200
                    Write-Host "        已开启请勿打扰: $name" -ForegroundColor DarkGreen
                    $dndCount = 1
                    $dndHandled = $true
                } else {
                    Write-Host "        请勿打扰已开启: $name" -ForegroundColor DarkGreen
                    $dndHandled = $true
                }
            } catch {
                try {
                    $invokePattern = $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
                    $invokePattern.Invoke()
                    Start-Sleep -Milliseconds 200
                    Write-Host "        已点击请勿打扰按钮: $name" -ForegroundColor DarkGreen
                    $dndCount = 1
                    $dndHandled = $true
                } catch {
                    Write-Host "        找到请勿打扰按钮但无法点击: $name - $($_.Exception.Message)" -ForegroundColor Yellow
                }
            }
            break
        }

        [CleanerKeyboard]::Escape()
        if (-not $dndHandled) {
            $dndCount += Enable-DoNotDisturbFallback -IsDryRun:$false
        }
        if ($clickedClearAll) {
            return (1 + $dndCount)
        }

        Write-Host "        未找到通知中心“全部清除”按钮，可能当前没有可清理通知。" -ForegroundColor Yellow
        return $dndCount
    } catch {
        try { [CleanerKeyboard]::Escape() } catch { }
        Write-Host "        无法通过通知中心按钮清理: $($_.Exception.Message)" -ForegroundColor Yellow
        return (Enable-DoNotDisturbFallback -IsDryRun:$false)
    }
}

function Enable-DoNotDisturbFallback {
    param(
        [switch]$IsDryRun
    )

    $quietHoursPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\QuietHours"
    if ($IsDryRun) {
        Write-Host "        [模拟兜底] 写入 $quietHoursPath -> QuietHoursServiceState=1" -ForegroundColor DarkCyan
        return 1
    }

    try {
        if (-not (Test-Path -LiteralPath $quietHoursPath)) {
            New-Item -Path $quietHoursPath -Force | Out-Null
        }
        Set-ItemProperty -LiteralPath $quietHoursPath -Name "QuietHoursServiceState" -Type DWord -Value 1 -ErrorAction Stop
        Write-Host "        已通过注册表兜底开启请勿打扰: QuietHoursServiceState=1" -ForegroundColor DarkGreen
        return 1
    } catch {
        Write-Host "        请勿打扰兜底失败: $($_.Exception.Message)" -ForegroundColor Yellow
        return 0
    }
}

function Clear-WindowsNotificationDatabase {
    param(
        [switch]$IsDryRun
    )

    $count = 0
    $serviceNames = @()
    $serviceNames += Get-Service -Name "WpnUserService*" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
    $serviceNames += Get-Service -Name "WpnService" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
    $serviceNames = @($serviceNames | Sort-Object -Unique)
    $stoppedServices = @()

    foreach ($serviceName in $serviceNames) {
        try {
            if ($IsDryRun) {
                Write-Host "        [模拟暂停通知服务] $serviceName" -ForegroundColor DarkCyan
                $stoppedServices += $serviceName
                continue
            }

            $svc = Get-Service -Name $serviceName -ErrorAction Stop
            if ($svc.Status -ne 'Stopped') {
                Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 700
            }

            Write-Host "        已暂停通知服务: $serviceName" -ForegroundColor DarkGreen
            $stoppedServices += $serviceName
            $count++
        } catch {
            Write-Host "        无法暂停通知服务 $serviceName : $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    $notificationDir = "$env:LOCALAPPDATA\Microsoft\Windows\Notifications"
    $notificationPatterns = @(
        "wpndatabase.db",
        "wpndatabase.db-wal",
        "wpndatabase.db-shm",
        "wpndatabase.db-journal",
        "wpndatabase.db-*"
    )

    if (Test-Path $notificationDir) {
        $processedNotificationFiles = @{}
        foreach ($pattern in $notificationPatterns) {
            Get-ChildItem -Path $notificationDir -Filter $pattern -Force -ErrorAction SilentlyContinue | ForEach-Object {
                if ($processedNotificationFiles.ContainsKey($_.FullName)) { return }
                $processedNotificationFiles[$_.FullName] = $true
                try {
                    if ($IsDryRun) {
                        Write-Host "        [模拟清空通知数据库] $($_.FullName)" -ForegroundColor DarkCyan
                    } else {
                        Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop
                        Write-Host "        已清空通知数据库文件: $($_.FullName)" -ForegroundColor DarkGreen
                    }
                    $count++
                } catch {
                    Write-Host "        无法清空通知数据库文件: $($_.FullName) - $($_.Exception.Message)" -ForegroundColor Yellow
                }
            }
        }
    } else {
        Write-Host "        通知数据库目录不存在: $notificationDir" -ForegroundColor Gray
    }

    foreach ($serviceName in $stoppedServices) {
        try {
            if ($IsDryRun) {
                Write-Host "        [模拟恢复通知服务] $serviceName" -ForegroundColor DarkCyan
            } else {
                Start-Service -Name $serviceName -ErrorAction SilentlyContinue
                Write-Host "        已恢复通知服务: $serviceName" -ForegroundColor DarkGreen
            }
        } catch {
            Write-Host "        无法恢复通知服务 $serviceName : $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    return $count
}

function Clear-WindowsNotificationHistory {
    param(
        [switch]$IsDryRun
    )

    $count = 0

    # 方法1: 模拟通知中心的“全部清除”按钮，避免重启 Explorer/任务栏造成屏幕闪烁。
    $buttonCount = Invoke-NotificationClearAllButton -IsDryRun:$IsDryRun
    $count += $buttonCount

    # 方法2: 调用 Windows Runtime API。部分 PowerShell 会话会返回 0x80070490，失败不再走破坏性数据库方案。
    try {
        if ($IsDryRun) {
            Write-Host "        [模拟调用] ToastNotificationManager.History.Clear()" -ForegroundColor DarkCyan
            $count++
        } else {
            $null = Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue
            [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
            [Windows.UI.Notifications.ToastNotificationManager]::History.Clear() | Out-Null
            Write-Host "        已调用系统通知历史 API" -ForegroundColor DarkGreen
            $count++
        }
    } catch {
        Write-Host "        无法通过 API 清空通知历史: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    # 方法3: 如果系统没有暴露“全部清除”按钮，则清空通知数据库兜底；不重启 Explorer/任务栏。
    if ($buttonCount -eq 0) {
        Write-Host "        未能直接点击“全部清除”，改用通知数据库兜底清理（不重启任务栏）" -ForegroundColor Yellow
        $count += Clear-WindowsNotificationDatabase -IsDryRun:$IsDryRun
    }

    # 方法4: 清理通知设置中的历史计数和时间戳。
    $settingsPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings"
    if (Test-Path $settingsPath) {
        try {
            Get-ChildItem -Path $settingsPath -ErrorAction SilentlyContinue | ForEach-Object {
                $itemPath = $_.PSPath
                $props = Get-ItemProperty -Path $itemPath -ErrorAction SilentlyContinue
                $propNames = $props.PSObject.Properties.Name | Where-Object { $_ -match 'LastNotificationAddedTime|PeriodicNotificationCount|PeriodicInteractionCount|IsOptOutCandidate' }
                foreach ($propName in $propNames) {
                    try {
                        if ($IsDryRun) {
                            Write-Host "        [模拟清理] $($_.PSChildName) -> $propName" -ForegroundColor DarkCyan
                        } else {
                            Remove-ItemProperty -Path $itemPath -Name $propName -ErrorAction Stop
                            Write-Host "        已清理: $($_.PSChildName) -> $propName" -ForegroundColor DarkGreen
                        }
                        $count++
                    } catch {
                        Write-Host "        无法清理: $($_.PSChildName) -> $propName" -ForegroundColor Yellow
                    }
                }
            }
        } catch {
            Write-Host "        无法读取通知设置注册表: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    return $count
}

function Clear-Screenshots {
    param(
        [Nullable[datetime]]$StartTime = $null,
        [Nullable[datetime]]$EndTime = $null,
        [string]$WindowLabel = "",
        [int]$DaysToDelete = 0,
        [switch]$IsDryRun,
        [switch]$RequireConfirm
    )

    $count = 0
    $screenshotsDir = "$env:USERPROFILE\Pictures\Screenshots"

    if (-not (Test-Path $screenshotsDir)) {
        Write-Host "        截图目录不存在: $screenshotsDir" -ForegroundColor Gray
        return 0
    }

    if ($DaysToDelete -lt 0) { $DaysToDelete = 0 }

    $hasWindow = $StartTime.HasValue -and $EndTime.HasValue
    if ($hasWindow -and $EndTime.Value -le $StartTime.Value) {
        Write-Host "        截图时间窗口无效，结束时间必须晚于开始时间" -ForegroundColor Yellow
        return 0
    }

    if (-not $hasWindow -and $DaysToDelete -eq 0) {
        Write-Host "        不清理截图" -ForegroundColor Gray
        return 0
    }

    $allScreenshots = Get-ChildItem -Path $screenshotsDir -File -ErrorAction SilentlyContinue
    if ($hasWindow) {
        $itemsToDelete = $allScreenshots |
            Where-Object { $_.LastWriteTime -ge $StartTime.Value -and $_.LastWriteTime -lt $EndTime.Value }
        $windowText = if ([string]::IsNullOrWhiteSpace($WindowLabel)) {
            "$($StartTime.Value.ToString('yyyy-MM-dd HH:mm')) 至 $($EndTime.Value.ToString('yyyy-MM-dd HH:mm'))"
        } else {
            $WindowLabel
        }
    } else {
        # 兼容旧交互菜单：删除最近 N 天（含当天）的文件
        $cutoff = (Get-Date).Date.AddDays(-$DaysToDelete)
        $itemsToDelete = $allScreenshots | Where-Object { $_.LastWriteTime -ge $cutoff }
        $windowText = "$($cutoff.ToString('yyyy-MM-dd')) 之后"
    }

    $totalSize = ($itemsToDelete | Measure-Object -Property Length -Sum).Sum
    $sizeText = if ($totalSize -gt 1GB) { "{0:N2} GB" -f ($totalSize / 1GB) } elseif ($totalSize -gt 1MB) { "{0:N2} MB" -f ($totalSize / 1MB) } elseif ($totalSize -gt 1KB) { "{0:N2} KB" -f ($totalSize / 1KB) } else { "$totalSize B" }

    Write-Host "        将删除 $($itemsToDelete.Count) 个文件（约 $sizeText），时间范围: $windowText" -ForegroundColor Yellow

    if ($RequireConfirm -and -not $IsDryRun) {
        $confirm = Read-Host "        确认删除这些截图？输入 'yes' 确认"
        if ($confirm -ne 'yes') {
            Write-Host "        已取消截图清理" -ForegroundColor Yellow
            return 0
        }
    }

    foreach ($item in $itemsToDelete) {
        try {
            if ($IsDryRun) {
                Write-Host "        [模拟删除] $($item.FullName)" -ForegroundColor DarkCyan
            } else {
                Remove-Item -Path $item.FullName -Force -ErrorAction Stop
                Write-Host "        已删除: $($item.FullName)" -ForegroundColor DarkGreen
            }
            $count++
        } catch {
            Write-Host "        无法删除: $($item.FullName)" -ForegroundColor Red
        }
    }

    return $count
}

function Clear-ClipboardHistory {
    param(
        [switch]$IsDryRun
    )

    $count = 0

    # 方法1: 调用 Windows Runtime API 清空剪贴板历史界面
    try {
        if ($IsDryRun) {
            Write-Host "        [模拟调用] Clipboard.ClearHistory()" -ForegroundColor DarkCyan
            $count++
        } else {
            $null = Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue
            [Windows.ApplicationModel.DataTransfer.Clipboard, Windows.ApplicationModel.DataTransfer, ContentType = WindowsRuntime] | Out-Null
            [Windows.ApplicationModel.DataTransfer.Clipboard]::ClearHistory() | Out-Null
            Write-Host "        已通过 API 清空剪贴板历史界面" -ForegroundColor DarkGreen
            $count++
        }
    } catch {
        Write-Host "        无法通过 API 清空剪贴板历史: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    # 方法2: 删除剪贴板历史数据目录
    $historyDir = "$env:LOCALAPPDATA\Microsoft\Windows\Clipboard\HistoryData"

    if (-not (Test-Path $historyDir)) {
        Write-Host "        剪贴板历史目录不存在: $historyDir" -ForegroundColor Gray
    } else {
        Get-ChildItem -Path $historyDir -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                if ($IsDryRun) {
                    Write-Host "        [模拟删除] $($_.FullName)" -ForegroundColor DarkCyan
                } else {
                    if ($_.PSIsContainer) {
                        Remove-Item -Path $_.FullName -Recurse -Force -ErrorAction Stop
                    } else {
                        Remove-Item -Path $_.FullName -Force -ErrorAction Stop
                    }
                    Write-Host "        已删除: $($_.FullName)" -ForegroundColor DarkGreen
                }
                $count++
            } catch {
                Write-Host "        无法删除: $($_.FullName)" -ForegroundColor Yellow
            }
        }
    }

    # 方法3: 清理注册表中的历史时间戳
    $clipboardRegPath = "HKCU:\Software\Microsoft\Clipboard"
    if (Test-Path $clipboardRegPath) {
        $propNames = @("HistoryOldItemsLastCleanupTimestamp")
        foreach ($propName in $propNames) {
            try {
                if (Get-ItemProperty -Path $clipboardRegPath -Name $propName -ErrorAction SilentlyContinue) {
                    if ($IsDryRun) {
                        Write-Host "        [模拟清理] 注册表: $clipboardRegPath -> $propName" -ForegroundColor DarkCyan
                    } else {
                        Remove-ItemProperty -Path $clipboardRegPath -Name $propName -ErrorAction Stop
                        Write-Host "        已清理: 注册表 $clipboardRegPath -> $propName" -ForegroundColor DarkGreen
                    }
                    $count++
                }
            } catch {
                Write-Host "        无法清理注册表: $clipboardRegPath -> $propName" -ForegroundColor Yellow
            }
        }
    }

    return $count
}

function Test-ProtectedRecycleBinName {
    param(
        [string]$Name,
        [string]$Path
    )

    $text = "$Name $Path"
    if ($Name -match '(?i)\.(xlsx?|csv)$' -or $Path -match '(?i)\.(xlsx?|csv)$') { return $true }
    if ($text -match '(?i)(^|\\|/| )inspec([^\\/]*)') { return $true }
    if ($text -match '(?i)-OMM') { return $true }
    if ($text -match '送测') { return $true }
    return $false
}

function Clear-RecycleBinSafe {
    param(
        [switch]$IsDryRun
    )

    $count = 0
    $protected = 0

    try {
        $shell = New-Object -ComObject Shell.Application
        $recycleBin = $shell.Namespace(10)
        if ($recycleBin) {
            $items = @($recycleBin.Items())
            if ($items.Count -eq 0) {
                Write-Host "        回收站为空" -ForegroundColor Gray
                return 0
            }

            foreach ($item in $items) {
                $name = [string]$item.Name
                $path = [string]$item.Path
                if (Test-ProtectedRecycleBinName -Name $name -Path $path) {
                    Write-Host "        保留: $name" -ForegroundColor Gray
                    $protected++
                    continue
                }

                try {
                    if ($IsDryRun) {
                        Write-Host "        [模拟清理回收站] $name" -ForegroundColor DarkCyan
                    } else {
                        $item.InvokeVerb("delete")
                        Write-Host "        已清理回收站项目: $name" -ForegroundColor DarkGreen
                    }
                    $count++
                } catch {
                    Write-Host "        无法清理回收站项目: $name - $($_.Exception.Message)" -ForegroundColor Yellow
                }
            }

            Write-Host "        回收站保护项目: $protected 项" -ForegroundColor Gray
            return $count
        }
    } catch {
        Write-Host "        无法通过 Shell 读取回收站，改用文件系统扫描: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    $recycleRoots = Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path $_.Root '$Recycle.Bin' } |
        Where-Object { Test-Path -LiteralPath $_ }

    foreach ($root in $recycleRoots) {
        Get-ChildItem -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue |
            Where-Object { -not $_.PSIsContainer -and $_.Name -notmatch '^\$I' } |
            ForEach-Object {
                if (Test-ProtectedRecycleBinName -Name $_.Name -Path $_.FullName) {
                    Write-Host "        保留: $($_.FullName)" -ForegroundColor Gray
                    $protected++
                } else {
                    try {
                        if ($IsDryRun) {
                            Write-Host "        [模拟清理回收站] $($_.FullName)" -ForegroundColor DarkCyan
                        } else {
                            Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop
                            Write-Host "        已清理回收站项目: $($_.FullName)" -ForegroundColor DarkGreen
                        }
                        $count++
                    } catch {
                        Write-Host "        无法清理回收站项目: $($_.FullName) - $($_.Exception.Message)" -ForegroundColor Yellow
                    }
                }
            }
    }

    Write-Host "        回收站保护项目: $protected 项" -ForegroundColor Gray
    return $count
}

function Clear-OpencodeShortcuts {
    param(
        [switch]$IsDryRun
    )

    $count = 0
    $startMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"

    if (-not (Test-Path $startMenuDir)) {
        Write-Host "        开始菜单目录不存在: $startMenuDir" -ForegroundColor Gray
        return 0
    }

    $patterns = @(
        "*opencode*",
        "*OpenCode*",
        "Firefox 隐私浏览.lnk",
        "Firefox*隐私浏览*.lnk",
        "“”.lnk",
        '""*.lnk'
    )
    $processed = @()

    foreach ($pattern in $patterns) {
        Get-ChildItem -Path $startMenuDir -Filter $pattern -File -ErrorAction SilentlyContinue | ForEach-Object {
            if ($processed -contains $_.FullName) { return }
            $processed += $_.FullName

            try {
                if ($IsDryRun) {
                    Write-Host "        [模拟删除] $($_.FullName)" -ForegroundColor DarkCyan
                } else {
                    Remove-Item -Path $_.FullName -Force -ErrorAction Stop
                    Write-Host "        已删除: $($_.FullName)" -ForegroundColor DarkGreen
                }
                $count++
            } catch {
                Write-Host "        无法删除: $($_.FullName)" -ForegroundColor Red
            }
        }
    }

    return $count
}

function Clear-WifiProfiles {
    param(
        [string[]]$KeepPrefixes,
        [string[]]$ForgetPatterns,
        [switch]$IsDryRun
    )

    $count = 0

    try {
        $profilesOutput = netsh wlan show profiles 2>$null
        $profileNames = $profilesOutput | Select-String '^\s*所有用户配置文件\s*:\s*(.+)$|^\s*All User Profile\s*:\s*(.+)$' | ForEach-Object {
            if ($_.Matches[0].Groups[1].Success) { $_.Matches[0].Groups[1].Value.Trim() }
            else { $_.Matches[0].Groups[2].Value.Trim() }
        }
    } catch {
        Write-Host "        无法获取 WiFi 配置文件列表: $($_.Exception.Message)" -ForegroundColor Red
        return 0
    }

    if (-not $profileNames) {
        Write-Host "        未找到任何已保存的 WiFi 配置文件" -ForegroundColor Gray
        return 0
    }

    foreach ($ssid in $profileNames) {
        if ($ForgetPatterns -and $ForgetPatterns.Count -gt 0) {
            $shouldForget = $false
            foreach ($pattern in $ForgetPatterns) {
                if ($ssid -like $pattern) {
                    $shouldForget = $true
                    break
                }
            }

            if (-not $shouldForget) {
                Write-Host "        保留: $ssid" -ForegroundColor Gray
                continue
            }

            try {
                if ($IsDryRun) {
                    Write-Host "        [模拟忘记] WiFi: $ssid" -ForegroundColor DarkCyan
                } else {
                    $result = netsh wlan delete profile name="$ssid" 2>&1
                    if ($LASTEXITCODE -eq 0 -or $result -match '已从接口|deleted from interface') {
                        Write-Host "        已忘记 WiFi: $ssid" -ForegroundColor DarkGreen
                    } else {
                        Write-Host "        无法忘记 WiFi: $ssid - $result" -ForegroundColor Red
                        continue
                    }
                }
                $count++
            } catch {
                Write-Host "        无法忘记 WiFi: $ssid - $($_.Exception.Message)" -ForegroundColor Red
            }
            continue
        }

        $shouldKeep = $false
        foreach ($prefix in $KeepPrefixes) {
            if ($ssid -like "$prefix*") {
                $shouldKeep = $true
                break
            }
        }

        if ($shouldKeep) {
            Write-Host "        保留: $ssid" -ForegroundColor Gray
            continue
        }

        try {
            if ($IsDryRun) {
                Write-Host "        [模拟忘记] WiFi: $ssid" -ForegroundColor DarkCyan
            } else {
                $result = netsh wlan delete profile name="$ssid" 2>&1
                if ($LASTEXITCODE -eq 0 -or $result -match '已从接口|deleted from interface') {
                    Write-Host "        已忘记 WiFi: $ssid" -ForegroundColor DarkGreen
                } else {
                    Write-Host "        无法忘记 WiFi: $ssid - $result" -ForegroundColor Red
                    continue
                }
            }
            $count++
        } catch {
            Write-Host "        无法忘记 WiFi: $ssid - $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    return $count
}

function Connect-CompanyWifi {
    param(
        [string]$Ssid,
        [switch]$IsDryRun
    )

    $targetSsid = $Ssid.Trim()
    if ([string]::IsNullOrWhiteSpace($targetSsid)) {
        Write-Host "        公司 WiFi 名称为空，跳过连接" -ForegroundColor Yellow
        return 0
    }

    try {
        $profilesOutput = netsh wlan show profiles 2>$null
        $profileNames = @($profilesOutput | Select-String '^\s*所有用户配置文件\s*:\s*(.+)$|^\s*All User Profile\s*:\s*(.+)$' | ForEach-Object {
            if ($_.Matches[0].Groups[1].Success) { $_.Matches[0].Groups[1].Value.Trim() }
            else { $_.Matches[0].Groups[2].Value.Trim() }
        })
        if ($profileNames -notcontains $targetSsid) {
            Write-Host "        未找到已保存的公司 WiFi 配置: $targetSsid；请先手动连接一次并保存密码" -ForegroundColor Yellow
            return 0
        }
    } catch {
        Write-Host "        无法读取 WiFi 配置文件列表: $($_.Exception.Message)" -ForegroundColor Yellow
        return 0
    }

    if ($IsDryRun) {
        Write-Host "        [模拟设置] 将把 WiFi '$targetSsid' 设置为自动连接" -ForegroundColor DarkCyan
        Write-Host "        [模拟连接] 将尝试连接 WiFi '$targetSsid'；真实执行时网络可能短暂断开" -ForegroundColor DarkCyan
        return 1
    }

    $count = 0
    try {
        $setResult = netsh wlan set profileparameter name="$targetSsid" connectionmode=auto 2>&1
        if ($LASTEXITCODE -eq 0 -or $setResult -match '成功|successfully') {
            Write-Host "        已设置自动连接: $targetSsid" -ForegroundColor DarkGreen
            $count++
        } else {
            Write-Host "        设置自动连接失败: $targetSsid - $setResult" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "        设置自动连接失败: $targetSsid - $($_.Exception.Message)" -ForegroundColor Yellow
    }

    try {
        $connectResult = netsh wlan connect name="$targetSsid" ssid="$targetSsid" 2>&1
        if ($LASTEXITCODE -eq 0 -or $connectResult -match '已成功|successfully') {
            Write-Host "        已发起连接公司 WiFi: $targetSsid" -ForegroundColor DarkGreen
            $count++
        } else {
            Write-Host "        连接公司 WiFi 失败: $targetSsid - $connectResult" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "        连接公司 WiFi 失败: $targetSsid - $($_.Exception.Message)" -ForegroundColor Yellow
    }

    return $count
}

# ====================== 主流程 ======================

Clear-Host
Write-Host "Microsoft Edge 深度补充清理工具" -ForegroundColor Magenta
Write-Host "用途：在 Edge 自带'清除浏览数据'之后，清理残留的底层数据" -ForegroundColor Magenta
Write-Host "模式: $(if ($DryRun) { '模拟运行（不会真删）' } else { '真实清理' })" -ForegroundColor Magenta
Write-Host ""

# 如果没有任何显式参数（除了可能的 DryRun / SkipBackup），显示交互菜单
$hasExplicitSwitches = $PSBoundParameters.Keys | Where-Object { $_ -notin @('DryRun', 'NoMenu', 'SkipBackup') }
if (-not $NoMenu -and -not $hasExplicitSwitches) {
    Show-Menu
}

if ($SkipEdgeCleaning) {
    Set-EdgeCleaningDisabled
}

if ($ResetEdge) {
    Write-Warn "已启用 -ResetEdge：将清理除扩展本体和核心设置骨架外的绝大多数数据"
}

if ($SkipStandardEdgeCleaning -and -not $ResetEdge) {
    $KeepHistory = $true
    $KeepCookies = $true
    $KeepSiteStorage = $true
    $KeepSessions = $true
    $script:CleanEdgeCaches = $false
    $script:CleanExtensionRuntime = $false
    $script:CleanMetadata = $false
    $script:CleanSecurityData = $false
    $script:CleanDiagnostics = $false
    $script:CleanOtherTempData = $false
    $script:CleanGlobalEdgeData = $false
    $script:CleanSystemTempData = $false
    Write-Warn "已跳过 Edge 标准隐私清理，仅执行显式选择的 Edge 子项目"
}

if ($script:CleanEdgeModule) {
    Stop-EdgeProcesses
}

if ($CleanPrivateBrowser -or $ClearPrivateBrowserHistory) {
    Stop-PrivateBrowserProcesses -Root $PrivateBrowserRoot -IsDryRun:$DryRun
}

$profileDirs = Get-EdgeProfileDirs
if ($script:CleanEdgeModule -and -not $profileDirs -and -not (Test-Path $script:UserDataRoot)) {
    Write-Host "未找到 Microsoft Edge 用户数据目录。" -ForegroundColor Red
    if (-not [string]::IsNullOrWhiteSpace($JsonSummaryPath)) {
        $summaryDir = Split-Path -Parent $JsonSummaryPath
        if (-not [string]::IsNullOrWhiteSpace($summaryDir)) {
            New-Item -Path $summaryDir -ItemType Directory -Force | Out-Null
        }
        [ordered]@{
            status = "failed"
            dry_run = [bool]$DryRun
            error = "未找到 Microsoft Edge 用户数据目录"
            finished_at = (Get-Date).ToString("o")
        } | ConvertTo-Json -Depth 5 | Set-Content -Path $JsonSummaryPath -Encoding utf8
    }
    if ($script:TranscriptStarted) {
        Stop-Transcript | Out-Null
    }
    if (-not $NoMenu) { Read-Host "按 Enter 键退出" }
    exit 1
}

# 如果启用 ResetEdge，则强制清理所有可选项目（扩展仍保留，除非用户同时指定 -ClearExtensions）
if ($ResetEdge) {
    $script:CleanEdgeModule = $true
    $script:CleanEdgeCaches = $true
    $script:CleanExtensionRuntime = $true
    $script:CleanMetadata = $true
    $script:CleanSecurityData = $true
    $script:CleanDiagnostics = $true
    $script:CleanOtherTempData = $true
    $script:CleanGlobalEdgeData = $true
    $script:CleanSystemTempData = $true
    $KeepCookies = $false
    $KeepHistory = $false
    $KeepSiteStorage = $false
    $KeepSessions = $false
    $KeepPasswords = $false
    $KeepAutofill = $false
    $ClearBookmarks = $true
    $ClearSettings = $true
    $ClearSitePreferences = $true
    $ClearMicrosoftAccount = $true
}

$results = [ordered]@{
    "Edge 关键数据备份" = 0
    "历史记录残留" = 0
    "Cookie 与站点凭证" = 0
    "网站本地存储" = 0
    "各类缓存" = 0
    "会话与恢复数据" = 0
    "扩展缓存" = 0
    "密码与自动填充" = 0
    "站点设置与权限" = 0
    "浏览器界面设置" = 0
    "书签" = 0
    "扩展本体" = 0
    "微软账户与同步" = 0
    "缩略图与站点元数据" = 0
    "安全与隐私数据" = 0
    "诊断日志与崩溃报告" = 0
    "运行进程" = 0
    "系统代理设置" = 0
    "Windows 通知历史" = 0
    "截图文件" = 0
    "剪贴板历史" = 0
    "回收站" = 0
    "私人入口快捷方式" = 0
    "私人浏览器备份" = 0
    "私人浏览器数据" = 0
    "WiFi 配置文件" = 0
    "公司 WiFi 连接" = 0
    "全局数据" = 0
    "其他临时数据" = 0
}

$deepItems = @{
    "网站本地存储" = $true
    "扩展缓存" = $true
    "密码与自动填充" = $true
    "站点设置与权限" = $true
    "浏览器界面设置" = $true
    "安全与隐私数据" = $true
    "诊断日志与崩溃报告" = $true
    "运行进程" = $true
    "系统代理设置" = $true
    "Windows 通知历史" = $true
    "截图文件" = $true
    "剪贴板历史" = $true
    "回收站" = $true
    "私人入口快捷方式" = $true
    "私人浏览器备份" = $true
    "私人浏览器数据" = $true
    "WiFi 配置文件" = $true
    "公司 WiFi 连接" = $true
    "全局数据" = $true
}

$choices = [ordered]@{
    "Edge 浏览器数据模块" = $script:CleanEdgeModule
    "清理前备份" = (-not $SkipBackup -and $script:CleanEdgeModule)
    "历史记录" = -not $KeepHistory
    "Cookie 与站点凭证" = -not $KeepCookies
    "网站本地存储" = -not $KeepSiteStorage
    "各类缓存" = $script:CleanEdgeCaches
    "会话与恢复数据" = -not $KeepSessions
    "扩展运行时缓存" = $script:CleanExtensionRuntime
    "密码" = -not $KeepPasswords
    "自动填充" = -not $KeepAutofill
    "站点设置/权限" = [bool]$ClearSitePreferences
    "浏览器界面设置" = [bool]$ClearSettings
    "书签" = [bool]$ClearBookmarks
    "扩展本体" = [bool]$ClearExtensions
    "微软账户/同步" = [bool]$ClearMicrosoftAccount
    "缩略图与站点元数据" = $script:CleanMetadata
    "安全与隐私数据" = $script:CleanSecurityData
    "诊断日志与崩溃报告" = $script:CleanDiagnostics
    "Adobi / Edge / Codex 运行进程" = [bool]$CloseAdobiProcesses
    "Windows 通知历史" = [bool]$ClearWindowsNotifications
    "截图文件 (当班时间窗口)" = ($ClearScreenshots -or $ClearScreenshotsDays -gt 0)
    "剪贴板历史" = [bool]$ClearClipboardHistory
    "回收站" = [bool]$ClearRecycleBin
    "私人入口快捷方式" = [bool]$ClearOpencodeShortcuts
    "私人浏览器浏览记录" = [bool]$ClearPrivateBrowserHistory
    "私人浏览器清理" = [bool]$CleanPrivateBrowser
    "私人浏览器备份" = (($CleanPrivateBrowser -or $ClearPrivateBrowserHistory) -and -not $SkipPrivateBrowserBackup)
    "WiFi 配置文件" = (($KeepWifiPrefixes.Count -gt 0) -or ($ForgetWifiPatterns.Count -gt 0))
    "公司 WiFi 连接" = [bool]$ConnectCompanyWifi
}

if ($CloseAdobiProcesses) {
    Write-Step "正在关闭 Adobi / Edge / Codex 运行进程..."
    Write-Deep "只处理可执行路径位于 Adobi 根目录下的进程，并额外包含 Edge 和 Codex 前后台进程；不删除任何文件"
    Write-Deep "如果 Adobi 中的代理软件曾修改系统代理，本项会清空当前用户系统代理和 WinHTTP 代理；不清理 Codex 自身代理配置或 HTTP_PROXY/HTTPS_PROXY 环境变量"
    $results["运行进程"] += Stop-AdobiEdgeAndCodexProcesses -Root $AdobiRoot -IsDryRun:$DryRun
    $results["系统代理设置"] += Clear-SystemProxySettings -IsDryRun:$DryRun
    Write-Success "Adobi / Edge / Codex 运行进程处理完成"
}

$historyPatterns = @(
    "History*"
    "Visited Links"
    "Top Sites"
    "Media History*"
    "Network Action Predictor*"
    "DownloadMetadata"
)

$cookiePatterns = @(
    "Cookies*"
    "Trust Tokens*"
    "Shared Dictionary"
    "Token Service"
    "Affiliation Database"
)

$siteStoragePatterns = @(
    "IndexedDB"
    "Local Storage"
    "Session Storage"
    "File System"
    "Service Worker"
    "blob_storage"
    "databases"
    "Storage\default"
    "site_engagement"
)

$cachePatterns = @(
    "Cache"
    "Code Cache"
    "GPUCache"
    "Media Cache"
    "GrShaderCache"
    "GraphiteDawnCache"
    "ShaderCache"
    "optimization_guide_model*"
    "PnaclTranslationCache"
)

$sessionPatterns = @(
    "Sessions"
    "Last Session"
    "Last Tabs"
    "Current Session"
    "Current Tabs"
)

$extensionRuntimePatterns = @(
    "Extension State"
    "Extension Rules"
    "Extension Scripts"
    "Extension ActivityLog"
    "Storage\ext"
    "Local Extension Settings"
)

$extensionBodyPatterns = @(
    "Extensions"
)

$passwordPatterns = @(
    "Login Data"
    "Login Data-journal"
    "AutofillStrikeDatabase"
    "AutofillAiModelCache"
    "EdgeWallet"
    "PaymentRequestMethodNames"
    "Secure Payment Confirmation"
)

$autofillPatterns = @(
    "Web Data*"
)

$siteSettingsPatterns = @(
    "Preferences"
    "Secure Preferences"
)

$sitePreferencesPatterns = @(
    "Preferences"
    "Secure Preferences"
)

$bookmarksPatterns = @(
    "Bookmarks*"
    "BookmarkMergedSurfaceOrdering"
)

$microsoftAccountPatterns = @(
    "Login Data For Account*"
    "Profile.pb"
    "AccountInfo"
    "Token Service"
    "Sync Data"
    "Network Persistent State"
    "Network\Network Persistent State"
)

$metadataPatterns = @(
    "Favicons*"
    "Thumbnails"
    "Shortcuts*"
    "JumpListIcons*"
)

$securityPatterns = @(
    "Safe Browsing Network"
    "Network\TransportSecurity"
    "Network\Reporting and NEL"
    "DIPS"
    "CertificateRevocation"
    "Origin Bound Certs"
)

$diagnosticPatterns = @(
    "crashpad*"
    "BrowserMetrics*"
    "Diagnostic*"
    "Logs"
    "greaselion"
    "*.log"
)

$otherPatterns = @(
    "QuotaManager*"
    "Segmentation Platform"
    "*.tmp"
)

$globalItems = @(
    "Safe Browsing"
    "Crashpad"
    "CrashpadMetrics-active.pma"
    "BrowserMetrics-spare.pma"
    "BrowserMetrics"
    "GrShaderCache"
    "ShaderCache"
    "CertificateRevocation"
    "Diagnostic No UTC Data"
)

if ($script:CleanEdgeModule -and -not $SkipBackup) {
    Write-Step "正在备份 Edge 关键数据..."
    Write-Deep "备份 Bookmarks / Preferences / Secure Preferences / Extensions，便于误删后手动恢复"
    $results["Edge 关键数据备份"] += Backup-EdgeKeyData -ProfileDirs $profileDirs -IsDryRun:$DryRun
    Write-Success "Edge 关键数据备份完成"
} elseif ($script:CleanEdgeModule) {
    Write-Warn "已跳过 Edge 关键数据备份（-SkipBackup）"
} else {
    Write-Warn "未选择 Edge 浏览器数据模块，跳过 Edge 备份"
}

# 清理各 Profile 数据
if ($script:CleanEdgeModule) {
foreach ($profileDir in $profileDirs) {
    Write-Step "正在处理 Edge 用户配置: $profileDir"

    if (-not $KeepHistory) {
        Write-SubStep "清理历史记录残留（History / Media History / Predictor 等）..."
        Write-Deep "Edge 自带清理通常不会删除这些数据库文件本身"
        $results["历史记录残留"] += Remove-EdgeItems -BaseDir $profileDir -Patterns $historyPatterns
        Write-Success "历史记录残留清理完成"
    } else {
        Write-Warn "跳过历史记录残留"
    }

    if (-not $KeepCookies) {
        Write-SubStep "清理 Cookie 与站点凭证残留..."
        $results["Cookie 与站点凭证"] += Remove-EdgeItems -BaseDir $profileDir -Patterns $cookiePatterns
        Write-Success "Cookie 与站点凭证清理完成"
    } else {
        Write-Warn "跳过 Cookie"
    }

    if (-not $KeepSiteStorage) {
        Write-SubStep "清理网站本地存储（IndexedDB / Local Storage / Service Worker 等）..."
        Write-Deep "这是 Edge 自带清理最容易遗漏的部分"
        $results["网站本地存储"] += Remove-EdgeItems -BaseDir $profileDir -Patterns $siteStoragePatterns
        Write-Success "网站本地存储清理完成"
    } else {
        Write-Warn "跳过网站本地存储"
    }

    if ($script:CleanEdgeCaches) {
        Write-SubStep "清理各类缓存（GPU / Code / Media / ShaderCache）..."
        $results["各类缓存"] += Remove-EdgeItems -BaseDir $profileDir -Patterns $cachePatterns
        Write-Success "缓存清理完成"
    } else {
        Write-Warn "跳过各类缓存"
    }

    if (-not $KeepSessions) {
        Write-SubStep "清理会话与恢复数据..."
        $results["会话与恢复数据"] += Remove-EdgeItems -BaseDir $profileDir -Patterns $sessionPatterns
        Write-Success "会话与恢复数据清理完成"
    } else {
        Write-Warn "跳过会话与恢复数据"
    }

    if ($script:CleanExtensionRuntime) {
        Write-SubStep "清理扩展运行时缓存（Extension State / Rules / Scripts / 扩展本地存储）..."
        Write-Deep "扩展产生的本地数据常被 Edge 自带清理忽略"
        $results["扩展缓存"] += Remove-EdgeItems -BaseDir $profileDir -Patterns $extensionRuntimePatterns
        Write-Success "扩展运行时缓存清理完成"
    } else {
        Write-Warn "跳过扩展运行时缓存"
    }

    if ($ClearExtensions) {
        Write-SubStep "清理扩展本体..."
        Write-Warn "此操作将删除所有已安装扩展，下次需重新安装"
        $results["扩展本体"] += Remove-EdgeItems -BaseDir $profileDir -Patterns $extensionBodyPatterns
        Write-Success "扩展本体清理完成"
    } else {
        Write-Warn "保留扩展本体（默认）"
    }

    if (-not $KeepPasswords) {
        Write-SubStep "清理已保存密码..."
        $results["密码与自动填充"] += Remove-EdgeItems -BaseDir $profileDir -Patterns $passwordPatterns
        Write-Success "已保存密码清理完成"
    } else {
        Write-Warn "跳过已保存密码"
    }

    if (-not $KeepAutofill) {
        Write-SubStep "清理自动填充数据（Web Data）..."
        $results["密码与自动填充"] += Remove-EdgeItems -BaseDir $profileDir -Patterns $autofillPatterns
        Write-Success "自动填充数据清理完成"
    } else {
        Write-Warn "跳过自动填充数据"
    }

    if ($ClearSitePreferences) {
        Write-SubStep "清理站点设置与权限（保留界面配置）..."
        Write-Deep "只移除站点权限、通知、位置等，不会显示欢迎页"
        $results["站点设置与权限"] += Clear-PreferencesSiteSettings -ProfileDir $profileDir -IsDryRun:$DryRun
        Write-Success "站点设置与权限清理完成"
    } else {
        Write-Warn "保留站点设置与权限（默认，不显示欢迎页）"
    }

    if ($ClearSettings) {
        Write-SubStep "清理浏览器界面设置（Preferences / Secure Preferences）..."
        Write-Warn "此操作会导致 Edge 显示'欢迎使用'页面、主题/工具栏恢复默认"
        $results["浏览器界面设置"] += Remove-EdgeItems -BaseDir $profileDir -Patterns $sitePreferencesPatterns
        Write-Success "浏览器界面设置清理完成"
    } else {
        Write-Warn "保留浏览器界面设置（默认）"
    }

    if ($ClearBookmarks) {
        Write-SubStep "清理书签..."
        Write-Warn "此操作将删除所有书签，无法恢复"
        $results["书签"] += Remove-EdgeItems -BaseDir $profileDir -Patterns $bookmarksPatterns
        Write-Success "书签清理完成"
    } else {
        Write-Warn "保留书签（默认）"
    }

    if ($ClearMicrosoftAccount) {
        Write-SubStep "清理微软账户与同步数据..."
        Write-Warn "此操作将退出微软账户登录状态"
        $results["微软账户与同步"] += Remove-EdgeItems -BaseDir $profileDir -Patterns $microsoftAccountPatterns
        Write-Success "微软账户与同步数据清理完成"
    } else {
        Write-Warn "保留微软账户登录状态（默认）"
    }

    if ($script:CleanMetadata) {
        Write-SubStep "清理缩略图与站点元数据..."
        $results["缩略图与站点元数据"] += Remove-EdgeItems -BaseDir $profileDir -Patterns $metadataPatterns
        Write-Success "缩略图与站点元数据清理完成"
    } else {
        Write-Warn "跳过缩略图与站点元数据"
    }

    if ($script:CleanSecurityData) {
        Write-SubStep "清理安全与隐私数据（Safe Browsing Network / HSTS / DIPS）..."
        $results["安全与隐私数据"] += Remove-EdgeItems -BaseDir $profileDir -Patterns $securityPatterns
        Write-Success "安全与隐私数据清理完成"
    } else {
        Write-Warn "跳过安全与隐私数据"
    }

    if ($script:CleanDiagnostics) {
        Write-SubStep "清理诊断、日志与崩溃报告..."
        $results["诊断日志与崩溃报告"] += Remove-EdgeItems -BaseDir $profileDir -Patterns $diagnosticPatterns
        Write-Success "诊断、日志与崩溃报告清理完成"
    } else {
        Write-Warn "跳过诊断、日志与崩溃报告"
    }

    if ($script:CleanOtherTempData) {
        Write-SubStep "清理其他临时数据..."
        $results["其他临时数据"] += Remove-EdgeItems -BaseDir $profileDir -Patterns $otherPatterns
        Write-Success "其他临时数据清理完成"
    } else {
        Write-Warn "跳过其他临时数据"
    }
}
} else {
    Write-Warn "未选择 Edge 浏览器数据模块，跳过所有 Edge Profile 清理"
}

# 清理 Windows 通知历史记录
if ($ClearWindowsNotifications) {
    Write-Step "正在清理 Windows 通知历史记录..."
    Write-Deep "优先调用通知中心“全部清除”，不会重启 Explorer/任务栏，也不会重置各应用通知权限"
    $results["Windows 通知历史"] += Clear-WindowsNotificationHistory -IsDryRun:$DryRun
    Write-Success "Windows 通知历史清理完成"
} else {
    Write-Warn "保留 Windows 通知历史记录（默认）"
}

# 清理截图文件夹
if ($ClearScreenshots -or $ClearScreenshotsDays -gt 0) {
    Write-Step "正在清理截图文件夹..."
    Write-Deep "路径: $env:USERPROFILE\Pictures\Screenshots"
    $requireConfirm = -not $NoMenu
    $screenshotStart = $null
    $screenshotEnd = $null
    if (-not [string]::IsNullOrWhiteSpace($ClearScreenshotsFrom) -and -not [string]::IsNullOrWhiteSpace($ClearScreenshotsTo)) {
        try {
            $screenshotStart = [datetime]::Parse($ClearScreenshotsFrom, [System.Globalization.CultureInfo]::InvariantCulture)
            $screenshotEnd = [datetime]::Parse($ClearScreenshotsTo, [System.Globalization.CultureInfo]::InvariantCulture)
            Write-Deep "时间窗口: $($screenshotStart.ToString('yyyy-MM-dd HH:mm')) 至 $($screenshotEnd.ToString('yyyy-MM-dd HH:mm'))"
        } catch {
            Write-Warn "截图时间窗口解析失败，跳过截图清理: $($_.Exception.Message)"
        }
    }
    $results["截图文件"] += Clear-Screenshots -StartTime $screenshotStart -EndTime $screenshotEnd -WindowLabel $ClearScreenshotsLabel -DaysToDelete $ClearScreenshotsDays -IsDryRun:$DryRun -RequireConfirm:$requireConfirm
    Write-Success "截图文件夹清理完成"
} else {
    Write-Warn "保留截图文件夹（默认）"
}

# 清理 Windows 剪贴板历史
if ($ClearClipboardHistory) {
    Write-Step "正在清理 Windows 剪贴板历史..."
    Write-Deep "只删除历史记录，保留固定项，不影响 Win+V 剪贴板功能"
    $results["剪贴板历史"] += Clear-ClipboardHistory -IsDryRun:$DryRun
    Write-Success "Windows 剪贴板历史清理完成"
} else {
    Write-Warn "保留 Windows 剪贴板历史（默认）"
}

if ($ClearRecycleBin) {
    Write-Step "正在清理回收站..."
    Write-Deep "会跳过 .xls/.xlsx/.csv、名称或路径包含 -OMM / 送测 的项目，以及 inspec 相关程序文件"
    $results["回收站"] += Clear-RecycleBinSafe -IsDryRun:$DryRun
    Write-Success "回收站清理完成"
} else {
    Write-Warn "保留回收站（默认）"
}

# 清理私人入口在开始菜单生成的快捷方式
if ($ClearOpencodeShortcuts) {
    Write-Step "正在清理私人入口开始菜单快捷方式..."
    Write-Deep "路径: $env:APPDATA\Microsoft\Windows\Start Menu\Programs"
    $results["私人入口快捷方式"] += Clear-OpencodeShortcuts -IsDryRun:$DryRun
    Write-Success "私人入口快捷方式清理完成"
} else {
    Write-Warn "保留私人入口开始菜单快捷方式（默认）"
}

# 清理私人浏览器 profile / 浏览记录
if ($CleanPrivateBrowser -or $ClearPrivateBrowserHistory) {
    Write-Step "正在处理私人浏览器 profile..."
    $privateProfiles = Get-PrivateBrowserProfileDirs -Root $PrivateBrowserRoot
    if (-not $privateProfiles -or $privateProfiles.Count -eq 0) {
        Write-Warn "未找到私人浏览器 profile，跳过"
    } else {
        if (-not $SkipPrivateBrowserBackup) {
            $results["私人浏览器备份"] += Backup-PrivateBrowserProfile -Root $PrivateBrowserRoot -ProfileDirs $privateProfiles -IsDryRun:$DryRun
        } else {
            Write-Warn "已跳过私人浏览器备份"
        }

        if ($CleanPrivateBrowser) {
            Write-Deep "清理历史、Cookie、缓存、会话、站点存储、表单、保存登录和诊断临时数据"
            $results["私人浏览器数据"] += Clear-PrivateBrowserProfile -ProfileDirs $privateProfiles -IsDryRun:$DryRun
            Write-Success "私人浏览器 profile 清理完成"
        } elseif ($ClearPrivateBrowserHistory) {
            Write-Deep "仅清理浏览记录数据库和站点图标数据库，默认保留完整 profile 备份"
            $results["私人浏览器浏览记录"] += Clear-PrivateBrowserHistory -ProfileDirs $privateProfiles -IsDryRun:$DryRun
            Write-Success "私人浏览器浏览记录清理完成"
        }
    }
} else {
    Write-Warn "保留私人浏览器 profile（默认）"
}

# 清理 WiFi 配置文件
if ($ForgetWifiPatterns.Count -gt 0) {
    $patternList = $ForgetWifiPatterns -join ', '
    Write-Step "正在忘记匹配模式的 WiFi 配置文件（模式: $patternList）..."
    Write-Deep "使用 netsh wlan delete profile 忘记命中的 WiFi；匹配大小写不敏感"
    $results["WiFi 配置文件"] += Clear-WifiProfiles -KeepPrefixes @() -ForgetPatterns $ForgetWifiPatterns -IsDryRun:$DryRun
    Write-Success "WiFi 配置文件管理完成"
} elseif ($KeepWifiPrefixes.Count -gt 0) {
    $prefixList = $KeepWifiPrefixes -join ', '
    Write-Step "正在管理 WiFi 配置文件（保留前缀: $prefixList）..."
    Write-Deep "使用 netsh wlan delete profile 忘记不匹配前缀的 WiFi"
    $results["WiFi 配置文件"] += Clear-WifiProfiles -KeepPrefixes $KeepWifiPrefixes -ForgetPatterns @() -IsDryRun:$DryRun
    Write-Success "WiFi 配置文件管理完成"
} else {
    Write-Warn "保留所有 WiFi 配置文件（默认）"
}

if ($ConnectCompanyWifi) {
    Write-Step "正在切换到公司 WiFi..."
    Write-Deep "清理完成后设置目标 WiFi 为自动连接，并尝试连接；真实执行时网络可能短暂断开"
    $results["公司 WiFi 连接"] += Connect-CompanyWifi -Ssid $CompanyWifiSsid -IsDryRun:$DryRun
    Write-Success "公司 WiFi 连接步骤完成"
} else {
    Write-Warn "不切换公司 WiFi（默认）"
}

if ($script:CleanEdgeModule -and $script:CleanGlobalEdgeData) {
    # 清理 User Data 根目录下的全局数据
    Write-Step "正在清理 Edge 全局数据目录（User Data 根目录）..."
    Write-Deep "这些全局目录包含 Safe Browsing、崩溃报告、着色器缓存等"
    $results["全局数据"] += Remove-GlobalItems -Names $globalItems
    Write-Success "全局数据清理完成"
} else {
    Write-Warn "跳过 Edge 全局数据目录"
}

if ($script:CleanEdgeModule -and $script:CleanSystemTempData) {
    # 清理系统级 Edge 临时目录
    Write-Step "清理系统级 Edge 临时目录..."
    $systemTempPaths = @(
        "$env:LOCALAPPDATA\Microsoft\Edge\Temp"
        "$env:LOCALAPPDATA\Microsoft\Edge\User Data\*.tmp"
        "$env:LOCALAPPDATA\Temp\MicrosoftEdge*"
        "$env:LOCALAPPDATA\Temp\edge_*"
        "$env:PROGRAMDATA\Microsoft\EdgeUpdate\Log"
    )

    foreach ($tp in $systemTempPaths) {
        Get-ChildItem -Path $tp -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                if (-not $DryRun) {
                    Remove-Item $_.FullName -Recurse -Force -ErrorAction Stop
                } else {
                    Write-Host "        [模拟删除] $($_.FullName)" -ForegroundColor DarkCyan
                }
            } catch { }
        }
    }
    Write-Success "系统级临时目录清理完成"
} else {
    Write-Warn "跳过系统级 Edge 临时目录"
}

Show-Summary -Results $results -Skipped @{} -DeepItems $deepItems -Choices $choices
Show-DeepExplanation

if (-not [string]::IsNullOrWhiteSpace($JsonSummaryPath)) {
    try {
        $summaryDir = Split-Path -Parent $JsonSummaryPath
        if (-not [string]::IsNullOrWhiteSpace($summaryDir)) {
            New-Item -Path $summaryDir -ItemType Directory -Force | Out-Null
        }
        [ordered]@{
            status = "complete"
            dry_run = [bool]$DryRun
            finished_at = (Get-Date).ToString("o")
            results = $results
            choices = $choices
        } | ConvertTo-Json -Depth 8 | Set-Content -Path $JsonSummaryPath -Encoding utf8
        Write-Host "`n结果摘要: $JsonSummaryPath" -ForegroundColor Green
    } catch {
        Write-Host "无法写入结果摘要: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host "`n清理结束。Edge 下次启动时会重新生成必要文件。" -ForegroundColor Green
if ($script:TranscriptStarted) {
    Stop-Transcript | Out-Null
}
if (-not $NoMenu) {
    Write-Host "按 Enter 键退出..." -ForegroundColor White
    Read-Host | Out-Null
}
