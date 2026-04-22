$ErrorActionPreference = "Stop"

$webRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $webRoot
$buildDir = Join-Path $repoRoot "build"
$targetDir = Join-Path $webRoot "public\\traces"
$exeCandidates = @(
    (Join-Path $buildDir "Release\\mycpu.exe"),
    (Join-Path $buildDir "mycpu.exe")
)
$exePath = $exeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

if (-not $exePath) {
    throw "Missing simulator executable. Looked for: $($exeCandidates -join ', '). Run the build first."
}

$sampleSpecs = @(
    @{
        Name = "smoke"
        ExpectedExitCode = 0
        Args = @("--use-program", "smoke", "--max-steps", "64")
    },
    @{
        Name = "uart"
        ExpectedExitCode = 0
        Args = @("--use-program", "uart", "--max-steps", "64")
    },
    @{
        Name = "break-resume"
        ExpectedExitCode = 0
        Args = @("--use-program", "break-resume", "--max-steps", "64")
    },
    @{
        Name = "timer-interrupt"
        ExpectedExitCode = 0
        Args = @("--use-program", "timer-interrupt", "--max-steps", "64")
    },
    @{
        Name = "invalid-unhandled"
        ExpectedExitCode = 1
        Args = @("--use-program", "invalid", "--max-steps", "8")
    },
    @{
        Name = "smoke-max-steps"
        ExpectedExitCode = 2
        Args = @("--use-program", "smoke", "--max-steps", "3")
    },
    @{
        Name = "pipeline-raw"
        ExpectedExitCode = 0
        Args = @("--pipeline", "--use-program", "pipeline-raw", "--max-steps", "64")
    },
    @{
        Name = "pipeline-forward"
        ExpectedExitCode = 0
        Args = @("--pipeline", "--use-program", "pipeline-forward", "--max-steps", "64")
    },
    @{
        Name = "pipeline-loaduse"
        ExpectedExitCode = 0
        Args = @("--pipeline", "--use-program", "pipeline-loaduse", "--base", "0", "--entry", "0", "--max-steps", "64")
    },
    @{
        Name = "pipeline-branch"
        ExpectedExitCode = 0
        Args = @("--pipeline", "--use-program", "pipeline-branch", "--max-steps", "64")
    },
    @{
        Name = "pipeline-runtime-error"
        ExpectedExitCode = 1
        Args = @("--pipeline", "--use-program", "logic", "--max-steps", "16")
    }
)

foreach ($sample in $sampleSpecs) {
    $target = Join-Path $targetDir ($sample.Name + ".jsonl")
    $commandArgs = @($sample.Args) + @("--trace", $target)

    & $exePath @commandArgs
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne $sample.ExpectedExitCode) {
        throw "Trace sample '$($sample.Name)' exited with $exitCode, expected $($sample.ExpectedExitCode)."
    }

    Write-Host "[trace] generated $($sample.Name).jsonl"
}
