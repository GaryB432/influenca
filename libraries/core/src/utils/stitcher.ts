import type { Manifest } from "..";

type Cadnf = Record<string, string[]>;

export function add(...addends: number[]) {
  return addends.reduce((a, b) => (a += b));
}

export async function findem(mnsft: Manifest): Promise<Cadnf> {
  const r: Cadnf = {};
  for (const og of Object.values(mnsft)) {
    // const jj: string[] = [];
    // const dfdfds = new Set<string>();

    for (const mf of Object.keys(og.video)) {
      console.log(mf);
    }
    console.log(og.video);
  }
  return r;
}

export function greet(greetee: string): string {
  return `stitcher says hello to ${greetee}`;
}
