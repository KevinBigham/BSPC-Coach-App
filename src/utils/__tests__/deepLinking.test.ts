import { parseDeepLink } from '../deepLinking';

describe('parseDeepLink', () => {
  // --- swimmer routes ---
  it('parses swimmer profile URL', () => {
    const result = parseDeepLink('bspc-coach://swimmer/abc123');
    expect(result).toEqual({
      path: '/swimmer/abc123',
      params: { id: 'abc123' },
    });
  });

  it('parses swimmer standards URL', () => {
    const result = parseDeepLink('bspc-coach://swimmer/abc123/standards');
    expect(result).toEqual({
      path: '/swimmer/standards?id=abc123',
      params: { id: 'abc123' },
    });
  });

  // --- meet route ---
  it('parses meet detail URL', () => {
    const result = parseDeepLink('bspc-coach://meet/meet456');
    expect(result).toEqual({
      path: '/meet/meet456',
      params: { id: 'meet456' },
    });
  });

  // --- calendar route ---
  it('parses calendar date URL', () => {
    const result = parseDeepLink('bspc-coach://calendar/2026-04-06');
    expect(result).toEqual({
      path: '/calendar/2026-04-06',
      params: { date: '2026-04-06' },
    });
  });

  // --- invite route ---
  it('parses invite code URL', () => {
    const result = parseDeepLink('bspc-coach://invite/ABCD1234');
    expect(result).toEqual({
      path: '/swimmer/invite-parent?code=ABCD1234',
      params: { code: 'ABCD1234' },
    });
  });

  // --- edge cases ---
  it('returns null for empty string', () => {
    expect(parseDeepLink('')).toBeNull();
  });

  it('returns null for non-matching scheme', () => {
    expect(parseDeepLink('https://example.com/swimmer/123')).toBeNull();
  });

  it('returns null for unrecognised route', () => {
    expect(parseDeepLink('bspc-coach://unknown/route')).toBeNull();
  });

  it('returns null for scheme-only URL', () => {
    expect(parseDeepLink('bspc-coach://')).toBeNull();
  });

  it('handles trailing slash', () => {
    const result = parseDeepLink('bspc-coach://swimmer/abc123/');
    expect(result).toEqual({
      path: '/swimmer/abc123',
      params: { id: 'abc123' },
    });
  });

  it('strips query string from path', () => {
    const result = parseDeepLink('bspc-coach://meet/m1?ref=push');
    expect(result).toEqual({
      path: '/meet/m1',
      params: { id: 'm1' },
    });
  });

  it('handles single-slash scheme variant', () => {
    const result = parseDeepLink('bspc-coach:/swimmer/xyz');
    expect(result).toEqual({
      path: '/swimmer/xyz',
      params: { id: 'xyz' },
    });
  });

  it('returns null for swimmer path with no id', () => {
    expect(parseDeepLink('bspc-coach://swimmer')).toBeNull();
  });

  it('returns null for meet path with no id', () => {
    expect(parseDeepLink('bspc-coach://meet')).toBeNull();
  });
});
