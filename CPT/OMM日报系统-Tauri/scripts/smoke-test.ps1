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
