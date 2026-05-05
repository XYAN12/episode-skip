export type YouTubePageContext = {
  videoId: string | null;
  playlistId: string | null;
  playlistIndex: string | null;
  channelId: string | null;
  isWatchPage: boolean;
};

export type WatchPageIdentifiers = {
  videoId: string | null;
  playlistId: string | null;
  index: string | null;
};

export function isYouTubeWatchUrl(url: string): boolean {
  return parseYouTubeWatchUrl(url) !== null;
}

export function parseYouTubeWatchUrl(url: string): WatchPageIdentifiers | null {
  const parsedUrl = tryParseUrl(url);
  if (!parsedUrl || !isYouTubeHost(parsedUrl.hostname) || parsedUrl.pathname !== "/watch") {
    return null;
  }

  return {
    videoId: parsedUrl.searchParams.get("v"),
    playlistId: parsedUrl.searchParams.get("list"),
    index: parsedUrl.searchParams.get("index")
  };
}

export function getWatchPageIdentifiers(url: string): WatchPageIdentifiers {
  const identifiers = parseYouTubeWatchUrl(url);
  if (!identifiers) {
    return {
      videoId: null,
      playlistId: null,
      index: null
    };
  }

  return identifiers;
}

export function getVideoIdFromUrl(url: string): string | null {
  return getWatchPageIdentifiers(url).videoId;
}

export function getPlaylistIdFromUrl(url: string): string | null {
  const parsedUrl = tryParseUrl(url);
  if (!parsedUrl || !isYouTubeHost(parsedUrl.hostname)) {
    return null;
  }

  if (parsedUrl.pathname !== "/watch" && parsedUrl.pathname !== "/playlist") {
    return null;
  }

  return parsedUrl.searchParams.get("list");
}

export function getPageContext(url: string, documentRef: Document): YouTubePageContext {
  const identifiers = getWatchPageIdentifiers(url);
  return {
    videoId: identifiers.videoId,
    playlistId: identifiers.playlistId,
    playlistIndex: identifiers.index,
    channelId: getChannelIdFromDocument(documentRef),
    isWatchPage: isWatchPage(url)
  };
}

export function isWatchPage(url: string): boolean {
  return isYouTubeWatchUrl(url);
}

export function getChannelIdFromDocument(documentRef: Document): string | null {
  const metaChannelId = documentRef.querySelector('meta[itemprop="channelId"]')?.getAttribute("content");
  if (metaChannelId) {
    return metaChannelId;
  }

  const channelHref = documentRef
    .querySelector<HTMLAnchorElement>('a[href*="/channel/"]')
    ?.getAttribute("href");
  if (!channelHref) {
    return null;
  }

  const match = channelHref.match(/\/channel\/([^/?]+)/);
  return match?.[1] ?? null;
}

function tryParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isYouTubeHost(hostname: string): boolean {
  return hostname === "youtube.com" || hostname === "www.youtube.com" || hostname.endsWith(".youtube.com");
}
