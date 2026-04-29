import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../config/firebase';

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
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        await updateDoc(doc(db, 'swimmers', swimmerId), {
          profilePhotoUrl: downloadUrl,
          updatedAt: serverTimestamp(),
        });
        resolve(downloadUrl);
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
  await updateDoc(doc(db, 'swimmers', swimmerId), {
    profilePhotoUrl: null,
    updatedAt: serverTimestamp(),
  });
}
