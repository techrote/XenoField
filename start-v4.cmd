@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo Node.js 20 or newer is required. Install it and run this file again.
 pause
 exit /b 1
)
set OPEN=1
node tools\serve.mjs
pause
