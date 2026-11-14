import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";

function LockedExamAudio({
  src,
  onEnded,
  onSkip,
  advancing,
  paused = false,
  ready = true,
}) {
  const { t } = useLanguage();
  const audioRef = useRef(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    setAutoplayBlocked(false);
    setMediaFailed(false);
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
        .catch((error) => {
          if (audio.error) setMediaFailed(true);
          else if (error.name !== "AbortError") setAutoplayBlocked(true);
        });
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
      setMediaFailed(false);
    } catch {
      if (audioRef.current?.error) setMediaFailed(true);
      else setAutoplayBlocked(true);
    }
  };

  const needsRecovery = (autoplayBlocked || mediaFailed) && !paused && ready && !advancing;

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onError={() => setMediaFailed(true)}
        onEnded={onEnded}
        onContextMenu={(event) => event.preventDefault()}
      />

      {needsRecovery && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <div className="flex-1" role="status">
            <p className="font-bold">{t(mediaFailed ? "listeningAudioLoadFailed" : "examAudioAutoplayBlocked")}</p>
            {mediaFailed && <p className="mt-1">{t("listeningAudioRecovery")}</p>}
          </div>
          <button
            type="button"
            onClick={startAfterBrowserBlock}
            className="rounded-xl bg-sky-700 px-4 py-2.5 font-bold text-white hover:bg-sky-800"
          >
            {t(mediaFailed ? "retryListeningAudio" : "startAudio")}
          </button>
          {mediaFailed && (
            <button
              type="button"
              onClick={onSkip}
              className="rounded-xl border border-sky-300 px-4 py-2.5 font-bold"
            >
              {t("skipUnavailableListeningUnit")}
            </button>
          )}
        </div>
      )}
    </>
  );
}

export default LockedExamAudio;
