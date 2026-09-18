import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

function LockedExamAudio({ src, onEnded, advancing, paused = false, ready = true }) {
  const { t } = useLanguage();
  const audioRef = useRef(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    setAutoplayBlocked(false);
    setPlaying(false);
    return () => {
      audio.pause();
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || audio.ended) return;

    if (paused || !ready) {
      audio.pause();
      return;
    }

    const playPromise = audio.play();
    if (playPromise) {
      playPromise
        .then(() => setAutoplayBlocked(false))
        .catch(() => setAutoplayBlocked(true));
    }
  }, [paused, ready, src]);

  const startAfterBrowserBlock = async () => {
    try {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.error) {
        audio.load();
      }
      await audio.play();
      setAutoplayBlocked(false);
      setPlaying(true);
    } catch {
      setAutoplayBlocked(true);
    }
  };

  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3.5">
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          setAutoplayBlocked(true);
        }}
        onEnded={() => {
          setPlaying(false);
          onEnded();
        }}
        onContextMenu={(event) => event.preventDefault()}
      />

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
            <span className={`${playing ? "animate-pulse" : ""}`}>♫</span>
          </span>
          <div>
            <p className="text-sm font-bold text-sky-900">
              {advancing
                ? t("audioSavingAdvance")
                : paused
                  ? t("audioPaused")
                  : !ready
                    ? t("waitingForImage")
                    : playing
                      ? t("audioPlaying")
                      : t("audioPreparing")}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-sky-700">
              {paused
                ? t("audioResumeNote")
                : !ready
                  ? t("audioStartsAfterImage")
                  : t("audioOnceNote")}
            </p>
          </div>
        </div>

        {autoplayBlocked && !paused && ready && (
          <button
            type="button"
            onClick={startAfterBrowserBlock}
            className="shrink-0 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-700"
          >
            {t("startAudio")}
          </button>
        )}
      </div>
    </div>
  );
}

export default LockedExamAudio;
