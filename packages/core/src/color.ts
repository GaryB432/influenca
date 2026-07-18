export function add(a: number, b: number): number {
  return a + b;
}

export function greet(name: string): string {
  return `color says: hello to ${name}`;
}

export const meaning: { life: number } = {
  life: 42,
};

export function ansiBold(): string {
  return "\u001b[1m";
}

export function ansiReset(): string {
  return "\u001b[0m";
}

export function color256(colorCode: number, value: string): string {
  return `\u001b[38;5;${colorCode}m${value}${ansiReset()}`;
}

export function supportsModernColors(): boolean {
  if (!process.stdout.isTTY) {
    return false;
  }

  if (process.env.NO_COLOR) {
    return false;
  }

  if (process.env.FORCE_COLOR === "0") {
    return false;
  }

  const term = process.env.TERM ?? "";
  const colorTerm = process.env.COLORTERM ?? "";
  return (
    /256color|truecolor|24bit/i.test(term) || /truecolor|24bit/i.test(colorTerm)
  );
}
