$ErrorActionPreference = "Stop"

$webRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $webRoot
$buildDir = Join-Path $repoRoot "build"
$targetDir = Join-Path $webRoot "public\\traces"

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

$traceNames = @(
    "pipeline-raw.jsonl",
    "pipeline-forward.jsonl",
    "pipeline-loaduse.jsonl",
    "pipeline-branch.jsonl"
)

foreach ($traceName in $traceNames) {
    $source = Join-Path $buildDir $traceName
    $target = Join-Path $targetDir $traceName

    if (-not (Test-Path $source)) {
        throw "Missing sample trace: $source"
    }

    Copy-Item -LiteralPath $source -Destination $target -Force
    Write-Host "[sync] copied $traceName"
}
