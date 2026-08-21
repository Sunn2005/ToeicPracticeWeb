import { useEffect, useRef, useState } from "react";

function LockedExamAudio({ src, onEnded, advancing }) {
  const audioRef = useRef(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const playPromise = audio.play();
    if (playPromise) {
      playPromise
        .then(() => setPlaying(true))
        .catch(() => setAutoplayBlocked(true));
    }

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [src]);

  const startAfterBrowserBlock = async () => {
    try {
      await audioRef.current?.play();
      setAutoplayBlocked(false);
      setPlaying(true);
    } catch {
      setAutoplayBlocked(true);
    }
  };

  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
      <audio
        ref={audioRef}
        src={src}
        autoPlay
        preload="auto"
        onPlay={() => setPlaying(true)}
        onEnded={() => {
          setPlaying(false);
          onEnded();
        }}
        onContextMenu={(event) => event.preventDefault()}
      />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-200">
            <span className={`text-xl ${playing ? "animate-pulse" : ""}`}>♫</span>
          </span>
          <div>
            <p className="font-bold text-sky-900">
              {advancing ? "Saving and advancing..." : playing ? "Audio is playing" : "Preparing audio"}
            </p>
            <p className="mt-1 text-xs leading-5 text-sky-700">
              Test mode: audio plays once and cannot be paused, skipped, or replayed.
            </p>
          </div>
        </div>

        {autoplayBlocked && (
          <button
            type="button"
            onClick={startAfterBrowserBlock}
            className="shrink-0 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-700"
          >
            Start audio
          </button>
        )}
      </div>
    </div>
  );
}

export default LockedExamAudio;
