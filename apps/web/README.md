# @influenca/web

SvelteKit web app for browsing generated cloud artifacts (videos and transcripts).

## Prerequisites

Install workspace dependencies from the repository root:

```bash
pnpm install
```

## Development

From repository root:

```bash
pnpm --filter @influenca/web run dev
```

Or from this directory:

```bash
pnpm run dev
```

## Build

From repository root:

```bash
pnpm --filter @influenca/web run build
```

Or from this directory:

```bash
pnpm run build
```

Note: this project uses `@sveltejs/adapter-node` and emits a Node-compatible server build.

## Preview

From this directory:

```bash
pnpm run preview
```

## Quality Checks

- Type and Svelte checks:

```bash
pnpm run check
```

- Unit tests:

```bash
pnpm run test
```

From repository root, you can run all workspace checks with:

```bash
pnpm run check
```

## Boundaries

```mermaid
---
title: Influenca · system boundaries
config:
  look: classic
  theme: base
  themeVariables:
    fontFamily: "Inter, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: 14px
    lineColor: "#8a96a3"
    primaryTextColor: "#2b3540"
    titleColor: "#0b6a96"
---
flowchart TB
    subgraph DEV["Source devices"]
        PIXEL@{ shape: bow-rect, label: "Pixel phone" }
        IPAD@{ shape: bow-rect, label: "iPad Pro" }
    end

    subgraph INTAKE["Intake"]
        PS@{ shape: fr-rect, label: "intake.ps1<br/>PowerShell" }
        STAGE@{ shape: docs, label: "Staging folder" }
    end

    subgraph APP["Influenca"]
        INF@{ shape: rounded, label: "<b>Influenca</b>" }
        MAN@{ shape: lin-cyl, label: ".influenca.json<br/><small>titles · probed stats · VTT pointers</small>" }
        subgraph OUTS["Outputs"]
            MP4@{ shape: docs, label: "MP4 files" }
            VTT@{ shape: lin-doc, label: "VTT captions" }
            XML@{ shape: tag-doc, label: "FCPXML" }
        end
    end

    subgraph TOOLS["External tools"]
        FF@{ shape: st-rect, label: "ffmpeg & friends" }
    end

    subgraph EDIT["Editor"]
        DR@{ shape: curv-trap, label: "DaVinci Resolve" }
    end

    PIXEL -- "USB / MTP?" --> PS
    IPAD -- "USB / ?" --> PS
    PS --> STAGE
    STAGE --> INF
    INF <-- "invokes / results" --> FF
    INF <-- "reads / writes" --> MAN
    INF -- "transcode" --> MP4
    INF -. "captions (planned)" .-> VTT
    MAN -. "points to" .-> VTT
    INF -. "export (planned)" .-> XML
    XML -. "references" .-> MP4
    XML -. "import" .-> DR

    %% boundaries: neutral, except Influenca
    style DEV    fill:#f6f8fa,stroke:#c7ced6,stroke-width:1px,color:#5b6672
    style INTAKE fill:#f6f8fa,stroke:#c7ced6,stroke-width:1px,color:#5b6672
    style TOOLS  fill:#f6f8fa,stroke:#c7ced6,stroke-width:1px,color:#5b6672
    style EDIT   fill:#f6f8fa,stroke:#c7ced6,stroke-width:1px,color:#5b6672
    style APP    fill:#eaf6fc,stroke:#1ca0de,stroke-width:2px,color:#0b6a96
    style OUTS   fill:#ffffff,stroke:#9fd4ef,stroke-width:1px,color:#0b6a96

    %% nodes
    classDef neutral fill:#ffffff,stroke:#aab4be,color:#2b3540
    classDef hero    fill:#1ca0dedf,stroke:#0b6a96,stroke-width:2px,color:#ffffff,font-weight:bold
    classDef brand   fill:#ffffff,stroke:#1ca0de,stroke-width:1.5px,color:#0f3d52
    classDef planned fill:#ffffff,stroke:#1ca0de,stroke-dasharray:5 4,color:#5b8ba3

    class PIXEL,IPAD,PS,STAGE,FF,DR neutral
    class INF hero
    class MAN,MP4 brand
    class VTT,XML planned
```
