param(
    [string]$DeviceName = "Pixel 11",
    [int]$Count = 20,
    [string]$DestinationRoot = ""
)

if ([string]::IsNullOrWhiteSpace($DestinationRoot)) {
    $DestinationRoot = "\\wsl.localhost\Ubuntu\home\$env:USERNAME"
    try {
        $wslHome = (& wsl.exe bash -lc 'printf "%s" "$HOME"' 2>$null).Trim()
        if (-not [string]::IsNullOrWhiteSpace($wslHome) -and $wslHome.StartsWith('/')) {
            $DestinationRoot = "\\wsl.localhost\Ubuntu$($wslHome.Replace('/', '\'))"
        }
    } catch {
        # Fall through to the Windows username-based WSL path.
    }
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
$destinationBase = Join-Path $DestinationRoot '.local'
$stateRoot = Join-Path $destinationBase 'state'
$destination = Join-Path $stateRoot "$($phone.Name)"
$destination = Join-Path $destination $timestamp
Write-Host "[phone-intake] Destination: $destination" -ForegroundColor DarkGray
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

Write-Host "[phone-intake] Finished. Successfully copied $copied item(s) into $destination" -ForegroundColor Green
Write-Host "[phone-intake] Final destination count: $(if (Test-Path $destination) { (Get-ChildItem -Force $destination | Measure-Object).Count } else { 0 })" -ForegroundColor DarkGray
