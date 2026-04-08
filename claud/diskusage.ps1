Get-ChildItem -Path 'C:\' -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $folder = $_.FullName
    $size = (Get-ChildItem -Path $folder -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
    [PSCustomObject]@{
        Folder = $folder
        SizeGB = [math]::Round($size / 1GB, 2)
    }
} | Sort-Object SizeGB -Descending | Format-Table -AutoSize
