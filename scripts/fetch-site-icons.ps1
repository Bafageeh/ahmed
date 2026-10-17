# Retrieves public favicons for known brands saved in Ahmed's secure vault.
# The resulting PNGs are served locally from ahmed.pm.sa/site-icons.
# This script never reads usernames, passwords or other private vault fields.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$destination = Join-Path $root 'ahmed-api\public\site-icons'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$brands = [ordered]@{
  'hik-connect' = 'hikvision.com'
  'stc'         = 'stc.com.sa'
  'samsung'     = 'samsung.com'
  'apple'       = 'apple.com'
  'godaddy'     = 'godaddy.com'
  'mobily'      = 'mobily.com.sa'
  'chatgpt'     = 'chatgpt.com'
  'expo'        = 'expo.dev'
  'google'      = 'google.com'
  'sahara'      = 'sahara.com'
  'cpanel'      = 'cpanel.net'
}
foreach ($pair in $brands.GetEnumerator()) {
  $target = Join-Path $destination ($pair.Key + '.png')
  $tempFile = Join-Path $env:TEMP ('ahmed-brand-' + $pair.Key + '.img')
  $source = "https://www.google.com/s2/favicons?domain=$($pair.Value)&sz=256"
  try {
    Invoke-WebRequest -Uri $source -OutFile $tempFile -UseBasicParsing -TimeoutSec 25
    $bitmap = [System.Drawing.Image]::FromFile($tempFile)
    try {
      $dims = "$($bitmap.Width)x$($bitmap.Height)"
      if ($bitmap.Width -lt 16 -or $bitmap.Height -lt 16) { throw "Invalid icon dimensions" }
      $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $bitmap.Dispose() }
    Write-Host "$($pair.Key) ($($pair.Value)): $dims, $((Get-Item $target).Length) bytes"
  } finally {
    if (Test-Path $tempFile) { Remove-Item -Path $tempFile -Force }
  }
}

# Prefer recognisable application artwork over tiny site favicons for these.
$overrides = [ordered]@{
  'hik-connect' = 'https://cdn.aptoide.com/imgs/6/d/5/6d5185460eb7e4d62ad78143fbd91e3c_icon.png'
  'mobily'      = 'https://cdn.aptoide.com/imgs/0/1/6/016846fe90bbbe8b6dd19330d05af9e7_icon.png'
  'alfursan'    = 'https://images.weserv.nl/?url=static.awardfares.com/images/providers/v3/light/saudia.webp&output=png'
}
foreach ($pair in $overrides.GetEnumerator()) {
  $target = Join-Path $destination ($pair.Key + '.png')
  $tempFile = Join-Path $env:TEMP ('ahmed-brand-override-' + $pair.Key + '.img')
  try {
    Invoke-WebRequest -Uri $pair.Value -OutFile $tempFile -UseBasicParsing -TimeoutSec 30
    $image = [System.Drawing.Image]::FromFile($tempFile)
    try {
      if ($image.Width -lt 32 -or $image.Height -lt 32) { throw "Image is too small" }
      if ($pair.Key -eq 'alfursan') {
        # Use the square green emblem for the small Al Fursan tile.
        $canvas = [System.Drawing.Bitmap]::new(256,256)
        $graphics = [System.Drawing.Graphics]::FromImage($canvas)
        try {
          $graphics.Clear([System.Drawing.Color]::White)
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          # Crop the recognizable Saudia/Al Fursan green emblem from the wordmark.
          $graphics.DrawImage(
            $image,
            [System.Drawing.Rectangle]::new(12,12,232,232),
            [System.Drawing.Rectangle]::new(90,30,740,650),
            [System.Drawing.GraphicsUnit]::Pixel
          )
          $canvas.Save($target,[System.Drawing.Imaging.ImageFormat]::Png)
        } finally { $graphics.Dispose(); $canvas.Dispose() }
      } else {
        $image.Save($target,[System.Drawing.Imaging.ImageFormat]::Png)
      }
    } finally { $image.Dispose() }
    Write-Host "$($pair.Key) high resolution: $((Get-Item $target).Length) bytes"
  } finally {
    if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
  }
}
