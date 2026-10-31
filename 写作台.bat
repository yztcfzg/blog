@echo off
chcp 65001 >nul
title 写作台
cd /d "%~dp0editor"

if not exist node_modules (
  echo 首次运行，正在安装依赖，稍等片刻...
  call npm install --no-audit --no-fund
)

start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:4310"
node server.mjs
