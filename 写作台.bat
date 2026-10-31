@echo off
chcp 65001 >nul
title 写作台
cd /d "%~dp0editor"

if not exist node_modules (
  echo 首次运行，正在安装依赖，稍等片刻...
  call npm install --no-audit --no-fund
)

node server.mjs

rem 服务退出后一并关闭窗口，不留后台进程
exit
