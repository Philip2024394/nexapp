// src/lib/nex-native/billing/video-duration-probe.ts
//
// Server-side video duration probe · owner-authorised 2026-11-07.
// -----------------------------------------------------------------------------
// The sealed cover-video route previously trusted the client's HTML5
// video-metadata probe for the 30-second cap. Owner directive 2026-11-07:
// server-side video duration validation · do not trust client-side checks.
//
// Uses the already-installed `ffprobe-static` + `fluent-ffmpeg` packages
// (see package.json). No new dependency, no system install. The probe
// writes the uploaded bytes to a temp file (ffprobe needs a file path,
// not a stream, for reliable duration detection across containers +
// codecs) and runs the bundled ffprobe binary.
//
// Honest limitations:
//   · Probing cost: ~50-200ms per video on typical server hardware.
//     Accepted trade-off for correctness. Owner-authorised.
//   · Temp file is written to os.tmpdir() and deleted after probe,
//     success or failure. If the process is killed mid-probe the
//     temp file is leaked · the OS clears tmpdir on reboot.
//   · Returns -1 on probe failure. Callers that must hard-deny on
//     failure should treat -1 as "duration unknown · reject".

import "server-only";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { videoProbeEnabled } from "@/lib/nex-native/runtime-flags";

interface FfprobeMetadata {
  format?: { duration?: number | string };
}

/** Probe duration of the uploaded video bytes using the bundled ffprobe.
 *  Returns the duration in seconds, or -1 if the probe fails.
 *
 *  The probe writes bytes to a temp file (fluent-ffmpeg requires a
 *  path, not a Buffer, for container detection reliability). The temp
 *  dir and file are removed in a `finally` block. */
export async function probeVideoDurationSeconds(
  bytes: Uint8Array,
  extension: string,
): Promise<number> {
  // Workers cut-over gate: when NEX_VIDEO_PROBE_ENABLED=false we return -1
  // without touching ffprobe-static / fluent-ffmpeg. Callers already treat
  // -1 as "duration unknown · reject" per the file's honest-limitations
  // doctrine. Default-unset keeps Vercel behavior exactly.
  if (!videoProbeEnabled()) return -1;
  const safeExt = /^[a-z0-9]{2,5}$/i.test(extension) ? extension : "mp4";
  let tempDir: string | null = null;
  try {
    tempDir = await mkdtemp(join(tmpdir(), "nex-video-probe-"));
    const tempFile = join(tempDir, `probe.${safeExt}`);
    await writeFile(tempFile, bytes);
    const [ffmpegModule, ffprobeModule] = await Promise.all([
      import("fluent-ffmpeg"),
      // ffprobe-static has no .d.ts shipped · inline-ignore + cast to the
      // known CJS shape { path: string }.
      // @ts-expect-error -- ffprobe-static is a plain-JS module without types
      import("ffprobe-static") as Promise<{ default: { path: string } }>,
    ]);
    const ffmpeg = (ffmpegModule as unknown as { default: typeof import("fluent-ffmpeg") }).default;
    const ffprobePath = (ffprobeModule as unknown as { default: { path: string } }).default.path;
    ffmpeg.setFfprobePath(ffprobePath);

    const meta = await new Promise<FfprobeMetadata>((resolve, reject) => {
      ffmpeg.ffprobe(tempFile, (err: Error | null, data: unknown) => {
        if (err) return reject(err);
        resolve(data as FfprobeMetadata);
      });
    });
    const d = meta.format?.duration;
    const seconds = typeof d === "string" ? Number.parseFloat(d) : (d ?? NaN);
    if (!Number.isFinite(seconds) || seconds <= 0) return -1;
    return Math.round(seconds * 100) / 100;
  } catch {
    return -1;
  } finally {
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // swallow · temp cleanup is best-effort
      }
    }
  }
}
