@echo off
cd /d e:\Code\image-gen
set PATH=C:\Program Files\nodejs;%PATH%
call npm run dev > e:\Code\image-gen\dev-server.log 2>&1