export interface SelectOptions<Value> {
  initialValue?: Value;
  maxItems?: number;
  message: string;
  options: Option<Value>[];
  showInstructions?: boolean;
}

export interface TextOptions {
  defaultValue?: string;
  initialValue?: string;
  message: string;
  placeholder?: string;
  // validate?: Validate<string>;
}

interface Option<Value> {
  disabled?: boolean;
  hint?: string;
  label?: string;
  value: Value;
}

export function add(...addends: number[]) {
  return addends.reduce((a, b) => (a += b));
}
//  const select: <Value>(opts: SelectOptions<Value>) => Promise<Value | symbol>;

export function greet(greetee: string): string {
  return `prompter says hello to ${greetee}`;
}

// export async function select<T>(
//   options: SelectOptions<T>,
// ): Promise<T | undefined | symbol> {
//   return dumper<string>(options);
// }

// export async function text(
//   options: TextOptions,
// ): Promise<string | undefined | symbol> {
//   return dumper(options);
// }

async function text(
  options: TextOptions,
): Promise<string | symbol | undefined> {
  console.log("faking");
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(options.initialValue);
    }, 1000);
  });
}
