$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

function Assert-LastExitCode {
    param([string]$StepName)
    if ($LASTEXITCODE -ne 0) {
        throw "$StepName failed with exit code $LASTEXITCODE"
    }
}

function Invoke-SmokeStep {
    param(
        [string]$Name,
        [scriptblock]$Step
    )

    Write-Host "==> $Name"
    & $Step
    Write-Host "OK: $Name"
}

Invoke-SmokeStep "TypeScript type check" {
    & npx.cmd tsc --noEmit
    Assert-LastExitCode "TypeScript type check"
}

Invoke-SmokeStep "Frontend build" {
    & npm.cmd run build
    Assert-LastExitCode "Frontend build"
}

Invoke-SmokeStep "Rust release check" {
    Push-Location -LiteralPath (Join-Path $projectRoot "src-tauri")
    try {
        & cargo check --release
        Assert-LastExitCode "Rust release check"
    }
    finally {
        Pop-Location
    }
}

Invoke-SmokeStep "Python sidecar compile" {
    & python -m py_compile sidecar\generate_report.py sidecar\sidecar_main.py
    Assert-LastExitCode "Python sidecar compile"
}

Invoke-SmokeStep "Fixture recognition regression" {
    $fixtureCheck = @'
import os
import sys

sys.path.insert(0, os.path.join(os.getcwd(), "sidecar"))
import generate_report as gr

base = os.path.abspath(os.path.join(os.getcwd(), "..", "\u65e5\u671f\u6587\u4ef6\u5939", "7.8A"))
if not os.path.isdir(base):
    raise SystemExit(f"missing fixture: {base}")

records, review_map = gr.parse_all_folders(base, operator_name="\u79b9\u6b23")
folders = [r.get("folder") for r in records if r.get("operator") == "\u79b9\u6b23"]
if len(folders) != 2:
    raise SystemExit(f"expected 2 records for \u79b9\u6b23 in 7.8A, got {len(folders)}: {folders}")

if not any("24PCS" in folder for folder in folders):
    raise SystemExit(f"missing 24PCS \u79b9\u6b23 fixture record: {folders}")
if not any("14PCS" in folder for folder in folders):
    raise SystemExit(f"missing 14PCS \u79b9\u6b23 fixture record: {folders}")

warning_items = [v for v in review_map.values() if v.get("warnings")]
if not any("\u9ed8\u8ba4\u91c7\u7528\u6587\u4ef6\u5939\u4ef6\u6570" in warning for item in warning_items for warning in item.get("warnings", [])):
    raise SystemExit("expected folder PCS priority warning for 7.8A fixture")
'@
    $fixtureCheck | & python -X utf8 -
    Assert-LastExitCode "Fixture recognition regression"
}

Invoke-SmokeStep "PowerShell cleaner parse" {
    $cleanerPath = Join-Path $projectRoot "src-tauri\resources\tools\edge-cleaner\clean-edge.ps1"
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($cleanerPath, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count -gt 0) {
        $errors | ForEach-Object { Write-Host $_.ToString() }
        throw "PowerShell cleaner parse failed"
    }
}

Invoke-SmokeStep "Python sidecar stdin ping" {
    $output = '{"command":"ping"}' | & python sidecar\sidecar_main.py
    Assert-LastExitCode "Python sidecar stdin ping"

    $line = $output | Where-Object { $_ -and $_.Trim() } | Select-Object -First 1
    if (-not $line) {
        throw "Python sidecar ping returned no stdout"
    }

    $json = $line | ConvertFrom-Json
    if (-not $json.success -or -not $json.data.pong) {
        throw "Python sidecar ping returned unexpected response: $line"
    }
}

Write-Host "Smoke checks passed."
