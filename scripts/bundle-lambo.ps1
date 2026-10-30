# Builds dist/rex-lambo.zip: everything <rex-lambo> is and needs, so it can be dropped into another site.
#
#   lambo.js    the component (src/components/lib/lambo.js, it has no imports)
#   assets      every image or media file lambo.js refers to as "./name.ext" (the car, the avatar and the media in the
#               text panels), taken from public/. A reference to a file that is not in public/ stops the build.
#   index.html  a minimal demo page, README.md the docs (both from scripts/lambo-bundle/)
#
# Run after `astro build` (npm's postbuild does that), because it writes into dist/.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression

$root = Split-Path $PSScriptRoot -Parent
$dist = Join-Path $root "dist"
$template = Join-Path $PSScriptRoot "lambo-bundle"
$jsPath = Join-Path $root "src/components/lib/lambo.js"
$zipPath = Join-Path $dist "rex-lambo.zip"
$folder = "rex-lambo"

if (-not (Test-Path $dist)) { throw "dist/ not found: run the build first" }

# the files lambo.js points at
$js = [System.IO.File]::ReadAllText($jsPath)
$assets = [regex]::Matches($js, '\./[\w./-]+\.(?:png|jpe?g|gif|webp|avif|svg|mp4|webm|mp3|ogg|wav)') |
  ForEach-Object { $_.Value.Substring(2) } |
  Sort-Object -Unique
foreach ($a in $assets) {
  if (-not (Test-Path (Join-Path $root "public/$a"))) { throw "lambo.js refers to ./$a but public/$a does not exist" }
}

# a README table row for each asset
$notes = @{
  "lambo-transparent.png" = "The car image. The default ``src``"
  "me.jpg"                = "The photo on the profile billboard. The default ``avatar``"
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
  foreach ($a in $assets) { & $add $a ([System.IO.File]::ReadAllBytes((Join-Path $root "public/$a"))) }
}
finally {
  $zip.Dispose()
  $stream.Dispose()
}

$kb = [math]::Round((Get-Item $zipPath).Length / 1KB)
Write-Output "rex-lambo bundle written to dist/rex-lambo.zip ($kb KB, $($assets.Count) assets)"
