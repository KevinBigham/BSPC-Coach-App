import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

export type OfflineDemoMediaType = 'video' | 'audio';

export interface OfflineDemoMediaItem {
  id: string;
  type: OfflineDemoMediaType;
  swimmerName: string;
  swimmerFolderName: string;
  fileName: string;
  uri: string;
  sourceUri: string;
  savedAt: string;
  durationSec?: number;
}

interface SaveLocalDemoMediaInput {
  type: OfflineDemoMediaType;
  swimmerName: string;
  sourceUri: string;
  durationSec?: number;
  now?: Date;
}

const INDEX_KEY = '@bspc/offline-demo-media-index';
const ROOT_FOLDER_NAME = 'BSPC-Coach-Demo';
const DEFAULT_SWIMMER_FOLDER_NAME = 'Unknown_Swimmer';
const MAX_FOLDER_NAME_LENGTH = 80;

let sequence = 0;

function trimTrailingSlash(uri: string): string {
  return uri.endsWith('/') ? uri.slice(0, -1) : uri;
}

function nextSequence(): string {
  sequence = (sequence + 1) % 0xffff;
  return sequence.toString(36).padStart(4, '0');
}

function timestampForFileName(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

function fallbackExtensionForType(type: OfflineDemoMediaType): string {
  return type === 'video' ? '.mp4' : '.m4a';
}

export function sanitizeSwimmerFolderName(swimmerName: string): string {
  const normalized = swimmerName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    .slice(0, MAX_FOLDER_NAME_LENGTH)
    .replace(/[._-]+$/g, '');

  return normalized.length > 0 ? normalized : DEFAULT_SWIMMER_FOLDER_NAME;
}

export function getOfflineDemoDirectoryUri(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error('Offline demo storage is unavailable on this platform.');
  }
  return `${trimTrailingSlash(FileSystem.documentDirectory)}/${ROOT_FOLDER_NAME}/`;
}

function getSourceExtension(sourceUri: string, type: OfflineDemoMediaType): string {
  const withoutQuery = sourceUri.split(/[?#]/)[0] ?? '';
  const fileName = withoutQuery.split('/').filter(Boolean).pop() ?? '';
  const match = fileName.match(/\.([A-Za-z0-9]{1,10})$/);
  return match ? `.${match[1].toLowerCase()}` : fallbackExtensionForType(type);
}

function getMediaDirectoryUri(swimmerFolderName: string, type: OfflineDemoMediaType): string {
  return `${getOfflineDemoDirectoryUri()}${swimmerFolderName}/${type}/`;
}

function buildSavedUri(
  swimmerFolderName: string,
  type: OfflineDemoMediaType,
  fileName: string,
): string {
  return `${getMediaDirectoryUri(swimmerFolderName, type)}${fileName}`;
}

async function ensureDirectory(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    return;
  }
  await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
}

async function writeSavedDemoMediaIndex(items: OfflineDemoMediaItem[]): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(items));
}

export async function readSavedDemoMediaIndex(): Promise<OfflineDemoMediaItem[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineDemoMediaItem[]) : [];
  } catch {
    return [];
  }
}

async function recordLocalMediaMetadata(
  item: OfflineDemoMediaItem,
): Promise<OfflineDemoMediaItem[]> {
  const existing = await readSavedDemoMediaIndex();
  const next = [item, ...existing].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  await writeSavedDemoMediaIndex(next);
  return next;
}

export async function saveLocalDemoMedia(
  input: SaveLocalDemoMediaInput,
): Promise<OfflineDemoMediaItem> {
  const savedAtDate = input.now ?? new Date();
  const savedAt = savedAtDate.toISOString();
  const swimmerFolderName = sanitizeSwimmerFolderName(input.swimmerName);
  const extension = getSourceExtension(input.sourceUri, input.type);
  const baseName = timestampForFileName(savedAtDate);
  const fileName = `${baseName}${extension}`;
  const directoryUri = getMediaDirectoryUri(swimmerFolderName, input.type);
  const uri = buildSavedUri(swimmerFolderName, input.type, fileName);

  await ensureDirectory(directoryUri);
  await FileSystem.copyAsync({ from: input.sourceUri, to: uri });

  const item: OfflineDemoMediaItem = {
    id: `${input.type}-${baseName}-${nextSequence()}`,
    type: input.type,
    swimmerName: input.swimmerName.trim() || DEFAULT_SWIMMER_FOLDER_NAME,
    swimmerFolderName,
    fileName,
    uri,
    sourceUri: input.sourceUri,
    savedAt,
    ...(input.durationSec !== undefined ? { durationSec: input.durationSec } : {}),
  };
  await recordLocalMediaMetadata(item);
  return item;
}

export async function clearOfflineDemoIndex(): Promise<void> {
  await AsyncStorage.removeItem(INDEX_KEY);
}
