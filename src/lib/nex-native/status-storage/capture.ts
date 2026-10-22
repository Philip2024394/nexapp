// src/lib/nex-native/status-storage/capture.ts
//
// NEX Status · device media capture helpers.
//
// Scope (strict):
//   · Browser-only. Server-side execution of these helpers is a
//     programming error · they will throw STORAGE_UNAVAILABLE-shaped
//     errors immediately when document / navigator is missing.
//   · Camera capture uses the `<input type="file" capture="...">`
//     pattern for iOS/Android compatibility (the picker UX varies).
//     The MediaRecorder path for recorded video uses `getUserMedia`
//     for a real in-app camera experience when the browser supports
//     it; both patterns return a Blob directly consumable by
//     `saveStatus()`.
//   · Each helper is one-shot · callers mount, invoke, dispose.
//
// Non-scope:
//   · No permissions UX. The browser handles the permission prompt.
//   · No face/pose detection. No background removal. No filters.
//   · No upload. No chunked streaming. No long-running capture that
//     exceeds `maxDurationMs`.

export type CaptureErrorCode =
  | "ENVIRONMENT_UNAVAILABLE"
  | "USER_CANCELLED"
  | "PERMISSION_DENIED"
  | "RECORDING_FAILED"
  | "UNSUPPORTED";

export class StatusCaptureError extends Error {
  public readonly code: CaptureErrorCode;
  public readonly cause?: unknown;

  constructor(code: CaptureErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "StatusCaptureError";
    this.code = code;
    this.cause = cause;
  }
}

function assertBrowser(): void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    throw new StatusCaptureError(
      "ENVIRONMENT_UNAVAILABLE",
      "capture helpers require a browser environment",
    );
  }
}

// ---------------------------------------------------------------------------
// Internal · hidden file-input helper
// ---------------------------------------------------------------------------

function pickWithInput(opts: {
  accept: string;
  capture?: "environment" | "user";
  cancellable: boolean;
}): Promise<Blob | null> {
  assertBrowser();
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = opts.accept;
    if (opts.capture) {
      // iOS Safari respects a plain string here, not boolean.
      input.setAttribute("capture", opts.capture);
    }
    input.style.position = "fixed";
    input.style.top = "-9999px";
    input.style.left = "-9999px";
    input.style.opacity = "0";

    let settled = false;

    const cleanup = () => {
      try {
        input.remove();
      } catch {
        /* ignore */
      }
      window.removeEventListener("focus", onFocus);
    };

    const onChange = () => {
      if (settled) return;
      settled = true;
      const file = input.files && input.files[0];
      cleanup();
      if (!file) {
        if (opts.cancellable) {
          resolve(null);
        } else {
          reject(
            new StatusCaptureError("USER_CANCELLED", "no file was selected"),
          );
        }
        return;
      }
      resolve(file);
    };

    // Fallback cancellation detection: if the user dismisses the file
    // picker, no `change` event fires. We watch for window focus
    // returning without a file after a short delay.
    const onFocus = () => {
      setTimeout(() => {
        if (settled) return;
        if (!input.files || input.files.length === 0) {
          settled = true;
          cleanup();
          if (opts.cancellable) {
            resolve(null);
          } else {
            reject(
              new StatusCaptureError(
                "USER_CANCELLED",
                "capture dialog was dismissed",
              ),
            );
          }
        }
      }, 300);
    };

    input.addEventListener("change", onChange);
    window.addEventListener("focus", onFocus);
    document.body.appendChild(input);
    input.click();
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Capture an image via the device rear camera (where available).
 *
 * On desktop this falls back to a plain file picker scoped to images.
 */
export async function captureImageFromCamera(): Promise<Blob> {
  const result = await pickWithInput({
    accept: "image/*",
    capture: "environment",
    cancellable: false,
  });
  // Non-cancellable rejects on cancel · so a null here is unexpected.
  if (!result) {
    throw new StatusCaptureError(
      "USER_CANCELLED",
      "camera capture returned no file",
    );
  }
  return result;
}

/**
 * Record a video using the device camera + microphone.
 *
 * Uses MediaRecorder + getUserMedia · stops automatically after
 * `maxDurationMs` elapses. Returns a webm Blob. On platforms where
 * MediaRecorder is unsupported, throws `UNSUPPORTED` so callers can
 * fall back to `pickFromPhotoRoll({ accept: "video/*" })`.
 */
export function captureVideoFromCamera(opts: {
  maxDurationMs: number;
}): Promise<Blob> {
  assertBrowser();
  if (typeof MediaRecorder === "undefined") {
    return Promise.reject(
      new StatusCaptureError(
        "UNSUPPORTED",
        "MediaRecorder is not supported in this browser",
      ),
    );
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return Promise.reject(
      new StatusCaptureError(
        "UNSUPPORTED",
        "getUserMedia is not supported in this browser",
      ),
    );
  }
  const maxDurationMs = Math.max(1, Math.floor(opts.maxDurationMs));

  return new Promise<Blob>(async (resolve, reject) => {
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let stopTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanupStream = () => {
      if (stream) {
        for (const track of stream.getTracks()) {
          try {
            track.stop();
          } catch {
            /* ignore */
          }
        }
        stream = null;
      }
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    } catch (err) {
      cleanupStream();
      reject(
        new StatusCaptureError(
          "PERMISSION_DENIED",
          "camera/microphone access was denied",
          err,
        ),
      );
      return;
    }

    const chunks: BlobPart[] = [];

    try {
      recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    } catch (err) {
      cleanupStream();
      reject(
        new StatusCaptureError(
          "UNSUPPORTED",
          "MediaRecorder could not be constructed with video/webm",
          err,
        ),
      );
      return;
    }

    recorder.addEventListener("dataavailable", (ev: BlobEvent) => {
      if (ev.data && ev.data.size > 0) {
        chunks.push(ev.data);
      }
    });

    recorder.addEventListener("error", (ev: Event) => {
      if (stopTimer) clearTimeout(stopTimer);
      cleanupStream();
      reject(
        new StatusCaptureError(
          "RECORDING_FAILED",
          "MediaRecorder error",
          ev,
        ),
      );
    });

    recorder.addEventListener("stop", () => {
      if (stopTimer) clearTimeout(stopTimer);
      cleanupStream();
      const blob = new Blob(chunks, { type: "video/webm" });
      resolve(blob);
    });

    recorder.start();
    stopTimer = setTimeout(() => {
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch (err) {
          cleanupStream();
          reject(
            new StatusCaptureError(
              "RECORDING_FAILED",
              "MediaRecorder.stop threw",
              err,
            ),
          );
        }
      }
    }, maxDurationMs);
  });
}

/**
 * Pick a media file from the device's photo roll · no camera.
 *
 * Returns null when the user cancels.
 */
export async function pickFromPhotoRoll(opts: {
  accept: "image/*" | "video/*" | "image/*,video/*";
}): Promise<Blob | null> {
  return pickWithInput({
    accept: opts.accept,
    cancellable: true,
  });
}
