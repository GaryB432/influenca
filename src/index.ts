#!/usr/bin/env node

import { spinner } from "@clack/prompts";
import * as crypto from "node:crypto";

// Helper to generate a random UUID for that movie effect
const getUUID = () => crypto.randomUUID();

// Helper to pause execution briefly
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function runHollywoodHack() {
  console.clear();
  console.log("\x1b[31m[CRITICAL] INITIALIZING MALWARE DEPLOYMENT...\x1b[0m\n");

  // Create an array of 5 simultaneous Clack progress bars
  const tasks = Array.from({ length: 5 }, (_, i) => {
    const s = spinner();
    return {
      spinner: s,
      id: getUUID(),
      progress: 0,
      // Random speed so they don't finish at the same time
      speed: Math.floor(Math.random() * 40) + 10,
      size: (Math.random() * 4 + 1).toFixed(2), // 1GB to 5GB
    };
  });

  // Start all spin animations at once
  tasks.forEach((task) => {
    task.spinner.start(
      `[Injecting payload] ID: ${task.id} (0% of ${task.size} GB)`,
    );
  });

  // Keep updating until all progress loops finish
  while (tasks.some((t) => t.progress < 100)) {
    for (const task of tasks) {
      if (task.progress < 100) {
        // Increment progress randomly
        task.progress = Math.min(
          100,
          task.progress + Math.floor(Math.random() * 4) + 1,
        );

        // Rapidly roll the UUID string for extra Hollywood chaos
        const activeID = task.progress < 100 ? getUUID() : task.id;

        // Build a visual progress bar string
        const bars = "█".repeat(Math.floor(task.progress / 5)).padEnd(20, "░");

        // Update the Clack frame message
        task.spinner.message(
          `\x1b[32m[${bars}]\x1b[0m ${task.progress}% | TARGET_UUID: ${activeID} | SYNCING ${task.size} GB`,
        );

        if (task.progress === 100) {
          task.spinner.stop(
            `\x1b[31m[DEPLOYED]\x1b[0m PAYLOAD ${task.id} FULLY INJECTED (${task.size} GB)`,
          );
        }
      }
    }
    // High refresh rate to make the terminal look incredibly busy
    await sleep(40);
  }

  console.log(
    "\n\x1b[31m⚡ CORE EXPLOIT SUCCESSFUL. SYSTEM EXFILTRATION COMPLETE. ⚡\x1b[0m\n",
  );
}

runHollywoodHack();
