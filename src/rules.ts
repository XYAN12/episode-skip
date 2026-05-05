export type SkipRule = {
  introEndSeconds?: number;
  outroRemainingSeconds?: number;
  updatedAt: number;
};

export type RuleScope = "video" | "playlist" | "channel";
export type RuleSource = RuleScope | "none";

export type RuleStore = {
  video: Record<string, SkipRule>;
  playlist: Record<string, SkipRule>;
  channel: Record<string, SkipRule>;
};

export type RuleContext = {
  videoId: string | null;
  playlistId: string | null;
  channelId: string | null;
};

export type VideoState = {
  currentTime: number;
  duration: number;
};

const DEFAULT_TOLERANCE_SECONDS = 0.5;
const DEFAULT_END_PADDING_SECONDS = 0.5;

export function createEmptyRuleStore(): RuleStore {
  return {
    video: {},
    playlist: {},
    channel: {}
  };
}

export function resolveRule(store: RuleStore, context: RuleContext): SkipRule | null {
  return resolveRuleWithSource(store, context).rule;
}

export function resolveRuleWithSource(store: RuleStore, context: RuleContext): {
  rule: SkipRule | null;
  source: RuleSource;
} {
  if (context.videoId && store.video[context.videoId]) {
    return {
      rule: store.video[context.videoId],
      source: "video"
    };
  }

  if (context.playlistId && store.playlist[context.playlistId]) {
    return {
      rule: store.playlist[context.playlistId],
      source: "playlist"
    };
  }

  if (context.channelId && store.channel[context.channelId]) {
    return {
      rule: store.channel[context.channelId],
      source: "channel"
    };
  }

  return {
    rule: null,
    source: "none"
  };
}

export function createRuleFromIntro(currentTime: number, updatedAt = Date.now()): SkipRule {
  return {
    introEndSeconds: currentTime,
    updatedAt
  };
}

export function createRuleFromOutro(duration: number, currentTime: number, updatedAt = Date.now()): SkipRule {
  return {
    outroRemainingSeconds: duration - currentTime,
    updatedAt
  };
}

export function getSkipTarget(videoState: VideoState, rule: SkipRule): number | null {
  if (!isValidVideoState(videoState)) {
    return null;
  }

  const introTarget = getIntroTarget(videoState, rule.introEndSeconds);
  if (introTarget !== null) {
    return introTarget;
  }

  return getOutroTarget(videoState, rule.outroRemainingSeconds);
}

function getIntroTarget(videoState: VideoState, introEndSeconds?: number): number | null {
  if (!isValidRuleTime(introEndSeconds, videoState.duration)) {
    return null;
  }

  if (videoState.currentTime + DEFAULT_TOLERANCE_SECONDS < introEndSeconds) {
    return introEndSeconds;
  }

  return null;
}

function getOutroTarget(videoState: VideoState, outroRemainingSeconds?: number): number | null {
  if (!isValidRuleTime(outroRemainingSeconds, videoState.duration)) {
    return null;
  }

  const remainingSeconds = videoState.duration - videoState.currentTime;
  if (remainingSeconds > outroRemainingSeconds + DEFAULT_TOLERANCE_SECONDS) {
    return null;
  }

  const target = Math.max(0, videoState.duration - DEFAULT_END_PADDING_SECONDS);
  if (target <= videoState.currentTime + DEFAULT_TOLERANCE_SECONDS) {
    return null;
  }

  return target;
}

function isValidVideoState(videoState: VideoState): boolean {
  return Number.isFinite(videoState.currentTime) && Number.isFinite(videoState.duration) && videoState.currentTime >= 0 && videoState.duration > 0;
}

function isValidRuleTime(value: number | undefined, duration: number): value is number {
  return Number.isFinite(value) && value >= 0 && value <= duration;
}
