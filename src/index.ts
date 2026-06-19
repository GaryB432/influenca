import readline from "readline";
import crypto from "crypto";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runSciFiSimulation() {
  console.clear();
  console.log(
    "\x1b[36m⚡ [INITIALIZING DEEP-SPACE NEURAL LINK SYSTEM] ⚡\x1b[0m",
  );
  console.log(
    "\x1b[35m========================================================\x1b[0m\n",
  );

  const nodes = Array.from({ length: 6 }, (_, i) => ({
    lineOffset: i,
    id: `NODE-${100 + i * 14}`,
    uuid: crypto.randomUUID(),
    progress: 0,
    speed: Math.floor(Math.random() * 40) + 15,
    step: Math.random() * 1.8 + 0.3,
    size: (Math.random() * 140 + 20).toFixed(1), // TB arrays
    status: "SYNCING",
  }));

  // Allocate empty vertical rows
  for (let i = 0; i < nodes.length; i++) console.log("");

  let active = true;
  while (active) {
    active = false;

    for (const node of nodes) {
      if (node.progress < 100) {
        active = true;
        node.progress = Math.min(
          100,
          node.progress + Math.random() * node.step,
        );

        if (node.progress < 100) {
          node.uuid = crypto.randomUUID();
        } else {
          node.status = "STABLE";
        }
      }

      // Jump cursor to the specific row
      readline.cursorTo(process.stdout, 0);
      readline.moveCursor(process.stdout, 0, -(nodes.length - node.lineOffset));

      // Visual progress bar using cyberpunk blocks
      const filledLength = Math.floor(node.progress / 5);
      const bar = "■".repeat(filledLength).padEnd(20, "·");

      // Styling rules
      const color = node.status === "STABLE" ? "\x1b[35m" : "\x1b[36m"; // Purple if stable, Cyan if syncing
      const statusLabel = node.status === "STABLE" ? "[ONLINE]" : "[SYNCING]";

      // Output line
      process.stdout.write(
        `${color}${statusLabel}\x1b[0m ${node.id} ──⪧ ${color}[${bar}]\x1b[0m ${node.progress.toFixed(1)}% | ${node.size} TB | HASH: ${node.uuid.slice(0, 18).toUpperCase()}...\x1b[K\n`,
      );

      // Return cursor to bottom row
      readline.moveCursor(
        process.stdout,
        0,
        nodes.length - node.lineOffset - 1,
      );
    }

    await sleep(30);
  }

  // Final Diagnostics Graph & Readout Table
  console.log(
    "\n\x1b[35m========================================================\x1b[0m",
  );
  console.log("\x1b[36m📊 CORE TELEMETRY CONFIGURATION DIAGNOSTICS:\x1b[0m\n");

  console.log(" ╭────────────────────────┬─────────────┬──────────────╮");
  console.log(" │ COGNITIVE DATA ARRAY   │ VECTOR STAT │ QUANTUM SYNC │");
  console.log(" ├────────────────────────┼─────────────┼──────────────┤");

  let totalData = 0;
  for (const node of nodes) {
    totalData += parseFloat(node.size);
    console.log(
      ` │ ${node.id} CORE ARRAY    │   \x1b[32mREADY\x1b[0m     │    100.0%    │`,
    );
  }

  console.log(" ╰────────────────────────┴─────────────┴──────────────╯");
  console.log(
    `\n\x1b[32m✔ SUCCESS: ${totalData.toFixed(1)} TB OF SATELLITE TELEMETRY SINKED TO LOCAL CORES.\x1b[0m\n`,
  );
}

runSciFiSimulation();
