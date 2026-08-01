export class ArrayStepper<T> {
  #things: Array<T>;
  #where = -1;
  constructor(a: Array<T>, autoselect = -1) {
    this.#things = a;
    this.#where = autoselect;
  }
  public can(steps: number) {
    const nw = this.#where + steps;

    const b = nw < 0;
    const a = nw > this.#things.length;
    const ok = !a && !b;

    return ok;
  }
  public go(steps: number): T | undefined {
    if (!this.can(steps)) {
      return undefined;
    }
    this.#where = this.#where + steps;
    return this.#things.at(this.#where);
  }
  public select(w: T | undefined): void {
    this.#where = w ? this.#things.indexOf(w) : -1;
  }
}
