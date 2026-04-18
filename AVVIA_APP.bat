@echo off
REM ─────────────────────────────────────────────────────
REM   ANAS SafeHub — Avvio locale automatico (Windows)
REM ─────────────────────────────────────────────────────
REM   Questo script avvia un web server locale nella cartella
REM   corrente e apre l'app nel browser predefinito.
REM
REM   Richiede Python installato. Se non ce l'hai, scaricalo da:
REM   https://www.python.org/downloads/windows/
REM ─────────────────────────────────────────────────────

echo.
echo ===========================================
echo   ANAS SafeHub - Avvio locale
echo ===========================================
echo.

cd /d "%~dp0"

REM Verifica che Python sia installato
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: Python non installato.
    echo.
    echo Scaricalo da: https://www.python.org/downloads/windows/
    echo Durante installazione spunta "Add Python to PATH".
    echo.
    pause
    exit /b 1
)

echo Server avviato su: http://localhost:8765/
echo.
echo Premere CTRL+C per chiudere il server.
echo.

REM Apre il browser dopo 2 secondi (dà tempo al server di partire)
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8765/"

REM Avvia server (blocca finestra)
python -m http.server 8765
