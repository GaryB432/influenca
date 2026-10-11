import { stripVTControlCharacters, styleText } from "node:util";

import type { OnProgress } from "./ffmpeg.js";

import { accent, dim } from "./theme.js";

export type RowState = "done" | "failed" | "skipped" | "waiting" | "working";

/** What a finished job leaves on its row: the text, or the text with a state other than done. */
type Outcome = string | { state: RowState; tail: string };

type Row = {
  cells: string[];
  fraction: number;
  state: RowState;
  tail: string;
  weight: number;
};

const METER_SIZE = 24;
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const TICK_MS = 80;

const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";
// Terminals that know this hold the screen until the frame is whole; the rest ignore it.
const FRAME_START = "\x1b[?2026h";
const FRAME_END = "\x1b[?2026l";

/** 75 -> 1:15 */
export function clock(sec: number): string {
  const whole = Math.max(0, Math.round(sec));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Cuts a line that would wrap, since a wrapped line throws the cursor arithmetic off. */
export function fit(line: string, columns: number): string {
  const plain = stripVTControlCharacters(line);
  return plain.length < columns
    ? line
    : `${plain.slice(0, Math.max(0, columns - 2))}…`;
}

/** A bar that moves in half steps, so it creeps rather than jumps. */
export function meter(fraction: number, size = METER_SIZE): string {
  const steps = Math.round(Math.min(1, Math.max(0, fraction)) * size * 2);
  const full = Math.floor(steps / 2);
  const half = steps % 2;
  return (
    accent("━".repeat(full) + (half ? "╸" : "")) +
    dim("━".repeat(size - full - half))
  );
}

/** Pure: one line of the table. The first cell is a number, so it lines up on the right. */
export function renderRow(
  row: Row,
  widths: number[],
  frame = 0,
  glyphs = true,
): string {
  const cells = row.cells
    .map((cell, i) =>
      i === 0 ? cell.padStart(widths[i] ?? 0) : cell.padEnd(widths[i] ?? 0),
    )
    .join("  ");
  const tail =
    row.state === "working"
      ? `${meter(row.fraction)} ${String(Math.floor(row.fraction * 100)).padStart(3)}%`
      : row.tail;
  const text = `${cells}  ${tail}`.trimEnd();
  const body =
    row.state === "waiting" || row.state === "skipped" ? dim(text) : text;
  return `${glyphs ? glyph(row.state, frame) : ""}  ${body}`;
}

/**
 * A table with a row for each file, known before the work starts. In a terminal the rows
 * fill in where they stand: the one being worked on shows a meter, and a line underneath
 * shows the whole job. Anywhere else each row is written once, when it is finished.
 */
export function startTable(
  specs: { cells: string[]; weight?: number }[],
  out: NodeJS.WriteStream = process.stdout,
) {
  const rows: Row[] = specs.map(({ cells, weight = 1 }) => ({
    cells,
    fraction: 0,
    state: "waiting",
    tail: "",
    weight,
  }));
  const widths = (rows[0]?.cells ?? []).map((_, i) =>
    Math.max(...rows.map((r) => r.cells[i]?.length ?? 0)),
  );
  const live = out.isTTY === true;
  // The cursor cannot climb back to a line that has scrolled away, so a table taller than
  // the screen writes finished rows for good and keeps only the working ones live.
  const tall = !live || rows.length + 2 > (out.rows ?? 24);
  const startedAt = Date.now();
  let committed = 0;
  let painted = 0;
  let frame = 0;
  let stopped = false;

  const line = (row: Row) => {
    const text = renderRow(row, widths, frame, live);
    return live ? fit(text, out.columns ?? 80) : text;
  };
  const shown = () =>
    rows.slice(committed).filter((r) => !tall || r.state !== "waiting");
  const erase = () => {
    if (painted) out.write(`\x1b[${painted}A\r\x1b[J`);
    painted = 0;
  };

  function footer(): string {
    const total = rows.reduce((sum, r) => sum + r.weight, 0);
    const reached = rows.reduce(
      (sum, r) =>
        sum +
        r.weight *
          (r.state === "working" ? r.fraction : r.state === "waiting" ? 0 : 1),
      0,
    );
    const whole = total === 0 ? 1 : reached / total;
    const elapsed = (Date.now() - startedAt) / 1000;
    const finished = rows.filter(
      (r) => r.state !== "waiting" && r.state !== "working",
    ).length;
    // Too early and the guess swings wildly.
    const left =
      elapsed > 3 && whole > 0.05 && whole < 1
        ? `  about ${clock((elapsed * (1 - whole)) / whole)} left`
        : "";
    return fit(
      `   ${meter(whole)} ${String(Math.floor(whole * 100)).padStart(3)}%  ${dim(`${finished} of ${rows.length}  ${clock(elapsed)}${left}`)}`,
      out.columns ?? 80,
    );
  }

  function paint(): void {
    if (!live || stopped) return;
    const lines = [...shown().map(line), footer()];
    out.write(
      `${FRAME_START}${painted ? `\x1b[${painted}A` : ""}\r\x1b[J${lines.join("\n")}\n${FRAME_END}`,
    );
    painted = lines.length;
  }

  /** Writes for good each finished row that has nothing unfinished above it. */
  function commit(): void {
    if (!tall) return;
    const finished: string[] = [];
    while (
      committed < rows.length &&
      rows[committed]?.state !== "waiting" &&
      rows[committed]?.state !== "working"
    ) {
      finished.push(line(rows[committed++] as Row));
    }
    if (finished.length === 0) return;
    erase();
    for (const text of finished) out.write(`${text}\n`);
  }

  const update = () => {
    commit();
    paint();
  };

  const restore = () => out.write(SHOW_CURSOR);
  // Node does not run exit handlers when a signal ends it, so Ctrl+C is turned into an exit.
  const interrupt = () => process.exit(130);
  const timer = live
    ? setInterval(() => {
        frame++;
        paint();
      }, TICK_MS)
    : undefined;
  timer?.unref();
  if (live) {
    out.write(HIDE_CURSOR);
    process.once("exit", restore);
    process.once("SIGINT", interrupt);
    paint();
  }

  function set(i: number, tail = "", state: RowState = "done"): void {
    const row = rows[i];
    if (!row) return;
    Object.assign(row, { fraction: 1, state, tail });
    update();
  }

  /** Takes the meters away and leaves the rows, whatever state they reached. Safe to call twice. */
  function end(): void {
    if (stopped) return;
    clearInterval(timer);
    erase();
    for (const row of shown()) out.write(`${line(row)}\n`);
    stopped = true;
    if (live) {
      restore();
      process.off("exit", restore);
      process.off("SIGINT", interrupt);
    }
  }

  return {
    end,
    /** Runs one row's job, handing it a reporter for its own 0..1, then shows what came of it. */
    async run<T>(
      i: number,
      work: (report: OnProgress) => Promise<T>,
      outcome: (value: T) => Outcome,
    ): Promise<T> {
      const row = rows[i];
      if (row) row.state = "working";
      update();
      try {
        const value = await work((fraction) => {
          if (row) row.fraction = Math.min(1, Math.max(0, fraction));
        });
        const result = outcome(value);
        if (typeof result === "string") set(i, result);
        else set(i, result.tail, result.state);
        return value;
      } catch (error) {
        set(i, "failed", "failed");
        end();
        throw error;
      }
    },
    set,
  };
}

function glyph(state: RowState, frame: number): string {
  switch (state) {
    case "done":
      return styleText("green", "✓");
    case "failed":
      return styleText("red", "✗");
    case "skipped":
      return dim("–");
    case "waiting":
      return dim("·");
    case "working":
      return accent(SPINNER[frame % SPINNER.length] ?? "");
  }
}
