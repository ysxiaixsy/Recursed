# Build art assets with Aseprite in batch mode (PowerShell version of `build`).
#
#   tools\art\build.ps1                  build all assets, in dependency order
#   tools\art\build.ps1 warrior monster  build only the named assets
#
# Environment:
#   ASEPRITE     path to the Aseprite executable (default: aseprite on PATH)
#   PREVIEW_DIR  if set, also write enlarged working previews to this folder

$here = $PSScriptRoot
$root = (Resolve-Path (Join-Path $here "..\..")).Path
$aseprite = if ($env:ASEPRITE) { $env:ASEPRITE } else { "aseprite" }

$assets = $args
if ($assets.Count -eq 0) {
    $assets = @("warrior", "monster", "background", "ui_kit", "mockup")
}

$params = @("--script-param", "root=$root")
if ($env:PREVIEW_DIR) {
    New-Item -ItemType Directory -Force $env:PREVIEW_DIR | Out-Null
    $params += @("--script-param", "preview=$env:PREVIEW_DIR")
}

foreach ($asset in $assets) {
    & $aseprite -b @params --script (Join-Path $here "$asset.lua")
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
