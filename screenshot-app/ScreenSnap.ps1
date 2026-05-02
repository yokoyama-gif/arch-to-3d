# ScreenSnap - Windows screenshot + annotation app
# Usage:
#   pwsh -File ScreenSnap.ps1                         # Tray-resident
#   pwsh -File ScreenSnap.ps1 -Capture region         # One-shot region capture
#   pwsh -File ScreenSnap.ps1 -Capture screen         # One-shot full-screen capture
#
# Pure PowerShell + WPF + WinForms. No native interop (DllImport).
# To bind a global hotkey, create a Windows shortcut targeting one of the one-shot
# commands above and assign it a shortcut key in the shortcut properties.

param(
  [ValidateSet('', 'region', 'screen')]
  [string]$Capture = ''
)

#region Setup
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName Microsoft.VisualBasic

$script:Settings = @{
  LibraryDir = Join-Path $env:USERPROFILE 'Pictures\ScreenSnap'
  Format     = 'png'
  JpgQuality = 92
  AutoCopy   = $true
  AutoSave   = $true
}
if (-not (Test-Path $script:Settings.LibraryDir)) {
  New-Item -ItemType Directory -Path $script:Settings.LibraryDir -Force | Out-Null
}

# Convert System.Drawing.Bitmap -> System.Windows.Media.ImageSource via PNG memory stream.
# Avoids GetHbitmap / DeleteObject DllImport (AMSI-friendly).
function ConvertTo-BitmapSource([System.Drawing.Bitmap]$bmp) {
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $ms.Position = 0
  $bi = New-Object System.Windows.Media.Imaging.BitmapImage
  $bi.BeginInit()
  $bi.CacheOption = 'OnLoad'
  $bi.StreamSource = $ms
  $bi.EndInit()
  $bi.Freeze()
  return $bi
}

# Pixelate a region using resize-down + resize-up (NearestNeighbor). Fast, pure GDI+.
function New-PixelatedBitmap([System.Drawing.Bitmap]$src, [System.Drawing.Rectangle]$rect, [int]$blockSize) {
  $rect.Intersect((New-Object System.Drawing.Rectangle 0, 0, $src.Width, $src.Height))
  $dst = $src.Clone()
  if ($rect.Width -le 0 -or $rect.Height -le 0) { return $dst }
  $sw = [Math]::Max(1, [int]($rect.Width / $blockSize))
  $sh = [Math]::Max(1, [int]($rect.Height / $blockSize))
  $small = New-Object System.Drawing.Bitmap $sw, $sh, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g1 = [System.Drawing.Graphics]::FromImage($small)
  $g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::Bilinear
  $g1.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g1.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $sw, $sh), $rect, [System.Drawing.GraphicsUnit]::Pixel)
  $g1.Dispose()
  $g2 = [System.Drawing.Graphics]::FromImage($dst)
  $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g2.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g2.DrawImage($small, $rect, (New-Object System.Drawing.Rectangle 0, 0, $sw, $sh), [System.Drawing.GraphicsUnit]::Pixel)
  $g2.Dispose()
  $small.Dispose()
  return $dst
}

#endregion

#region Capture primitives

function Capture-FullScreen {
  $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.X, $b.Y, 0, 0, $bmp.Size, [System.Drawing.CopyPixelOperation]::SourceCopy)
  $g.Dispose()
  return $bmp
}

function Capture-Rect([System.Drawing.Rectangle]$r) {
  if ($r.Width -le 0 -or $r.Height -le 0) { return $null }
  $bmp = New-Object System.Drawing.Bitmap $r.Width, $r.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($r.X, $r.Y, 0, 0, $bmp.Size, [System.Drawing.CopyPixelOperation]::SourceCopy)
  $g.Dispose()
  return $bmp
}

#endregion

#region Region selector overlay

