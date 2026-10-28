"""Extract one middle-frame PNG per video for watch identification · Phase W-6."""
import cv2
import os
import sys

IDS = [
    "7690132468275498253",
    "7691193978569395470",
    "7691568982611987725",
    "7693088304782134542",
    "7696085218729544973",
    "7673852249835097357",
]

OUT_DIR = "/tmp/frames"
os.makedirs(OUT_DIR, exist_ok=True)

for i, vid in enumerate(IDS, start=10):
    src = f"public/dev/live-videos/snaptik_{vid}_v3.mp4"
    cap = cv2.VideoCapture(src)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    duration = frame_count / fps if fps > 0 else 0
    # grab 3 frames: 25%, 50%, 75% into the clip
    for pct, label in [(0.25, "a"), (0.50, "b"), (0.75, "c")]:
        target = int(frame_count * pct)
        cap.set(cv2.CAP_PROP_POS_FRAMES, target)
        ok, frame = cap.read()
        if ok:
            out = f"{OUT_DIR}/hendra-{i:02d}-{label}.png"
            cv2.imwrite(out, frame)
            print(f"  wrote {out} (video {vid} at frame {target}/{frame_count}, {duration:.1f}s)")
        else:
            print(f"  FAIL frame at {pct} of {vid}", file=sys.stderr)
    cap.release()
print("done")
