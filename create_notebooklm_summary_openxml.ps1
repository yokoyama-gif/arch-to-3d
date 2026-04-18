$ErrorActionPreference = "Stop"

$sourcePath = "C:\Users\admin\Desktop\create_notebooklm_xlsx.py"
$outputPath = "C:\Users\admin\Desktop\NotebookLM_目次まとめ.xlsx"
$buildRoot = "C:\Users\admin\Desktop\_notebooklm_xlsx_build"

function Get-ColumnName {
    param([int]$Index)

    $name = ""
    while ($Index -gt 0) {
        $mod = ($Index - 1) % 26
        $name = [char](65 + $mod) + $name
        $Index = [int](($Index - 1) / 26)
    }
    return $name
}

function Escape-XmlText {
    param([string]$Value)

    if ($null -eq $Value) {
        return ""
    }
    return [System.Security.SecurityElement]::Escape($Value)
}

function New-CellXml {
    param(
        [int]$RowIndex,
        [int]$ColumnIndex,
        [string]$Value,
        [int]$StyleId = 0
    )

    $ref = "{0}{1}" -f (Get-ColumnName -Index $ColumnIndex), $RowIndex
    $text = Escape-XmlText -Value $Value
    return "<c r=`"$ref`" s=`"$StyleId`" t=`"inlineStr`"><is><t xml:space=`"preserve`">$text</t></is></c>"
}

function New-SheetXml {
    param(
        [object[]]$Rows,
        [double[]]$ColumnWidths
    )

    $colsXml = ""
    if ($ColumnWidths.Count -gt 0) {
        $cols = for ($i = 0; $i -lt $ColumnWidths.Count; $i++) {
            $idx = $i + 1
            "<col min=`"$idx`" max=`"$idx`" width=`"$($ColumnWidths[$i])`" customWidth=`"1`"/>"
        }
        $colsXml = "<cols>{0}</cols>" -f ($cols -join "")
    }

    $rowsXml = for ($r = 0; $r -lt $Rows.Count; $r++) {
        $rowNumber = $r + 1
        $row = $Rows[$r]
        $styleId = if ($row.Header) { 1 } else { 0 }
        if (-not $row.Cells -or $row.Cells.Count -eq 0) {
            "<row r=`"$rowNumber`"/>"
            continue
        }

        $cellXml = for ($c = 0; $c -lt $row.Cells.Count; $c++) {
            New-CellXml -RowIndex $rowNumber -ColumnIndex ($c + 1) -Value ([string]$row.Cells[$c]) -StyleId $styleId
        }
        "<row r=`"$rowNumber`">{0}</row>" -f ($cellXml -join "")
    }

    return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0"/>
  </sheetViews>
  $colsXml
  <sheetData>
    $($rowsXml -join "`n    ")
  </sheetData>
</worksheet>
"@
}

function New-Row {
    param(
        [string[]]$Cells,
        [bool]$Header = $false
    )

    return [pscustomobject]@{
        Cells  = $Cells
        Header = $Header
    }
}

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
            Share = "{0:P1}" -f ($_.Count / $totalCount)
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
            Share = "{0:P1}" -f ($_.Count / $totalCount)
        }
    }

$recentItems = $items |
    Sort-Object -Property @{ Expression = "Date"; Descending = $true }, @{ Expression = "No"; Descending = $false } |
    Select-Object -First 40

$dateMin = ($items | Measure-Object Date -Minimum).Minimum
$dateMax = ($items | Measure-Object Date -Maximum).Maximum
$topMajor = $majorGroups | Select-Object -First 5
$topMinor = $minorGroups | Select-Object -First 8

