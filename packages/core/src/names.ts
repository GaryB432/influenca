import { join } from "path/posix";

export const meaning: { life: number } = {
  life: 42,
};

export function buildManifestFilePath(output: string) {
  return join(output, ".influenca.json");
}
