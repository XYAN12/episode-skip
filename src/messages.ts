import type { RuleContext, RuleSource, SkipRule } from "./rules";

export type PageState = {
  isWatchPage: boolean;
  title: string | null;
  currentTime: number | null;
  duration: number | null;
  context: RuleContext;
  activeRuleSource: RuleSource;
  activeRule: SkipRule | null;
  videoRule: SkipRule | null;
};

export type GetPageStateMessage = {
  type: "GET_PAGE_STATE";
};

export type SetIntroEndMessage = {
  type: "SET_INTRO_END";
};

export type SetOutroStartMessage = {
  type: "SET_OUTRO_START";
};

export type ClearVideoRuleMessage = {
  type: "CLEAR_VIDEO_RULE";
};

export type ApplyRuleToPlaylistMessage = {
  type: "APPLY_RULE_TO_PLAYLIST";
  playlistUrl: string;
};

export type PopupRequest =
  | GetPageStateMessage
  | SetIntroEndMessage
  | SetOutroStartMessage
  | ClearVideoRuleMessage
  | ApplyRuleToPlaylistMessage;

export type ContentResponse = {
  ok: boolean;
  message: string;
  state?: PageState;
  error?: string;
};
