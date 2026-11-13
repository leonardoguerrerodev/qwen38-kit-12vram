# q38.ps1 - Windows bootstrap: downloads a pinned Node into .state\node (first run only) and hands over to q38.mjs.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # Invoke-WebRequest is very slow with the progress bar
# Windows PowerShell 5.1 on older Windows 10 may not offer TLS 1.2, which nodejs.org requires
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$R = $PSScriptRoot
$NodeVer = 'v22.22.2'
$NodeSha = '7c93e9d92bf68c07182b471aa187e35ee6cd08ef0f24ab060dfff605fcc1c57c'
$Node = Join-Path $R '.state\node\node.exe'

if (-not (Test-Path $Node)) {
  $f = "node-$NodeVer-win-x64"
  $state = Join-Path $R '.state'
  $zip = Join-Path $state "$f.zip.part"
  New-Item -ItemType Directory -Force -Path $state | Out-Null
  Write-Host "q38: descargando / downloading Node $NodeVer..."
  Invoke-WebRequest -Uri "https://nodejs.org/dist/$NodeVer/$f.zip" -OutFile $zip -UseBasicParsing
  if ((Get-FileHash -Algorithm SHA256 $zip).Hash.ToLower() -ne $NodeSha) {
    Remove-Item $zip -Force
    throw 'q38: sha256 no coincide / mismatch'
  }
  $tmp = Join-Path $state 'node-tmp'
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $dest = Join-Path $state 'node'
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }   # a half-made one would make Move-Item nest the folder
  Move-Item (Join-Path $tmp $f) $dest
  Remove-Item $tmp, $zip -Recurse -Force
}
& $Node (Join-Path $R 'q38.mjs') @args
exit $LASTEXITCODE
