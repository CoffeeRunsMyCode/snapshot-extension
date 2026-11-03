$ErrorActionPreference = "Stop"
$iconScriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Join-Path (Get-Location) "scripts" }
Add-Type -AssemblyName System.Drawing
$brandText = Get-Content -LiteralPath (Join-Path $iconScriptRoot '../src/brand.ts') -Raw
$charcoalHex = [regex]::Match($brandText, '--sn-charcoal:(#[0-9a-fA-F]+)').Groups[1].Value
foreach ($size in @(16,32,48,128)) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.ScaleTransform(($size / 128.0), ($size / 128.0))
    $background = New-Object System.Drawing.Drawing2D.GraphicsPath
    $background.AddArc(0,0,48,48,180,90)
    $background.AddArc(80,0,48,48,270,90)
    $background.AddArc(80,80,48,48,0,90)
    $background.AddArc(0,80,48,48,90,90)
    $background.CloseFigure()
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($charcoalHex))
    $graphics.FillPath($brush,$background)
    $graphics.TranslateTransform(20,20)
    $graphics.ScaleTransform((88.0 / 24), (88.0 / 24))
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White,1.7)
    $pen.StartCap = $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    # The same scan mark used in src/brand.ts: four open corners and a central square.
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddLine(8,3,5,3); $path.AddArc(3,3,4,4,270,-90); $path.AddLine(3,5,3,8)
    $path.StartFigure(); $path.AddLine(16,3,19,3); $path.AddArc(17,3,4,4,270,90); $path.AddLine(21,5,21,8)
    $path.StartFigure(); $path.AddLine(3,16,3,19); $path.AddArc(3,17,4,4,180,-90); $path.AddLine(5,21,8,21)
    $path.StartFigure(); $path.AddLine(16,21,19,21); $path.AddArc(17,17,4,4,90,-90); $path.AddLine(21,19,21,16)
    $path.StartFigure(); $path.AddArc(8,8,2,2,180,90); $path.AddArc(14,8,2,2,270,90); $path.AddArc(14,14,2,2,0,90); $path.AddArc(8,14,2,2,90,90); $path.CloseFigure()
    $graphics.DrawPath($pen,$path)
    $bitmap.Save((Join-Path $iconScriptRoot "../icons/$size.png"),[System.Drawing.Imaging.ImageFormat]::Png)
    $path.Dispose(); $pen.Dispose(); $brush.Dispose(); $background.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
