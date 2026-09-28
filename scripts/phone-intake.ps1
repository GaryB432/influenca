param(
    [string]$DeviceName = "Pixel 11",
    [int]$Count = 20,
    [string]$DestinationRoot = ""
)

# PowerShell 7 is supported; this script still depends on Windows-only Shell COM APIs
# for phone enumeration. If this is run from WSL/Linux, it should be started via
# `powershell.exe` on Windows rather than `pwsh` directly.
if (-not $IsWindows) {
    throw "[phone-intake] This script requires Windows PowerShell 7+ (pwsh) on Windows because it calls the Windows Shell COM API to enumerate the phone. Run it via `powershell.exe` from WSL if needed."
}

# WSL-first workflow: this script runs from WSL, so the command we print at the end
# should use the native Linux path. The Windows UNC path is only needed for the
# Shell namespace copy step when the phone is enumerated.
$wslHome = ""
try {
    $wslHome = (& wsl.exe bash -lc 'printf "%s" "$HOME"' 2>$null).Trim()
} catch {
    # Fall back to the standard WSL home if the shell lookup fails.
}

if ([string]::IsNullOrWhiteSpace($wslHome)) {
    $wslHome = "/home/$env:USERNAME"
}

$WslRoot = $wslHome.TrimEnd('/')
if ([string]::IsNullOrWhiteSpace($DestinationRoot)) {
    $DestinationRoot = $WslRoot
} else {
    $DestinationRoot = ConvertTo-WslPath $DestinationRoot
    $WslRoot = $DestinationRoot.TrimEnd('/')
}

function Get-PxlTimestamp {
    param([string]$FileName)

    if ([string]::IsNullOrWhiteSpace($FileName)) {
        return $null
    }

    $match = [regex]::Match($FileName, '^PXL_(\d{8})_(\d{6,9})')
    if (-not $match.Success) {
        throw "[phone-intake] Unsupported filename format for Android camera item: '$FileName'. Expected patterns like 'PXL_20260423_233742242.jpg'."
    }

    $datePart = $match.Groups[1].Value
    $timePart = $match.Groups[2].Value
    $dateText = [string]::Format('{0}-{1}-{2}', $datePart.Substring(0,4), $datePart.Substring(4,2), $datePart.Substring(6,2))
    $timeText = [string]::Format('{0}:{1}:{2}', $timePart.Substring(0,2), $timePart.Substring(2,2), $timePart.Substring(4,2))

    return [datetime]::ParseExact("$dateText $timeText", 'yyyy-MM-dd HH:mm:ss', [System.Globalization.CultureInfo]::InvariantCulture)
}

function Get-SortKey {
    param([object]$Item)

    if ($null -eq $Item) {
        return [datetime]::MinValue
    }

    try {
        return Get-PxlTimestamp $Item.Name
    } catch {
        throw "[phone-intake] Cannot sort item '$($Item.Name)' because it does not match the expected Google Camera naming pattern."
    }
}

function ConvertTo-WslPath {
    param(
        [string]$WindowsPath
    )

    if ([string]::IsNullOrWhiteSpace($WindowsPath)) {
        return ""
    }

    $normalized = $WindowsPath.Trim()
    if ($normalized -match '^\\wsl\.localhost\\Ubuntu') {
        $relative = $normalized.Substring("\\\\wsl.localhost\\Ubuntu".Length)
        return "/$($relative.Replace('\\', '/'))"
    }

    return $normalized
}

function Wait-ForCopiedItem {
    param(
        [string]$DestinationPath,
        [string]$ItemName,
        [int]$TimeoutSeconds = 30,
        [int]$PollMilliseconds = 250
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $matching = Get-ChildItem -Force $DestinationPath -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq $ItemName }
        if ($matching) {
            return $true
        }

        Start-Sleep -Milliseconds $PollMilliseconds
    }

    return $false
}

$shell = New-Object -ComObject Shell.Application
Write-Host "[phone-intake] Starting camera copy from phone..." -ForegroundColor Cyan

$phoneDrives = $shell.NameSpace(17).Items()
Write-Host "[phone-intake] Enumerated device list. Count: $($phoneDrives.Count)" -ForegroundColor DarkGray
$phone = $phoneDrives | Where-Object { $_.Name -eq $DeviceName }

if (-not $phone) {
    Write-Error "[phone-intake] Could not find a device named '$DeviceName'. Make sure the phone is connected and unlocked."
    exit 1
}

Write-Host "[phone-intake] Found phone object: $($phone.Name)" -ForegroundColor Green

$internalStorage = $phone.GetFolder.Items() | Where-Object { $_.Name -eq "Internal shared storage" }
if (-not $internalStorage) {
    Write-Error "[phone-intake] Could not find 'Internal shared storage' under the phone. Check file transfer mode."
    exit 1
}
Write-Host "[phone-intake] Found internal storage: $($internalStorage.Name)" -ForegroundColor Green

