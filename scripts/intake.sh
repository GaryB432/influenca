#!/bin/bash
# Exit immediately if any command fails
set -e

# 1. Configuration & Formatting
INPUT_DRIVE="${1:-G}"
INPUT_DRIVE="${INPUT_DRIVE%:}"
DRIVE_LOWER="${INPUT_DRIVE,}"
DRIVE_LOWER="${DRIVE_LOWER:0:1}"
DRIVE_UPPER="${DRIVE_LOWER^^}"

MOUNT_POINT="/mnt/${DRIVE_LOWER}"
WINDOWS_DRIVE="${DRIVE_UPPER}:"

# Heuristic WSL detection: warn only; do not block mounting.
if ! grep -qiE '(microsoft|wsl)' /proc/version 2>/dev/null; then
    echo "⚠️  This does not look like WSL based on /proc/version."
    echo "   Continuing anyway and attempting to mount ${WINDOWS_DRIVE}..."
fi

# 2. Check if the drive is already mounted to avoid errors
if mountpoint -q "$MOUNT_POINT" 2>/dev/null && ls "$MOUNT_POINT" >/dev/null 2>&1; then
    echo "ℹ️  ${WINDOWS_DRIVE} is already mounted at ${MOUNT_POINT}. Skipping mount step."
else
    # Clean up any stale/broken stacked mounts before remounting.
    if mountpoint -q "$MOUNT_POINT" 2>/dev/null; then
        echo "⚠️  Found existing mount(s) at ${MOUNT_POINT}; clearing them..."
        sudo umount -R "$MOUNT_POINT" 2>/dev/null || true
    fi

    ATTEMPT=0
    while mountpoint -q "$MOUNT_POINT" 2>/dev/null; do
        ATTEMPT=$((ATTEMPT + 1))
        echo "⚠️  ${MOUNT_POINT} still mounted; unmount attempt ${ATTEMPT}..."
        sudo umount -l "$MOUNT_POINT" || true
        if [ "$ATTEMPT" -ge 8 ]; then
            echo "❌ Error: Could not clear mount stack at ${MOUNT_POINT}."
            echo "   Try: sudo umount -R ${MOUNT_POINT}"
            exit 1
        fi
    done

    # Ensure the mount point directory exists safely.
    if ! sudo mkdir -p "$MOUNT_POINT"; then
        echo "❌ Error: Could not create mount point ${MOUNT_POINT}."
        echo "   Try manually running: sudo umount -l ${MOUNT_POINT}"
        exit 1
    fi

    echo "🔌 Attempting to mount ${WINDOWS_DRIVE} to ${MOUNT_POINT}..."

    # Try mounting, keep stderr so the real root cause is visible.
    if ! sudo mount -t drvfs "$WINDOWS_DRIVE" "$MOUNT_POINT"; then
        echo "❌ Error: Could not mount ${WINDOWS_DRIVE}."
        echo "   Verify the drive letter in Windows Explorer and rerun as: ./scripts/intake.sh <LETTER>"
        # Clean up the empty directory so it doesn't leave a ghost folder.
        sudo rmdir "$MOUNT_POINT" 2>/dev/null || true
        exit 1
    fi
fi

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)

# 3. Your Rsync Command Pipeline
# Customize your destination directory as needed

DEST_DIR="$HOME/.local/state/influenca/$TIMESTAMP/videos/"
mkdir -p "$DEST_DIR"

echo "☕🔄 Starting rsync operations from ${MOUNT_POINT} to ${DEST_DIR}..."

# Standard safe backup flags: archive, verbose, human-readable, compress, delete stale files
#sudo rsync -avh --delete "${MOUNT_POINT}/" "$DEST_DIR/"


# sudo -v


# mkdir -p "$HOME/.local/state/influenca/$TIMESTAMP/videos"

# sudo mkdir -p /mnt/rushmore
# sudo mount -t drvfs G: /mnt/rushmore

# echo "☕ Synchronizing media from G:\\"

rsync -rtv --progress --include="*/" --include="*.AVI" --include="*.avi" --exclude="*" "$MOUNT_POINT/DCIMA/" "$DEST_DIR"

rm -rf "$MOUNT_POINT/AUDIO" "$MOUNT_POINT/DCIMA"

echo "2026-01-01 00:00:01 N" > "$MOUNT_POINT/TIME.TXT"
# sudo umount /mnt/rushmore

ls "$DEST_DIR"

echo "✅ Intake complete!"

printf "✨ Next Steps: %s %s %s\n" \
  "$(tput setaf 208)node" \
  "$(tput setaf 81)apps/cli/dist/bin.mjs accession" \
  "$(tput setaf 121)$DEST_DIR$(tput sgr0)"

