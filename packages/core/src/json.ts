import { readFile } from "node:fs/promises";

/** Typed JSON loader. This is a cast, not validation. */
export async function readJSON<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}
