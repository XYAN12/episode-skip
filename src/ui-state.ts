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
  videoTitle: string;
  currentTime: string;
  introValue: string;
  outroValue: string;
  canApplyPlaylist: boolean;
};

export function buildPanelViewModel(state: PageState): PanelViewModel {
  return {
    videoTitle: state.title ?? "Untitled video",
    currentTime: formatClock(state.currentTime),
    introValue:
      typeof state.activeRule?.introEndSeconds === "number" ? formatClock(state.activeRule.introEndSeconds) : "Not set",
    outroValue:
      typeof state.activeRule?.outroRemainingSeconds === "number"
        ? formatClock(state.activeRule.outroRemainingSeconds)
        : "Not set",
    canApplyPlaylist: Boolean(state.playlistId && state.videoRule)
  };
}

export function formatIntroSavedMessage(seconds: number): string {
  return seconds >= 0 ? "Intro saved." : "Intro saved.";
}

export function formatOutroSavedMessage(remainingSeconds: number): string {
  return remainingSeconds >= 0 ? "Outro saved." : "Outro saved.";
}

export function formatPlaylistSavedMessage(_playlistId: string): string {
  return "Playlist rules saved.";
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
