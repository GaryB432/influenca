<#
.SYNOPSIS
    Copies the newest camera media from an Android phone (MTP) into a timestamped
    influenca intake directory and prints the WSL-native accession command.

.DESCRIPTION
    Uses the Windows Shell COM API to enumerate MTP devices — the same mechanism
    Explorer uses — so no Android drivers or adb are required beyond what Windows
    already installs when you plug in the phone and allow file access.

    Run this from PowerShell 7 on Windows (pwsh.exe), or from WSL via:
        pwsh.exe -File "$(wslpath -w ./scripts/intake-android.ps1)"

    After copying, the script prints a ready-to-paste WSL command:
        influenca accession "/home/.../.local/state/influenca/<timestamp>/<phone-slug>" --transcribe true

    The WSL path is resolved using `wsl.exe wslpath` so no Windows paths leak
    into the printed command.

.PARAMETER PhoneName
    Optional. Partial or full name of the phone as it appears in "This PC"
    (e.g. "Pixel", "Galaxy"). Defaults to the first MTP device found.

.PARAMETER Extensions
    Optional. Comma-separated file extensions to copy.
    Defaults to: mp4,MP4,mov,MOV,avi,AVI,wav,WAV,m4a,M4A

.PARAMETER MaxAgeDays
    Optional. Only copy files modified within this many days. Default: 7.
    Pass 0 to copy all files regardless of age.

.PARAMETER WslDistro
    Optional. WSL distribution name to use when resolving WSL paths.
    Defaults to the default WSL distribution.

.EXAMPLE
    # Use defaults — finds the first phone, copies last 7 days of media
    pwsh.exe -File scripts\intake-android.ps1

.EXAMPLE
    # Target a specific phone by partial name, copy last 3 days
    pwsh.exe -File scripts\intake-android.ps1 -PhoneName "Pixel" -MaxAgeDays 3

.EXAMPLE
    # Copy ALL camera files (no age filter) from a Galaxy device
    pwsh.exe -File scripts\intake-android.ps1 -PhoneName "Galaxy" -MaxAgeDays 0

.EXAMPLE
    # From WSL — convert path and hand off to Windows PowerShell 7
    pwsh.exe -File "$(wslpath -w ./scripts/intake-android.ps1)"
#>

