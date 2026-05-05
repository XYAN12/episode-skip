export type YouTubePageContext = {
  videoId: string | null;
  playlistId: string | null;
  channelId: string | null;
  isWatchPage: boolean;
};

export function getVideoIdFromUrl(url: string): string | null {
  const parsedUrl = tryParseUrl(url);
  if (!parsedUrl || !isYouTubeHost(parsedUrl.hostname) || parsedUrl.pathname !== "/watch") {
    return null;
  }

  return parsedUrl.searchParams.get("v");
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
  return {
    videoId: getVideoIdFromUrl(url),
    playlistId: getPlaylistIdFromUrl(url),
    channelId: getChannelIdFromDocument(documentRef),
    isWatchPage: isWatchPage(url)
  };
}

export function isWatchPage(url: string): boolean {
  const parsedUrl = tryParseUrl(url);
  return Boolean(parsedUrl && isYouTubeHost(parsedUrl.hostname) && parsedUrl.pathname === "/watch");
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