function Show-RegionSelector {
  $full = Capture-FullScreen
  $virt = [System.Windows.Forms.SystemInformation]::VirtualScreen

  $xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        Topmost="True" ShowInTaskbar="False" Cursor="Cross"
        ResizeMode="NoResize" WindowStartupLocation="Manual">
  <Grid x:Name="Root">
    <Image x:Name="Bg" Stretch="None"/>
    <Rectangle x:Name="Dim" Fill="#80000000"/>
    <Canvas x:Name="C">
      <Rectangle x:Name="Sel" Stroke="#FF3DAEFF" StrokeThickness="2" Fill="Transparent" Visibility="Hidden"/>
      <Border x:Name="Info" Background="#CC101418" Padding="6,3" CornerRadius="3" Visibility="Hidden">
        <TextBlock x:Name="InfoText" Foreground="White" FontFamily="Consolas" FontSize="12"/>
      </Border>
    </Canvas>
    <TextBlock x:Name="Hint" Foreground="White" FontSize="14" HorizontalAlignment="Center"
               VerticalAlignment="Top" Margin="0,16,0,0" Background="#A0000000" Padding="10,4">
      ドラッグで範囲を選択 / Esc でキャンセル / Enter で全画面
    </TextBlock>
  </Grid>
</Window>
'@
  $reader = New-Object System.Xml.XmlNodeReader ([xml]$xaml)
  $w = [Windows.Markup.XamlReader]::Load($reader)

  $w.Left = $virt.X; $w.Top = $virt.Y; $w.Width = $virt.Width; $w.Height = $virt.Height

  $bg = $w.FindName('Bg')
  $bg.Source = (ConvertTo-BitmapSource $full)
  $bg.Width = $virt.Width; $bg.Height = $virt.Height

  $sel = $w.FindName('Sel'); $info = $w.FindName('Info'); $infoText = $w.FindName('InfoText')
  $hint = $w.FindName('Hint')

  $state = [pscustomobject]@{ Down = $false; Sx = 0; Sy = 0; Result = $null; Cancelled = $false }

  $w.Add_MouseLeftButtonDown({
    param($s, $e)
    $p = $e.GetPosition($w.FindName('Root'))
    $state.Down = $true; $state.Sx = $p.X; $state.Sy = $p.Y
    [System.Windows.Controls.Canvas]::SetLeft($sel, $p.X)
    [System.Windows.Controls.Canvas]::SetTop($sel, $p.Y)
    $sel.Width = 0; $sel.Height = 0
    $sel.Visibility = 'Visible'
    $info.Visibility = 'Visible'
    $hint.Visibility = 'Collapsed'
  })
  $w.Add_MouseMove({
    param($s, $e)
    if (-not $state.Down) { return }
    $p = $e.GetPosition($w.FindName('Root'))
    $x = [Math]::Min($p.X, $state.Sx); $y = [Math]::Min($p.Y, $state.Sy)
    $wd = [Math]::Abs($p.X - $state.Sx); $ht = [Math]::Abs($p.Y - $state.Sy)
    [System.Windows.Controls.Canvas]::SetLeft($sel, $x)
    [System.Windows.Controls.Canvas]::SetTop($sel, $y)
    $sel.Width = $wd; $sel.Height = $ht
    $infoText.Text = "{0} x {1}" -f [int]$wd, [int]$ht
    [System.Windows.Controls.Canvas]::SetLeft($info, $x)
    [System.Windows.Controls.Canvas]::SetTop($info, [Math]::Max(0, $y - 22))
  })
  $w.Add_MouseLeftButtonUp({
    param($s, $e)
    if (-not $state.Down) { return }
    $state.Down = $false
    $p = $e.GetPosition($w.FindName('Root'))
    $x = [int][Math]::Min($p.X, $state.Sx); $y = [int][Math]::Min($p.Y, $state.Sy)
    $wd = [int][Math]::Abs($p.X - $state.Sx); $ht = [int][Math]::Abs($p.Y - $state.Sy)
    if ($wd -lt 4 -or $ht -lt 4) { $w.Close(); return }
    $state.Result = New-Object System.Drawing.Rectangle ($virt.X + $x), ($virt.Y + $y), $wd, $ht
    $w.Close()
  })
  $w.Add_KeyDown({
    param($s, $e)
    if ($e.Key -eq 'Escape') { $state.Cancelled = $true; $w.Close() }
    elseif ($e.Key -eq 'Return') {
      $state.Result = New-Object System.Drawing.Rectangle $virt.X, $virt.Y, $virt.Width, $virt.Height
      $w.Close()
    }
  })

  $w.ShowDialog() | Out-Null

  $full.Dispose()
  if ($state.Cancelled) { return $null }
  if ($null -eq $state.Result) { return $null }
  return Capture-Rect $state.Result
}

#endregion

#region Editor

$EditorXaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="ScreenSnap エディタ" Width="1200" Height="780"
        Background="#1B1F24" Foreground="#E6EDF3"
        WindowStartupLocation="CenterScreen">
  <Window.Resources>
    <Style TargetType="Button">
      <Setter Property="Background" Value="#2A323D"/>
      <Setter Property="Foreground" Value="#E6EDF3"/>
      <Setter Property="BorderBrush" Value="#3A4452"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="Padding" Value="10,5"/>
      <Setter Property="Margin" Value="3"/>
      <Setter Property="FontSize" Value="13"/>
      <Setter Property="Cursor" Value="Hand"/>
    </Style>
    <Style TargetType="ToggleButton">
      <Setter Property="Background" Value="#2A323D"/>
      <Setter Property="Foreground" Value="#E6EDF3"/>
      <Setter Property="BorderBrush" Value="#3A4452"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="Padding" Value="10,5"/>
      <Setter Property="Margin" Value="3"/>
      <Setter Property="MinWidth" Value="44"/>
      <Setter Property="FontSize" Value="13"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Style.Triggers>
        <Trigger Property="IsChecked" Value="True">
          <Setter Property="Background" Value="#1F6FEB"/>
          <Setter Property="BorderBrush" Value="#1F6FEB"/>
        </Trigger>
      </Style.Triggers>
    </Style>
    <Style TargetType="TextBlock">
      <Setter Property="Foreground" Value="#E6EDF3"/>
    </Style>
    <Style TargetType="Label">
      <Setter Property="Foreground" Value="#9DA7B3"/>
      <Setter Property="FontSize" Value="12"/>
    </Style>
  </Window.Resources>
  <DockPanel>
    <Border DockPanel.Dock="Top" Background="#161A20" BorderBrush="#262C36" BorderThickness="0,0,0,1">
      <StackPanel Orientation="Horizontal" Margin="6">
        <TextBlock Text="ツール" VerticalAlignment="Center" Margin="6,0,8,0" Foreground="#9DA7B3"/>
        <ToggleButton x:Name="TBArrow"   Content="矢印" IsChecked="True"/>
        <ToggleButton x:Name="TBRect"    Content="矩形"/>
        <ToggleButton x:Name="TBEllipse" Content="楕円"/>
        <ToggleButton x:Name="TBLine"    Content="線"/>
        <ToggleButton x:Name="TBHigh"    Content="蛍光ペン"/>
        <ToggleButton x:Name="TBText"    Content="テキスト"/>
        <ToggleButton x:Name="TBStep"    Content="番号"/>
        <ToggleButton x:Name="TBBlur"    Content="モザイク"/>
        <ToggleButton x:Name="TBCrop"    Content="切抜き"/>
        <Separator Margin="8,0" Background="#262C36" Width="1"/>
        <TextBlock Text="色" VerticalAlignment="Center" Margin="6,0,4,0" Foreground="#9DA7B3"/>
        <Button x:Name="ClrRed"    Background="#E5484D" Width="22" Height="22" Padding="0" Margin="2"/>
        <Button x:Name="ClrYellow" Background="#FFD93D" Width="22" Height="22" Padding="0" Margin="2"/>
        <Button x:Name="ClrGreen"  Background="#3FB950" Width="22" Height="22" Padding="0" Margin="2"/>
        <Button x:Name="ClrBlue"   Background="#1F6FEB" Width="22" Height="22" Padding="0" Margin="2"/>
        <Button x:Name="ClrWhite"  Background="#FFFFFF" Width="22" Height="22" Padding="0" Margin="2"/>
        <Button x:Name="ClrBlack"  Background="#000000" Width="22" Height="22" Padding="0" Margin="2"/>
        <Separator Margin="8,0" Background="#262C36" Width="1"/>
        <TextBlock Text="太さ" VerticalAlignment="Center" Margin="6,0,4,0" Foreground="#9DA7B3"/>
        <Slider x:Name="Thickness" Minimum="1" Maximum="14" Value="3" Width="90" VerticalAlignment="Center"/>
        <TextBlock x:Name="ThicknessLabel" Text="3" VerticalAlignment="Center" Width="20" Margin="4,0"/>
        <Separator Margin="8,0" Background="#262C36" Width="1"/>
        <Button x:Name="UndoBtn" Content="元に戻す  Ctrl+Z"/>
        <Button x:Name="RedoBtn" Content="やり直し  Ctrl+Y"/>
      </StackPanel>
    </Border>

    <Border DockPanel.Dock="Bottom" Background="#161A20" BorderBrush="#262C36" BorderThickness="0,1,0,0">
      <Grid Margin="6">
        <Grid.ColumnDefinitions>
          <ColumnDefinition Width="*"/>
          <ColumnDefinition Width="Auto"/>
        </Grid.ColumnDefinitions>
        <TextBlock x:Name="StatusText" Grid.Column="0" VerticalAlignment="Center" Margin="8,0" Foreground="#9DA7B3"/>
        <StackPanel Grid.Column="1" Orientation="Horizontal">
          <Button x:Name="CopyBtn"   Content="コピー  Ctrl+C"/>
          <Button x:Name="SaveBtn"   Content="保存  Ctrl+S" Background="#1F6FEB" BorderBrush="#1F6FEB"/>
          <Button x:Name="SaveAsBtn" Content="名前を付けて保存..."/>
          <Button x:Name="OpenBtn"   Content="フォルダを開く"/>
        </StackPanel>
      </Grid>
    </Border>

    <Border DockPanel.Dock="Left" Width="220" Background="#161A20" BorderBrush="#262C36" BorderThickness="0,0,1,0">
      <DockPanel>
        <TextBlock DockPanel.Dock="Top" Text="ライブラリ" Margin="12,10" FontWeight="Bold" FontSize="13"/>
        <ListBox x:Name="LibraryList" Background="Transparent" BorderThickness="0" Foreground="#E6EDF3"
                 ScrollViewer.HorizontalScrollBarVisibility="Disabled">
          <ListBox.ItemTemplate>
            <DataTemplate>
              <StackPanel Margin="6,4">
                <Border Background="#0D1117" BorderBrush="#262C36" BorderThickness="1" CornerRadius="3">
                  <Image Source="{Binding Thumb}" Stretch="Uniform" MaxHeight="100"/>
                </Border>
                <TextBlock Text="{Binding Name}" FontSize="11" Foreground="#9DA7B3" Margin="0,2,0,0" TextTrimming="CharacterEllipsis"/>
              </StackPanel>
            </DataTemplate>
          </ListBox.ItemTemplate>
        </ListBox>
      </DockPanel>
    </Border>

    <ScrollViewer HorizontalScrollBarVisibility="Auto" VerticalScrollBarVisibility="Auto" Background="#0D1117">
      <Grid HorizontalAlignment="Center" VerticalAlignment="Center" Margin="20">
        <Border BorderBrush="#262C36" BorderThickness="1">
          <Grid>
            <Image x:Name="BaseImage" Stretch="None"/>
            <Canvas x:Name="AnnotCanvas" Background="Transparent"/>
          </Grid>
        </Border>
      </Grid>
    </ScrollViewer>
  </DockPanel>
