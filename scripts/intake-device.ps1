<#
.SYNOPSIS
    Copies the newest camera media from whichever device is plugged in into a
    timestamped influenca intake directory and prints the WSL-native accession command.

.DESCRIPTION
    Uses the Windows Shell COM API (Shell.Application) to discover and browse
    devices — the exact same mechanism Windows Explorer uses when you open "This PC".
    Any device that appears there is reachable here: Android phones, iPhones, iPads,
    and anything else Windows recognises as a portable device, regardless of the
    underlying protocol (MTP, PTP, or Apple's own).

    No adb, no iTunes, no vendor drivers beyond what Windows installs automatically
    when you first plug the device in and tap "Allow" or "File Transfer".

    Run this from PowerShell 7 on Windows (pwsh.exe), or from WSL via:
        pwsh.exe -File "$(wslpath -w ./scripts/intake-device.ps1)"

    After copying, the script prints a WSL command, ready to paste at the repo root:
        pnpm influenca accession "/home/.../.local/state/influenca/<timestamp>/<device-slug>"

    The WSL path is resolved using `wsl.exe wslpath` so no Windows paths leak
    into the printed command.

.PARAMETER DeviceName
    Optional. Partial or full name of the device as it appears in "This PC"
    (e.g. "Pixel", "iPad"). Defaults to the device that is plugged in; with
    more than one, you are asked which.

.PARAMETER Extensions
    Optional. Comma-separated file extensions to copy.
    Defaults to: mp4,MP4,mov,MOV,avi,AVI,wav,WAV,m4a,M4A,png,PNG,jpg,JPG,jpeg,JPEG,heic,HEIC

.PARAMETER KeepLiveClips
    Optional. A Live Photo is a still and a short clip under the same name. By
    default only the still is copied; this brings the clip as well.

.PARAMETER MaxAgeDays
    Optional. Only copy files modified within this many days. Default: 7.
    Pass 0 to copy all files regardless of age.

.PARAMETER WslDistro
    Optional. WSL distribution name to use when resolving WSL paths.
    Defaults to the default WSL distribution.

.EXAMPLE
    # Use defaults — finds the first device, copies last 7 days of media
    pwsh.exe -File scripts\intake-device.ps1

.EXAMPLE
    # Target a specific device by partial name, copy last 3 days
    pwsh.exe -File scripts\intake-device.ps1 -DeviceName "Pixel" -MaxAgeDays 3

.EXAMPLE
    # Copy ALL camera files (no age filter) from an iPad
    pwsh.exe -File scripts\intake-device.ps1 -DeviceName "iPad" -MaxAgeDays 0

.EXAMPLE
    # From WSL — convert path and hand off to Windows PowerShell 7
    pwsh.exe -File "$(wslpath -w ./scripts/intake-device.ps1)"
#>

[CmdletBinding()]
param(
    [string]  $DeviceName  = "",
    [string]  $Extensions = "mp4,MP4,mov,MOV,avi,AVI,wav,WAV,m4a,M4A,png,PNG,jpg,JPG,jpeg,JPEG,heic,HEIC",
    [int]     $MaxAgeDays = 7,
    [switch]  $KeepLiveClips,
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
# 1. Discover the device via the Windows Shell COM API
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "☕ influenca device intake" -ForegroundColor Magenta
Write-Host ""

$shell    = New-Object -ComObject Shell.Application
$thisPC   = $shell.Namespace(0x11)   # CSIDL_DRIVES  ("This PC")

# Shell.Application enumerates everything in "This PC". Portable devices —
# phones, tablets, cameras — appear without a drive-letter Path, which is
# how we tell them apart from local disks. This works for any device Windows
# recognises: Android (MTP), iPhone/iPad (PTP via Apple drivers), and others.
$devices = @($thisPC.Items() | Where-Object {
    ($_.Path -notmatch '^[A-Za-z]:') -and (($DeviceName -eq "") -or ($_.Name -like "*$DeviceName*"))
})

if ($devices.Count -eq 0) {
    $hint = if ($DeviceName -ne "") { " matching '$DeviceName'" } else { "" }
    Write-Fail "No device found$hint in This PC."
    Write-Host "  • Ensure the device is connected and has allowed file access."
    Write-Host "    Android: tap 'File Transfer'. iPhone/iPad: tap 'Trust' and unlock the screen."
    Write-Host "  • Use -DeviceName to narrow the search (e.g. -DeviceName 'iPad')."
    exit 1
}

$device = $devices[0]
if ($devices.Count -gt 1) {
    # More than one is plugged in, so ask. Each is picked by its number.
    $choices = for ($i = 0; $i -lt $devices.Count; $i++) {
        [System.Management.Automation.Host.ChoiceDescription]::new("&$($i + 1) $($devices[$i].Name)")
    }
    $device = $devices[$Host.UI.PromptForChoice("", "Which device?", $choices, 0)]
}

$deviceFriendlyName = $device.Name
$deviceSlug         = ConvertTo-KebabCase $deviceFriendlyName
Write-Ok "Found device: $deviceFriendlyName  →  slug: $deviceSlug"

# ---------------------------------------------------------------------------
# 2. Find the camera folder (walk: device → Internal Storage → DCIM)
# ---------------------------------------------------------------------------

function Find-ShellFolder ([object]$parentFolder, [string]$targetName) {
    foreach ($item in $parentFolder.Items()) {
        if ($item.IsFolder -and $item.Name -eq $targetName) {
            return $item.GetFolder()
        }
    }
    return $null
}

$deviceFolder     = $device.GetFolder()
$storageFolder   = $null

# Try common MTP storage names in order
foreach ($storageName in @("Internal shared storage", "Internal Storage", "Phone")) {
    $storageFolder = Find-ShellFolder $deviceFolder $storageName
    if ($null -ne $storageFolder) {
        Write-Step "Storage : $storageName"
        break
    }
}

if ($null -eq $storageFolder) {
    # Fall back: use the phone folder itself as root
    Write-Warn "Could not find a named internal storage — using phone root."
    $storageFolder = $deviceFolder
}

$mediaFolder = Find-ShellFolder $storageFolder "DCIM"
if ($null -ne $mediaFolder) {
    Write-Step "Found DCIM on $deviceFriendlyName"
} elseif (@($storageFolder.Items()).Count -gt 0) {
    # Some devices show no DCIM folder. This iPad's dated camera folders sit at the top.
    Write-Step "No DCIM folder on $deviceFriendlyName; scanning all of its storage"
    $mediaFolder = $storageFolder
} else {
    Write-Fail "Nothing to read on $deviceFriendlyName."
    Write-Host "  • Make sure the phone is unlocked and File Transfer mode is active."
    exit 1
}

# ---------------------------------------------------------------------------
# 3. Collect matching files recursively from the camera folder
# ---------------------------------------------------------------------------

$allowedExts = $Extensions -split ',' | ForEach-Object { ".$($_.Trim())" }
$cutoffDate  = if ($MaxAgeDays -gt 0) { (Get-Date).AddDays(-$MaxAgeDays) } else { $null }

# A Live Photo is two files under one name: the still, and a clip of a second or two
# around it. The still is the photo, so the clip is left on the device.
$stillExts = @(".jpg", ".png", ".jpeg", ".heic")
$clipExts  = @(".mov")
$script:liveClips = 0

function Collect-MediaItems ([object]$folder, [ref]$results) {
    # Listed once: every pass over a folder is a round trip to the device.
    $items  = @($folder.Items())
    $stills = @{}
    foreach ($item in $items) {
        if (-not $item.IsFolder -and [System.IO.Path]::GetExtension($item.Name) -in $stillExts) {
            $stills[[System.IO.Path]::GetFileNameWithoutExtension($item.Name)] = $true
        }
    }

    foreach ($item in $items) {
        if ($item.IsFolder) {
            Collect-MediaItems $item.GetFolder() $results
        } else {
            $ext = [System.IO.Path]::GetExtension($item.Name)
            if ($ext -notin $allowedExts) { continue }
            $stem = [System.IO.Path]::GetFileNameWithoutExtension($item.Name)
            if (-not $KeepLiveClips -and $ext -in $clipExts -and $stills.ContainsKey($stem)) {
                $script:liveClips++
                continue
            }

            # ModifyDate is detail column 3 for most Shell namespaces
            $modStr = $folder.GetDetailsOf($item, 3)
            [datetime]$modDate = [datetime]::MinValue
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

Write-Step "Scanning for media files (MaxAgeDays=$MaxAgeDays)..."
$mediaItems = [System.Collections.Generic.List[object]]::new()
$listRef    = [ref]$mediaItems
Collect-MediaItems $mediaFolder $listRef

if ($mediaItems.Count -eq 0) {
    $ageNote = if ($MaxAgeDays -gt 0) { " in the last $MaxAgeDays day(s)" } else { "" }
    Write-Warn "No matching media files found on $deviceFriendlyName$ageNote."
    Write-Host "  Extensions searched: $Extensions"
    exit 0
}

Write-Ok "Found $($mediaItems.Count) file(s) to copy"
if ($script:liveClips -gt 0) {
    Write-Step "Left $($script:liveClips) Live Photo clip(s) on the device (-KeepLiveClips brings them too)"
}

# ---------------------------------------------------------------------------
# 4. Build the Windows destination path
# ---------------------------------------------------------------------------

$timestamp    = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
# Resolve both the Windows and POSIX forms of WSL $HOME in one shot each
$wslHomeWin   = (wsl.exe -- wslpath -w '$HOME' 2>&1).Trim()
if ($LASTEXITCODE -ne 0) { throw "wsl.exe wslpath -w failed: $wslHomeWin" }
$wslHomePosix = (wsl.exe -- sh -c 'echo $HOME' 2>&1).Trim()
if ($LASTEXITCODE -ne 0) { throw "wsl.exe sh -c echo HOME failed: $wslHomePosix" }

$destWin      = Join-Path $wslHomeWin ".local\state\influenca\$timestamp\$deviceSlug"
$destPosix    = "$wslHomePosix/.local/state/influenca/$timestamp/$deviceSlug"

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

function Get-ShellItemBytes ([object]$item) {
    # Size reads 0 for some portable-device items; System.Size is the fallback.
    $bytes = [int64]$item.Size
    if ($bytes -le 0) {
        $prop = $item.ExtendedProperty("System.Size")
        if ($prop) { $bytes = [int64]$prop }
    }
    return $bytes
}

function Test-FileClosed ([string]$path) {
    # Windows holds the file open while it writes, so an exclusive open fails until it is done.
    try {
        [System.IO.File]::Open($path, 'Open', 'Read', 'None').Dispose()
        return $true
    } catch {
        return $false
    }
}

function Wait-ShellCopy ([string]$path, [int64]$expectedBytes, [scriptblock]$OnProgress) {
    # CopyHere returns at once and never says when it is done, so watch the file instead.
    # Done means full size (or steady, when the size is unknown) and no longer held open.
    # Gives up when the file stops growing, not after a fixed time, so big clips can take as long as they need.
    $stalled = [System.Diagnostics.Stopwatch]::StartNew()
    $last    = [int64]-1
    while ($true) {
        Start-Sleep -Milliseconds 500
        $bytes = [int64]0
        if (Test-Path -LiteralPath $path) { $bytes = (Get-Item -LiteralPath $path).Length }
        $steady = $bytes -eq $last
        if (-not $steady) { $last = $bytes; $stalled.Restart() }

        if ($expectedBytes -gt 0) { & $OnProgress ([math]::Min(1.0, $bytes / $expectedBytes)) }
        $full = if ($expectedBytes -gt 0) { $bytes -ge $expectedBytes } else { $bytes -gt 0 -and $steady }
        if ($full -and (Test-FileClosed $path)) { return $true }

        # A file already at full size may only be being flushed, so it gets longer.
        $limitSecs = if ($full) { 300 } else { 30 }
        if ($stalled.Elapsed.TotalSeconds -ge $limitSecs) { return $false }
    }
}

$copied  = 0
$skipped = 0
$failed  = 0

# One at a time: the device sends one file at a time anyway, and each is checked before the next starts.
foreach ($entry in $mediaItems) {
    $name     = $entry.Name
    $destFile = Join-Path $destWin $name
    if (Test-Path -LiteralPath $destFile) {
        Write-Warn "  Skip (exists): $name"
        $skipped++
        continue
    }
    Write-Host "  … $name" -NoNewline -ForegroundColor Cyan
    try {
        # CopyHere flags: 4 = no progress dialog, 16 = yes to all, 1024 = no error UI
        $destShellFolder.CopyHere($entry.Item, 4 -bor 16 -bor 1024)
    } catch {
        Write-Host "`r`e[2K" -NoNewline
        Write-Warn "  Failed to copy ${name}: $_"
        $failed++
        continue
    }
    $done = Wait-ShellCopy $destFile (Get-ShellItemBytes $entry.Item) {
        param($fraction)
        Write-Host "`r`e[2K  … $name $([int]($fraction * 100))%" -NoNewline -ForegroundColor Cyan
    }
    Write-Host "`r`e[2K" -NoNewline
    if ($done) {
        Write-Host "  ✓ $name" -ForegroundColor DarkGreen
        $copied++
    } else {
        Write-Warn "  Gave up on ${name}: it stopped growing"
        $failed++
    }
}

Write-Ok "Copy complete — copied: $copied, skipped: $skipped, failed: $failed"

# ---------------------------------------------------------------------------
# 6. List copied files and print the WSL-native accession command
# ---------------------------------------------------------------------------

# $copiedFiles = Get-ChildItem -Path $destWin -File
# Write-Host ""
# Write-Host "Files in intake directory:" -ForegroundColor DarkGray
# foreach ($f in $copiedFiles) {
#     Write-Host "  $($f.Name)" -ForegroundColor DarkGray
# }

# The same closing line the CLI ends on: plain, with the command to paste in its accent.
Write-Host ""
Write-Host "Next: " -NoNewline
Write-Host "pnpm influenca accession `"$destPosix`"" -ForegroundColor Cyan
