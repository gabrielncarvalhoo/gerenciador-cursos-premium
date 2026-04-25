$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ws = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath('Desktop')
$atalho = $ws.CreateShortcut("$desktop\Gerenciador de Cursos.lnk")
$atalho.TargetPath = "$root\iniciar_silencioso.vbs"
$atalho.Arguments = "`"$root\iniciar.bat`""
$atalho.WorkingDirectory = $root
$atalho.IconLocation = "$root\web\assets\logo_icon.ico"
$atalho.Save()