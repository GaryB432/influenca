# influenca

Say it like `influenza` but with a a `c`

```shell
npm install influenca
influenca ~/my-media --exif
```

## Content intake

move `avi` files from your Windows `F:` drive to a time-stamped temporary folder

```bash
sudo -v

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)

mkdir -p "$HOME/.local/state/influenca/$TIMESTAMP/videos"

sudo mkdir -p /mnt/f
sudo mount -t drvfs F: /mnt/f

echo "☕ Synchronizing media from F:\\"

rsync -rtv --progress --include="*/" --include="*.AVI" --include="*.avi" --exclude="*" /mnt/f/DCIMA/ "$HOME/.local/state/influenca/$TIMESTAMP/videos/"

rm -rf /mnt/f/AUDIO /mnt/f/DCIMA
echo "2026-01-01 00:00:00 N" > /mnt/f/TIME.TXT
sudo umount /mnt/f

ls "$HOME/.local/state/influenca/$TIMESTAMP/videos/"

echo "✅ node $HOME/repos/influenca/packages/cli/dist/bin.mjs accession $HOME/.local/state/influenca/$TIMESTAMP/videos/"

```

## Development

- Install dependencies:

```bash
pnpm install
```

- Run the unit tests:

```bash
pnpm run test
```

- Build the library:

```bash
pnpm run build
```

## Speech-to-Text Transcription

Transcription is implemented in the current pipeline, but it only runs when the input has an audio stream and `OPENAI_API_KEY` is set. The workflow uses `fluent-ffmpeg` for media handling and OpenAI's Whisper API for transcription.

### Workflow

```mermaid
flowchart TD
    A["Input video"]
    B["Normalize"]
    C["Probe"]
    D{"Can transcribe?"}
    E["Extract audio"]
    F["Transcribe"]
    G["Skip transcription"]
    H["Write manifest"]

    A --> B
    B -->|"ffmpeg"| C
    C -->|"ffprobe"| D
    D -->|Yes| E
    D -->|No| G
    E -->|"ffmpeg"| F
    F -->|"Whisper API"| H
    G --> H
```

### Tools In Use

- `ffmpeg` via `fluent-ffmpeg` for transcoding and audio extraction
- `ffprobe` via `fluent-ffmpeg` for duration, frame count, and stream detection
- OpenAI Whisper API for transcription
- `fs` and `path` for local file and manifest handling

The manifest is written to `tmp/processed_videos/<timestamp>/.influenca.json` after each run.
