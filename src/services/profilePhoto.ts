import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';
import { supabase } from '../config/supabase';

// Photo binaries stay on Firebase Storage until the media phase (UNIFY/04
// Phase F); the swimmer row's photo URL now lives on canonical swimmers.
// profile_photo_url is host-agnostic, so the stored download URL keeps
// working across the cutover. updated_at is owned by the DB trigger.
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
  const response = await fetch(uri);
  const blob = await response.blob();
  const storagePath = `profiles/${swimmerId}/photo.jpg`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, blob);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      (error) => reject(error),
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          await setSwimmerPhotoUrl(swimmerId, downloadUrl);
          resolve(downloadUrl);
        } catch (error) {
          reject(error);
        }
      },
    );
  });
}

export async function deleteProfilePhoto(swimmerId: string): Promise<void> {
  const storagePath = `profiles/${swimmerId}/photo.jpg`;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch {
    // Intentionally not logged: missing storage object still needs the profile field cleared.
  }
  await setSwimmerPhotoUrl(swimmerId, null);
}
