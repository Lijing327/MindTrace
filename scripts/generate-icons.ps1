# 生成 MindTrace 插件图标 (16 / 48 / 128)
# 运行: powershell -ExecutionPolicy Bypass -File scripts/generate-icons.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$iconsDir = Join-Path $root 'icons'

if (-not (Test-Path $iconsDir)) {
  New-Item -ItemType Directory -Path $iconsDir | Out-Null
}

Add-Type -AssemblyName System.Drawing

function New-MindTraceIcon {
  param([int]$Size, [string]$OutPath)

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  $bg = [System.Drawing.Color]::FromArgb(45, 55, 72)
  $g.Clear($bg)

  $margin = [Math]::Max(2, [int]($Size * 0.2))
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $g.FillEllipse($brush, $margin, $margin, $Size - 2 * $margin, $Size - 2 * $margin)

  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $brush.Dispose()
  $g.Dispose()
  $bmp.Dispose()
}

New-MindTraceIcon -Size 16 -OutPath (Join-Path $iconsDir 'icon16.png')
New-MindTraceIcon -Size 48 -OutPath (Join-Path $iconsDir 'icon48.png')
New-MindTraceIcon -Size 128 -OutPath (Join-Path $iconsDir 'icon128.png')

Write-Host 'Icons generated in icons/'
