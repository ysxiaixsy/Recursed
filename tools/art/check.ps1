# Run the automatic checks on the art exports (PowerShell version of `check`).
# Exit code 0 = all passed.
#
# Environment:
#   ASEPRITE  path to the Aseprite executable (default: aseprite on PATH)

$here = $PSScriptRoot
$root = (Resolve-Path (Join-Path $here "..\..")).Path
$aseprite = if ($env:ASEPRITE) { $env:ASEPRITE } else { "aseprite" }

& $aseprite -b --script-param "root=$root" --script (Join-Path $here "check.lua")
exit $LASTEXITCODE
