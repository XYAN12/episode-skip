import type { PageState } from "./messages";

export type PopupViewModel = {
  buttonsDisabled: boolean;
  canApplyPlaylist: boolean;
  title: string;
  currentTime: string;
  duration: string;
  activeRuleSource: string;
  introValue: string;
  outroValue: string;
};

export function buildPopupViewModel(state: PageState | null): PopupViewModel {
  if (!state || !state.isWatchPage) {
    return {
      buttonsDisabled: true,
      canApplyPlaylist: false,
      title: "Open a YouTube video page first",
      currentTime: "--:--",
      duration: "--:--",
      activeRuleSource: "none",
      introValue: "Not set",
      outroValue: "Not set"
    };
  }

  return {
    buttonsDisabled: false,
    canApplyPlaylist: Boolean(state.videoRule),
    title: state.title ?? "Untitled video",
    currentTime: formatClock(state.currentTime),
    duration: formatClock(state.duration),
    activeRuleSource: state.activeRuleSource,
    introValue:
      typeof state.activeRule?.introEndSeconds === "number"
        ? formatClock(state.activeRule.introEndSeconds)
        : "Not set",
    outroValue:
      typeof state.activeRule?.outroRemainingSeconds === "number"
        ? formatClock(state.activeRule.outroRemainingSeconds)
        : "Not set"
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
