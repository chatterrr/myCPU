$ErrorActionPreference = "Stop"

Write-Host "=== Git ==="
git --version
where.exe git

Write-Host "`n=== CMake ==="
cmake --version
where.exe cmake

Write-Host "`n=== Python ==="
python --version
where.exe python

Write-Host "`n=== Node ==="
node -v
npm -v
where.exe node
where.exe npm

Write-Host "`n=== .NET ==="
dotnet --info
where.exe dotnet

Write-Host "`n=== GitHub CLI ==="
gh --version
where.exe gh

Write-Host "`n=== Visual Studio Developer Tools ==="
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"

if (-not (Test-Path $vswhere)) {
    Write-Error "vswhere.exe not found: $vswhere"
    exit 1
}

$vs = & $vswhere -latest -products * -property installationPath

if (-not $vs) {
    Write-Error "Visual Studio installation not found."
    exit 1
}

Write-Host "VS Path: $vs"

cmd /c "`"$vs\Common7\Tools\VsDevCmd.bat`" && where msbuild && msbuild -version && where cl"
exit $LASTEXITCODE