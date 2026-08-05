import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

const svgStringOrPath = path.resolve(
  import.meta.dirname,
  "../../..",
  "assets/no-video.svg",
);

export async function generateMissingVideo(
  wavAudioPath: string,
  outputMp4Path: string,
): Promise<void> {
  // 1. Setup a temporary PNG path since FFmpeg needs rasterized pixels for video encoding
  const tempPngPath = path.resolve(
    path.dirname(outputMp4Path),
    `temp_frame_${Date.now()}.png`,
  );

  try {
    // 2. Rasterize the SVG to a high-res PNG frame (1920x1080 standard)
    const svgBuffer = svgStringOrPath.trim().startsWith("<svg")
      ? Buffer.from(svgStringOrPath)
      : fs.readFileSync(svgStringOrPath);

    await sharp(svgBuffer).resize(1920, 1080).png().toFile(tempPngPath);

    // 3. Build the MP4 using the looped PNG and your WAV file
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(tempPngPath)
        .inputOptions("-loop 1") // Loop the single PNG frame infinitely
        .input(wavAudioPath) // Feed the source of truth audio track
        .videoCodec("libx264") // Encode to standard H.264 video
        .outputOptions([
          "-tune stillimage", // Optimizes the encoder specifically for static images
          "-pix_fmt yuv420p", // Ensures compatibility with default players (QuickTime, web browsers)
          "-shortest", // Hard stop: cuts off the image loop when the WAV audio ends
          "-c:a aac", // Compress raw WAV audio into standard streaming AAC
          "-b:a 192k", // Maintains high-quality audio fidelity
        ])
        .output(outputMp4Path)
        .on("end", () => resolve())
        .on("error", reject)
        .run();
    });
  } finally {
    // 4. Clean up the temporary frame so it doesn't clutter your disk
    if (fs.existsSync(tempPngPath)) {
      fs.unlinkSync(tempPngPath);
    }
  }
}