$dcimFolder = $internalStorage.GetFolder.Items() | Where-Object { $_.Name -eq "DCIM" }
if (-not $dcimFolder) {
    Write-Error "[phone-intake] Could not find 'DCIM' under the phone storage."
    exit 1
}
Write-Host "[phone-intake] Found DCIM folder: $($dcimFolder.Name)" -ForegroundColor Green

$cameraFolder = $dcimFolder.GetFolder.Items() | Where-Object { $_.Name -eq "Camera" }
if (-not $cameraFolder) {
    Write-Error "[phone-intake] Could not find 'Camera' under DCIM."
    exit 1
}

Write-Host "[phone-intake] Found camera folder: $($cameraFolder.Name)" -ForegroundColor Green
Write-Host "[phone-intake] Camera folder path: $($cameraFolder.Path)" -ForegroundColor DarkGray
Write-Host "[phone-intake] This is a shell namespace path, not a normal filesystem path. CopyHere is more reliable when passed the shell item object itself." -ForegroundColor Yellow

$timestamp = Get-Date -Format 'yyyy-MM-ddTHH-mm-ss'
# These are WSL-native paths and must remain slash-based; Join-Path would use Windows
# path semantics and reintroduce backslashes into the command we want to paste into bash.
$wslDestinationBase = "$WslRoot/.local"
$wslStateRoot = "$wslDestinationBase/state"
$wslDestinationPath = "$wslStateRoot/$($phone.Name)/$timestamp"

# The shell namespace API needs a Windows UNC path, but the command we hand off to WSL
# should stay in native Linux form so it can be pasted into the same terminal session.
$windowsDestinationRoot = "\\wsl.localhost\Ubuntu$($WslRoot.Replace('/', '\'))"
$windowsDestinationBase = Join-Path $windowsDestinationRoot '.local'
$windowsStateRoot = Join-Path $windowsDestinationBase 'state'
$destination = Join-Path $windowsStateRoot "$($phone.Name)"
$destination = Join-Path $destination $timestamp

Write-Host "[phone-intake] Destination: $destination" -ForegroundColor DarkGray
Write-Host "[phone-intake] WSL destination path: $wslDestinationPath" -ForegroundColor DarkGray
Write-Host "[phone-intake] Creating destination folder..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Write-Host "[phone-intake] Destination folder exists: $(Test-Path $destination)" -ForegroundColor Green

$destShell = $shell.NameSpace($destination)
$items = @($cameraFolder.GetFolder.Items())
$items = $items | Where-Object {
    $name = $_.Name
    $ext = [System.IO.Path]::GetExtension($name)
    $isSupportedType = @('.avi', '.mp4', '.wav') -contains $ext.ToLowerInvariant()
    if (-not $isSupportedType) {
        return $false
    }

    try {
        $null = Get-PxlTimestamp $name
        return $true
    } catch {
        return $false
    }
}
Write-Host "[phone-intake] Camera folder contents after filtering: $($items.Count) item(s)" -ForegroundColor DarkGray

# Sort newest first using the Android PXL filename timestamp.
$items = $items | Sort-Object {
    Get-SortKey $_
} -Descending

if ($Count -gt 0) {
    $items = $items | Select-Object -First $Count
} else {
    $items = @()
}
Write-Host "[phone-intake] Copying newest $($items.Count) files/items only. Final selection: $($items.Count)" -ForegroundColor Yellow

$copied = 0
foreach ($item in $items) {
    Write-Host "[phone-intake] Copying item: $($item.Name)" -ForegroundColor Yellow
    try {
        $destShell.CopyHere($item, 16)
        $itemCopied = Wait-ForCopiedItem -DestinationPath $destination -ItemName $item.Name
        if ($itemCopied) {
            $copied++
            Write-Host "[phone-intake] Verified item landed: $($item.Name)" -ForegroundColor Green
        } else {
            Write-Warning "[phone-intake] Copy for '$($item.Name)' did not appear in destination within 30 seconds."
        }
    } catch {
        Write-Warning "[phone-intake] Failed to copy '$($item.Name)': $($_.Exception.Message)"
    }
}

$nextStepCommand = "influenca accession `"$wslDestinationPath`" --transcribe true"

Write-Host "[phone-intake] Finished. Successfully copied $copied item(s) into $destination" -ForegroundColor Green
Write-Host "[phone-intake] Final destination count: $(if (Test-Path $destination) { (Get-ChildItem -Force $destination | Measure-Object).Count } else { 0 })" -ForegroundColor DarkGray
Write-Host
Write-Host "[phone-intake] Next Steps:" -ForegroundColor Cyan
Write-Host $nextStepCommand -ForegroundColor Green
Write-Host "[phone-intake] Copy/paste this command in your WSL terminal:" -ForegroundColor DarkGray
Write-Host $nextStepCommand -ForegroundColor Cyan
