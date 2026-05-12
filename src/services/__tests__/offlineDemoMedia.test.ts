jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store = {};
        return Promise.resolve();
      }),
    },
  };
});

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  copyAsync: jest.fn(() => Promise.resolve()),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: false })),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import {
  clearOfflineDemoIndex,
  getOfflineDemoDirectoryUri,
  readSavedDemoMediaIndex,
  sanitizeSwimmerFolderName,
  saveLocalDemoMedia,
} from '../offlineDemoMedia';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('offlineDemoMedia', () => {
  it('sanitizes swimmer names into stable local folder names', () => {
    expect(sanitizeSwimmerFolderName('  Ava O/Neil #12  ')).toBe('Ava_O_Neil_12');
    expect(sanitizeSwimmerFolderName('../')).toBe('Unknown_Swimmer');
    expect(sanitizeSwimmerFolderName('José Power Cat')).toBe('Jose_Power_Cat');
  });

  it('builds the demo root under app document storage', () => {
    expect(getOfflineDemoDirectoryUri()).toBe('file:///documents/BSPC-Coach-Demo/');
  });

  it('copies media into a swimmer/type folder and preserves the source extension', async () => {
    const saved = await saveLocalDemoMedia({
      type: 'video',
      swimmerName: 'Ava O/Neil',
      sourceUri: 'file:///tmp/camera-capture.MOV?asset=1',
      now: new Date('2026-05-12T15:04:05.678Z'),
    });

    expect(saved).toMatchObject({
      type: 'video',
      swimmerName: 'Ava O/Neil',
      swimmerFolderName: 'Ava_O_Neil',
      fileName: '2026-05-12T15-04-05-678Z.mov',
      uri: 'file:///documents/BSPC-Coach-Demo/Ava_O_Neil/video/2026-05-12T15-04-05-678Z.mov',
      sourceUri: 'file:///tmp/camera-capture.MOV?asset=1',
      savedAt: '2026-05-12T15:04:05.678Z',
    });
    expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
      'file:///documents/BSPC-Coach-Demo/Ava_O_Neil/video/',
      { intermediates: true },
    );
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file:///tmp/camera-capture.MOV?asset=1',
      to: saved.uri,
    });

    const index = await readSavedDemoMediaIndex();
    expect(index).toEqual([saved]);
  });

  it('uses safe fallback extensions for source URIs without a file extension', async () => {
    const audio = await saveLocalDemoMedia({
      type: 'audio',
      swimmerName: 'Ben',
      sourceUri: 'file:///tmp/expo-recording',
      now: new Date('2026-05-12T16:00:00.000Z'),
    });

    expect(audio.fileName).toBe('2026-05-12T16-00-00-000Z.m4a');
    expect(audio.uri).toBe(
      'file:///documents/BSPC-Coach-Demo/Ben/audio/2026-05-12T16-00-00-000Z.m4a',
    );
  });

  it('returns an empty index when local metadata is malformed', async () => {
    await AsyncStorage.setItem('@bspc/offline-demo-media-index', '{bad json');

    await expect(readSavedDemoMediaIndex()).resolves.toEqual([]);
  });

  it('can clear only the local metadata index', async () => {
    await saveLocalDemoMedia({
      type: 'audio',
      swimmerName: 'Ava',
      sourceUri: 'file:///tmp/audio.m4a',
      now: new Date('2026-05-12T16:10:00.000Z'),
    });

    await clearOfflineDemoIndex();

    expect(await readSavedDemoMediaIndex()).toEqual([]);
  });
});
