import type { RuleSource, SkipRule } from "./rules";

export type PageState = {
  isWatchPage: boolean;
  title: string | null;
  currentTime: number | null;
  duration: number | null;
  videoId: string | null;
  playlistId: string | null;
  playlistIndex: string | null;
  activeRuleSource: RuleSource;
  activeRule: SkipRule | null;
  videoRule: SkipRule | null;
};

export type PanelViewModel = {
  title: string;
  videoId: string;
  playlistId: string;
  currentTime: string;
  duration: string;
  activeRuleSource: string;
  introValue: string;
  outroValue: string;
  playlistNote: string;
  canApplyPlaylist: boolean;
};

export function buildPanelViewModel(state: PageState): PanelViewModel {
  return {
    title: state.title ?? "Untitled video",
    videoId: state.videoId ?? "Unavailable",
    playlistId: state.playlistId ?? "Not in playlist",
    currentTime: formatClock(state.currentTime),
    duration: formatClock(state.duration),
    activeRuleSource: state.activeRuleSource,
    introValue:
      typeof state.activeRule?.introEndSeconds === "number" ? formatClock(state.activeRule.introEndSeconds) : "Not set",
    outroValue:
      typeof state.activeRule?.outroRemainingSeconds === "number"
        ? formatClock(state.activeRule.outroRemainingSeconds)
        : "Not set",
    playlistNote: state.playlistId
      ? `Detected playlist ${state.playlistId}`
      : "This video is not currently opened from a playlist.",
    canApplyPlaylist: Boolean(state.playlistId && state.videoRule)
  };
}

export function formatIntroSavedMessage(seconds: number): string {
  return `Intro end saved at ${formatClock(seconds)}`;
}

export function formatOutroSavedMessage(remainingSeconds: number): string {
  return `Outro start saved; will skip when ${formatClock(remainingSeconds)} remains`;
}

export function formatPlaylistSavedMessage(playlistId: string): string {
  return `Playlist rule saved for ${playlistId}`;
}

export function shouldShowPlaylistPrompt(
  state: PageState,
  actionType: "SET_INTRO_END" | "SET_OUTRO_START",
  ok: boolean
): boolean {
  return Boolean(ok && state.isWatchPage && state.playlistId && state.videoRule && (actionType === "SET_INTRO_END" || actionType === "SET_OUTRO_START"));
}

export function formatClock(seconds: number | null | undefined): string {
  if (!Number.isFinite(seconds) || seconds === null || seconds === undefined || seconds < 0) {
    return "--:--";
  }

  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(secs)}`;
  }

  return `${pad(minutes)}:${pad(secs)}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
