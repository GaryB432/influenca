import readline from "readline";
import * as crypto from "crypto";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runDynamicBars() {
  console.clear();
  console.log(
    "\x1b[31m[CRITICAL] INITIALIZING OVERWHELMING INJECTIONS...\x1b[0m\n",
  );

  // Define 6 independent, stacked tasks
  const tasks = Array.from({ length: 6 }, (_, i) => ({
    lineOffset: i, // Which row the task owns in the stack
    id: crypto.randomUUID().slice(0, 8).toUpperCase(), // Short punchy ID
    uuid: crypto.randomUUID(),
    progress: 0,
    // Totally random step size and speeds so they finish completely staggered
    speed: Math.floor(Math.random() * 50) + 20,
    step: Math.random() * 2 + 0.5,
    size: (Math.random() * 8 + 2).toFixed(1),
    status: "DOWNLOADING",
  }));

  // Allocate empty vertical space on screen first so the lines don't clip
  for (let i = 0; i < tasks.length; i++) console.log("");

  let active = true;
  while (active) {
    active = false;

    for (const task of tasks) {
      if (task.progress < 100) {
        active = true;

        // Stagger the progression over time
        task.progress = Math.min(
          100,
          task.progress + Math.random() * task.step,
        );

        // Scramble the visible UUID on-the-fly until it finishes
        if (task.progress < 100) {
          task.uuid = crypto.randomUUID();
        } else {
          task.status = "COMPLETED";
        }
      }

      // 1. Move cursor back up to the top of our progress stack
      // 2. Move down to this specific task's row line layout
      readline.cursorTo(process.stdout, 0);
      readline.moveCursor(process.stdout, 0, -(tasks.length - task.lineOffset));

      // Build the distinct visual layout bar
      const filledLength = Math.floor(task.progress / 5);
      const bar = "█".repeat(filledLength).padEnd(20, "░");

      const color = task.status === "COMPLETED" ? "\x1b[32m" : "\x1b[33m";
      const statusLabel =
        task.status === "COMPLETED" ? "[SUCCESS]" : "[SYNCING]";

      // Print the entirely distinct row with its unique tracking metrics
      process.stdout.write(
        `${color}${statusLabel}\x1b[0m Job #${task.id} [${bar}] ${task.progress.toFixed(1)}% | ${task.size}GB | UUID: ${task.uuid}\x1b[K\n`,
      );

      // Move cursor back down to the very bottom of the stack to stay clean
      readline.moveCursor(
        process.stdout,
        0,
        tasks.length - task.lineOffset - 1,
      );
    }

    // High refresh rate pacing loop
    await sleep(35);
  }

  console.log("\n\x1b[32m✔ ALL PAYLOADS EXECUTED SUCCESSFULLY.\x1b[0m\n");
}

runDynamicBars();
