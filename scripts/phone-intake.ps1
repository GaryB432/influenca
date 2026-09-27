param(
    [string]$DeviceName = "Pixel 11",
    [int]$Count = 20,
    [string]$DestinationRoot = ""
)

if ([string]::IsNullOrWhiteSpace($DestinationRoot)) {
    $DestinationRoot = "\\wsl.localhost\Ubuntu\home\$env:USERNAME"
    try {
        $wslHome = (& wsl.exe bash -lc 'printf "%s" "$HOME"' 2>$null).Trim()
        if (-not [string]::IsNullOrWhiteSpace($wslHome)) {
            $DestinationRoot = $wslHome
        }
    } catch {
        # Fall through to the Windows username-based WSL path.
    }
}

function Get-ShellItemDate {
    param([object]$Item)

    if ($null -eq $Item) {
        return [datetime]::MinValue
    }

    try {
        return [datetime]$Item.ModifyDate
    } catch {
        Write-Warning "[grab-camera] Item '$($Item.Name)' has no usable ModifyDate; sorting it last."
        return [datetime]::MinValue
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
Write-Host "[grab-camera] Starting camera copy from phone..." -ForegroundColor Cyan

$phoneDrives = $shell.NameSpace(17).Items()
Write-Host "[grab-camera] Enumerated device list. Count: $($phoneDrives.Count)" -ForegroundColor DarkGray
$phone = $phoneDrives | Where-Object { $_.Name -eq $DeviceName }

if (-not $phone) {
    Write-Error "[grab-camera] Could not find a device named '$DeviceName'. Make sure the phone is connected and unlocked."
    exit 1
}

Write-Host "[grab-camera] Found phone object: $($phone.Name)" -ForegroundColor Green

$internalStorage = $phone.GetFolder.Items() | Where-Object { $_.Name -eq "Internal shared storage" }
if (-not $internalStorage) {
    Write-Error "[grab-camera] Could not find 'Internal shared storage' under the phone. Check file transfer mode."
    exit 1
}
Write-Host "[grab-camera] Found internal storage: $($internalStorage.Name)" -ForegroundColor Green

$dcimFolder = $internalStorage.GetFolder.Items() | Where-Object { $_.Name -eq "DCIM" }
if (-not $dcimFolder) {
    Write-Error "[grab-camera] Could not find 'DCIM' under the phone storage."
    exit 1
}
Write-Host "[grab-camera] Found DCIM folder: $($dcimFolder.Name)" -ForegroundColor Green

$cameraFolder = $dcimFolder.GetFolder.Items() | Where-Object { $_.Name -eq "Camera" }
if (-not $cameraFolder) {
    Write-Error "[grab-camera] Could not find 'Camera' under DCIM."
    exit 1
}

Write-Host "[grab-camera] Found camera folder: $($cameraFolder.Name)" -ForegroundColor Green
Write-Host "[grab-camera] Camera folder path: $($cameraFolder.Path)" -ForegroundColor DarkGray
Write-Host "[grab-camera] This is a shell namespace path, not a normal filesystem path. CopyHere is more reliable when passed the shell item object itself." -ForegroundColor Yellow

$timestamp = Get-Date -Format 'yyyy-MM-ddTHH-mm-ss'
$destinationBase = Join-Path $DestinationRoot '.local'
$stateRoot = Join-Path $destinationBase 'state'
$destination = Join-Path $stateRoot "$($phone.Name)"
$destination = Join-Path $destination $timestamp
Write-Host "[grab-camera] Destination: $destination" -ForegroundColor DarkGray
Write-Host "[grab-camera] Creating destination folder..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Write-Host "[grab-camera] Destination folder exists: $(Test-Path $destination)" -ForegroundColor Green

$destShell = $shell.NameSpace($destination)
$items = @($cameraFolder.GetFolder.Items())
Write-Host "[grab-camera] Camera folder contents: $($items.Count) item(s)" -ForegroundColor DarkGray

# Sort newest first using the shell item's modified date if available
$items = $items | Sort-Object {
    Get-ShellItemDate $_
} -Descending

if ($Count -gt 0) {
    $items = $items | Select-Object -First $Count
} else {
    $items = @()
}
Write-Host "[grab-camera] Copying newest $($items.Count) files/items only. Final selection: $($items.Count)" -ForegroundColor Yellow

$copied = 0
foreach ($item in $items) {
    Write-Host "[grab-camera] Copying item: $($item.Name)" -ForegroundColor Yellow
    try {
        $destShell.CopyHere($item, 16)
        $itemCopied = Wait-ForCopiedItem -DestinationPath $destination -ItemName $item.Name
        if ($itemCopied) {
            $copied++
            Write-Host "[grab-camera] Verified item landed: $($item.Name)" -ForegroundColor Green
        } else {
            Write-Warning "[grab-camera] Copy for '$($item.Name)' did not appear in destination within 30 seconds."
        }
    } catch {
        Write-Warning "[grab-camera] Failed to copy '$($item.Name)': $($_.Exception.Message)"
    }
}

Write-Host "[grab-camera] Finished. Successfully copied $copied item(s) into $destination" -ForegroundColor Green
Write-Host "[grab-camera] Final destination count: $(if (Test-Path $destination) { (Get-ChildItem -Force $destination | Measure-Object).Count } else { 0 })" -ForegroundColor DarkGray
