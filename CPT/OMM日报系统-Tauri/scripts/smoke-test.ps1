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

from openpyxl import Workbook

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

wb = Workbook()
ws = wb.active
ws["A1"] = "\u5b89\u5fbd\u4e2d\u8000\u667a\u80fd\u79d1\u6280\u6709\u9650\u516c\u53f8\u9996\u4ef6\u5c3a\u5bf8\u62a5\u544a"
ws["I4"] = "\u68c0\u6d4b\n\u5de5\u5177"
ws["J4"] = "\u68c0\u6d4b\u7ed3\u679c"
ws["J5"] = "\u6d4b\u91cf\u503c"
for offset, header in enumerate(list(range(1, 14)) + ["\u590d\u6d4b2", 15, 16], start=10):
    ws.cell(row=6, column=offset).value = header
ws["Z4"] = "\u91cf\u6d4b\u5206\u6790"
ws["Z5"] = "\u5224\u65ad\uff08\u221a OR DEV)"
for offset, header in enumerate(range(1, 13), start=26):
    ws.cell(row=6, column=offset).value = header
for row in range(7, 12):
    ws.cell(row=row, column=9).value = "OMM"
    for col in range(10, 22):
        ws.cell(row=row, column=col).value = 1.0
    for col in range(26, 38):
        ws.cell(row=row, column=col).value = 0.1 if col in (26, 27, 37) else "\u221a"
for row in range(12, 18):
    ws.cell(row=row, column=9).value = "CMM"
    for col in range(10, 23):
        ws.cell(row=row, column=col).value = 2.0

qty = gr._count_sheet_quantity(ws)
if qty != 12:
    raise SystemExit(f"expected mixed CMM/OMM synthetic fixture to count 12 OMM columns, got {qty}")

folder = "613-41428-(035-625)-\u710a\u63a5 -AOI-\u5bf9\u6807-FAI6,11,12-6.30B-7\uff1a55\u5f20\u9896\u9f99\u9001\u6d4b-20PCS-CMM-\u5f20\u5143\u5e86-OMM-\u79b9\u6b23"
parsed, missing, placeholders = gr.parse_folder_name(folder)
expected = {
    "station": "\u5f00\u53d1",
    "product": "035",
    "sender": "\u5f20\u9896\u9f99",
    "send_time": "7:55",
}
for key, value in expected.items():
    if parsed.get(key) != value:
        raise SystemExit(f"expected {key}={value!r} for FAI/AOI fixture, got {parsed.get(key)!r}; parsed={parsed}")
if missing or placeholders:
    raise SystemExit(f"expected no missing/placeholders for FAI/AOI fixture, got missing={missing}, placeholders={placeholders}, parsed={parsed}")
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
