# Repoints FreePlay's bundled B1ChurchProvider at the local ChurchApps Api on
# port 8084 by patching the compiled @churchapps/content-providers package
# in node_modules. The package hardcodes API_BASE3 = "https://api.churchapps.org"
# at module-load time with no runtime override mechanism, so a sed-style patch
# is the only way short of forking the package. The patch is idempotent and
# reversible (re-run with -Revert to restore production).
#
# Also sets up an adb reverse so the AVD can reach the host's localhost:8084
# (and Metro's 8081) through the adb pipe -- same mechanism used for Metro.
#
# Run BEFORE 'npx expo start --reset-cache' so Metro picks up the patch on its
# first bundle build.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .maestro/scripts/setup-b1-localhost.ps1
#   powershell -ExecutionPolicy Bypass -File .maestro/scripts/setup-b1-localhost.ps1 -Revert

param(
  [switch]$Revert
)

$ErrorActionPreference = "Stop"
$device = "emulator-5554"
$bundlePath = "node_modules/@churchapps/content-providers/dist/index.js"
$prodLine = 'var API_BASE3 = "https://api.churchapps.org"'
$localLine = 'var API_BASE3 = "http://localhost:8084"'

if (-not (Test-Path $bundlePath)) {
  Write-Error ("Cannot find " + $bundlePath + ". Run from the FreePlay/ project root.")
  exit 1
}

$content = Get-Content $bundlePath -Raw

if ($Revert) {
  if ($content.Contains($localLine)) {
    $content = $content.Replace($localLine, $prodLine)
    Set-Content -Path $bundlePath -Value $content -NoNewline
    Write-Host "setup-b1: Reverted API_BASE3 to production."
  } else {
    Write-Host "setup-b1: Already on production API_BASE3 (or unrecognized state)."
  }
} else {
  if ($content.Contains($localLine)) {
    Write-Host "setup-b1: API_BASE3 already pointed at localhost."
  } elseif ($content.Contains($prodLine)) {
    $content = $content.Replace($prodLine, $localLine)
    Set-Content -Path $bundlePath -Value $content -NoNewline
    Write-Host "setup-b1: Patched API_BASE3 to http://localhost:8084"
  } else {
    Write-Error "Could not find expected API_BASE3 string in node_modules. Was the package upgraded?"
    exit 1
  }

  # Forward the AVD's localhost:8084 to the host's localhost:8084
  $prev = $ErrorActionPreference; $ErrorActionPreference = "Continue"
  try {
    & adb -s $device reverse tcp:8084 tcp:8084 | Out-Null
    & adb -s $device reverse tcp:8081 tcp:8081 | Out-Null
  } finally {
    $ErrorActionPreference = $prev
  }
  Write-Host "setup-b1: adb reverse set for tcp:8084 + tcp:8081"
  Write-Host "setup-b1: Done. Restart Metro with --reset-cache + reload the app."
}
