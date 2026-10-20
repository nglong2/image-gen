@echo off
cd /d e:\Code\image-gen
set PATH=C:\Program Files\nodejs;%PATH%
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo NPM_INSTALL_FAILED
  exit /b 1
)
echo STARTING_DEV_SERVER...
call npm run dev
