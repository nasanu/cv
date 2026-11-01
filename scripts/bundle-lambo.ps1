# Builds fn-lambo.zip (in the repo root): everything <fn-lambo> is and needs, so it can be dropped into another site.
#
#   lambo.js    the component (lib/lambo.js, it has no imports)
#   assets      every image or media file lambo.js refers to as "./name.ext" (the car, the avatar and the media in the
#               text panels), taken from the repo root. A reference to a file that is not there stops the build.
#   index.html  a minimal demo page, README.md the docs (both from scripts/lambo-bundle/)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression

$root = Split-Path $PSScriptRoot -Parent
$template = Join-Path $PSScriptRoot "lambo-bundle"
$jsPath = Join-Path $root "lib/lambo.js"
$zipPath = Join-Path $root "fn-lambo.zip"
$folder = "fn-lambo"

# the files lambo.js points at
$js = [System.IO.File]::ReadAllText($jsPath)
$assets = [regex]::Matches($js, '\./[\w./-]+\.(?:png|jpe?g|gif|webp|avif|svg|mp4|webm|mp3|ogg|wav)') |
  ForEach-Object { $_.Value.Substring(2) } |
  Sort-Object -Unique
foreach ($a in $assets) {
  if (-not (Test-Path (Join-Path $root $a))) { throw "lambo.js refers to ./$a but $a does not exist" }
}

# a README table row for each asset
$notes = @{
  "images/lambo-transparent.png" = "The car image. The default ``src``"
  "images/me.jpg"                = "The photo on the profile billboard. The default ``avatar``"
}
$rows = foreach ($a in $assets) {
  $note = if ($notes.ContainsKey($a)) { $notes[$a] } elseif ($a -like "*.mp3") { "Soundtrack (plays from the first key press or tap at 30% volume). Credit: see Credits below" } else { "Media shown in a text panel (see ``tables`` in ``lambo.js``)" }
  "| ``$a`` | $note |"
}
$readme = [System.IO.File]::ReadAllText((Join-Path $template "README.md")).Replace("{{ASSETS}}", ($rows -join "`n"))

# write the zip by hand rather than with Compress-Archive, which (in Windows PowerShell 5.1) stores backslash paths
# that other platforms unzip wrongly
$utf8 = New-Object System.Text.UTF8Encoding($false)
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
$stream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
$zip = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $add = {
    param([string]$name, [byte[]]$bytes)
    $entry = $zip.CreateEntry("$folder/$name", [System.IO.Compression.CompressionLevel]::Optimal)
    $out = $entry.Open()
    try { $out.Write($bytes, 0, $bytes.Length) } finally { $out.Dispose() }
  }
  & $add "lambo.js" ([System.IO.File]::ReadAllBytes($jsPath))
  & $add "index.html" ([System.IO.File]::ReadAllBytes((Join-Path $template "index.html")))
  & $add "README.md" ($utf8.GetBytes($readme))
  foreach ($a in $assets) { & $add $a ([System.IO.File]::ReadAllBytes((Join-Path $root $a))) }
}
finally {
  $zip.Dispose()
  $stream.Dispose()
}

$kb = [math]::Round((Get-Item $zipPath).Length / 1KB)
Write-Output "fn-lambo bundle written to fn-lambo.zip ($kb KB, $($assets.Count) assets)"
