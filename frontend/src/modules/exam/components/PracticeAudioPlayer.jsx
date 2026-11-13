import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";

const waveformBarCount = 64;
const speeds = [0.75, 1, 1.25, 1.5, 2];
const controlClass = "min-h-11 rounded-lg px-3 focus-visible:outline-2 focus-visible:outline-sky-600 disabled:opacity-50";

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return [minutes, remainder].map((value) => String(value).padStart(2, "0")).join(":");
}

function getWaveform(audio) {
  const peaks = Array(waveformBarCount).fill(0);
  for (let channel = 0; channel < audio.numberOfChannels; channel += 1) {
    const samples = audio.getChannelData(channel);
    for (let bar = 0; bar < peaks.length; bar += 1) {
      const start = Math.floor(bar * samples.length / peaks.length);
      const end = Math.floor((bar + 1) * samples.length / peaks.length);
      let peak = peaks[bar];
      for (let index = start; index < end; index += 1) {
        peak = Math.max(peak, Math.abs(samples[index]));
      }
      peaks[bar] = peak;
    }
  }
  const maxPeak = Math.max(...peaks) || 1;
  return peaks.map((peak) => Math.max(6, peak / maxPeak * 100));
}

export default function PracticeAudioPlayer({ src, paused, shortcutsDisabled, onAnswerShortcut }) {
  const { t } = useLanguage();
  const audioRef = useRef(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [waveform, setWaveform] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadWaveform() {
      if (!window.OfflineAudioContext) return;

      try {
        const response = await fetch(src, { signal: controller.signal });
        if (!response.ok) return;

        const bytes = await response.arrayBuffer();
        if (controller.signal.aborted) return;

        const decoder = new OfflineAudioContext(1, 1, 22050);
        const audio = await decoder.decodeAudioData(bytes);
        if (!controller.signal.aborted) {
          setWaveform({ src, heights: getWaveform(audio) });
        }
      } catch {
        // The audio element can still play when the waveform request or decode fails.
      }
    }

    void loadWaveform();
    return () => controller.abort();
  }, [src]);

  const play = async () => {
    try {
      await audioRef.current.play();
    } catch (error) {
      if (error.name !== "AbortError") setFailed(true);
    }
  };

  const toggle = () => {
    if (audioRef.current.paused) void play();
    else audioRef.current.pause();
  };

  const seek = (seconds) => {
    const position = Math.min(duration, Math.max(0, seconds));
    audioRef.current.currentTime = position;
    setTime(position);
  };

  const replay = () => {
    seek(0);
    void play();
  };

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio.pause();
  }, []);

  useEffect(() => {
    if (paused) audioRef.current.pause();
  }, [paused]);

  const onKeyDown = useEffectEvent((event) => {
    if (paused || shortcutsDisabled || event.defaultPrevented || event.repeat || event.isComposing
      || event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target;
    const radio = target instanceof HTMLInputElement && target.type === "radio";
    if (target instanceof HTMLElement && (target.isContentEditable
      || (!radio && target.closest("input, textarea, select, [role='textbox']")))) return;

    if (/^[1-4]$/.test(event.key) && !event.shiftKey) {
      if (onAnswerShortcut(Number(event.key) - 1, radio ? target.name : null)) event.preventDefault();
      return;
    }
    if (!duration || failed) return;

    if (event.code === "Space" && !event.shiftKey
      && !target?.closest?.("button, a, input, [role='button']")) {
      event.preventDefault();
      toggle();
    } else if (event.key === "0" && !event.shiftKey) {
      event.preventDefault();
      replay();
    }
  });

  const rewindFromKeyboard = useEffectEvent(() => {
    if (!paused && !shortcutsDisabled && duration && !failed) {
      seek(audioRef.current.currentTime - 3);
    }
  });

  useEffect(() => {
    let shiftPressedAlone = false;
    const handleKeyDown = (event) => {
      if (event.key === "Shift" && event.repeat) return;
      shiftPressedAlone = event.key === "Shift" && !event.ctrlKey && !event.metaKey && !event.altKey
        && !event.target?.closest?.("input, textarea, select, [contenteditable]");
      onKeyDown(event);
    };
    const handleKeyUp = (event) => {
      if (event.key !== "Shift") return;
      if (shiftPressedAlone) rewindFromKeyboard();
      shiftPressedAlone = false;
    };
    const resetShift = () => { shiftPressedAlone = false; };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", resetShift);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", resetShift);
    };
  }, []);

  const progress = duration ? time / duration : 0;
  const barHeights = waveform?.src === src ? waveform.heights : null;
  const controlsDisabled = paused || !duration || failed;
  const shortcuts = [
    ["Space", "practiceAudioToggle"],
    ["Shift", "practiceAudioBack3"],
    ["0", "replayAudio"],
    ["1–4", "practiceAudioChooseAnswer"],
  ];

  return (
    <div>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onDurationChange={(event) => {
          const value = event.currentTarget.duration;
          setDuration(Number.isFinite(value) ? value : 0);
        }}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => { setPlaying(false); setFailed(true); }}
      />
      <div role="group" aria-label={t("practiceAudio")} className="rounded-2xl border border-sky-200 bg-sky-50 text-sky-900">
        <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
          <button type="button" onClick={toggle} disabled={controlsDisabled}
            aria-label={t(playing ? "practiceAudioPause" : "startAudio")}
            className={`${controlClass} w-11 shrink-0 rounded-full bg-sky-700 text-lg text-white hover:bg-sky-800`}>
            <span aria-hidden="true">{playing ? "Ⅱ" : "▷"}</span>
          </button>
          <div className="relative flex h-11 min-w-0 flex-1 items-center rounded focus-within:ring-2 focus-within:ring-sky-600">
            <div aria-hidden="true" className="flex h-9 w-full items-center gap-px sm:gap-0.5">
              {barHeights ? barHeights.map((height, index) => (
                <span key={index} style={{ height: `${height}%` }}
                  className={`min-w-0 flex-1 rounded-full ${index / barHeights.length < progress ? "bg-sky-600" : "bg-sky-300"}`} />
              )) : (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-sky-200">
                  <div className="h-full bg-sky-600" style={{ width: `${progress * 100}%` }} />
                </div>
              )}
            </div>
            <input type="range" min="0" max={duration || 1} step="0.01" value={Math.min(time, duration)}
              disabled={controlsDisabled} onChange={(event) => seek(Number(event.target.value))}
              aria-label={t("practiceAudioPosition")} aria-valuetext={formatTime(time)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums sm:text-sm">
            {formatTime(time)} / {formatTime(duration)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1 border-t border-sky-200 px-2 py-1 text-sm sm:gap-2">
          <button type="button" className={`${controlClass} hover:bg-sky-100`} disabled={controlsDisabled}
            onClick={() => seek(audioRef.current.currentTime - 3)} aria-label={t("practiceAudioBack3")}>
            <span aria-hidden="true">⟲ 3s</span>
          </button>
          <button type="button" className={`${controlClass} hover:bg-sky-100`} disabled={controlsDisabled}
            onClick={() => seek(audioRef.current.currentTime - 5)} aria-label={t("practiceAudioBack5")}>
            <span aria-hidden="true">⟲ 5s</span>
          </button>
          <button type="button" className={`${controlClass} hover:bg-sky-100`} disabled={controlsDisabled} onClick={replay}>
            <span aria-hidden="true" className="mr-1.5">⟲</span>{t("replayAudio")}
          </button>
          <select defaultValue={1} aria-label={t("practiceAudioSpeed")} className={`${controlClass} ml-auto bg-sky-50 hover:bg-sky-100`}
            onChange={(event) => { audioRef.current.playbackRate = Number(event.target.value); }}>
            {speeds.map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
          </select>
        </div>
      </div>
      {failed && (
        <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-sm text-red-700">
          <span>{t("listeningAudioLoadFailed")}</span>
          <button type="button" disabled={paused} className="min-h-11 rounded-lg border border-red-200 px-3 font-semibold"
            onClick={() => {
              audioRef.current.load();
              setFailed(false);
              void play();
            }}>
            {t("retryListeningAudio")}
          </button>
        </div>
      )}
      <ul className="mt-2 hidden flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600 sm:flex">
        {shortcuts.map(([key, label]) => (
          <li key={key}><kbd className="mr-1 rounded bg-sky-100 px-1.5 py-0.5 text-sky-900">{key}</kbd>{t(label)}</li>
        ))}
      </ul>
    </div>
  );
}