</Window>
'@

function Show-Editor([System.Drawing.Bitmap]$bitmap) {
  if ($null -eq $bitmap) { return }

  $reader = New-Object System.Xml.XmlNodeReader ([xml]$EditorXaml)
  $win = [Windows.Markup.XamlReader]::Load($reader)

  $base   = $win.FindName('BaseImage')
  $canvas = $win.FindName('AnnotCanvas')
  $status = $win.FindName('StatusText')
  $libList = $win.FindName('LibraryList')
  $thicknessSlider = $win.FindName('Thickness')
  $thicknessLabel  = $win.FindName('ThicknessLabel')

  $tools = @{
    Arrow   = $win.FindName('TBArrow')
    Rect    = $win.FindName('TBRect')
    Ellipse = $win.FindName('TBEllipse')
    Line    = $win.FindName('TBLine')
    High    = $win.FindName('TBHigh')
    Text    = $win.FindName('TBText')
    Step    = $win.FindName('TBStep')
    Blur    = $win.FindName('TBBlur')
    Crop    = $win.FindName('TBCrop')
  }

  $editor = [pscustomobject]@{
    Bitmap     = $bitmap
    Color      = [System.Windows.Media.Color]::FromRgb(229, 72, 77)
    Thickness  = 3
    Tool       = 'Arrow'
    Annots     = New-Object System.Collections.ArrayList
    Redo       = New-Object System.Collections.Stack
    StepNum    = 1
    Drawing    = $false
    StartX     = 0
    StartY     = 0
    Preview    = $null
  }

  function Set-BaseImage($bmp) {
    $base.Source  = (ConvertTo-BitmapSource $bmp)
    $base.Width   = $bmp.Width
    $base.Height  = $bmp.Height
    $canvas.Width = $bmp.Width
    $canvas.Height = $bmp.Height
    $status.Text  = "{0} x {1} px" -f $bmp.Width, $bmp.Height
  }
  Set-BaseImage $bitmap

  $setTool = {
    param($name)
    foreach ($k in $tools.Keys) { $tools[$k].IsChecked = ($k -eq $name) }
    $editor.Tool = $name
  }
  foreach ($k in $tools.Keys) {
    $tn = $k
    $tools[$k].Add_Click({ & $setTool $tn }.GetNewClosure())
  }

  $setColor = {
    param($hex)
    $editor.Color = [System.Windows.Media.ColorConverter]::ConvertFromString($hex)
  }
  $win.FindName('ClrRed').Add_Click({    & $setColor '#E5484D' })
  $win.FindName('ClrYellow').Add_Click({ & $setColor '#FFD93D' })
  $win.FindName('ClrGreen').Add_Click({  & $setColor '#3FB950' })
  $win.FindName('ClrBlue').Add_Click({   & $setColor '#1F6FEB' })
  $win.FindName('ClrWhite').Add_Click({  & $setColor '#FFFFFF' })
  $win.FindName('ClrBlack').Add_Click({  & $setColor '#000000' })

  $thicknessSlider.Add_ValueChanged({
    $v = [int]$thicknessSlider.Value
    $editor.Thickness = $v
    $thicknessLabel.Text = "$v"
  })

  function brushNow { return New-Object System.Windows.Media.SolidColorBrush $editor.Color }
  function brushAlpha([byte]$a) {
    $c = $editor.Color
    $col = [System.Windows.Media.Color]::FromArgb($a, $c.R, $c.G, $c.B)
    return New-Object System.Windows.Media.SolidColorBrush $col
  }

  $pushAnnot = {
    param($el)
    [void]$canvas.Children.Add($el)
    [void]$editor.Annots.Add($el)
    $editor.Redo.Clear()
  }
  $undo = {
    if ($editor.Annots.Count -gt 0) {
      $i = $editor.Annots.Count - 1
      $el = $editor.Annots[$i]
      $editor.Annots.RemoveAt($i)
      $canvas.Children.Remove($el)
      $editor.Redo.Push($el)
    }
  }
  $redo = {
    if ($editor.Redo.Count -gt 0) {
      $el = $editor.Redo.Pop()
      [void]$canvas.Children.Add($el)
      [void]$editor.Annots.Add($el)
    }
  }
  $win.FindName('UndoBtn').Add_Click($undo)
  $win.FindName('RedoBtn').Add_Click($redo)

  function New-Arrow($x1, $y1, $x2, $y2) {
    $g = New-Object System.Windows.Controls.Canvas
    $line = New-Object System.Windows.Shapes.Line
    $line.X1 = $x1; $line.Y1 = $y1; $line.X2 = $x2; $line.Y2 = $y2
    $line.Stroke = (brushNow); $line.StrokeThickness = $editor.Thickness
    $line.StrokeStartLineCap = 'Round'; $line.StrokeEndLineCap = 'Round'
    [void]$g.Children.Add($line)
    $dx = $x2 - $x1; $dy = $y2 - $y1
    $len = [Math]::Sqrt($dx * $dx + $dy * $dy)
    if ($len -gt 1) {
      $headLen = [Math]::Max(10, $editor.Thickness * 4)
      $ux = $dx / $len; $uy = $dy / $len
      $px = -$uy; $py = $ux
      $hx1 = $x2 - $ux * $headLen + $px * $headLen * 0.5
      $hy1 = $y2 - $uy * $headLen + $py * $headLen * 0.5
      $hx2 = $x2 - $ux * $headLen - $px * $headLen * 0.5
      $hy2 = $y2 - $uy * $headLen - $py * $headLen * 0.5
      $poly = New-Object System.Windows.Shapes.Polygon
      $poly.Points = New-Object System.Windows.Media.PointCollection
      $poly.Points.Add((New-Object System.Windows.Point $x2, $y2))
      $poly.Points.Add((New-Object System.Windows.Point $hx1, $hy1))
      $poly.Points.Add((New-Object System.Windows.Point $hx2, $hy2))
      $poly.Fill = (brushNow); $poly.Stroke = (brushNow); $poly.StrokeThickness = 1
      [void]$g.Children.Add($poly)
    }
    return $g
  }
  function New-Rect($x, $y, $w, $h) {
    $r = New-Object System.Windows.Shapes.Rectangle
    $r.Width = $w; $r.Height = $h
    $r.Stroke = (brushNow); $r.StrokeThickness = $editor.Thickness
    [System.Windows.Controls.Canvas]::SetLeft($r, $x)
    [System.Windows.Controls.Canvas]::SetTop($r, $y)
    return $r
  }
  function New-Ellipse($x, $y, $w, $h) {
    $r = New-Object System.Windows.Shapes.Ellipse
    $r.Width = $w; $r.Height = $h
    $r.Stroke = (brushNow); $r.StrokeThickness = $editor.Thickness
    [System.Windows.Controls.Canvas]::SetLeft($r, $x)
    [System.Windows.Controls.Canvas]::SetTop($r, $y)
    return $r
  }
  function New-Line($x1, $y1, $x2, $y2) {
    $l = New-Object System.Windows.Shapes.Line
    $l.X1 = $x1; $l.Y1 = $y1; $l.X2 = $x2; $l.Y2 = $y2
    $l.Stroke = (brushNow); $l.StrokeThickness = $editor.Thickness
    $l.StrokeStartLineCap = 'Round'; $l.StrokeEndLineCap = 'Round'
    return $l
  }
  function New-Highlight($x, $y, $w, $h) {
    $r = New-Object System.Windows.Shapes.Rectangle
    $r.Width = $w; $r.Height = $h
    $r.Fill = (brushAlpha 90); $r.Stroke = $null
    [System.Windows.Controls.Canvas]::SetLeft($r, $x)
    [System.Windows.Controls.Canvas]::SetTop($r, $y)
    return $r
  }
  function New-Step($x, $y, $num) {
    $g = New-Object System.Windows.Controls.Grid
    $size = [Math]::Max(28, $editor.Thickness * 8)
    $e = New-Object System.Windows.Shapes.Ellipse
    $e.Width = $size; $e.Height = $size
    $e.Fill = (brushNow); $e.Stroke = [System.Windows.Media.Brushes]::White; $e.StrokeThickness = 2
    $tb = New-Object System.Windows.Controls.TextBlock
    $tb.Text = "$num"; $tb.Foreground = [System.Windows.Media.Brushes]::White
    $tb.FontWeight = 'Bold'; $tb.FontSize = ($size / 2.2)
    $tb.HorizontalAlignment = 'Center'; $tb.VerticalAlignment = 'Center'
    [void]$g.Children.Add($e); [void]$g.Children.Add($tb)
    [System.Windows.Controls.Canvas]::SetLeft($g, $x - $size / 2)
    [System.Windows.Controls.Canvas]::SetTop($g, $y - $size / 2)
    return $g
  }
  function New-Text($x, $y, $txt) {
    $tb = New-Object System.Windows.Controls.TextBlock
    $tb.Text = $txt
    $tb.Foreground = (brushNow)
    $tb.FontSize = [Math]::Max(14, $editor.Thickness * 5)
    $tb.FontWeight = 'Bold'
    $tb.Background = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromArgb(160, 0, 0, 0))
    $tb.Padding = New-Object System.Windows.Thickness 4, 2, 4, 2
    [System.Windows.Controls.Canvas]::SetLeft($tb, $x)
    [System.Windows.Controls.Canvas]::SetTop($tb, $y)
    return $tb
  }

  function Render-Final {
    $w = [int]$editor.Bitmap.Width; $h = [int]$editor.Bitmap.Height
    $rtb = New-Object System.Windows.Media.Imaging.RenderTargetBitmap $w, $h, 96, 96, ([System.Windows.Media.PixelFormats]::Pbgra32)
    $vis = New-Object System.Windows.Media.DrawingVisual
    $dc = $vis.RenderOpen()
    $bsrc = ConvertTo-BitmapSource $editor.Bitmap
    $dc.DrawImage($bsrc, (New-Object System.Windows.Rect 0, 0, $w, $h))
    $dc.Close()
    $rtb.Render($vis)
    $rtb.Render($canvas)

    $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
    $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($rtb))
    $ms = New-Object System.IO.MemoryStream
    $enc.Save($ms)
    $ms.Position = 0
    $finalBmp = [System.Drawing.Bitmap]::FromStream($ms)
    return , $finalBmp
  }

  $canvas.Add_MouseLeftButtonDown({
    param($s, $e)
    $p = $e.GetPosition($canvas)
    $editor.StartX = $p.X; $editor.StartY = $p.Y
    $editor.Drawing = $true
    if (-not $canvas.IsMouseCaptured) { [void]$canvas.CaptureMouse() }

    switch ($editor.Tool) {
      'Text' {
        $editor.Drawing = $false
        $txt = [Microsoft.VisualBasic.Interaction]::InputBox('テキストを入力', 'テキスト注釈', '')
        if (-not [string]::IsNullOrWhiteSpace($txt)) {
          & $pushAnnot (New-Text $p.X $p.Y $txt)
        }
      }
      'Step' {
        $editor.Drawing = $false
        & $pushAnnot (New-Step $p.X $p.Y $editor.StepNum)
        $editor.StepNum++
      }
    }
  })
  $canvas.Add_MouseMove({
    param($s, $e)
    if (-not $editor.Drawing) { return }
    $p = $e.GetPosition($canvas)
    $x = [Math]::Min($p.X, $editor.StartX); $y = [Math]::Min($p.Y, $editor.StartY)
    $w = [Math]::Abs($p.X - $editor.StartX); $h = [Math]::Abs($p.Y - $editor.StartY)
    if ($null -ne $editor.Preview) { $canvas.Children.Remove($editor.Preview) }
    switch ($editor.Tool) {
      'Arrow'   { $editor.Preview = New-Arrow $editor.StartX $editor.StartY $p.X $p.Y }
      'Rect'    { $editor.Preview = New-Rect $x $y $w $h }
      'Ellipse' { $editor.Preview = New-Ellipse $x $y $w $h }
      'Line'    { $editor.Preview = New-Line $editor.StartX $editor.StartY $p.X $p.Y }
      'High'    { $editor.Preview = New-Highlight $x $y $w $h }
      'Blur'    {
        $r = New-Object System.Windows.Shapes.Rectangle
        $r.Width = $w; $r.Height = $h
        $r.Stroke = [System.Windows.Media.Brushes]::Cyan; $r.StrokeThickness = 1
        $r.StrokeDashArray = New-Object System.Windows.Media.DoubleCollection
        $r.StrokeDashArray.Add(4); $r.StrokeDashArray.Add(2)
        $r.Fill = [System.Windows.Media.Brushes]::Transparent
        [System.Windows.Controls.Canvas]::SetLeft($r, $x)
        [System.Windows.Controls.Canvas]::SetTop($r, $y)
        $editor.Preview = $r
      }
      'Crop'    {
        $r = New-Object System.Windows.Shapes.Rectangle
        $r.Width = $w; $r.Height = $h
        $r.Stroke = [System.Windows.Media.Brushes]::Yellow; $r.StrokeThickness = 1
        $r.StrokeDashArray = New-Object System.Windows.Media.DoubleCollection
        $r.StrokeDashArray.Add(4); $r.StrokeDashArray.Add(2)
        $r.Fill = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromArgb(60, 255, 255, 0))
        [System.Windows.Controls.Canvas]::SetLeft($r, $x)
        [System.Windows.Controls.Canvas]::SetTop($r, $y)
        $editor.Preview = $r
      }
      default { $editor.Preview = $null }
    }
    if ($null -ne $editor.Preview) { [void]$canvas.Children.Add($editor.Preview) }
  })
  $canvas.Add_MouseLeftButtonUp({
    param($s, $e)
    if (-not $editor.Drawing) { return }
    $editor.Drawing = $false
    if ($canvas.IsMouseCaptured) { $canvas.ReleaseMouseCapture() }
    if ($null -ne $editor.Preview) { $canvas.Children.Remove($editor.Preview); $editor.Preview = $null }

    $p = $e.GetPosition($canvas)
    $x = [Math]::Min($p.X, $editor.StartX); $y = [Math]::Min($p.Y, $editor.StartY)
    $w = [Math]::Abs($p.X - $editor.StartX); $h = [Math]::Abs($p.Y - $editor.StartY)
    if ($w -lt 3 -and $h -lt 3 -and $editor.Tool -notin @('Step', 'Text')) { return }

    switch ($editor.Tool) {
      'Arrow'   { & $pushAnnot (New-Arrow $editor.StartX $editor.StartY $p.X $p.Y) }
      'Rect'    { & $pushAnnot (New-Rect $x $y $w $h) }
      'Ellipse' { & $pushAnnot (New-Ellipse $x $y $w $h) }
      'Line'    { & $pushAnnot (New-Line $editor.StartX $editor.StartY $p.X $p.Y) }
      'High'    { & $pushAnnot (New-Highlight $x $y $w $h) }
      'Blur'    {
        $rect = New-Object System.Drawing.Rectangle ([int]$x), ([int]$y), ([int]$w), ([int]$h)
        $blockSize = [Math]::Max(8, [int]([Math]::Min($w, $h) / 12))
        $newBmp = New-PixelatedBitmap $editor.Bitmap $rect $blockSize
        $editor.Bitmap.Dispose()
        $editor.Bitmap = $newBmp
        Set-BaseImage $newBmp
      }
      'Crop'    {
        $rect = New-Object System.Drawing.Rectangle ([int]$x), ([int]$y), ([int]$w), ([int]$h)
        $rect.Intersect((New-Object System.Drawing.Rectangle 0, 0, $editor.Bitmap.Width, $editor.Bitmap.Height))
        if ($rect.Width -gt 0 -and $rect.Height -gt 0) {
          $rendered = Render-Final
          $cropped = New-Object System.Drawing.Bitmap $rect.Width, $rect.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
          $g = [System.Drawing.Graphics]::FromImage($cropped)
          $g.DrawImage($rendered, (New-Object System.Drawing.Rectangle 0, 0, $rect.Width, $rect.Height), $rect, [System.Drawing.GraphicsUnit]::Pixel)
          $g.Dispose()
          $rendered.Dispose()
          $editor.Bitmap.Dispose()
          $editor.Bitmap = $cropped
          foreach ($a in @($editor.Annots)) { $canvas.Children.Remove($a) }
          $editor.Annots.Clear()
          $editor.Redo.Clear()
          Set-BaseImage $cropped
        }
      }
    }
  })

  $libItems = New-Object System.Collections.ObjectModel.ObservableCollection[object]
  $libList.ItemsSource = $libItems
  function Refresh-Library {
    $libItems.Clear()
    Get-ChildItem -Path $script:Settings.LibraryDir -Filter *.png -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 30 |
      ForEach-Object {
        $bi = New-Object System.Windows.Media.Imaging.BitmapImage
        $bi.BeginInit()
        $bi.CacheOption = 'OnLoad'
        $bi.UriSource = New-Object System.Uri $_.FullName
        $bi.DecodePixelWidth = 200
        $bi.EndInit()
        $bi.Freeze()
        $libItems.Add([pscustomobject]@{ Name = $_.Name; Path = $_.FullName; Thumb = $bi })
      }
  }
  Refresh-Library
  $libList.Add_MouseDoubleClick({
    $sel = $libList.SelectedItem
    if ($sel) { Start-Process -FilePath $sel.Path }
  })

  function Save-Now {
    $final = Render-Final
    $ts = Get-Date -Format 'yyyyMMdd_HHmmss'
    $ext = $script:Settings.Format
    $path = Join-Path $script:Settings.LibraryDir "snap_$ts.$ext"
    if ($ext -eq 'jpg') {
      $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
      $params = New-Object System.Drawing.Imaging.EncoderParameters 1
      $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$script:Settings.JpgQuality)
      $final.Save($path, $codec, $params)
    } else {
      $final.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    $final.Dispose()
    $status.Text = "保存しました: $path"
    Refresh-Library
    return $path
  }
  $win.FindName('SaveBtn').Add_Click({ [void](Save-Now) })
  $win.FindName('SaveAsBtn').Add_Click({
    $dlg = New-Object System.Windows.Forms.SaveFileDialog
    $dlg.Filter = 'PNG (*.png)|*.png|JPEG (*.jpg)|*.jpg'
    $dlg.FileName = ('snap_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
    $dlg.InitialDirectory = $script:Settings.LibraryDir
    if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
      $final = Render-Final
      $ext = [System.IO.Path]::GetExtension($dlg.FileName).TrimStart('.').ToLower()
      if ($ext -eq 'jpg' -or $ext -eq 'jpeg') {
        $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
        $params = New-Object System.Drawing.Imaging.EncoderParameters 1
        $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$script:Settings.JpgQuality)
        $final.Save($dlg.FileName, $codec, $params)
      } else {
        $final.Save($dlg.FileName, [System.Drawing.Imaging.ImageFormat]::Png)
      }
      $final.Dispose()
      $status.Text = "保存しました: $($dlg.FileName)"
    }
  })
  $win.FindName('CopyBtn').Add_Click({
    $final = Render-Final
    [System.Windows.Forms.Clipboard]::SetImage($final)
    $final.Dispose()
    $status.Text = "クリップボードにコピーしました"
  })
  $win.FindName('OpenBtn').Add_Click({
    Start-Process -FilePath 'explorer.exe' -ArgumentList $script:Settings.LibraryDir
  })

  $win.Add_PreviewKeyDown({
    param($s, $e)
    $ctrl = ($e.KeyboardDevice.Modifiers -band [System.Windows.Input.ModifierKeys]::Control) -ne 0
    if ($ctrl -and $e.Key -eq 'Z') { & $undo; $e.Handled = $true }
    elseif ($ctrl -and $e.Key -eq 'Y') { & $redo; $e.Handled = $true }
    elseif ($ctrl -and $e.Key -eq 'S') { [void](Save-Now); $e.Handled = $true }
    elseif ($ctrl -and $e.Key -eq 'C') {
      $final = Render-Final
      [System.Windows.Forms.Clipboard]::SetImage($final)
      $final.Dispose()
      $status.Text = "クリップボードにコピーしました"
      $e.Handled = $true
    } elseif ($e.Key -eq 'Escape') { $win.Close() }
  })

  $win.Add_Loaded({
    if ($script:Settings.AutoSave) { [void](Save-Now) }
    if ($script:Settings.AutoCopy) {
      $final = Render-Final
      [System.Windows.Forms.Clipboard]::SetImage($final)
      $final.Dispose()
    }
  })

  $win.Add_Closed({
    if ($null -ne $editor.Bitmap) { try { $editor.Bitmap.Dispose() } catch {} }
  })

  [void]$win.ShowDialog()
}

