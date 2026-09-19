import { ApiError, apiRequest, configureHttp } from './http';

const originalFetch = globalThis.fetch;

function mockResponse(status: number, body?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
      if (body === undefined) throw new Error('No body');
      return body;
    },
  } as Response;
}

describe('apiRequest', () => {
  let onUnauthorized: jest.Mock;

  beforeEach(() => {
    onUnauthorized = jest.fn();
    configureHttp({ getToken: () => 'test-token', onUnauthorized });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends the bearer token and returns the parsed body', async () => {
    const fetchMock = jest.fn().mockResolvedValue(mockResponse(200, { id: 'u1' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiRequest('/users/me')).resolves.toEqual({ id: 'u1' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/users/me');
    expect(init.headers.Authorization).toBe('Bearer test-token');
    expect(init.method).toBe('GET');
  });

  it('omits the Authorization header when there is no session', async () => {
    configureHttp({ getToken: () => null, onUnauthorized });
    const fetchMock = jest.fn().mockResolvedValue(mockResponse(200, {}));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await apiRequest('/auth/login', { method: 'POST', body: { email: 'a@b.co' } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.co' });
  });

  it('returns undefined for 204 responses', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(mockResponse(204)) as unknown as typeof fetch;
    await expect(apiRequest('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('turns an API error body into an ApiError', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      mockResponse(401, {
        error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' },
      }),
    ) as unknown as typeof fetch;

    await expect(apiRequest('/auth/login', { method: 'POST' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Incorrect email or password.',
      status: 401,
    });
  });

  it('falls back to a generic message when the server sends no usable body', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(mockResponse(500)) as unknown as typeof fetch;

    await expect(apiRequest('/tasks')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
    });
  });

  it('reports a network failure without technical detail', async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;

    const error = await apiRequest('/tasks').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isNetworkError).toBe(true);
    expect((error as ApiError).message).toBe(
      "Couldn't connect. Check your connection and try again.",
    );
  });

  it('signs the user out on 401', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'nope' } }),
      ) as unknown as typeof fetch;

    await expect(apiRequest('/tasks')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not sign the user out when the caller opts out', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'nope' } }),
      ) as unknown as typeof fetch;

    await expect(apiRequest('/users/me', { ignoreUnauthorized: true })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
