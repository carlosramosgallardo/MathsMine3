<#
.SYNOPSIS
  Attach the MathsMine3 Android emulator (AVD FreakingAI) for local portal QA.

.DESCRIPTION
  Windows counterpart of scripts/android-native-reconnect.sh.
  Prefers the FreakingAI AVD, maps tcp:3000 back to the host Next.js server,
  and optionally relaunches xyz.mathsmine3.app.

.PARAMETER SyntaxCheck
  Parse the script and exit. Used by CI on Linux runners that have pwsh.

.PARAMETER DryRun
  Print the adb serial and commands without executing them.

.PARAMETER SkipLaunch
  Only restore adb reverse; do not force-stop / relaunch the app.
#>
[CmdletBinding()]
param(
    [switch]$SyntaxCheck,
    [switch]$DryRun,
    [switch]$SkipLaunch,
    [string]$AvdName = $(if ($env:MM3_AVD) { $env:MM3_AVD } else { 'FreakingAI' }),
    [int]$Port = 3000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($SyntaxCheck) {
    Write-Output "ok  Connect-FreakingAI.ps1 syntax  avd=$AvdName port=$Port"
    exit 0
}

function Get-AdbPath {
    $candidates = @()
    if ($env:ADB_BIN) { $candidates += $env:ADB_BIN }
    if ($env:ANDROID_HOME) {
        $candidates += (Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe')
        $candidates += (Join-Path $env:ANDROID_HOME 'platform-tools/adb')
    }
    if ($env:ANDROID_SDK_ROOT) {
        $candidates += (Join-Path $env:ANDROID_SDK_ROOT 'platform-tools/adb.exe')
    }
    $localAppData = [Environment]::GetFolderPath('LocalApplicationData')
    if ($localAppData) {
        $candidates += (Join-Path $localAppData 'Android/Sdk/platform-tools/adb.exe')
    }
    $cmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($cmd) { $candidates += $cmd.Source }

    foreach ($path in $candidates) {
        if ($path -and (Test-Path -LiteralPath $path)) {
            return $path
        }
    }
    throw 'adb not found. Set ANDROID_HOME or ADB_BIN, or install platform-tools.'
}

function Get-EmulatorSerial([string]$Adb, [string]$PreferredAvd) {
    $lines = & $Adb devices | Select-Object -Skip 1
    $emulators = @()
    foreach ($line in $lines) {
        $text = ($line -replace "`r", '').Trim()
        if (-not $text) { continue }
        $parts = $text -split '\s+'
        if ($parts.Count -lt 2) { continue }
        $serial = $parts[0]
        $state = $parts[1]
        if ($state -ne 'device' -or $serial -notlike 'emulator-*') { continue }
        $emulators += $serial
        $avd = (& $Adb -s $serial emu avd name 2>$null | Select-Object -First 1)
        $avd = ($avd -replace "`r", '').Trim()
        if ($avd -eq $PreferredAvd) {
            return $serial
        }
    }
    if ($emulators.Count -gt 0) {
        return $emulators[0]
    }
    return $null
}

$adb = Get-AdbPath
$serial = Get-EmulatorSerial -Adb $adb -PreferredAvd $AvdName
if (-not $serial) {
    throw "No emulator online. Start AVD $AvdName first."
}

$reverseArgs = @('-s', $serial, 'reverse', "tcp:$Port", "tcp:$Port")
$launchArgs = @('-s', $serial, 'shell', 'am', 'start', '-n', 'xyz.mathsmine3.app/.MainActivity')

Write-Output "Using $serial (preferred AVD $AvdName)"
if ($DryRun) {
    Write-Output "dry-run  $adb $($reverseArgs -join ' ')"
    if (-not $SkipLaunch) {
        Write-Output "dry-run  $adb -s $serial shell am force-stop xyz.mathsmine3.app"
        Write-Output "dry-run  $adb $($launchArgs -join ' ')"
    }
    exit 0
}

Write-Output "Restoring adb reverse tcp:$Port -> tcp:$Port"
& $adb @reverseArgs
if ($LASTEXITCODE -ne 0) {
    throw "adb reverse failed with exit $LASTEXITCODE"
}

if (-not $SkipLaunch) {
    Write-Output 'Relaunching MathsMine3'
    & $adb -s $serial shell am force-stop xyz.mathsmine3.app | Out-Null
    Start-Sleep -Seconds 1
    & $adb @launchArgs
}

Write-Output 'ok'
