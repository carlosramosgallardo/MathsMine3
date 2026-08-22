@echo off
REM MathsMine3 — double-click launcher for the PowerShell AVD helper.
REM Does not replace scripts/windows/Connect-FreakingAI.ps1; it only forwards argv.
setlocal EnableExtensions
set "SCRIPT_DIR=%~dp0"
set "PS1=%SCRIPT_DIR%Connect-FreakingAI.ps1"

if not exist "%PS1%" (
  echo Connect-FreakingAI.ps1 missing next to this .cmd
  exit /b 1
)

where pwsh >nul 2>&1
if %ERRORLEVEL%==0 (
  pwsh -NoProfile -File "%PS1%" %*
  exit /b %ERRORLEVEL%
)

where powershell >nul 2>&1
if %ERRORLEVEL%==0 (
  powershell -NoProfile -File "%PS1%" %*
  exit /b %ERRORLEVEL%
)

echo Need pwsh or Windows PowerShell on PATH.
exit /b 1
