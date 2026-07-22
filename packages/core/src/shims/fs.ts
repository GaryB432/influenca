import type { PathOrFileDescriptor, WriteFileOptions } from "fs";
import * as fs from "fs";

export function writeFileSync(
  file: PathOrFileDescriptor,
  data: string | NodeJS.ArrayBufferView,
  options?: WriteFileOptions,
): void {
  return fs.writeFileSync(file, data, options);
}
export function writeJSONSync<T>(
  file: PathOrFileDescriptor,
  data: T,
  options?: WriteFileOptions & {
    stringify?: {
      replacer?: (number | string)[] | null;
      space?: string | number;
    };
  },
): void {
  const replacer = options?.stringify?.replacer;
  const space = options?.stringify?.space;
  return fs.writeFileSync(file, JSON.stringify(data, replacer, space), options);
}
