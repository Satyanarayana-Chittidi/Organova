@echo off
:: Check for Administrator privileges; if not elevated, prompt for elevation
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo ====================================================
echo   STARTING MYSQL DATABASE SERVICE
echo ====================================================
echo.
net start MySQL80
echo.
echo ====================================================
echo   MySQL80 is now active! 
echo ====================================================
timeout /t 3
exit
