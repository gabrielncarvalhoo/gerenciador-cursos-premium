@echo off
echo ================================
echo  Atualizando Gerenciador Cursos
echo ================================

REM Configure o caminho de origem (pasta dist do PC principal)
REM Pode ser caminho de rede, pendrive, etc.
SET ORIGEM=%1
IF "%ORIGEM%"=="" (
    echo Uso: atualizar.bat "caminho\para\nova\versao"
    echo Exemplo: atualizar.bat "D:\GerenciadorCursos"
    pause
    exit /b 1
)

SET DESTINO=%~dp0
SET EXCLUIR=%DESTINO%excluir.txt

REM Criar lista de arquivos que cada PC tem sua propria versao
echo sessao_estudos.session> "%EXCLUIR%"

echo Copiando executavel e _internal (exceto arquivos unicos do PC)...
xcopy /Y /I /E /EXCLUDE:"%EXCLUIR%" "%ORIGEM%\*.exe" "%DESTINO%"
xcopy /Y /I /E /EXCLUDE:"%EXCLUIR%" "%ORIGEM%\_internal\*" "%DESTINO%_internal\"

REM Copiar tokens (sobrescreve para permitir atualizacao de acesso)
if exist "%ORIGEM%\token.json" (
    copy /Y "%ORIGEM%\token.json" "%DESTINO%token.json"
)
if exist "%ORIGEM%\credentials.json" (
    copy /Y "%ORIGEM%\credentials.json" "%DESTINO%credentials.json"
)

REM Limpar arquivo temporario
del "%EXCLUIR%" 2>nul

echo.
echo Atualizacao concluida!
echo Protegido: sessao_estudos.session (sessao Telegram unica deste PC)
pause
