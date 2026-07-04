# influenca

Say it like `influenza` but with a a `c`

```shell
npm install influenca
influenca ~/my-media --exif
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

## Continuous Preview Releases (pkg.pr.new)

This repository is set up for [pkg.pr.new](https://pkg.pr.new/) continuous releases.
Each push and pull request publishes an installable preview package URL.

### One-time GitHub setup

1. Install the GitHub app: https://github.com/apps/pkg-pr-new
2. Make sure the app is installed on this repository.

### Workflow example in this repo

The preview workflow is in `.github/workflows/preview.yml` and uses lockfile-based execution:

```yaml
- name: Publish Preview
	id: publish
	run: pnpm exec pkg-pr-new publish --commentWithSha --bin
```

### Smoke test example using publish outputs

The same workflow also demonstrates a follow-up job that installs the published URL and runs the binary:

```yaml
- name: Install preview package URL
	run: pnpm add ${{ needs.publish.outputs.urls }}

- name: Run preview binary
	run: pnpm exec influenca ./media --list
```

This gives a practical end-to-end check that the preview package can be installed and executed.
