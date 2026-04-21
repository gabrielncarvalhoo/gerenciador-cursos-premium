@echo off
REM ============================================================
REM Build do GerenciadorCursos em executavel Windows (.exe)
REM
REM Usa o empacotador oficial do Eel (python -m eel) que ja
REM adiciona automaticamente o eel.js e a pasta web/ como data.
REM
REM Requer PyInstaller instalado:  pip install pyinstaller
REM ============================================================

setlocal
cd /d "%~dp0"

echo.
echo [1/3] Limpando builds anteriores...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist GerenciadorCursos.spec del /q GerenciadorCursos.spec

echo.
echo [2/3] Empacotando com PyInstaller via Eel...
python -m eel main.py web ^
    --name GerenciadorCursos ^
    --noconsole ^
    --onedir ^
    --noconfirm ^
    --clean ^
    --hidden-import=googleapiclient ^
    --hidden-import=google.auth.transport.requests ^
    --hidden-import=google.oauth2.credentials ^
    --hidden-import=bottle_websocket

if errorlevel 1 (
    echo.
    echo [ERRO] PyInstaller falhou. Verifique se 'pip install pyinstaller eel' ja foi executado.
    pause
    exit /b 1
)

echo.
echo [3/3] Build concluido!
echo.
echo Executavel final:   dist\GerenciadorCursos\GerenciadorCursos.exe
echo.
echo ATENCAO: antes de rodar o .exe, copie estes arquivos para
echo a pasta dist\GerenciadorCursos\ (mesma pasta do .exe):
echo    - token.json
echo    - credentials.json
echo    - sessao_estudos.session
echo.
pause
endlocal
