@echo off
echo ============================================
echo   Starting Client and Server Dev Environments
echo ============================================

:: Get the root directory of the script
set "ROOT_DIR=%~dp0"

:: --- Launch Client ---
if exist "%ROOT_DIR%client\" (
    echo Launching Vite Client...
    start "Vite Client (React)" cmd /k "cd /d "%ROOT_DIR%client" && npm run dev"
) else (
    echo [ERROR] "client" directory not found at %ROOT_DIR%client\
)

:: --- Launch Server ---
if exist "%ROOT_DIR%server\" (
    echo Launching Node Server...
    start "Node Server (TypeScript)" cmd /k "cd /d "%ROOT_DIR%server" && npm run dev"
) else (
    echo [ERROR] "server" directory not found at %ROOT_DIR%server\
)

echo ============================================
echo   Both processes launched in separate windows!
echo ============================================
