import { useRef, useState, useCallback } from "react";

/**
 * useCanvasRecorder — wraps MediaRecorder around a canvas element.
 *
 * Usage:
 *   const rec = useCanvasRecorder();
 *   rec.start(canvasEl, { fps: 60, bitsPerSecond: 20_000_000 });
 *   rec.stop(); // triggers download of a .webm file
 *
 * Returns:
 *   isRecording    – boolean
 *   elapsedMs      – ms since recording started (updates ~5x/sec)
 *   start(canvas, opts) – begin capture. opts: { fps, bitsPerSecond, filename }
 *   stop()         – finalize and download
 */
export function useCanvasRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startTimeRef = useRef(0);
  const tickIdRef = useRef(null);
  const filenameRef = useRef("pagerank.webm");

  const pickMimeType = () => {
    const candidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
        return c;
      }
    }
    return "video/webm";
  };

  const start = useCallback((canvas, opts = {}) => {
    if (!canvas) {
      console.warn("useCanvasRecorder: no canvas provided");
      return;
    }
    if (recorderRef.current) {
      console.warn("useCanvasRecorder: already recording");
      return;
    }

    const fps = opts.fps ?? 60;
    const bitsPerSecond = opts.bitsPerSecond ?? 20_000_000; // 20 Mbps — presentation quality
    filenameRef.current = opts.filename ?? `pagerank-${Date.now()}.webm`;

    const stream = canvas.captureStream(fps);
    const mimeType = pickMimeType();

    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitsPerSecond });
    } catch (err) {
      console.error("MediaRecorder failed to initialize:", err);
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameRef.current;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Let the browser hold the URL briefly in case it's needed, then revoke.
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      chunksRef.current = [];
      recorderRef.current = null;
      setIsRecording(false);
      setElapsedMs(0);
      if (tickIdRef.current) {
        clearInterval(tickIdRef.current);
        tickIdRef.current = null;
      }
    };

    recorder.start(1000); // flush a chunk every second → resilient to tab freeze
    recorderRef.current = recorder;
    startTimeRef.current = performance.now();
    setIsRecording(true);
    setElapsedMs(0);

    tickIdRef.current = setInterval(() => {
      setElapsedMs(performance.now() - startTimeRef.current);
    }, 200);
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  return { isRecording, elapsedMs, start, stop };
}
