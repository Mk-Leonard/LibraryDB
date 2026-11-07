@echo off
SETLOCAL Enabledelayedexpansion

echo ============================================
echo   Installing Dependencies for fullstack App 
echo ============================================

:: Get the root directory of the script
set "ROOT_DIR=%~dp0"

:: --- Client Installation ---
echo.
echo [1/2] Navigating to Client Directory...
if exist "%ROOT_DIR%client\" (
    cd "%ROOT_DIR%client"
    echo Installing client npm packages...
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] Client installation failed!
        pause
        exit /b !errorlevel!
    )
    echo [SUCCESS] Client dependencies installed.
) else (
    echo [WARNING] "client" directory not found at %ROOT_DIR%client\
)

:: --- Server Installation ---
echo.
echo [2/2] Navigating to Server Directory...
if exist "%ROOT_DIR%server\" (
    cd "%ROOT_DIR%server"
    echo Installing server npm packages...
    call npm install
    
    echo Installing @tsconfig/node24...
    call npm install --save-dev @tsconfig/node24
    if !errorlevel! neq 0 (
        echo [ERROR] @tsconfig/node24 installation failed!
        pause
        exit /b !errorlevel!
    )

    echo [SUCCESS] Server dependencies installed.
) else (
    echo [WARNING] "server" directory not found at %ROOT_DIR%server\
)

echo.
echo ============================================
echo   All dependencies installed successfully!
echo ============================================
pause
