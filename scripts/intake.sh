#!/usr/bin/env bash
set -euo pipefail

MAX_DAYS=${MAX_DAYS:-2}
EXTENSIONS=${EXTENSIONS:-mp4,mov}
TRANSPORT=auto
SOURCE_DIR=
USER=${USER:-$(id -un)}

usage() {
  cat <<'EOF'
Usage: intake.sh [--transport auto|usb|adb|adb-win|mtp|gio]
                 [--max-days N] [--extensions EXT[,EXT...]]
                 [--source-dir PATH]

Copy recent camera media from an auto-mounted volume or Android phone.
Defaults: --transport auto --max-days 2 --extensions mp4,mov

In WSL, mounted Windows drives under /mnt are checked. If none contain media,
the script tries to mount WSL_USB_DRIVE (default G) with sudo and drvfs.
In WSL, adb-win uses Windows adb.exe. For Android over USB with Linux adb,
attach the device with usbipd-win first. MTP access with simple-mtpfs in WSL
may require systemd; gio requires a GNOME/GVfs session.
EOF
}

fail() {
  printf '❌ %s\n' "$*" >&2
  exit 1
}

while (($#)); do
  case "$1" in
    --transport)
      (($# >= 2)) || fail "--transport requires a value"
      TRANSPORT=$2
      shift 2
      ;;
    --max-days)
      (($# >= 2)) || fail "--max-days requires a value"
      MAX_DAYS=$2
      shift 2
      ;;
    --extensions)
      (($# >= 2)) || fail "--extensions requires a value"
      EXTENSIONS=$2
      shift 2
      ;;
    --source-dir)
      (($# >= 2)) || fail "--source-dir requires a value"
      SOURCE_DIR=$2
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1 (see --help)"
      ;;
  esac
done

[[ "$MAX_DAYS" =~ ^[0-9]+$ ]] || fail "--max-days must be a non-negative integer"
case "$TRANSPORT" in
  auto|usb|adb|adb-win|mtp|gio) ;;
  *) fail "Unsupported transport '$TRANSPORT' (choose auto, usb, adb, adb-win, mtp, or gio)" ;;
esac

EXTS=()
IFS=',' read -r -a requested_extensions <<< "$EXTENSIONS"
for ext in "${requested_extensions[@]}"; do
  ext=${ext#.}
  [[ -n "$ext" ]] || continue
  EXTS+=("$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')")
done
((${#EXTS[@]})) || fail "At least one file extension is required"

is_wsl() {
  grep -qiE '(microsoft|wsl)' /proc/version 2>/dev/null
}

contains_media() {
  local directory=$1 ext
  for ext in "${EXTS[@]}"; do
    if find "$directory" -type f -iname "*.$ext" -print -quit 2>/dev/null | grep -q .; then
      return 0
    fi
  done
  return 1
}

find_usb_mount() {
  local base volume
  for base in "/media/$USER" "/run/media/$USER" /Volumes; do
    [[ -d "$base" ]] || continue
    for volume in "$base"/*; do
      [[ -d "$volume" ]] || continue
      if contains_media "$volume"; then
        printf '%s\n' "$volume"
        return 0
      fi
    done
  done
  if is_wsl; then
    local drive=${WSL_USB_DRIVE:-G}
    drive=$(printf '%s' "$drive" | tr '[:upper:]' '[:lower:]')
    for volume in "/mnt/$drive" /mnt/[a-z]; do
      [[ -d "$volume" ]] || continue
      if contains_media "$volume"; then
        printf '%s\n' "$volume"
        return 0
      fi
    done
  fi
  return 1
}

mount_wsl_default_drive() {
  is_wsl || return 1
  local drive=${WSL_USB_DRIVE:-G} mount_dir
  [[ "$drive" =~ ^[a-zA-Z]$ ]] || {
    printf '⚠️  WSL_USB_DRIVE must be a single drive letter (got %s).\n' "$drive" >&2
    return 1
  }
  drive=$(printf '%s' "$drive" | tr '[:lower:]' '[:upper:]')
  mount_dir="/mnt/${drive,,}"
  mountpoint -q "$mount_dir" 2>/dev/null && return 1
  command -v sudo >/dev/null 2>&1 || return 1

  printf '🔌 Trying to mount WSL drive %s: at %s (sudo may prompt for your Linux password)...\n' "$drive" "$mount_dir" >&2
  if sudo mkdir -p "$mount_dir" && sudo mount -t drvfs "$drive:" "$mount_dir"; then
    if contains_media "$mount_dir"; then
      printf '%s\n' "$mount_dir"
      return 0
    fi
  fi
  return 1
}

has_adb_device() {
  local binary=$1
  command -v "$binary" >/dev/null 2>&1 || return 1
  "$binary" devices 2>/dev/null | awk '$2 == "device" { found = 1 } END { exit !found }'
}

gio_mtp_uri() {
  command -v gio >/dev/null 2>&1 || return 1
  gio mount -li 2>/dev/null |
    sed -n 's/^[[:space:]]*default_location=//p' |
    grep -m1 '^mtp://' || return 1
}

USB_MOUNT=
GIO_URI=
if [[ "$TRANSPORT" == auto || "$TRANSPORT" == usb ]]; then
  USB_MOUNT=$(find_usb_mount || true)
  if [[ -z "$USB_MOUNT" ]]; then
    USB_MOUNT=$(mount_wsl_default_drive || true)
  fi
fi

if [[ "$TRANSPORT" == auto ]]; then
  if [[ -n "$USB_MOUNT" ]]; then
    TRANSPORT=usb
  elif has_adb_device adb; then
    TRANSPORT=adb
  elif is_wsl && has_adb_device adb.exe; then
    TRANSPORT=adb-win
  elif command -v simple-mtpfs >/dev/null 2>&1; then
    TRANSPORT=mtp
  elif GIO_URI=$(gio_mtp_uri); then
    TRANSPORT=gio
  else
    fail "No supported source found. Mount a USB volume, connect Android with adb/adb.exe, or install simple-mtpfs (or use gio in GNOME)."
  fi
fi

if [[ "$TRANSPORT" == usb && -z "$SOURCE_DIR" ]]; then
  [[ -n "$USB_MOUNT" ]] || fail "No mounted volume with matching media found under /media/$USER or /run/media/$USER; pass --source-dir to specify one."
  SOURCE_DIR=$USB_MOUNT
fi

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
DEST="$HOME/.local/state/influenca/$TIMESTAMP"
mkdir -p "$DEST"

WORK_DIR=
MOUNT_DIR=
cleanup() {
  if [[ -n "$MOUNT_DIR" ]]; then
    if command -v fusermount3 >/dev/null 2>&1; then
      fusermount3 -u "$MOUNT_DIR" 2>/dev/null || true
    elif command -v fusermount >/dev/null 2>&1; then
      fusermount -u "$MOUNT_DIR" 2>/dev/null || true
    fi
    rm -rf "$MOUNT_DIR" 2>/dev/null || true
  fi
  [[ -z "$WORK_DIR" ]] || rm -rf "$WORK_DIR"
}
trap cleanup EXIT

copy_from() {
  local source=$1 file relative extension target copied=0
  [[ -d "$source" ]] || fail "Source directory does not exist: $source"
  while IFS= read -r -d '' file; do
    extension=${file##*.}
    extension=$(printf '%s' "$extension" | tr '[:upper:]' '[:lower:]')
    [[ " ${EXTS[*]} " == *" $extension "* ]] || continue
    if ((MAX_DAYS > 0)) && ! find "$file" -type f -mtime "-$MAX_DAYS" -print -quit | grep -q .; then
      continue
    fi
    relative=${file#"$source"/}
    target="$DEST/$relative"
    mkdir -p "$(dirname "$target")"
    cp -p "$file" "$target"
    copied=$((copied + 1))
  done < <(find "$source" -type f -print0)
  printf '%s\n' "$copied"
}

case "$TRANSPORT" in
  usb)
    echo "📂 USB volume: $SOURCE_DIR"
    ;;
  adb|adb-win)
    SOURCE_DIR=${SOURCE_DIR:-/sdcard/DCIM/Camera}
    WORK_DIR=$(mktemp -d)
    if [[ "$TRANSPORT" == adb-win ]]; then
      command -v wslpath >/dev/null 2>&1 || fail "wslpath is required to use Windows adb.exe from WSL"
      echo "📱 Android via adb.exe (WSL)"
      adb.exe pull "$SOURCE_DIR" "$(wslpath -w "$WORK_DIR")"
    else
      echo "📱 Android via adb"
      adb pull "$SOURCE_DIR" "$WORK_DIR"
    fi
    if [[ -d "$WORK_DIR/$(basename "$SOURCE_DIR")" ]]; then
      SOURCE_DIR="$WORK_DIR/$(basename "$SOURCE_DIR")"
    else
      SOURCE_DIR=$WORK_DIR
    fi
    ;;
  mtp)
    command -v simple-mtpfs >/dev/null 2>&1 || fail "Install simple-mtpfs to use the MTP transport"
    WORK_DIR=$(mktemp -d)
    MOUNT_DIR=$(mktemp -d)
    simple-mtpfs "$MOUNT_DIR"
    SOURCE_DIR=${SOURCE_DIR:-}
    if [[ -z "$SOURCE_DIR" ]]; then
      for candidate in \
        "$MOUNT_DIR/Internal shared storage/DCIM/Camera" \
        "$MOUNT_DIR/Internal storage/DCIM/Camera" \
        "$MOUNT_DIR/Internal Storage/DCIM/Camera" \
        "$MOUNT_DIR/Phone/DCIM/Camera" \
        "$MOUNT_DIR/DCIM/Camera" \
        "$MOUNT_DIR/Internal storage/DCIM" \
        "$MOUNT_DIR/Internal Storage/DCIM" \
        "$MOUNT_DIR/Phone/DCIM" \
        "$MOUNT_DIR/DCIM"; do
        if [[ -d "$candidate" ]]; then
          SOURCE_DIR=$candidate
          break
        fi
      done
    elif [[ "$SOURCE_DIR" != /* ]]; then
      SOURCE_DIR="$MOUNT_DIR/$SOURCE_DIR"
    fi
    [[ -n "$SOURCE_DIR" ]] || fail "Could not find DCIM on the MTP device; pass --source-dir to specify its path."
    echo "📱 Android via simple-mtpfs"
    ;;
  gio)
    GIO_URI=${GIO_URI:-$(gio_mtp_uri || true)}
    [[ -n "$GIO_URI" ]] || fail "No GVfs MTP device found; check that the phone is mounted in Files."
    WORK_DIR=$(mktemp -d)
    if [[ -z "$SOURCE_DIR" ]]; then
      SOURCE_DIR="${GIO_URI%/}/Internal%20storage/DCIM/Camera"
    elif [[ "$SOURCE_DIR" != mtp://* ]]; then
      SOURCE_DIR="${GIO_URI%/}/$(printf '%s' "$SOURCE_DIR" | sed 's/ /%20/g')"
    fi
    echo "📱 Android via gio"
    gio copy "$SOURCE_DIR" "$WORK_DIR/"
    if [[ -d "$WORK_DIR/Camera" ]]; then
      SOURCE_DIR="$WORK_DIR/Camera"
    else
      SOURCE_DIR=$WORK_DIR
    fi
    ;;
esac

COUNT=$(copy_from "$SOURCE_DIR")
printf '\n✅ %s file(s) → %s\n\n' "$COUNT" "$DEST"
printf 'influenca accession %q --transcribe true\n' "$DEST"
