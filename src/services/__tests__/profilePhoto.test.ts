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

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
  })),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  serverTimestamp: jest.fn(() => new Date()),
}));

// Mock fetch for blob creation
global.fetch = jest.fn().mockResolvedValue({
  blob: jest.fn().mockResolvedValue(new Blob(['photo'])),
}) as any;

import { uploadProfilePhoto, deleteProfilePhoto } from '../profilePhoto';
import { updateDoc } from 'firebase/firestore';
import { deleteObject } from 'firebase/storage';

describe('profilePhoto', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('uploadProfilePhoto', () => {
    it('uploads photo and updates swimmer doc', async () => {
      const url = await uploadProfilePhoto('sw1', 'file:///photo.jpg');
      expect(url).toBe('https://storage.example.com/photo.jpg');
      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'swimmers/sw1' }),
        expect.objectContaining({ profilePhotoUrl: 'https://storage.example.com/photo.jpg' }),
      );
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
    it('deletes storage file and clears swimmer doc field', async () => {
      await deleteProfilePhoto('sw1');
      expect(deleteObject).toHaveBeenCalled();
      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'swimmers/sw1' }),
        expect.objectContaining({ profilePhotoUrl: null }),
      );
    });

    it('handles missing storage file gracefully', async () => {
      (deleteObject as jest.Mock).mockRejectedValueOnce(new Error('not found'));
      await deleteProfilePhoto('sw1');
      // Should still update the doc
      expect(updateDoc).toHaveBeenCalled();
    });
  });
});
