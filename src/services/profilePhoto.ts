// Phase F (D-F1/D-F3): photo binaries live in the PRIVATE 'profile-photos'
// bucket. The persisted profile_photo_url becomes a LONG-LIVED SIGNED
// capability URL — shape-identical to the Firebase token URL it replaces
// (an unguessable link that renders without a login). That URL is the
// parents' ONE media affordance, unchanged by the move. updated_at is owned
// by the DB trigger.
import { supabase } from '../config/supabase';
import { uploadFileToBucket, getSignedFileUrl, LONG_LIVED_URL_SECONDS } from './mediaUpload';

async function setSwimmerPhotoUrl(swimmerId: string, url: string | null): Promise<void> {
  const { error } = await supabase
    .from('swimmers')
    .update({ profile_photo_url: url })
    .eq('id', swimmerId);
  if (error) throw error;
}

export async function uploadProfilePhoto(
  swimmerId: string,
  uri: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const storagePath = `profiles/${swimmerId}/photo.jpg`;

  // upsert: overwrite-by-path — the Firebase fixed-name semantics survive
  await uploadFileToBucket('profile-photos', storagePath, uri, 'image/jpeg', onProgress, true);
  const downloadUrl = await getSignedFileUrl('profile-photos', storagePath, LONG_LIVED_URL_SECONDS);
  await setSwimmerPhotoUrl(swimmerId, downloadUrl);
  return downloadUrl;
}

export async function deleteProfilePhoto(swimmerId: string): Promise<void> {
  const storagePath = `profiles/${swimmerId}/photo.jpg`;
  // remove() reports a missing object as an error value, never a throw —
  // either way the row field still gets cleared (the Firebase-era behavior).
  await supabase.storage.from('profile-photos').remove([storagePath]);
  await setSwimmerPhotoUrl(swimmerId, null);
}
