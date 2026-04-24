@echo off
echo ================================
echo  Instalando Gerenciador Cursos
echo ================================
echo.
echo Instalando dependencias Python...
py -3.12 -m pip install eel telethon google-api-python-client google-auth-oauthlib aiohttp
echo.
echo ================================
echo  Instalacao concluida!
echo  Para iniciar o app rode: iniciar.bat
echo ================================
pause
