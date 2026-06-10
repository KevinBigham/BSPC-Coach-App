// Phase F (D-F1): the shared Supabase Storage upload helper. The XHR PUT
// preserves the uploadBytesResumable onProgress percent contract.
jest.mock('../../config/supabase', () => {
  const storageApi = {
    createSignedUploadUrl: jest
      .fn()
      .mockResolvedValue({
        data: { signedUrl: 'https://signed.upload/url?token=t1' },
        error: null,
      }),
    createSignedUrl: jest
      .fn()
      .mockResolvedValue({ data: { signedUrl: 'https://signed.read/url' }, error: null }),
  };
  const supabase = { storage: { from: jest.fn(() => storageApi) } };
  return { supabase, __storageApi: storageApi };
});

import {
  uploadFileToBucket,
  getSignedFileUrl,
  putWithProgress,
  LONG_LIVED_URL_SECONDS,
} from '../mediaUpload';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __storageApi } = mock;

class FakeXHR {
  static instances: FakeXHR[] = [];
  static nextStatus = 200;
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: unknown = null;
  status = 0;
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    FakeXHR.instances.push(this);
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }
  send(body: unknown) {
    this.body = body;
    this.status = FakeXHR.nextStatus;
    // emit one progress tick then complete, like a real upload
    this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 200 } as ProgressEvent);
    this.onload?.();
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  FakeXHR.instances = [];
  FakeXHR.nextStatus = 200;
  (global as Record<string, unknown>).XMLHttpRequest = FakeXHR as unknown;
  global.fetch = jest
    .fn()
    .mockResolvedValue({ blob: jest.fn().mockResolvedValue(new Blob(['bytes'])) }) as jest.Mock;
});

describe('uploadFileToBucket', () => {
  it('signs an upload URL for the exact path and PUTs the blob with the content type', async () => {
    const path = await uploadFileToBucket(
      'media-audio',
      'audio/c1/d/f.m4a',
      'file://x',
      'audio/mp4',
    );
    expect(supabase.storage.from).toHaveBeenCalledWith('media-audio');
    expect(__storageApi.createSignedUploadUrl).toHaveBeenCalledWith('audio/c1/d/f.m4a');
    const xhr = FakeXHR.instances[0];
    expect(xhr.method).toBe('PUT');
    expect(xhr.url).toBe('https://signed.upload/url?token=t1');
    expect(xhr.headers['content-type']).toBe('audio/mp4');
    expect(path).toBe('audio/c1/d/f.m4a');
  });

  it('reports progress as a percent — the uploadBytesResumable contract', async () => {
    const onProgress = jest.fn();
    await uploadFileToBucket('media-audio', 'p', 'file://x', 'audio/mp4', onProgress);
    expect(onProgress).toHaveBeenCalledWith(25); // 50 / 200 bytes
  });

  it('sends x-upsert only when asked (the overwrite-by-path photo flow)', async () => {
    await uploadFileToBucket(
      'profile-photos',
      'profiles/s1/photo.jpg',
      'file://x',
      'image/jpeg',
      undefined,
      true,
    );
    expect(FakeXHR.instances[0].headers['x-upsert']).toBe('true');
    await uploadFileToBucket('media-audio', 'a.m4a', 'file://x', 'audio/mp4');
    expect(FakeXHR.instances[1].headers).not.toHaveProperty('x-upsert');
  });

  it('rejects on a non-2xx upload response', async () => {
    FakeXHR.nextStatus = 403;
    await expect(uploadFileToBucket('media-audio', 'p', 'file://x', 'audio/mp4')).rejects.toThrow(
      /upload failed \(403\)/,
    );
  });

  it('surfaces a signing error without attempting the PUT', async () => {
    __storageApi.createSignedUploadUrl.mockResolvedValueOnce({
      data: null,
      error: new Error('not authorized'),
    });
    await expect(uploadFileToBucket('media-audio', 'p', 'file://x', 'audio/mp4')).rejects.toThrow(
      'not authorized',
    );
    expect(FakeXHR.instances).toHaveLength(0);
  });
});

describe('getSignedFileUrl', () => {
  it('returns a signed read URL for the path and expiry', async () => {
    const url = await getSignedFileUrl('media-audio', 'audio/x.m4a', 3600);
    expect(__storageApi.createSignedUrl).toHaveBeenCalledWith('audio/x.m4a', 3600);
    expect(url).toBe('https://signed.read/url');
  });

  it('long-lived expiry constant is ~10 years (capability-URL parity, D-F3)', () => {
    expect(LONG_LIVED_URL_SECONDS).toBe(315360000);
  });
});

describe('putWithProgress', () => {
  it('rejects on network error', async () => {
    class ErrorXHR extends FakeXHR {
      send() {
        this.onerror?.();
      }
    }
    (global as Record<string, unknown>).XMLHttpRequest = ErrorXHR as unknown;
    await expect(putWithProgress('https://u', new Blob(), 'audio/mp4', {})).rejects.toThrow(
      /network/,
    );
  });
});
