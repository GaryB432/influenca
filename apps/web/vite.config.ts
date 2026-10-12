import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

// A port of our own, not Vite's 5173, which every other Vite project on this machine
// also reaches for. strictPort makes a taken port an error: drifting to the next one
// would quietly change the address the page is at.
const PORT = 4000;

export default defineConfig({
  plugins: [sveltekit({ adapter: adapter() })],
  preview: { port: PORT, strictPort: true },
  server: { port: PORT, strictPort: true },
});
