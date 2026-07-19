@echo off
chcp 65001 > nul
color 0A
cls

set GIT="C:\Users\Roshdi\AppData\Local\GitHubDesktop\app-3.6.3\resources\app\git\cmd\git.exe"
set PROJECT_DIR=f:\AI\dataCore

echo ================================================
echo    DataCore - Push to GitHub
echo ================================================
echo.

cd /d %PROJECT_DIR%

echo [1/4] Building frontend (vite build)...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)
echo Build complete!
echo.

echo [2/4] Staging all files...
%GIT% add .
echo Done!
echo.

echo [3/4] Creating commit...
echo Deployment update > temp_commit.txt
%GIT% commit -F temp_commit.txt
del temp_commit.txt
echo Done!
echo.

echo [4/4] Pushing to GitHub...
%GIT% push origin main
if errorlevel 1 (
    echo.
    echo Push failed - Please push manually via GitHub Desktop
    echo Open GitHub Desktop and click "Push origin"
) else (
    echo.
    echo ================================================
    echo   SUCCESS! Pushed to GitHub
    echo   Now go to Hostinger and click Redeploy
    echo ================================================
)

echo.
pause
