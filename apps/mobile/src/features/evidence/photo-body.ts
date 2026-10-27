/** The pieces of a prepared photo the upload body needs. */
export type PhotoBody = {
  uri: string;
  mimeType: 'image/jpeg' | 'image/png';
  name: string;
  /** Camera or gallery; the server will not accept a photo without it. */
  source: string;
  /** The id the server stores it under, so a resent upload is not kept twice. */
  id?: string;
};

/**
 * React Native's FormData takes a file descriptor rather than a Blob, and
 * streams the file straight off disk, so a large photo never has to sit in
 * memory. The browser has no such thing; see the .web sibling.
 */
export async function photoFormData(photo: PhotoBody): Promise<FormData> {
  const form = new FormData();
  form.append('source', photo.source);
  if (photo.id) form.append('id', photo.id);
  form.append('photo', {
    uri: photo.uri,
    name: photo.name,
    type: photo.mimeType,
  } as unknown as Blob);
  return form;
}
