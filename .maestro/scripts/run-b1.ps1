# Runs the B1Church to localhost Maestro flow. Verifies prereqs, applies the
# node_modules patch, and invokes maestro on .maestro/flows-b1/. Re-running
# is safe: the patch is idempotent and adb reverse is harmless to set twice.
#
# Does NOT start the local Api or run reset-demo for you. Will fail loudly on
# the health check if the Api is not reachable or does not report dev/demo.
#
# Usage from FreePlay/:
#   powershell -ExecutionPolicy Bypass -File .maestro/scripts/run-b1.ps1

$ErrorActionPreference = "Stop"
$device = "emulator-5554"
$apiBase = "http://localhost:8084"
$maestro = if (Get-Command maestro -ErrorAction SilentlyContinue) {
  "maestro"
} else {
  "$env:USERPROFILE\.maestro\maestro\bin\maestro.bat"
}

# 1. Verify the local Api is reachable + in dev/demo mode.
try {
  $health = (Invoke-WebRequest -Uri ($apiBase + "/health") -UseBasicParsing -TimeoutSec 5).Content | ConvertFrom-Json
} catch {
  Write-Error ("Local Api at " + $apiBase + " not reachable. Start it with: cd Api; npm run dev")
  exit 1
}
if ($health.environment -ne "dev" -and $health.environment -ne "demo") {
  Write-Error ("Local Api environment is '" + $health.environment + "' but must be dev or demo. Refusing to run.")
  exit 1
}
Write-Host ("run-b1: Local Api healthy: environment=" + $health.environment)

# 2. Verify the OAuth client is seeded.
try {
  $authResp = Invoke-WebRequest -Uri ($apiBase + "/membership/oauth/device/authorize") -Method Post `
    -ContentType "application/json" `
    -Body '{"client_id":"nsowldn58dk","scope":"plans"}' `
    -UseBasicParsing -TimeoutSec 5
  $authJson = $authResp.Content | ConvertFrom-Json
  if (-not $authJson.device_code) { throw "no device_code in response" }
  Write-Host "run-b1: OAuth client nsowldn58dk seeded."
} catch {
  Write-Error "OAuth client nsowldn58dk not registered. Run: cd Api; npm run reset-demo"
  exit 1
}

# 3. Verify the demo plan references a real lessons.church venue.
try {
  $login = (Invoke-WebRequest -Uri ($apiBase + "/membership/users/login") -Method Post `
    -ContentType "application/json" `
    -Body '{"email":"demo@b1.church","password":"password"}' `
    -UseBasicParsing -TimeoutSec 5).Content | ConvertFrom-Json
  $jwt = ($login.userChurches[0].apis | Where-Object keyName -eq "MembershipApi").jwt
  $plans = (Invoke-WebRequest -Uri ($apiBase + "/doing/plans/types/PLT00000001") `
    -Headers @{ Authorization = ("Bearer " + $jwt) } `
    -UseBasicParsing -TimeoutSec 5).Content | ConvertFrom-Json
  $upcoming = $plans | Where-Object id -eq "PLA00000001"
  if (-not $upcoming -or $upcoming.contentId -ne "keYYf8Z8ZD1") {
    throw ("Demo plan PLA00000001 missing or contentId not keYYf8Z8ZD1 (got '" + $upcoming.contentId + "')")
  }
  Write-Host "run-b1: Demo plan PLA00000001 to venue keYYf8Z8ZD1 confirmed."
} catch {
  Write-Error ("Demo data check failed: " + $_)
  exit 1
}

# 4. Verify AVD is connected.
$devices = & adb devices | Select-String "^$device\s+device$"
if (-not $devices) {
  Write-Error ("AVD " + $device + " not found. Boot it via Android Studio first.")
  exit 1
}

# 5. Patch node_modules + adb reverse.
& powershell -ExecutionPolicy Bypass -File ".maestro/scripts/setup-b1-localhost.ps1"

# 6. Force-stop the app so the next launchApp picks up the freshly bundled patch.
& adb -s $device shell am force-stop church.freeplay | Out-Null

# 7. Run the flow.
Write-Host "run-b1: Running B1 flow..."
& $maestro test ".maestro/flows-b1/"
exit $LASTEXITCODE
