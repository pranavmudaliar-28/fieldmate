/** The pieces of a prepared photo the upload body needs. */
export type PhotoBody = {
  uri: string;
  mimeType: 'image/jpeg' | 'image/png';
  name: string;
};

/**
 * React Native's FormData takes a file descriptor rather than a Blob, and
 * streams the file straight off disk, so a large photo never has to sit in
 * memory. The browser has no such thing; see the .web sibling.
 */
export async function photoFormData(photo: PhotoBody): Promise<FormData> {
  const form = new FormData();
  form.append('photo', {
    uri: photo.uri,
    name: photo.name,
    type: photo.mimeType,
  } as unknown as Blob);
  return form;
}
