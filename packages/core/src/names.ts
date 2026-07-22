import { format, join } from "node:path";

export function buildManifestFilePath(directory: string) {
  return join(directory, ".influenca.json");
}

export function videoCaptionPath(slug: string): string {
  return format({
    dir: "cloud",
    ext: ".json",
    name: slug.concat(".track"),
    root: "/",
  });
}

export function videoSrcPath(slug: string): string {
  return format({
    dir: "cloud",
    ext: ".mp4",
    name: slug,
    root: "/",
  });
}
