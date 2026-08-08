@echo off
title Hyperlocal Commerce & Delivery Platform Server
echo ==================================================
echo Starting Hyperlocal Commerce & Delivery Platform...
echo ==================================================
echo.
cd /d "%~dp0backend"
py -3 -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
pause