#endregion

#region Tray

function Make-TrayIcon {
  $bmp = New-Object System.Drawing.Bitmap 32, 32
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(31, 111, 235))), 0, 6, 32, 22)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(31, 111, 235))), 10, 2, 12, 6)
  $g.FillEllipse([System.Drawing.Brushes]::White, 9, 10, 14, 14)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(31, 111, 235))), 13, 14, 6, 6)
  $g.Dispose()
  $hIcon = $bmp.GetHicon()
  return [System.Drawing.Icon]::FromHandle($hIcon)
}

function Run-Capture([string]$mode) {
  Start-Sleep -Milliseconds 150
  $bmp = $null
  switch ($mode) {
    'region' { $bmp = Show-RegionSelector }
    'screen' { $bmp = Capture-FullScreen }
  }
  if ($null -ne $bmp) { Show-Editor $bmp }
}

function Start-Tray {
  $tray = New-Object System.Windows.Forms.NotifyIcon
  $tray.Icon = (Make-TrayIcon)
  $tray.Text = 'ScreenSnap'
  $tray.Visible = $true

  $menu = New-Object System.Windows.Forms.ContextMenuStrip
  $miRegion = $menu.Items.Add('領域をキャプチャ')
  $miScreen = $menu.Items.Add('全画面をキャプチャ')
  $menu.Items.Add('-') | Out-Null
  $miOpen   = $menu.Items.Add('保存フォルダを開く')
  $miAuto   = $menu.Items.Add('自動保存を切替')
  $menu.Items.Add('-') | Out-Null
  $miExit   = $menu.Items.Add('終了')
  $tray.ContextMenuStrip = $menu

  $miRegion.Add_Click({ Run-Capture 'region' })
  $miScreen.Add_Click({ Run-Capture 'screen' })
  $miOpen.Add_Click({ Start-Process explorer.exe $script:Settings.LibraryDir })
  $miAuto.Add_Click({
    $script:Settings.AutoSave = -not $script:Settings.AutoSave
    $tray.BalloonTipTitle = '設定を変更しました'
    $tray.BalloonTipText  = '自動保存: ' + $script:Settings.AutoSave
    $tray.BalloonTipIcon  = [System.Windows.Forms.ToolTipIcon]::Info
    $tray.ShowBalloonTip(2000)
  })
  $miExit.Add_Click({
    $tray.Visible = $false
    [System.Windows.Forms.Application]::Exit()
  })

  $tray.Add_MouseDoubleClick({ Run-Capture 'region' })

  $tray.BalloonTipTitle = 'ScreenSnap が起動しました'
  $tray.BalloonTipText  = "タスクトレイのアイコンをダブルクリックで領域キャプチャ"
  $tray.BalloonTipIcon  = [System.Windows.Forms.ToolTipIcon]::Info
  $tray.ShowBalloonTip(4000)

  [System.Windows.Forms.Application]::EnableVisualStyles()
  [System.Windows.Forms.Application]::Run()

  $tray.Dispose()
}

#endregion

# Entry
if ($Capture -ne '') {
  Run-Capture $Capture
} else {
  Start-Tray
}
