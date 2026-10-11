# @influenca/cli

The `influenca` command. It takes a folder of media off a camera or phone, keeps
it in a lasting form with a record of what was kept, then transcribes and
measures it.

The [influenca repository](https://github.com/GaryB432/influenca#readme) has
the full guide, including how a run folder is laid out.

## Needs

- Node 20.12 or newer
- `ffmpeg` with `ffprobe` on your `PATH`

## Install

```sh
npm install --global @influenca/cli
```

## Settings

Each setting is taken from the first place that has it: the environment, then
`.env` in the folder you run from, then `~/.config/influenca/.env` (under
`$XDG_CONFIG_HOME` if that is set).

| Variable              | For                                                             |
| --------------------- | --------------------------------------------------------------- |
| `INFLUENCA_MEDIA_DIR` | Where runs are kept. Not needed if you always pass `--out-dir`. |
| `OPENAI_API_KEY`      | Transcribing what is said. Without it the files are still kept. |

## Use

```sh
influenca accession /path/to/intake   # keep the supported files as a new run
influenca transcribe                  # finish transcribing the newest run
influenca analyze                     # measure the newest run and print what it holds
```

- `accession` keeps `avi`, `mov`, `mp4`, `wav` and `jpg` files. The intake folder
  is never changed. `--dry-run` shows the plan and writes nothing, and
  `--no-transcribe` sends nothing to OpenAI.
- `transcribe` and `analyze` take a run folder, or use the newest run under
  `INFLUENCA_MEDIA_DIR`. Each skips what is already done unless you pass `--redo`.
