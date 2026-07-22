import { format, join } from "node:path";

export function buildManifestFilePath(directory: string) {
  return join(directory, ".influenca.json");
}

export function videoCaptionPath(slug: string, dir = "cloud"): string {
  return format({
    dir,
    ext: ".json",
    name: slug.concat(".track"),
    root: "/",
  });
}

export function videoSrcPath(slug: string, dir = "cloud"): string {
  return format({
    dir,
    ext: ".mp4",
    name: slug,
    root: "/",
  });
}
