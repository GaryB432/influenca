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

echo "✅ node $HOME/repos/influenca/packages/cli/dist/bin.mjs ascession $HOME/.local/state/influenca/$TIMESTAMP/videos/ --output ./$TIMESTAMP/videos"

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

## Windows adapter

The Windows platform adapter lives at `/home/runner/work/influenca/influenca/apps/influenca-win`.

Run the initial milestone directly with the .NET SDK:

```bash
cd /home/runner/work/influenca/influenca/apps/influenca-win
dotnet run
```
