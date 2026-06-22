@echo off
title MongoDB Server Launcher
echo ===================================================
echo             MongoDB Server Launcher
echo ===================================================
echo.

set DB_PATH=%~dp0mongodb_data
if not exist "%DB_PATH%" (
    echo [INFO] Creating local database directory at %DB_PATH%...
    mkdir "%DB_PATH%"
)

echo [INFO] Starting MongoDB Server...
"C:\Users\NACL\Desktop\mongodb-win32-x86_64-windows-8.3.4\bin\mongod.exe" --dbpath "%DB_PATH%"

pause
