param(
    [string]$Command = ""
)

$ErrorActionPreference = "Stop"

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vs = & $vswhere -latest -products * -property installationPath

if (-not $vs) {
    Write-Error "Visual Studio installation not found."
    exit 1
}

$bat = Join-Path $vs "Common7\Tools\VsDevCmd.bat"

if (-not (Test-Path $bat)) {
    Write-Error "VsDevCmd.bat not found: $bat"
    exit 1
}

if ([string]::IsNullOrWhiteSpace($Command)) {
    cmd /c "`"$bat`" && where msbuild && msbuild -version && where cl"
    exit $LASTEXITCODE
} else {
    cmd /c "`"$bat`" && $Command"
    exit $LASTEXITCODE
}