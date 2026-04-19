$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut("C:\Users\admin\Desktop\demolition-tool.lnk")
$sc.TargetPath = "C:\Users\admin\Desktop\claud\demolition-tool\demolition-tool.html"
$sc.Description = "Demolition Tool"
$sc.Save()
Write-Host "Shortcut created"
