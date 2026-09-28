import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNative } from './native';

function pickFileFromBrowser(): Promise<Blob | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Takes or picks a photo. Returns null when the user cancels. */
export async function pickPhoto(source: 'camera' | 'photos'): Promise<Blob | null> {
  if (!isNative()) return pickFileFromBrowser();
  try {
    const photo = await Camera.getPhoto({
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      resultType: CameraResultType.Uri,
      quality: 85,
      width: 1600,
      correctOrientation: true,
      saveToGallery: false,
    });
    if (!photo.webPath) return null;
    return await (await fetch(photo.webPath)).blob();
  } catch {
    return null;
  }
}
