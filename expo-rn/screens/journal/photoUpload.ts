/**
 * Local photo-pick + upload-error helpers for the Journal section.
 * The backend photo route answers with error codes (413 `too_large`,
 * 409 `too_many`, 415 `not_image`/`invalid_image`); `postForm` surfaces the
 * code as the Error message — map it to the web's exact copy.
 */
import * as ImagePicker from 'expo-image-picker';
import { STR } from './strings';

export type PickedImage = { uri: string; name: string; type: string };

/** Map an upload failure to the web's exact error string. */
export function uploadErrorMessage(e: unknown): string {
  const code = e instanceof Error ? e.message : '';
  if (code.includes('too_large')) return STR.photoTooLarge;
  if (code.includes('too_many')) return STR.photoTooMany;
  if (code.includes('not_image') || code.includes('invalid_image')) return STR.photoNotImage;
  return STR.photoUploadFailed;
}

/** Open the image library; [] when the user cancels. */
export async function pickImages(allowsMultipleSelection: boolean): Promise<PickedImage[]> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsMultipleSelection,
  });
  if (picked.canceled) return [];
  return picked.assets.map((a, i) => ({
    uri: a.uri,
    name: a.fileName ?? `photo-${Date.now()}-${i}.jpg`,
    type: a.mimeType ?? 'image/jpeg',
  }));
}
