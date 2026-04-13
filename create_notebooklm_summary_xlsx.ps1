$ErrorActionPreference = "Stop"

$sourcePath = "C:\Users\admin\Desktop\create_notebooklm_xlsx.py"
$outputPath = "C:\Users\admin\Desktop\NotebookLM_目次まとめ.xlsx"

$sourceText = Get-Content -LiteralPath $sourcePath -Raw -Encoding UTF8
$pattern = '\((\d+),"([^"]*)","([^"]*)","([^"]*)","([^"]*)"\)'
$matches = [regex]::Matches($sourceText, $pattern)

$items = foreach ($m in $matches) {
    [pscustomobject]@{
        No    = [int]$m.Groups[1].Value
        Title = $m.Groups[2].Value
        Date  = [datetime]::ParseExact($m.Groups[3].Value, "yyyy/MM/dd", $null)
        Major = $m.Groups[4].Value
        Minor = $m.Groups[5].Value
    }
}

$totalCount = $items.Count
$majorGroups = $items |
    Group-Object Major |
    Sort-Object -Property @{ Expression = "Count"; Descending = $true }, @{ Expression = "Name"; Descending = $false } |
    ForEach-Object {
        [pscustomobject]@{
            Major = $_.Name
            Count = $_.Count
            Share = [math]::Round(($_.Count / $totalCount), 4)
        }
    }

$minorGroups = $items |
    Group-Object Major, Minor |
    Sort-Object -Property @{ Expression = "Count"; Descending = $true }, @{ Expression = "Name"; Descending = $false } |
    ForEach-Object {
        $parts = $_.Name -split ',\s*', 2
        [pscustomobject]@{
            Major = $parts[0]
            Minor = $parts[1]
            Count = $_.Count
            Share = [math]::Round(($_.Count / $totalCount), 4)
        }
    }

$recentItems = $items |
    Sort-Object -Property @{ Expression = "Date"; Descending = $true }, @{ Expression = "No"; Descending = $false } |
    Select-Object -First 40

$topMajor = $majorGroups | Select-Object -First 5
$topMinor = $minorGroups | Select-Object -First 8
$dateMin = ($items | Measure-Object Date -Minimum).Minimum
$dateMax = ($items | Measure-Object Date -Maximum).Maximum

$summaryRows = @(
    [pscustomobject]@{ Item = "総件数"; Value = $totalCount; Note = "create_notebooklm_xlsx.py の data 配列から抽出" }
    [pscustomobject]@{ Item = "期間"; Value = "$($dateMin.ToString('yyyy/MM/dd')) - $($dateMax.ToString('yyyy/MM/dd'))"; Note = "収録タイトルの作成日レンジ" }
    [pscustomobject]@{ Item = "最大カテゴリ"; Value = "$(($majorGroups[0]).Major) / $(($majorGroups[0]).Count)件"; Note = "全体の $([math]::Round($majorGroups[0].Share * 100, 1))%" }
    [pscustomobject]@{ Item = "次点カテゴリ"; Value = "$(($majorGroups[1]).Major) / $(($majorGroups[1]).Count)件"; Note = "全体の $([math]::Round($majorGroups[1].Share * 100, 1))%" }
    [pscustomobject]@{ Item = "最近の傾向"; Value = "建築・空間デザイン"; Note = "2026/03/29-2026/03/30 は没入体験・空間設計の題材が集中" }
)

function Set-HeaderRow {
    param(
        $Worksheet,
        [int]$Row,
        [string[]]$Headers
    )

    for ($i = 0; $i -lt $Headers.Count; $i++) {
        $cell = $Worksheet.Cells.Item($Row, $i + 1)
        $cell.Value2 = $Headers[$i]
        $cell.Font.Bold = $true
        $cell.Font.Color = 0xFFFFFF
        $cell.Interior.Color = 0x96542F
        $cell.HorizontalAlignment = -4108
    }
}

