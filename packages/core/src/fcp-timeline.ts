import XMLBuilder from "fast-xml-builder";

import type { ManifestEntry } from "./manifest";

export const FCPXML_FILE_NAME = ".fcp.xml";

export type FcpxmlDocument = {
  fcpxml: {
    ":@": { version: string };
    library?: Record<string, unknown>;
    resources: {
      asset?: Array<{ ":@": AssetAttributes }>;
      // Multiple formats/assets are specified as arrays of objects containing the ":@" group
      format?: Array<{ ":@": FormatAttributes }>;
    };
  };
};

type AssetAttributes = {
  duration: string;
  format?: string;
  hasAudio: "0" | "1";
  hasVideo: "0" | "1";
  id: string;
  name: string;
  src: string;
  start: string;
};

type FormatAttributes = {
  frameDuration?: string;
  height?: string;
  id: string;
  name?: string;
  width?: string;
};

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

function seconds(s: number): string {
  return `${s}s`;
}

function zeroOrOne(v: boolean): "0" | "1" {
  return v ? "1" : "0";
}
