const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function getSecureBytes(length: number): Uint8Array {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Secure random number generation is unavailable in this runtime');
  }

  const bytes = new Uint8Array(length);
  cryptoApi.getRandomValues(bytes);
  return bytes;
}

export function secureInviteCode(): string {
  const bytes = getSecureBytes(8);
  let code = '';

  for (let i = 0; i < bytes.length; i++) {
    if (i === 4) code += '-';
    code += INVITE_CODE_CHARS[bytes[i] % INVITE_CODE_CHARS.length];
  }

  return code;
}
