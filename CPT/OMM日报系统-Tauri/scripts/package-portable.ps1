#Requires -Version 5.1
<#
.SYNOPSIS
    Package 玉衡山科学院管理厅 portable edition.
.DESCRIPTION
    Copies the latest app exe, sidecar exe and bundled template into a
    versioned portable directory and creates a zip plus data\manifests\portable-manifest.json.
    This avoids manual copying mistakes that lead to version mismatches.
.PARAMETER Version
    Version tag like "v5.0.2". Defaults to version from src-tauri/tauri.conf.json.
.PARAMETER SourceDir
    Tauri release output directory. Default: target\release.
.PARAMETER OutDir
    Output directory for the portable package. Default: releases.
.PARAMETER SkipBuildCheck
    If set, do not verify that SourceDir\app.exe exists.
#>
param(
    [string]$Version = $null,
    [string]$SourceDir = "src-tauri\target\release",
    [string]$OutDir = "releases",
    [switch]$SkipBuildCheck
)

$ErrorActionPreference = "Stop"

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
Set-Location -LiteralPath $ROOT

function Resolve-Version {
    $confPath = Join-Path (Join-Path $ROOT "src-tauri") "tauri.conf.json"
    if (Test-Path $confPath) {
        $conf = Get-Content $confPath -Raw -Encoding UTF8 | ConvertFrom-Json
        return $conf.version
    }
    return "unknown"
}

if (-not $Version) {
    $Version = Resolve-Version
}

$appName = "玉衡山科学院管理厅"
$portableBaseName = $appName + "_便携版_" + $Version
$portableDir = Join-Path $OutDir $portableBaseName
$innerDir = Join-Path $portableDir ($appName + "_便携版")
$zipPath = Join-Path $OutDir ($portableBaseName + ".zip")

$srcExe = Join-Path $SourceDir "app.exe"
$srcSidecar = Join-Path (Join-Path (Join-Path $ROOT "src-tauri") "binaries") "generate_report.exe"
$srcTemplate = Join-Path (Join-Path (Join-Path $ROOT "src-tauri") "resources") "template.xlsx"
$srcCleanerDir = Join-Path (Join-Path (Join-Path (Join-Path $ROOT "src-tauri") "resources") "tools") "edge-cleaner"

if (-not $SkipBuildCheck -and -not (Test-Path $srcExe)) {
    throw "App exe not found: $srcExe (Tauri builds target\release\app.exe)`nRun first: npm run tauri-build"
}
if (-not (Test-Path $srcSidecar)) {
    throw "Sidecar not found: $srcSidecar`nRun first: python sidecar\build_sidecar.py"
}
if (-not (Test-Path $srcTemplate)) {
    throw "Bundled template not found: $srcTemplate"
}
if (-not (Test-Path (Join-Path $srcCleanerDir "clean-edge.ps1"))) {
    throw "Personal cleaner script not found: $srcCleanerDir"
}

if (Test-Path $portableDir) {
    Remove-Item -LiteralPath $portableDir -Recurse -Force
}
New-Item -ItemType Directory -Path $innerDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $innerDir "binaries") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $innerDir "resources") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path (Join-Path (Join-Path $innerDir "resources") "tools") "edge-cleaner") -Force | Out-Null

Copy-Item -Path $srcExe -Destination (Join-Path $innerDir ($appName + ".exe")) -Force
Copy-Item -Path $srcSidecar -Destination (Join-Path (Join-Path $innerDir "binaries") "generate_report.exe") -Force
Copy-Item -Path $srcTemplate -Destination (Join-Path (Join-Path $innerDir "resources") "template.xlsx") -Force
Copy-Item -Path (Join-Path $srcCleanerDir "clean-edge.ps1") -Destination (Join-Path (Join-Path (Join-Path (Join-Path $innerDir "resources") "tools") "edge-cleaner") "clean-edge.ps1") -Force
Copy-Item -Path (Join-Path $srcCleanerDir "clean-edge.bat") -Destination (Join-Path (Join-Path (Join-Path (Join-Path $innerDir "resources") "tools") "edge-cleaner") "clean-edge.bat") -Force

function Get-FileSha256($path) {
    if (Test-Path $path) {
        return (Get-FileHash -Path $path -Algorithm SHA256).Hash.ToLower()
    }
    return $null
}

$manifest = @{
    name        = $appName
    version     = $Version
    packaged_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
    files       = @(
        @{
            role   = "app"
            path   = $appName + ".exe"
            sha256 = Get-FileSha256 (Join-Path $innerDir ($appName + ".exe"))
        },
        @{
            role   = "sidecar"
            path   = "binaries\generate_report.exe"
            sha256 = Get-FileSha256 (Join-Path (Join-Path $innerDir "binaries") "generate_report.exe")
        },
        @{
            role   = "template"
            path   = "resources\template.xlsx"
            sha256 = Get-FileSha256 (Join-Path (Join-Path $innerDir "resources") "template.xlsx")
        },
        @{
            role   = "personal_cleaner_script"
            path   = "resources\tools\edge-cleaner\clean-edge.ps1"
            sha256 = Get-FileSha256 (Join-Path (Join-Path (Join-Path (Join-Path $innerDir "resources") "tools") "edge-cleaner") "clean-edge.ps1")
        },
        @{
            role   = "personal_cleaner_launcher"
            path   = "resources\tools\edge-cleaner\clean-edge.bat"
            sha256 = Get-FileSha256 (Join-Path (Join-Path (Join-Path (Join-Path $innerDir "resources") "tools") "edge-cleaner") "clean-edge.bat")
        }
    )
}

$manifestDir = Join-Path (Join-Path $innerDir "data") "manifests"
New-Item -ItemType Directory -Force -Path $manifestDir | Out-Null
$manifestPath = Join-Path $manifestDir "portable-manifest.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding UTF8

if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($portableDir, $zipPath, "Optimal", $false)

Write-Host "============================================"
Write-Host "Portable package created"
Write-Host "Version: $Version"
Write-Host "Dir:     $portableDir"
Write-Host "Zip:     $zipPath"
Write-Host "Manifest: $manifestPath"
Write-Host "--------------------------------------------"
$manifest.files | ForEach-Object {
    Write-Host ("[{0}] {1}`n  sha256={2}" -f $_.role, $_.path, $_.sha256)
}
Write-Host "============================================"