$summaryRows = @(
    (New-Row -Cells @("NotebookLM 目次まとめ", "", "") -Header $true),
    (New-Row -Cells @("作成日", (Get-Date).ToString("yyyy/MM/dd HH:mm"), "")),
    (New-Row -Cells @("項目", "値", "補足") -Header $true),
    (New-Row -Cells @("総件数", "$totalCount", "create_notebooklm_xlsx.py の data 配列から抽出")),
    (New-Row -Cells @("期間", "$($dateMin.ToString('yyyy/MM/dd')) - $($dateMax.ToString('yyyy/MM/dd'))", "収録タイトルの作成日レンジ")),
    (New-Row -Cells @("最大カテゴリ", "$(($majorGroups[0]).Major) / $(($majorGroups[0]).Count)件", "全体の $(($majorGroups[0]).Share)")),
    (New-Row -Cells @("次点カテゴリ", "$(($majorGroups[1]).Major) / $(($majorGroups[1]).Count)件", "全体の $(($majorGroups[1]).Share)")),
    (New-Row -Cells @("最近の傾向", "建築・空間デザイン", "2026/03/29-2026/03/30 は没入体験・空間設計の題材が集中")),
    (New-Row -Cells @()),
    (New-Row -Cells @("上位大分類", "件数", "構成比") -Header $true)
)
$summaryRows += $topMajor | ForEach-Object {
    New-Row -Cells @($_.Major, "$($_.Count)", $_.Share)
}
$summaryRows += @(
    (New-Row -Cells @()),
    (New-Row -Cells @("上位中分類", "", "", "") -Header $true),
    (New-Row -Cells @("大分類", "中分類", "件数", "構成比") -Header $true)
)
$summaryRows += $topMinor | ForEach-Object {
    New-Row -Cells @($_.Major, $_.Minor, "$($_.Count)", $_.Share)
}

$majorRows = @(
    (New-Row -Cells @("大分類", "件数", "構成比") -Header $true)
)
$majorRows += $majorGroups | ForEach-Object {
    New-Row -Cells @($_.Major, "$($_.Count)", $_.Share)
}

$minorRows = @(
    (New-Row -Cells @("大分類", "中分類", "件数", "構成比") -Header $true)
)
$minorRows += $minorGroups | ForEach-Object {
    New-Row -Cells @($_.Major, $_.Minor, "$($_.Count)", $_.Share)
}

$recentRows = @(
    (New-Row -Cells @("日付", "大分類", "中分類", "タイトル") -Header $true)
)
$recentRows += $recentItems | ForEach-Object {
    New-Row -Cells @($_.Date.ToString("yyyy/MM/dd"), $_.Major, $_.Minor, $_.Title)
}

$contentTypesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>
"@

$rootRelsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
"@

$workbookXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="要約" sheetId="1" r:id="rId1"/>
    <sheet name="大分類集計" sheetId="2" r:id="rId2"/>
    <sheet name="中分類集計" sheetId="3" r:id="rId3"/>
    <sheet name="直近トピック" sheetId="4" r:id="rId4"/>
  </sheets>
</workbook>
"@

$workbookRelsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"@

$stylesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font>
      <sz val="11"/>
      <name val="Arial"/>
    </font>
    <font>
      <b/>
      <sz val="11"/>
      <color rgb="FFFFFFFF"/>
      <name val="Arial"/>
    </font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FF2F5496"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
  </fills>
  <borders count="1">
    <border>
      <left/><right/><top/><bottom/><diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>
"@

if (Test-Path -LiteralPath $buildRoot) {
    Remove-Item -LiteralPath $buildRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $buildRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path $buildRoot "_rels") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $buildRoot "xl") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $buildRoot "xl\_rels") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $buildRoot "xl\worksheets") | Out-Null

Set-Content -LiteralPath (Join-Path $buildRoot "[Content_Types].xml") -Value $contentTypesXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "_rels\.rels") -Value $rootRelsXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "xl\workbook.xml") -Value $workbookXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "xl\_rels\workbook.xml.rels") -Value $workbookRelsXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "xl\styles.xml") -Value $stylesXml -Encoding UTF8

Set-Content -LiteralPath (Join-Path $buildRoot "xl\worksheets\sheet1.xml") -Value (New-SheetXml -Rows $summaryRows -ColumnWidths @(22, 36, 54, 12)) -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "xl\worksheets\sheet2.xml") -Value (New-SheetXml -Rows $majorRows -ColumnWidths @(28, 12, 12)) -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "xl\worksheets\sheet3.xml") -Value (New-SheetXml -Rows $minorRows -ColumnWidths @(28, 36, 12, 12)) -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "xl\worksheets\sheet4.xml") -Value (New-SheetXml -Rows $recentRows -ColumnWidths @(14, 28, 36, 80)) -Encoding UTF8

if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($buildRoot, $outputPath)

Write-Output "Saved: $outputPath"
