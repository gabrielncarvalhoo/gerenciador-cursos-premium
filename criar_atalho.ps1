$ws = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath('Desktop')
$atalho = $ws.CreateShortcut("$desktop\Gerenciador de Cursos.lnk")
$atalho.TargetPath = "C:\gerenciador-cursos\iniciar_silencioso.vbs"
$atalho.Arguments = '"C:\gerenciador-cursos\iniciar.bat"'
$atalho.WorkingDirectory = "C:\gerenciador-cursos"
$atalho.IconLocation = "C:\gerenciador-cursos\web\assets\logo_icon.ico"
$atalho.Save()