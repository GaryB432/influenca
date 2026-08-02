class SelectorState {
  public get selected(): string | undefined {
    return this._selected;
  }
  public set selected(v: string | undefined) {
    this._selected = v;
  }
  private _selected: string | undefined = $state(undefined);
}

export const slugSelect = new SelectorState();
