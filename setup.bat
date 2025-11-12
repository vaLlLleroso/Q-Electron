@echo off
<<<<<<< Updated upstream
echo === installing python deps ===
pip install -r requirements.txt

echo === installing node/electron deps ===
cd QuareroElectron\electron
npm install

echo === building docker image ===
docker build -t quarero-app .

echo === done ===
pause
=======
title Python 3.10 + Flask App Setup
echo === Setting up Python 3.10 environment ===

rem Define Python version and URL
set "pythonVersion=3.10.11"
set "pythonDownloadUrl=https://www.python.org/ftp/python/%pythonVersion%/python-%pythonVersion%-amd64.exe"

rem Define installation directory
set "installDir=C:\Python310"

rem Check if Python is already installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python not found. Downloading Python %pythonVersion%...
    bitsadmin.exe /transfer "PythonInstaller" "%pythonDownloadUrl%" "%TEMP%\python-installer.exe"

    echo Installing Python silently...
    "%TEMP%\python-installer.exe" /quiet InstallAllUsers=1 PrependPath=1 DefaultCustomInstall=1 DefaultPath=%installDir% /wait

    echo Cleaning up installer...
    del "%TEMP%\python-installer.exe" /f /q
) else (
    echo Python already installed.
)

echo === Ensuring pip ===
python -m ensurepip --upgrade

echo === Installing dependencies ===
pip install --upgrade pip
pip install flask opencv-python-headless requests psycopg2-binary python-dotenv

echo === Setup complete ===
python --version
pip --version
pause
>>>>>>> Stashed changes
