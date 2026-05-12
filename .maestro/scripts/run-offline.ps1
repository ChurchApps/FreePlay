# Runs the offline-mode Maestro flows against the connected Android TV emulator.
# Disables the AVD's wifi+data, runs the flows, then re-enables network even on
# failure. Requires Maestro to already be on PATH (or the default install dir).
#
# Usage (from FreePlay/):  pwsh .maestro/scripts/run-offline.ps1
#
# Pre-requisites:
#   - emulator-5554 is running (adb devices)
#   - The downloaded lesson from flow 31 is present (run the regular suite first)
#   - adb reverse tcp:8081 tcp:8081 is set (npm run android sets this)

$ErrorActionPreference = "Stop"

$device = "emulator-5554"
$maestro = if (Get-Command maestro -ErrorAction SilentlyContinue) {
  "maestro"
} else {
  "$env:USERPROFILE\.maestro\maestro\bin\maestro.bat"
}

function Set-AvdNetwork {
  param([bool]$Enabled)
  $state = if ($Enabled) { "enable" } else { "disable" }
  Write-Host "[run-offline] Setting AVD network: $state"
  # PowerShell 5.1 turns redirected native stderr into ErrorRecords that
  # ErrorActionPreference=Stop will halt on, so call adb without redirection
  # and ignore the stderr that lands in the host. `svc data` is cellular-only
  # and prints "Can't find service: phone" on TV — harmless.
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & adb -s $device shell svc wifi $state | Out-Null
    & adb -s $device shell svc data $state | Out-Null
  } finally {
    $ErrorActionPreference = $prev
  }
}

# Verify device is connected
$devices = & adb devices | Select-String "^$device\s+device$"
if (-not $devices) {
  Write-Error "AVD $device not found. Boot it via Android Studio first."
  exit 1
}

# Ensure adb reverse for Metro is in place (in case it was lost)
& adb -s $device reverse tcp:8081 tcp:8081 | Out-Null

try {
  Set-AvdNetwork -Enabled $false
  # Brief settle so the AVD's connectivity service notices.
  Start-Sleep -Seconds 2

  Write-Host "[run-offline] Running offline flows..."
  & $maestro test ".maestro/flows-offline/"
  $exitCode = $LASTEXITCODE
} finally {
  Set-AvdNetwork -Enabled $true
}

exit $exitCode
