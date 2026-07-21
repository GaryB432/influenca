import { join } from "path/posix";

export function buildManifestFilePath(output: string) {
  return join(output, ".influenca.json");
}
