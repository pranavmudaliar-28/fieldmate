import { MAX_EVIDENCE_BYTES } from '@fieldmate/shared';
import { ApiError, configureHttp } from '../../services/http';
import { PHOTO_TOO_LARGE_MESSAGE, uploadEvidence } from './api';

type Handlers = {
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
};

class FakeXhr implements Handlers {
  static instances: FakeXhr[] = [];
  /** Which callback send() should fire, so tests can simulate a dropped connection. */
  static mode: 'load' | 'error' = 'load';
  status = 201;
  responseText = '{}';
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: FormData | null = null;
  onload?: () => void;
  onerror?: () => void;
  upload = { onprogress: undefined as ((event: ProgressEvent) => void) | undefined };

  constructor() {
    FakeXhr.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }

  send(body: FormData) {
    this.body = body;
    if (FakeXhr.mode === 'error') {
      setTimeout(() => this.onerror?.(), 0);
      return;
    }
    this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 } as ProgressEvent);
    this.upload.onprogress?.({ lengthComputable: true, loaded: 10, total: 10 } as ProgressEvent);
    setTimeout(() => this.onload?.(), 0);
  }
}

const photo = { uri: 'file:///tmp/photo.jpg', mimeType: 'image/jpeg' as const, size: 1024 };

beforeEach(() => {
  FakeXhr.instances = [];
  FakeXhr.mode = 'load';
  configureHttp({ getToken: () => 'test-token', onUnauthorized: jest.fn() });
  (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;
});

describe('uploadEvidence', () => {
  it('posts the photo with the session token and reports progress', async () => {
    const progress: number[] = [];
    const evidence = { id: 'e1', url: 'https://storage.test/x.jpg' };
    FakeXhr.instances = [];

    const promise = uploadEvidence('task-1', photo, (value) => progress.push(value));
    const request = FakeXhr.instances[0]!;
    request.responseText = JSON.stringify(evidence);

    await expect(promise).resolves.toEqual(evidence);
    expect(request.method).toBe('POST');
    expect(request.url).toContain('/tasks/task-1/evidence');
    expect(request.headers.Authorization).toBe('Bearer test-token');
    expect(progress).toEqual([0.5, 1]);
  });

  it('rejects a photo above the size limit before sending anything', async () => {
    const oversized = { ...photo, size: MAX_EVIDENCE_BYTES + 1 };

    await expect(uploadEvidence('task-1', oversized)).rejects.toMatchObject({
      code: 'INVALID_FILE',
      message: PHOTO_TOO_LARGE_MESSAGE,
    });
    expect(FakeXhr.instances).toHaveLength(0);
  });

  it('surfaces the server error message', async () => {
    const promise = uploadEvidence('task-1', photo);
    const request = FakeXhr.instances[0]!;
    request.status = 409;
    request.responseText = JSON.stringify({
      error: { code: 'INVALID_STATUS_TRANSITION', message: 'This task can no longer be updated.' },
    });

    await expect(promise).rejects.toMatchObject({
      code: 'INVALID_STATUS_TRANSITION',
      message: 'This task can no longer be updated.',
      status: 409,
    });
  });

  it('reports a connection failure in plain words', async () => {
    FakeXhr.mode = 'error';

    const error = await uploadEvidence('task-1', photo).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe(
      "Couldn't connect. Check your connection and try again.",
    );
  });
});
