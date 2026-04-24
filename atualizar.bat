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

echo Copiando arquivos atualizados...

REM Copia executavel e DLLs (exceto arquivos de credenciais)
xcopy /Y /I "%ORIGEM%\*.exe" "%DESTINO%"
xcopy /Y /I /E "%ORIGEM%\_internal\*" "%DESTINO%_internal\"

echo.
echo ATENCAO: Nao foram sobrescritos:
echo  - token.json (credenciais Google)
echo  - credentials.json (credenciais Google)
echo  - sessao_estudos.session (sessao Telegram)
echo  - cache_fotos\ (capas dos cursos)
echo.
echo Atualizacao concluida!
pause