@echo off
title CareTaker Portal Launcher
echo ===================================================
echo             CareTaker Portal Launcher
echo ===================================================
echo.

set "NODE_CMD=node"

:: 1. Check if Node.js is installed globally
node -v >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Global Node.js installation detected.
    goto :start_server
)

:: 2. Check if Node.js is installed locally in tools\node
if exist "tools\node\node.exe" (
    echo [INFO] Local portable Node.js detected.
    set "NODE_CMD=tools\node\node.exe"
    goto :start_server
)

:: 3. If not found, run setup_node.ps1 to download it
echo [INFO] Node.js was not found globally or locally.
echo        Running setup_node.ps1 to download a portable copy...
powershell -ExecutionPolicy Bypass -File setup_node.ps1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] setup_node.ps1 failed to install portable Node.js.
    echo         Please make sure you have internet access and try again.
    echo.
    pause
    exit /b 1
)

:: Double check if it was installed successfully
if exist "tools\node\node.exe" (
    set "NODE_CMD=tools\node\node.exe"
    goto :start_server
) else (
    echo [ERROR] Failed to locate tools\node\node.exe after setup.
    pause
    exit /b 1
)

:start_server
echo [INFO] Using: %NODE_CMD%
echo [INFO] Starting CareTaker Application Servers...
echo [INFO] - Login Portal:       http://localhost:9012
echo [INFO] - Registration Port:  http://localhost:1290
echo.
echo Press Ctrl+C to stop the servers.
echo ---------------------------------------------------

:: Open the browser to the login portal
start http://localhost:9012

:: Run the Node server
%NODE_CMD% app.js
