import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RepeatMode, Track } from '../types';
import { clamp } from '../lib/format';

interface PlayerSettings {
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  rate: number;
}

interface UseAudioPlayerOptions {
  tracks: Track[];
  queue: string[];
  currentId: string | null;
  onCurrentIdChange: (id: string | null) => void;
  onError: (message: string) => void;
}

const SETTINGS_KEY = 'lumen.player.settings.v1';

function loadSettings(): PlayerSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlayerSettings>;
      return {
        volume: clamp(Number(parsed.volume) || 0.78, 0, 1),
        muted: Boolean(parsed.muted),
        shuffle: Boolean(parsed.shuffle),
        repeat: parsed.repeat === 'all' || parsed.repeat === 'one' ? parsed.repeat : 'off',
        rate: [0.75, 1, 1.25, 1.5, 2].includes(Number(parsed.rate)) ? Number(parsed.rate) : 1,
      };
    }
  } catch {
    // A corrupt preference should never keep the player from opening.
  }
  return { volume: 0.78, muted: false, shuffle: false, repeat: 'off', rate: 1 };
}

function shuffled<T>(values: T[]): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

export function useAudioPlayer({
  tracks,
  queue,
  currentId,
  onCurrentIdChange,
  onError,
}: UseAudioPlayerOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initialSettings = useRef(loadSettings());
  const [isPlaying, setIsPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolumeState] = useState(initialSettings.current.volume);
  const [muted, setMuted] = useState(initialSettings.current.muted);
  const [shuffle, setShuffle] = useState(initialSettings.current.shuffle);
  const [repeat, setRepeat] = useState<RepeatMode>(initialSettings.current.repeat);
  const [rate, setRateState] = useState(initialSettings.current.rate);

  const playIntentRef = useRef(false);
  const historyRef = useRef<string[]>([]);
  const shuffleBagRef = useRef<string[]>([]);
  const shuffleBagKeyRef = useRef('');
  const errorRef = useRef(onError);
  const tracksRef = useRef(tracks);
  const queueRef = useRef(queue);
  const currentIdRef = useRef(currentId);
  const shuffleRef = useRef(shuffle);
  const repeatRef = useRef(repeat);
  const stepRef = useRef<(direction: 1 | -1, automatic: boolean) => boolean>(() => false);
  const lastPositionUpdateRef = useRef(0);

  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    tracksRef.current = tracks;
    queueRef.current = queue;
    currentIdRef.current = currentId;
    shuffleRef.current = shuffle;
    repeatRef.current = repeat;
  }, [tracks, queue, currentId, shuffle, repeat]);

  const currentTrack = useMemo(
    () => tracks.find((track) => track.id === currentId) || null,
    [tracks, currentId],
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ volume, muted, shuffle, repeat, rate }),
      );
    } catch {
      // Preferences are optional.
    }
  }, [volume, muted, shuffle, repeat, rate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = clamp(volume, 0, 1);
    audio.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      setCurrentTime(0);
      setDuration(0);
      setBuffered(0);
      setIsPlaying(false);
      return;
    }

    const sourceChanged = audio.dataset.trackId !== currentTrack.id;
    if (sourceChanged) {
      audio.pause();
      audio.dataset.trackId = currentTrack.id;
      audio.src = currentTrack.streamUrl;
      audio.load();
      setCurrentTime(0);
      setDuration(currentTrack.duration || 0);
      setBuffered(0);
      setBuffering(true);
    }

    if (playIntentRef.current) {
      playIntentRef.current = false;
      void audio.play().catch((error: unknown) => {
        setBuffering(false);
        setIsPlaying(false);
        const message = error instanceof Error ? error.message : String(error);
        if (!/not allowed|user gesture/i.test(message)) {
          errorRef.current('音频无法播放，文件可能已移动或格式不受支持。');
        }
      });
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentTrack) return;
    if (!('mediaSession' in navigator)) return;

    let disposed = false;
    let artworkObjectUrl: string | null = null;

    const apply = (artwork?: string) => {
      if (disposed) return;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album,
          artwork: artwork
            ? [
                { src: artwork, sizes: '256x256' },
                { src: artwork, sizes: '512x512' },
              ]
            : [],
        });
      } catch {
        // Artwork formats vary; metadata itself is the part that matters.
      }
    };

    const loadArtwork = async () => {
      if (!currentTrack.coverUrl) {
        apply();
        return;
      }
      try {
        const response = await fetch(currentTrack.coverUrl);
        if (!response.ok) throw new Error('cover unavailable');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        if (disposed) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        artworkObjectUrl = objectUrl;
        apply(objectUrl);
      } catch {
        apply();
      }
    };

    void loadArtwork();

    return () => {
      disposed = true;
      if (artworkObjectUrl) URL.revokeObjectURL(artworkObjectUrl);
    };
  }, [currentTrack]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Not every Electron build exposes every action.
      }
    };

    setHandler('play', () => {
      const audio = audioRef.current;
      if (audio && audio.ended) audio.currentTime = 0;
      playIntentRef.current = true;
      void audio?.play();
    });
    setHandler('pause', () => audioRef.current?.pause());
    setHandler('previoustrack', () => {
      if (audioRef.current && audioRef.current.currentTime > 4) {
        audioRef.current.currentTime = 0;
      } else {
        stepRef.current(-1, false);
      }
    });
    setHandler('nexttrack', () => stepRef.current(1, false));
    setHandler('seekto', (details) => {
      if (details.seekTime !== undefined && audioRef.current) {
        audioRef.current.currentTime = details.seekTime;
      }
    });

    return () => {
      setHandler('play', null);
      setHandler('pause', null);
      setHandler('previoustrack', null);
      setHandler('nexttrack', null);
      setHandler('seekto', null);
    };
  }, []);

  const step = useCallback(
    (direction: 1 | -1, automatic: boolean) => {
      const ids = (queueRef.current.length
        ? queueRef.current
        : tracksRef.current.map((track) => track.id)
      ).filter((id, index, list) => list.indexOf(id) === index);

      if (!ids.length) return false;
      const activeId = currentIdRef.current;
      let nextId: string | undefined;

      if (shuffleRef.current && direction === 1) {
        if (historyRef.current.length > 24) historyRef.current.shift();
        historyRef.current.push(activeId || '');
        const key = ids.join('|');
        if (shuffleBagKeyRef.current !== key) {
          shuffleBagKeyRef.current = key;
          shuffleBagRef.current = [];
        }
        if (!shuffleBagRef.current.length) {
          shuffleBagRef.current = shuffled(ids.filter((id) => id !== activeId));
        }
        nextId = shuffleBagRef.current.pop();
        if (!nextId) {
          if (automatic && repeatRef.current === 'off') {
            setIsPlaying(false);
            return false;
          }
          shuffleBagRef.current = shuffled(ids.filter((id) => id !== activeId));
          nextId = shuffleBagRef.current.pop();
        }
      } else if (direction === -1 && shuffleRef.current && historyRef.current.length) {
        nextId = historyRef.current.pop();
      } else {
        const index = activeId ? ids.indexOf(activeId) : -1;
        let target = index + direction;
        if (index < 0) target = direction === 1 ? 0 : ids.length - 1;
        if (target >= ids.length) {
          if (automatic && repeatRef.current === 'off') {
            setIsPlaying(false);
            return false;
          }
          target = 0;
        }
        if (target < 0) target = ids.length - 1;
        nextId = ids[target];
      }

      if (!nextId) return false;
      if (nextId === activeId) {
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = 0;
          void audio.play();
        }
        return true;
      }

      playIntentRef.current = true;
      onCurrentIdChange(nextId);
      return true;
    },
    [onCurrentIdChange],
  );

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const restartIfEnded = useCallback((audio: HTMLAudioElement) => {
    if (
      audio.ended ||
      (Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime >= audio.duration - 0.15)
    ) {
      audio.currentTime = 0;
      setCurrentTime(0);
    }
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentIdRef.current) {
      const fallback = queueRef.current[0] || tracksRef.current[0]?.id;
      if (fallback) {
        playIntentRef.current = true;
        onCurrentIdChange(fallback);
      }
      return;
    }
    if (audio.paused) {
      restartIfEnded(audio);
      playIntentRef.current = true;
      void audio.play().catch(() => {
        errorRef.current('音频无法播放，请检查文件是否仍然存在。');
      });
    } else {
      audio.pause();
    }
  }, [onCurrentIdChange, restartIfEnded]);

  const selectTrack = useCallback(
    (id: string, autoplay = true) => {
      const audio = audioRef.current;
      if (id === currentIdRef.current) {
        if (audio) {
          if (audio.paused && autoplay) {
            restartIfEnded(audio);
            void audio.play();
          } else if (!autoplay) {
            audio.pause();
          }
        }
        return;
      }
      if (currentIdRef.current) {
        historyRef.current.push(currentIdRef.current);
        if (historyRef.current.length > 30) historyRef.current.shift();
      }
      playIntentRef.current = autoplay;
      onCurrentIdChange(id);
    },
    [onCurrentIdChange, restartIfEnded],
  );

  const next = useCallback(() => {
    step(1, false);
  }, [step]);

  const previous = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 4) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    step(-1, false);
  }, [step]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const limit = Number.isFinite(audio.duration) ? audio.duration : duration;
    const nextTime = clamp(time, 0, limit || 0);
    try {
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
    } catch {
      // Seeking before metadata is available is a no-op.
    }
  }, [duration]);

  const setVolume = useCallback((nextVolume: number) => {
    const value = clamp(nextVolume, 0, 1);
    setVolumeState(value);
    if (value > 0) setMuted(false);
  }, []);

  const toggleMute = useCallback(() => setMuted((value) => !value), []);

  const toggleShuffle = useCallback(() => {
    setShuffle((value) => {
      if (!value) {
        shuffleBagKeyRef.current = '';
        shuffleBagRef.current = [];
      }
      return !value;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((value) => (value === 'off' ? 'all' : value === 'all' ? 'one' : 'off'));
  }, []);

  const setRate = useCallback((value: number) => {
    if ([0.75, 1, 1.25, 1.5, 2].includes(value)) setRateState(value);
  }, []);

  const handleEnded = useCallback(() => {
    const audio = audioRef.current;
    if (repeatRef.current === 'one' && audio) {
      audio.currentTime = 0;
      void audio.play();
      return;
    }
    step(1, true);
  }, [step]);

  const updateBuffered = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.buffered.length) return;
    const end = audio.buffered.end(audio.buffered.length - 1);
    const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
    if (total > 0) setBuffered(clamp(end / total, 0, 1));
  }, [duration]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    updateBuffered();

    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      const now = performance.now();
      if (now - lastPositionUpdateRef.current > 900 && Number.isFinite(audio.duration) && audio.duration > 0) {
        lastPositionUpdateRef.current = now;
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: clamp(audio.currentTime, 0, audio.duration),
          });
        } catch {
          // Position state is advisory.
        }
      }
    }
  }, [updateBuffered]);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (nextDuration > 0) setDuration(nextDuration);
    updateBuffered();
  }, [updateBuffered]);

  const handleError = useCallback(() => {
    setBuffering(false);
    setIsPlaying(false);
    errorRef.current('无法播放这首歌曲，文件可能已移动或编码不受支持。');
  }, []);

  const audioEvents = useMemo(
    () => ({
      onPlay: () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
      onEnded: handleEnded,
      onTimeUpdate: handleTimeUpdate,
      onLoadedMetadata: handleLoadedMetadata,
      onDurationChange: handleLoadedMetadata,
      onProgress: updateBuffered,
      onWaiting: () => setBuffering(true),
      onPlaying: () => setBuffering(false),
      onCanPlay: () => setBuffering(false),
      onError: handleError,
    }),
    [handleEnded, handleTimeUpdate, handleLoadedMetadata, updateBuffered, handleError],
  );

  useEffect(() => {
    if (!window.lumen?.setPlaybackState) return;
    window.lumen.setPlaybackState({
      playing: isPlaying,
      progress: duration > 0 ? currentTime / duration : 0,
      trackId: currentId,
    });
  }, [isPlaying, currentTime, duration, currentId]);

  return {
    audioRef,
    audioEvents,
    currentTrack,
    isPlaying,
    buffering,
    currentTime,
    duration,
    buffered,
    volume,
    muted,
    shuffle,
    repeat,
    rate,
    toggle,
    play: () => {
      playIntentRef.current = true;
      void audioRef.current?.play();
    },
    pause: () => audioRef.current?.pause(),
    selectTrack,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    setRate,
    step,
  };
}
