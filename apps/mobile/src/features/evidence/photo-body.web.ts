export type PhotoBody = {
  uri: string;
  mimeType: 'image/jpeg' | 'image/png';
  name: string;
  /** Camera or gallery; the server will not accept a photo without it. */
  source: string;
};

/**
 * A browser's FormData only accepts a Blob: the React Native file descriptor
 * would be appended as the string "[object Object]" and the server would
 * reject the upload. A captured photo is a blob: or data: URL, so it is read
 * back into a Blob first.
 */
export async function photoFormData(photo: PhotoBody): Promise<FormData> {
  const form = new FormData();
  form.append('source', photo.source);
  const response = await fetch(photo.uri);
  form.append('photo', await response.blob(), photo.name);
  return form;
}
