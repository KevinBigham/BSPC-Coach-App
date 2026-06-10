// Photo binaries stay on Firebase Storage (UNIFY Phase F); the swimmer-row
// photo URL write migrated to canonical swimmers (Phase B). Same behavioral
// contract; the row-write mock is re-pointed at the Supabase client.
jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

const mockUploadOn = jest.fn(
  (_event: string, _progress: unknown, _error: unknown, complete: () => void) => complete(),
);

jest.mock('firebase/storage', () => ({
  ref: jest.fn((_s: unknown, path: string) => ({ path })),
  uploadBytesResumable: jest.fn(() => ({
    on: mockUploadOn,
    snapshot: { ref: { path: 'mock/path' } },
  })),
  getDownloadURL: jest.fn().mockResolvedValue('https://storage.example.com/photo.jpg'),
  deleteObject: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../config/supabase', () => {
  const query: Record<string, jest.Mock> = {
    update: jest.fn(() => query),
    eq: jest.fn(() => Promise.resolve({ error: null })),
  };
  const supabase = { from: jest.fn(() => query) };
  return { supabase, __query: query };
});

// Mock fetch for blob creation
global.fetch = jest.fn().mockResolvedValue({
  blob: jest.fn().mockResolvedValue(new Blob(['photo'])),
}) as any;

import { uploadProfilePhoto, deleteProfilePhoto } from '../profilePhoto';
import { deleteObject } from 'firebase/storage';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { supabase, __query } = require('../../config/supabase');

describe('profilePhoto', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('uploadProfilePhoto', () => {
    it('uploads the photo and writes the URL to the swimmer row', async () => {
      const url = await uploadProfilePhoto('sw1', 'file:///photo.jpg');
      expect(url).toBe('https://storage.example.com/photo.jpg');
      expect(supabase.from).toHaveBeenCalledWith('swimmers');
      expect(__query.update).toHaveBeenCalledWith({
        profile_photo_url: 'https://storage.example.com/photo.jpg',
      });
      expect(__query.eq).toHaveBeenCalledWith('id', 'sw1');
    });

    it('never sends updated_at (DB trigger owns it)', async () => {
      await uploadProfilePhoto('sw1', 'file:///photo.jpg');
      expect(__query.update.mock.calls[0][0]).not.toHaveProperty('updated_at');
    });

    it('calls onProgress callback', async () => {
      // Override the on mock to call progress
      mockUploadOn.mockImplementationOnce(
        (_event: string, progress: any, _error: unknown, complete: () => void) => {
          progress({ bytesTransferred: 50, totalBytes: 100 });
          complete();
        },
      );
      const onProgress = jest.fn();
      await uploadProfilePhoto('sw1', 'file:///photo.jpg', onProgress);
      expect(onProgress).toHaveBeenCalledWith(50);
    });
  });

  describe('deleteProfilePhoto', () => {
    it('deletes the storage file and clears the swimmer row field', async () => {
      await deleteProfilePhoto('sw1');
      expect(deleteObject).toHaveBeenCalled();
      expect(__query.update).toHaveBeenCalledWith({ profile_photo_url: null });
      expect(__query.eq).toHaveBeenCalledWith('id', 'sw1');
    });

    it('handles missing storage file gracefully', async () => {
      (deleteObject as jest.Mock).mockRejectedValueOnce(new Error('not found'));
      await deleteProfilePhoto('sw1');
      // Should still clear the row field
      expect(__query.update).toHaveBeenCalledWith({ profile_photo_url: null });
    });
  });
});
