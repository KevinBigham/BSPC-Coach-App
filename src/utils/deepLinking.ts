/**
 * Deep link URL parser for bspc-coach:// scheme.
 *
 * Supported routes:
 *   bspc-coach://swimmer/:id
 *   bspc-coach://swimmer/:id/standards
 *   bspc-coach://meet/:id
 *   bspc-coach://calendar/:date
 *   bspc-coach://invite/:code
 */

const SCHEME = 'bspc-coach://';

export interface DeepLinkResult {
  /** Expo Router path, e.g. "/swimmer/abc123" */
  path: string;
  /** Extracted route params */
  params: Record<string, string>;
}

/**
 * Parse a bspc-coach:// URL into a router path + params.
 * Returns null for unrecognised or malformed URLs.
 */
export function parseDeepLink(url: string): DeepLinkResult | null {
  if (!url) return null;

  let path = url;
  if (path.startsWith(SCHEME)) {
    path = path.slice(SCHEME.length);
  } else if (path.startsWith('bspc-coach:')) {
    // Tolerate single-slash `bspc-coach:/` variant produced by some OS share sheets.
    path = path.replace(/^bspc-coach:\/*/, '');
  } else {
    return null;
  }

  const queryIndex = path.indexOf('?');
  const query = queryIndex >= 0 ? path.slice(queryIndex + 1) : '';
  if (queryIndex >= 0) path = path.slice(0, queryIndex);
  path = path.replace(/\/+$/, '');

  if (!path) return null;

  const segments = path.split('/').filter(Boolean);

  // swimmer/:id/standards
  if (segments[0] === 'swimmer' && segments.length === 3 && segments[2] === 'standards') {
    return {
      path: `/swimmer/standards?id=${segments[1]}`,
      params: { id: segments[1] },
    };
  }

  // swimmer/:id
  if (segments[0] === 'swimmer' && segments.length === 2) {
    return {
      path: `/swimmer/${segments[1]}`,
      params: { id: segments[1] },
    };
  }

  // meet/:id
  if (segments[0] === 'meet' && segments.length === 2) {
    return {
      path: `/meet/${segments[1]}`,
      params: { id: segments[1] },
    };
  }

  // calendar/:date
  if (segments[0] === 'calendar' && segments.length === 2) {
    return {
      path: `/calendar/${segments[1]}`,
      params: { date: segments[1] },
    };
  }

  // invite/:code
  if (segments[0] === 'invite' && segments.length === 2) {
    return {
      path: `/swimmer/invite-parent?code=${segments[1]}`,
      params: { code: segments[1] },
    };
  }

  return null;
}
