import type { RuleScope, RuleSource, SkipRule } from "./rules";

export type PageState = {
  isWatchPage: boolean;
  title: string | null;
  currentTime: number | null;
  duration: number | null;
  videoId: string | null;
  playlistId: string | null;
  playlistIndex: string | null;
  channelId: string | null;
  activeRuleSource: RuleSource;
  activeRule: SkipRule | null;
  videoRule: SkipRule | null;
  playlistRule: SkipRule | null;
  channelRule: SkipRule | null;
};

export type PanelFeedbackTone = "success" | "error" | "info";

export type PanelView =
  | { kind: "main" }
  | { kind: "playlist-confirm"; reason: "intro-saved" | "outro-saved" }
  | { kind: "clear-confirm" }
  | { kind: "feedback"; message: string; tone: PanelFeedbackTone };

export type RuleClearTarget =
  | {
      scope: RuleScope;
      key: string;
    }
  | null;

export type PanelViewModel = {
  videoTitle: string;
  introValue: string;
  outroValue: string;
  introIsSet: boolean;
  outroIsSet: boolean;
  canApplyPlaylist: boolean;
};

export function buildPanelViewModel(state: PageState): PanelViewModel {
  const displayRule: Partial<SkipRule> = {
    ...state.channelRule,
    ...state.playlistRule,
    ...state.videoRule
  };
  const introIsSet = typeof displayRule.introEndSeconds === "number";
  const outroIsSet = typeof displayRule.outroRemainingSeconds === "number";

  return {
    videoTitle: state.title ?? "Untitled video",
    introValue: introIsSet ? formatClock(displayRule.introEndSeconds) : "Not set",
    outroValue: outroIsSet ? formatClock(displayRule.outroRemainingSeconds) : "Not set",
    introIsSet,
    outroIsSet,
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

export function getPanelViewAfterRuleSave(
  state: PageState,
  actionType: "SET_INTRO_END" | "SET_OUTRO_START",
  feedbackMessage: string
): PanelView {
  if (state.isWatchPage && state.playlistId && state.videoRule) {
    return {
      kind: "playlist-confirm",
      reason: actionType === "SET_INTRO_END" ? "intro-saved" : "outro-saved"
    };
  }

  return {
    kind: "feedback",
    message: feedbackMessage,
    tone: "success"
  };
}

export function getFeedbackView(message: string, tone: PanelFeedbackTone): PanelView {
  return {
    kind: "feedback",
    message,
    tone
  };
}

export function getPanelViewAfterPlaylistDismiss(): PanelView {
  return { kind: "main" };
}

export function getPanelViewAfterPlaylistApply(message: string): PanelView {
  return {
    kind: "feedback",
    message,
    tone: "success"
  };
}

export function getPanelViewBeforeClear(state: PageState): PanelView {
  if (doesPlaylistContributeToDisplay(state)) {
    return { kind: "clear-confirm" };
  }

  return { kind: "main" };
}

export function getRuleClearTarget(state: PageState): RuleClearTarget {
  if (state.activeRuleSource === "video" && state.videoId) {
    return {
      scope: "video",
      key: state.videoId
    };
  }

  if (state.activeRuleSource === "playlist" && state.playlistId) {
    return {
      scope: "playlist",
      key: state.playlistId
    };
  }

  if (state.activeRuleSource === "channel" && state.channelId) {
    return {
      scope: "channel",
      key: state.channelId
    };
  }

  return null;
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

function doesPlaylistContributeToDisplay(state: PageState): boolean {
  if (!state.playlistId || !state.playlistRule) {
    return false;
  }

  if (state.activeRuleSource === "playlist") {
    return true;
  }

  if (state.activeRuleSource !== "video" || !state.videoRule) {
    return false;
  }

  const playlistAddsIntro =
    typeof state.playlistRule.introEndSeconds === "number" && typeof state.videoRule.introEndSeconds !== "number";
  const playlistAddsOutro =
    typeof state.playlistRule.outroRemainingSeconds === "number" &&
    typeof state.videoRule.outroRemainingSeconds !== "number";

  return playlistAddsIntro || playlistAddsOutro;
}
