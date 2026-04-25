@echo off
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'Gerenciador de Cursos.lnk')); $s.TargetPath = '%~dp0iniciar.bat'; $s.WorkingDirectory = '%~dp0'; $s.IconLocation = '%~dp0iniciar.bat'; $s.Save()"
echo Atalho "Gerenciador de Cursos" criado na area de trabalho!
pause