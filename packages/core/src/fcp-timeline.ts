import XMLBuilder from "fast-xml-builder";

import type { ManifestEntry } from "./manifest";

export const FCPXML_FILE_NAME = ".fcp.xml";

type AssetAttributes = {
  id: string;
  name: string;
  src: string;
  start: string;
  duration: string;
  hasAudio: "0" | "1";
  hasVideo: "0" | "1";
  format?: string;
};

type FormatAttributes = {
  id: string;
  name?: string;
  frameDuration?: string;
  width?: string;
  height?: string;
};

export type FcpxmlDocument = {
  fcpxml: {
    ":@": { version: string };
    resources: {
      // Multiple formats/assets are specified as arrays of objects containing the ":@" group
      format?: Array<{ ":@": FormatAttributes }>;
      asset?: Array<{ ":@": AssetAttributes }>;
    };
    library?: Record<string, unknown>;
  };
};

function seconds(s: number): string {
  return `${s}s`;
}

function zeroOrOne(v: boolean): "0" | "1" {
  return v ? "1" : "0";
}

/**
 *
 * see `fast-xml-parser` one fine day for your consideration
 */
export class FcpTimeline {
  private readonly dictionary = new Set<{
    dest: string;
    entry: ManifestEntry;
    stem: string;
    target: string;
  }>();

  public async add(
    entry: ManifestEntry,
    stem: string,
    target: string,
    dest: string,
  ): Promise<void> {
    return new Promise((resolve) =>
      setTimeout(() => {
        this.dictionary.add({ dest, entry, stem, target });
        resolve();
      }, 1),
    );
  }

  public emit_specimen_during_development(greetee: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.8">
  <resources>
    <format id="f1" name="FFMPEG_EXPORT_STREAM" frameDuration="100/2400s" />
    <!-- Dynamic asset entries loop here ${greetee} -->
    <asset id="r1" name="Example Clip Title" src="file://localhost/absolute/path/to/media.mp4" start="0s" duration="120s" hasVideo="1" hasAudio="1" />
  </resources>
  <library>
    <event name="Influenca Curated Ingest">
      <!-- Timelines loop here -->
      <project name="Example Clip Title_Timeline">
        <sequence format="f1" duration="120s">
          <spine>
            <asset-clip name="Example Clip Title" ref="r1" offset="0s" duration="120s">
              <!-- Sequential metadata and transcript markers layer here -->
              <marker start="15s" duration="4s" value="Transcribed speech line goes here" color="green" />
              <marker start="45s" duration="10s" value="Silent Stretch" color="blue" />
            </asset-clip>
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;
  }

  public end(): void {
    console.warn("thank you for closing");
  }

  public xml(): string {
    const assets = [...this.dictionary.values()].map<AssetAttributes>((v) => {
      const mediaAsset = {
        id: v.entry.id,
        name: v.entry.title ?? v.stem,
        src: `file://${v.dest}`,
        start: seconds(0),
        duration: seconds(v.entry.kind === "video" ? v.entry.durationSec : 0),
        hasAudio: zeroOrOne(
          (v.entry.kind === "video" && v.entry.hasAudio) ?? false,
        ),
        hasVideo: zeroOrOne(v.entry.kind === "video"),
      };
      return mediaAsset;
    });

    const fcpxmlData: FcpxmlDocument = {
      fcpxml: {
        ":@": { version: "1.10" },
        resources: {
          asset: assets.map((assetAttrs) => ({
            ":@": assetAttrs,
          })),
        },
      },
    };

    return new XMLBuilder({
      attributesGroupName: ":@",
      format: true,
      ignoreAttributes: false,
      suppressEmptyNode: true,
    }).build(fcpxmlData);
  }
}