[CmdletBinding()]
param(
    [string]  $PhoneName  = "",
    [string]  $Extensions = "mp4,MP4,mov,MOV,avi,AVI,wav,WAV,m4a,M4A",
    [int]     $MaxAgeDays = 7,
    [string]  $WslDistro  = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Write-Step   ([string]$msg) { Write-Host "  $msg" -ForegroundColor Cyan }
function Write-Ok     ([string]$msg) { Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Warn   ([string]$msg) { Write-Host "⚠️  $msg" -ForegroundColor Yellow }
function Write-Fail   ([string]$msg) { Write-Host "❌ $msg" -ForegroundColor Red }

function ConvertTo-KebabCase ([string]$text) {
    # Lower-case, replace runs of non-alphanumeric chars with a single dash,
    # then trim leading/trailing dashes.
    $text = $text.Trim().ToLowerInvariant()
    $text = [System.Text.RegularExpressions.Regex]::Replace($text, '[^a-z0-9]+', '-')
    $text = $text.Trim('-')
    return $text
}

function Get-WslPath ([string]$windowsPath) {
    # Ask WSL to translate the Windows path to a POSIX path.
    $wslArgs = @("wslpath", "-u", $windowsPath)
    if ($WslDistro -ne "") {
        $wslArgs = @("-d", $WslDistro) + $wslArgs
    }
    $posix = wsl.exe @wslArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "wsl.exe wslpath failed for '$windowsPath': $posix"
    }
    return $posix.Trim()
}

# ---------------------------------------------------------------------------
# 1. Locate the phone via Windows Shell COM API
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "☕ influenca Android intake" -ForegroundColor Magenta
Write-Host ""

$shell    = New-Object -ComObject Shell.Application
$thisPC   = $shell.Namespace(0x11)   # CSIDL_DRIVES  ("This PC")

$phone = $null
foreach ($item in $thisPC.Items()) {
    $name = $item.Name
    # MTP devices report themselves as portable devices; they won't have a drive
    # letter Path, so we filter for that heuristic AND apply the optional name filter.
    $isPortable = ($item.Path -notmatch '^[A-Za-z]:')
    $nameMatches = ($PhoneName -eq "") -or ($name -like "*$PhoneName*")
    if ($isPortable -and $nameMatches) {
        $phone = $item
        break
    }
}

if ($null -eq $phone) {
    $hint = if ($PhoneName -ne "") { " matching '$PhoneName'" } else { "" }
    Write-Fail "No MTP device found$hint."
    Write-Host "  • Ensure the phone is connected and you selected 'File Transfer' (MTP) mode."
    Write-Host "  • Use -PhoneName to narrow the search (e.g. -PhoneName 'Pixel')."
    exit 1
}

$phoneFriendlyName = $phone.Name
$phoneSlug         = ConvertTo-KebabCase $phoneFriendlyName
Write-Ok "Found phone: $phoneFriendlyName  →  slug: $phoneSlug"

# ---------------------------------------------------------------------------
# 2. Find the DCIM folder (walk: phone → Internal Storage → DCIM)
# ---------------------------------------------------------------------------

function Find-ShellFolder ([object]$parentFolder, [string]$targetName) {
    foreach ($item in $parentFolder.Items()) {
        if ($item.IsFolder -and $item.Name -eq $targetName) {
            return $item.GetFolder()
        }
    }
    return $null
}

$phoneFolder     = $phone.GetFolder()
$storageFolder   = $null

# Try common MTP storage names in order
foreach ($storageName in @("Internal shared storage", "Internal Storage", "Phone")) {
    $storageFolder = Find-ShellFolder $phoneFolder $storageName
    if ($null -ne $storageFolder) {
        Write-Step "Storage : $storageName"
        break
    }
}

if ($null -eq $storageFolder) {
    # Fall back: use the phone folder itself as root
    Write-Warn "Could not find a named internal storage — using phone root."
    $storageFolder = $phoneFolder
}

$dcimFolder = Find-ShellFolder $storageFolder "DCIM"
if ($null -eq $dcimFolder) {
    Write-Fail "DCIM folder not found on $phoneFriendlyName."
    Write-Host "  • Make sure the phone is unlocked and File Transfer mode is active."
    exit 1
}

Write-Step "Found DCIM on $phoneFriendlyName"

# ---------------------------------------------------------------------------
# 3. Collect matching files recursively from DCIM
# ---------------------------------------------------------------------------

$allowedExts = $Extensions -split ',' | ForEach-Object { ".$($_.Trim())" }
$cutoffDate  = if ($MaxAgeDays -gt 0) { (Get-Date).AddDays(-$MaxAgeDays) } else { $null }

function Collect-MediaItems ([object]$folder, [ref]$results) {
    foreach ($item in $folder.Items()) {
        if ($item.IsFolder) {
            Collect-MediaItems $item.GetFolder() $results
        } else {
            $ext = [System.IO.Path]::GetExtension($item.Name)
            if ($ext -notin $allowedExts) { continue }

            # ModifyDate is detail column 3 for most Shell namespaces
            $modStr = $folder.GetDetailsOf($item, 3)
            $modDate = $null
            if ($modStr -and [datetime]::TryParse($modStr, [ref]$modDate)) {
                if ($null -ne $cutoffDate -and $modDate -lt $cutoffDate) { continue }
            }

            $results.Value += [PSCustomObject]@{
                Item    = $item
                Folder  = $folder
                Name    = $item.Name
                ModDate = $modDate
            }
        }
    }
}

Write-Step "Scanning DCIM for media files (MaxAgeDays=$MaxAgeDays)..."
$mediaItems = [System.Collections.Generic.List[object]]::new()
$listRef    = [ref]$mediaItems
Collect-MediaItems $dcimFolder $listRef

if ($mediaItems.Count -eq 0) {
    $ageNote = if ($MaxAgeDays -gt 0) { " in the last $MaxAgeDays day(s)" } else { "" }
    Write-Warn "No matching media files found on $phoneFriendlyName$ageNote."
    Write-Host "  Extensions searched: $Extensions"
    exit 0
}

Write-Ok "Found $($mediaItems.Count) file(s) to copy"

# ---------------------------------------------------------------------------
# 4. Build the Windows destination path
# ---------------------------------------------------------------------------

$timestamp   = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
# Resolve to the Windows path of the WSL home directory
$wslHomeRaw  = wsl.exe wsl echo '$HOME' 2>&1
$wslHome     = $wslHomeRaw.Trim()

# Convert WSL $HOME to a Windows path
$wslHomeWin  = wsl.exe wslpath -w $wslHome 2>&1
$wslHomeWin  = $wslHomeWin.Trim()

$destWin     = Join-Path $wslHomeWin ".local\state\influenca\$timestamp\$phoneSlug"

Write-Step "Destination (Windows) : $destWin"

# Create destination directory
New-Item -ItemType Directory -Path $destWin -Force | Out-Null

# ---------------------------------------------------------------------------
# 5. Copy files using Shell.Application (MTP-safe)
# ---------------------------------------------------------------------------

Write-Step "Copying $($mediaItems.Count) file(s)..."

$destShellFolder = $shell.Namespace($destWin)
if ($null -eq $destShellFolder) {
    Write-Fail "Could not open destination folder via Shell COM: $destWin"
    exit 1
}

$copied  = 0
$skipped = 0
$failed  = 0

foreach ($entry in $mediaItems) {
    $destFile = Join-Path $destWin $entry.Name
    if (Test-Path $destFile) {
        Write-Warn "  Skip (exists): $($entry.Name)"
        $skipped++
        continue
    }
    try {
        # CopyHere flags: 4 = no progress dialog, 16 = yes to all, 1024 = no error UI
        $destShellFolder.CopyHere($entry.Item, 4 -bor 16 -bor 1024)
        Write-Host "  ✓ $($entry.Name)" -ForegroundColor DarkGreen
        $copied++
    } catch {
        Write-Warn "  Failed to copy $($entry.Name): $_"
        $failed++
    }
}

# CopyHere is asynchronous — poll until all expected files appear.
Write-Step "Waiting for Shell copy to complete..."
$expectedCount = $copied
$waitSecs      = 0
$maxWaitSecs   = 120
do {
    Start-Sleep -Seconds 2
    $waitSecs += 2
    $present = (Get-ChildItem -Path $destWin -File -ErrorAction SilentlyContinue).Count
    if ($present -ge $expectedCount) { break }
    if ($waitSecs -ge $maxWaitSecs) {
        Write-Warn "Timed out waiting for all files. Proceeding with what arrived."
        break
    }
} while ($true)

Write-Ok "Copy complete — copied: $copied, skipped: $skipped, failed: $failed"

# ---------------------------------------------------------------------------
# 6. List copied files and print the WSL-native accession command
# ---------------------------------------------------------------------------

$copiedFiles = Get-ChildItem -Path $destWin -File
Write-Host ""
Write-Host "Files in intake directory:" -ForegroundColor DarkGray
foreach ($f in $copiedFiles) {
    Write-Host "  $($f.Name)" -ForegroundColor DarkGray
}

# Translate the Windows destination path into a WSL POSIX path.
$destPosix = Get-WslPath $destWin

Write-Host ""
Write-Host "✨ Next step — paste into your WSL terminal:" -ForegroundColor White
Write-Host ""
Write-Host "  influenca accession `"$destPosix`" --transcribe true" -ForegroundColor Green
Write-Host ""
