# setup_node.ps1
$ErrorActionPreference = "Stop"

$toolsDir = Join-Path $PSScriptRoot "tools"
$zipPath = Join-Path $toolsDir "node.zip"
$nodeUrl = "https://nodejs.org/dist/v20.12.2/node-v20.12.2-win-x64.zip"
$extractedDirName = "node-v20.12.2-win-x64"

# Create tools directory
if (-not (Test-Path $toolsDir)) {
    Write-Host "[INFO] Creating tools directory..."
    New-Item -ItemType Directory -Path $toolsDir | Out-Null
}

$nodeExePath = Join-Path $toolsDir "node\node.exe"
if (Test-Path $nodeExePath) {
    Write-Host "[INFO] Node.js is already installed locally in tools\node."
    exit 0
}

Write-Host "[INFO] Downloading Node.js v20.12.2 portable (win-x64)..."
Write-Host "[INFO] URL: $nodeUrl"
try {
    # Use System.Net.WebClient for download
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $webClient = New-Object System.Net.WebClient
    $webClient.DownloadFile($nodeUrl, $zipPath)
} catch {
    Write-Host "[ERROR] Download failed: $_"
    exit 1
}

Write-Host "[INFO] Extracting zip archive..."
try {
    Expand-Archive -Path $zipPath -DestinationPath $toolsDir -Force
} catch {
    Write-Host "[ERROR] Extraction failed: $_"
    exit 1
}

Write-Host "[INFO] Cleaning up zip and renaming folders..."
if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
}

$oldPath = Join-Path $toolsDir $extractedDirName
$newPath = Join-Path $toolsDir "node"

if (Test-Path $oldPath) {
    if (Test-Path $newPath) {
        Remove-Item -Path $newPath -Recurse -Force
    }
    Rename-Item -Path $oldPath -NewName "node"
}

Write-Host "[SUCCESS] Node.js has been successfully downloaded and set up at tools\node."
