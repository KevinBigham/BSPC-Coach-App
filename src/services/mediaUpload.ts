// Phase F (D-F1): media files live in Supabase Storage. Uploads go through a
// signed upload URL + an XHR PUT so the onProgress percent contract from the
// Firebase uploadBytesResumable era survives unchanged (React Native's
// networking is XHR-based; fetch exposes no upload progress).
import { supabase } from '../config/supabase';

// ~10 years. Capability-URL parity with the Firebase download-token URLs this
// replaces: an unguessable link that renders without a login (D-F3) — used
// for the persisted profile_photo_url, the parents' one media affordance.
export const LONG_LIVED_URL_SECONDS = 315360000;

export function putWithProgress(
  url: string,
  body: Blob,
  contentType: string,
  extraHeaders: Record<string, string>,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', contentType);
    for (const [key, value] of Object.entries(extraHeaders)) {
      xhr.setRequestHeader(key, value);
    }
    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event: ProgressEvent) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress((event.loaded / event.total) * 100);
        }
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('upload failed (network)'));
    xhr.send(body);
  });
}

export async function uploadFileToBucket(
  bucket: string,
  storagePath: string,
  uri: string,
  contentType: string,
  onProgress?: (percent: number) => void,
  upsert: boolean = false,
): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(storagePath);
  if (error) throw error;

  await putWithProgress(
    (data as { signedUrl: string }).signedUrl,
    blob,
    contentType,
    upsert ? { 'x-upsert': 'true' } : {},
    onProgress,
  );
  return storagePath;
}

export async function getSignedFileUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return (data as { signedUrl: string }).signedUrl;
}