function Add-DataTable {
    param(
        $Worksheet,
        [int]$StartRow,
        [object[]]$Rows,
        [string[]]$Columns
    )

    Set-HeaderRow -Worksheet $Worksheet -Row $StartRow -Headers $Columns
    $rowIndex = $StartRow + 1
    foreach ($row in $Rows) {
        for ($c = 0; $c -lt $Columns.Count; $c++) {
            $name = $Columns[$c]
            $cell = $Worksheet.Cells.Item($rowIndex, $c + 1)
            $cell.Value2 = $row.$name
        }
        $rowIndex++
    }
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    if (Test-Path -LiteralPath $outputPath) {
        Remove-Item -LiteralPath $outputPath -Force
    }

    $workbook = $excel.Workbooks.Add()
    while ($workbook.Worksheets.Count -lt 4) {
        [void]$workbook.Worksheets.Add()
    }

    $sheetSummary = $workbook.Worksheets.Item(1)
    $sheetSummary.Name = "要約"
    $sheetMajor = $workbook.Worksheets.Item(2)
    $sheetMajor.Name = "大分類集計"
    $sheetMinor = $workbook.Worksheets.Item(3)
    $sheetMinor.Name = "中分類集計"
    $sheetRecent = $workbook.Worksheets.Item(4)
    $sheetRecent.Name = "直近トピック"

    $sheetSummary.Cells.Item(1, 1).Value2 = "NotebookLM 目次まとめ"
    $sheetSummary.Cells.Item(1, 1).Font.Size = 16
    $sheetSummary.Cells.Item(1, 1).Font.Bold = $true
    $sheetSummary.Cells.Item(2, 1).Value2 = "作成日"
    $sheetSummary.Cells.Item(2, 2).Value2 = (Get-Date).ToString("yyyy/MM/dd HH:mm")

    Add-DataTable -Worksheet $sheetSummary -StartRow 4 -Rows $summaryRows -Columns @("Item", "Value", "Note")

    $sheetSummary.Cells.Item(11, 1).Value2 = "上位大分類"
    $sheetSummary.Cells.Item(11, 1).Font.Bold = $true
    Add-DataTable -Worksheet $sheetSummary -StartRow 12 -Rows ($topMajor | ForEach-Object {
        [pscustomobject]@{
            Category = $_.Major
            Count    = $_.Count
            Share    = $_.Share
        }
    }) -Columns @("Category", "Count", "Share")

    $sheetSummary.Cells.Item(20, 1).Value2 = "上位中分類"
    $sheetSummary.Cells.Item(20, 1).Font.Bold = $true
    Add-DataTable -Worksheet $sheetSummary -StartRow 21 -Rows ($topMinor | ForEach-Object {
        [pscustomobject]@{
            Major = $_.Major
            Minor = $_.Minor
            Count = $_.Count
            Share = $_.Share
        }
    }) -Columns @("Major", "Minor", "Count", "Share")

    Add-DataTable -Worksheet $sheetMajor -StartRow 1 -Rows ($majorGroups | ForEach-Object {
        [pscustomobject]@{
            Category = $_.Major
            Count    = $_.Count
            Share    = $_.Share
        }
    }) -Columns @("Category", "Count", "Share")

    Add-DataTable -Worksheet $sheetMinor -StartRow 1 -Rows ($minorGroups | ForEach-Object {
        [pscustomobject]@{
            Major = $_.Major
            Minor = $_.Minor
            Count = $_.Count
            Share = $_.Share
        }
    }) -Columns @("Major", "Minor", "Count", "Share")

    Add-DataTable -Worksheet $sheetRecent -StartRow 1 -Rows ($recentItems | ForEach-Object {
        [pscustomobject]@{
            Date  = $_.Date.ToString("yyyy/MM/dd")
            Major = $_.Major
            Minor = $_.Minor
            Title = $_.Title
        }
    }) -Columns @("Date", "Major", "Minor", "Title")

    foreach ($sheet in @($sheetSummary, $sheetMajor, $sheetMinor, $sheetRecent)) {
        $usedRange = $sheet.UsedRange
        $usedRange.EntireColumn.AutoFit() | Out-Null
        $usedRange.Borders.LineStyle = 1
    }

    foreach ($shareSheet in @($sheetSummary, $sheetMajor, $sheetMinor)) {
        $used = $shareSheet.UsedRange
        for ($r = 1; $r -le $used.Rows.Count; $r++) {
            for ($c = 1; $c -le $used.Columns.Count; $c++) {
                $value = $shareSheet.Cells.Item($r, $c).Value2
                if ($value -is [double] -and $value -le 1 -and $value -ge 0) {
                    $shareSheet.Cells.Item($r, $c).NumberFormatLocal = "0.0%"
                }
            }
        }
    }

    $sheetRecent.Columns.Item(4).ColumnWidth = 80
    $sheetMinor.Columns.Item(2).ColumnWidth = 38
    $sheetSummary.Columns.Item(3).ColumnWidth = 48

    $workbook.SaveAs($outputPath, 51)
    Write-Output "Saved: $outputPath"
}
finally {
    if ($workbook) {
        $workbook.Close($false)
    }
    if ($excel) {
        $excel.Quit()
    }
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
