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

rsync -rtv --progress \
  --include="*/" --include="*.AVI" --include="*.avi" --exclude="*" \
  /mnt/f/DCIMA/ \
  "$HOME/.local/state/influenca/$TIMESTAMP/videos/"

cat "$HOME/.local/state/influenca/$TIMESTAMP/videos/"

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
