export function add(...addends: number[]) {
	return addends.reduce((a, b) => (a += b));
}

export function greet(greetee: string): string {
	return `stitcher says hello to ${greetee}`;
}
