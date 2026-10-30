"use client";

// src/lib/nex-native/music/live-audio-mixer.ts
//
// Owner-authorised 2026-10-29 · DRAFT §11 audio graph.
//
// WebAudio mixer that combines the broadcaster's microphone with a
// locally-decoded <audio> element and emits a single mixed
// MediaStream. The broadcaster's existing WebRTC sender is swapped
// to this mixed stream via `RTCRtpSender.replaceTrack` so viewers
// hear mic + music without a renegotiation.
//
// Honest limitations:
//   · Only works for uploaded_audio (local <audio> element with a
//     same-origin signed URL). Spotify / YouTube cross-origin
//     iframes do not expose a MediaElementAudioSourceNode and are
//     explicitly NOT mixed · see §11.6.
//   · Autoplay rules · AudioContext MUST be created inside a user
//     gesture (overlay "Open" tap). Caller is responsible for the
//     gesture precondition.
//   · The music element is OWNED by the mixer during its lifetime ·
//     the caller sets `src` via `attachMusicElement` and the mixer
//     routes it through the music GainNode.

type AudioContextLike = AudioContext & {
  readonly state: AudioContextState;
};

export interface LiveAudioMixerHandle {
  readonly outputStream: MediaStream;
  readonly outputTrack: MediaStreamTrack;
  attachMusicElement(audio: HTMLAudioElement): void;
  setMusicGain(value: number): void;
  setMicMuted(muted: boolean): void;
  destroy(): void;
  /** Owner-authorised 2026-10-29 (Live analyser exposure) · returns
   *  the mixer's AnalyserNode that sits DOWNSTREAM of musicGain as a
   *  leaf tap. Reading `getByteFrequencyData` from it reflects the
   *  music the viewer actually hears (gain-adjusted) without creating
   *  any additional MediaElementSource or audible path. Null before
   *  `attachMusicElement` is called. */
  getMusicAnalyser(): AnalyserNode | null;
}

export interface CreateLiveAudioMixerArgs {
  readonly micStream: MediaStream;
  /** Initial music gain · 0..1. Default 0.8 so mic stays dominant. */
  readonly initialMusicGain?: number;
}

/**
 * Build the sealed §11.1 audio graph. Does NOT create the
 * AudioContext at module-load time · must be called from a
 * user-gesture handler.
 */
export function createLiveAudioMixer(
  args: CreateLiveAudioMixerArgs,
): LiveAudioMixerHandle {
  const AudioCtor =
    typeof window !== "undefined"
      ? (window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext)
      : undefined;
  if (!AudioCtor) {
    throw new Error("live-audio-mixer: Web Audio not available in this environment");
  }
  const ctx = new AudioCtor() as AudioContextLike;

  // Mic source · route through its own gain so we never duck the mic.
  const micSource = ctx.createMediaStreamSource(args.micStream);
  const micGain = ctx.createGain();
  micGain.gain.value = 1;

  // Music source placeholder · wired on attachMusicElement.
  const musicGain = ctx.createGain();
  musicGain.gain.value = clampGain(args.initialMusicGain ?? 0.8);

  // Owner-authorised 2026-10-29 (Live analyser exposure) · leaf
  // AnalyserNode that sits DOWNSTREAM of musicGain so reads reflect
  // the gain-adjusted signal viewers hear. Created at init so the
  // handle method can return it before `attachMusicElement` is
  // called (it will have no input signal until then, which is
  // exactly correct · getByteFrequencyData returns all zeros).
  //
  // The node has NO onward connection · nothing feeds from the
  // analyser into any destination. It is strictly a read-only tap
  // and cannot double audio, alter volume, or affect any output.
  const musicAnalyser = ctx.createAnalyser();
  musicAnalyser.fftSize = 64;
  musicAnalyser.smoothingTimeConstant = 0.78;
  let analyserConnected = false;

  // Destination · the mixed MediaStream we hand back to WebRTC.
  const dest = ctx.createMediaStreamDestination();

  // Wire mic → micGain → dest.
  micSource.connect(micGain);
  micGain.connect(dest);

  // Mic always flows to speakers too? NO · listening to your own
  // mic in-stream causes feedback. The destination is for WebRTC
  // only · nothing is connected to ctx.destination for the mic.

  // Music → musicGain → dest. The MediaElementSource arrives in
  // attachMusicElement because we cannot build it until the caller
  // provides the <audio> element.
  let musicSource: MediaElementAudioSourceNode | null = null;
  let attachedAudio: HTMLAudioElement | null = null;

  const attachMusicElement = (audio: HTMLAudioElement): void => {
    if (attachedAudio === audio && musicSource) return;
    // Reconnect: tear down previous.
    if (musicSource) {
      try {
        musicSource.disconnect();
      } catch {
        // ignore
      }
    }
    attachedAudio = audio;
    musicSource = ctx.createMediaElementSource(audio);
    musicSource.connect(musicGain);
    musicGain.connect(dest);
    // IMPORTANT · route to speakers too so the broadcaster hears
    // their own music. Mic does NOT go to speakers (feedback) · music does.
    musicGain.connect(ctx.destination);
    // One-time analyser tap · downstream leaf of musicGain. Guarded
    // so reattaching a different <audio> element does not double-
    // connect the analyser. The analyser does NOT connect onward.
    if (!analyserConnected) {
      musicGain.connect(musicAnalyser);
      analyserConnected = true;
    }
  };

  const setMusicGain = (value: number): void => {
    musicGain.gain.value = clampGain(value);
  };

  const setMicMuted = (muted: boolean): void => {
    micGain.gain.value = muted ? 0 : 1;
  };

  const destroy = (): void => {
    try {
      if (musicSource) musicSource.disconnect();
    } catch {
      // ignore
    }
    try {
      micSource.disconnect();
    } catch {
      // ignore
    }
    try {
      micGain.disconnect();
    } catch {
      // ignore
    }
    try {
      musicGain.disconnect();
    } catch {
      // ignore
    }
    try {
      musicAnalyser.disconnect();
    } catch {
      // ignore
    }
    try {
      void ctx.close();
    } catch {
      // ignore
    }
  };

  const getMusicAnalyser = (): AnalyserNode | null =>
    analyserConnected ? musicAnalyser : null;

  const outputStream = dest.stream;
  const outputTrack = outputStream.getAudioTracks()[0];
  if (!outputTrack) {
    destroy();
    throw new Error("live-audio-mixer: destination stream has no audio track");
  }

  return {
    outputStream,
    outputTrack,
    attachMusicElement,
    setMusicGain,
    setMicMuted,
    destroy,
    getMusicAnalyser,
  };
}

function clampGain(v: number): number {
  if (!Number.isFinite(v)) return 0.8;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
