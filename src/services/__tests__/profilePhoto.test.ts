// Phase F: photo binaries live in the private profile-photos bucket; the
// persisted profile_photo_url is a LONG-LIVED signed capability URL (D-F3 —
// the parents' one media affordance, shape-identical to the Firebase token
// URL it replaces). Same behavioral contract; the storage mock is re-pointed
// at the shared mediaUpload helper.
jest.mock('../mediaUpload', () => ({
  uploadFileToBucket: jest.fn().mockResolvedValue('mocked-path'),
  getSignedFileUrl: jest.fn().mockResolvedValue('https://signed.example.com/photo.jpg'),
  LONG_LIVED_URL_SECONDS: 315360000,
}));

jest.mock('../../config/supabase', () => {
  const storageApi = {
    remove: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  const query: Record<string, jest.Mock> = {
    update: jest.fn(() => query),
    eq: jest.fn(() => Promise.resolve({ error: null })),
  };
  const supabase = { from: jest.fn(() => query), storage: { from: jest.fn(() => storageApi) } };
  return { supabase, __query: query, __storageApi: storageApi };
});

import { uploadProfilePhoto, deleteProfilePhoto } from '../profilePhoto';
import { uploadFileToBucket, getSignedFileUrl } from '../mediaUpload';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { supabase, __query, __storageApi } = require('../../config/supabase');

describe('profilePhoto', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('uploadProfilePhoto', () => {
    it('uploads with upsert (overwrite-by-path) and writes the LONG-LIVED signed URL to the swimmer row', async () => {
      const url = await uploadProfilePhoto('sw1', 'file:///photo.jpg');
      expect(uploadFileToBucket).toHaveBeenCalledWith(
        'profile-photos',
        'profiles/sw1/photo.jpg',
        'file:///photo.jpg',
        'image/jpeg',
        undefined,
        true, // upsert — the Firebase fixed-name overwrite semantics
      );
      expect(getSignedFileUrl).toHaveBeenCalledWith(
        'profile-photos',
        'profiles/sw1/photo.jpg',
        315360000, // ~10y capability URL, parity with Firebase token URLs
      );
      expect(url).toBe('https://signed.example.com/photo.jpg');
      expect(supabase.from).toHaveBeenCalledWith('swimmers');
      expect(__query.update).toHaveBeenCalledWith({
        profile_photo_url: 'https://signed.example.com/photo.jpg',
      });
      expect(__query.eq).toHaveBeenCalledWith('id', 'sw1');
    });

    it('never sends updated_at (DB trigger owns it)', async () => {
      await uploadProfilePhoto('sw1', 'file:///photo.jpg');
      expect(__query.update.mock.calls[0][0]).not.toHaveProperty('updated_at');
    });

    it('threads the onProgress callback through to the upload helper', async () => {
      const onProgress = jest.fn();
      await uploadProfilePhoto('sw1', 'file:///photo.jpg', onProgress);
      expect(uploadFileToBucket).toHaveBeenCalledWith(
        'profile-photos',
        'profiles/sw1/photo.jpg',
        'file:///photo.jpg',
        'image/jpeg',
        onProgress,
        true,
      );
    });
  });

  describe('deleteProfilePhoto', () => {
    it('removes the storage object and clears the swimmer row field', async () => {
      await deleteProfilePhoto('sw1');
      expect(supabase.storage.from).toHaveBeenCalledWith('profile-photos');
      expect(__storageApi.remove).toHaveBeenCalledWith(['profiles/sw1/photo.jpg']);
      expect(__query.update).toHaveBeenCalledWith({ profile_photo_url: null });
      expect(__query.eq).toHaveBeenCalledWith('id', 'sw1');
    });

    it('still clears the row field when the storage object is missing', async () => {
      __storageApi.remove.mockResolvedValueOnce({ data: null, error: new Error('not found') });
      await deleteProfilePhoto('sw1');
      expect(__query.update).toHaveBeenCalledWith({ profile_photo_url: null });
    });
  });
});
