import { createOsmLocationProvider } from './osm-provider';
import { formatPhotonFeature, type PhotonFeature } from './provider';

const fetchMock = jest.fn<Promise<unknown>, [string, RequestInit | undefined]>();

function photonOk(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

const HARBOUR: PhotonFeature = {
  geometry: { coordinates: [151.20929384, -33.86881122] },
  properties: {
    housenumber: '14',
    street: 'Harbour Road',
    district: 'Docklands',
    city: 'Sydney',
    state: 'New South Wales',
    postcode: '2000',
    country: 'Australia',
  },
};

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('formatPhotonFeature', () => {
  it('joins the parts into one address with a primary and secondary line', () => {
    expect(formatPhotonFeature(HARBOUR)).toEqual({
      address: '14 Harbour Road, Docklands, Sydney, New South Wales, 2000, Australia',
      primary: '14 Harbour Road',
      secondary: 'Docklands, Sydney, New South Wales, 2000, Australia',
    });
  });

  it('leads with the place name and does not repeat a part', () => {
    const { address, primary } = formatPhotonFeature({
      geometry: { coordinates: [72.87, 19.07] },
      properties: { name: 'Andheri', city: 'Andheri', state: 'Maharashtra', country: 'India' },
    });

    expect(primary).toBe('Andheri');
    expect(address).toBe('Andheri, Maharashtra, India');
  });

  it('falls back through city, town and village', () => {
    const { address } = formatPhotonFeature({
      geometry: { coordinates: [0, 0] },
      properties: { street: 'Mill Lane', village: 'Ashwell', country: 'United Kingdom' },
    });

    expect(address).toBe('Mill Lane, Ashwell, United Kingdom');
  });

  it('returns an empty address when there is nothing to show', () => {
    expect(formatPhotonFeature({}).address).toBe('');
  });
});

describe('OSM location provider', () => {
  const provider = createOsmLocationProvider();

  it('does not call the service for a query shorter than three characters', async () => {
    await expect(provider.search('14')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps Photon features to suggestions, with coordinates the right way round', async () => {
    fetchMock.mockReturnValue(photonOk({ features: [HARBOUR] }));

    const [suggestion] = await provider.search('14 Harbour');

    expect(suggestion).toEqual({
      id: '-33.86881122,151.20929384,0',
      address: '14 Harbour Road, Docklands, Sydney, New South Wales, 2000, Australia',
      primary: '14 Harbour Road',
      secondary: 'Docklands, Sydney, New South Wales, 2000, Australia',
      // Photon returns [lon, lat]; six decimals is about 0.1 m.
      latitude: -33.868811,
      longitude: 151.209294,
    });
  });

  it('identifies the app and asks for a short result list', async () => {
    fetchMock.mockReturnValue(photonOk({ features: [] }));

    await provider.search('harbour road');
    const [url, init] = fetchMock.mock.calls[0]!;

    expect(url).toContain('q=harbour%20road');
    expect(url).toContain('limit=6');
    expect((init?.headers as Record<string, string>)['User-Agent']).toContain('FieldMate');
  });

  it('skips features that have no usable coordinates or address', async () => {
    fetchMock.mockReturnValue(
      photonOk({
        features: [
          { properties: { city: 'Nowhere' } },
          { geometry: { coordinates: [1] }, properties: { city: 'Half a point' } },
          { geometry: { coordinates: [1, 2] }, properties: {} },
          HARBOUR,
        ],
      }),
    );

    const suggestions = await provider.search('anything');
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.primary).toBe('14 Harbour Road');
  });

  it('passes the abort signal through', async () => {
    fetchMock.mockReturnValue(photonOk({ features: [] }));
    const controller = new AbortController();

    await provider.search('harbour road', controller.signal);

    expect(fetchMock.mock.calls[0]![1]?.signal).toBe(controller.signal);
  });

  it('rejects when the service answers with an error status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) });

    await expect(provider.search('harbour road')).rejects.toThrow('503');
  });

  it('reverse geocodes a dragged pin', async () => {
    fetchMock.mockReturnValue(photonOk({ features: [HARBOUR] }));

    await expect(provider.reverse(-33.868811, 151.209294)).resolves.toBe(
      '14 Harbour Road, Docklands, Sydney, New South Wales, 2000, Australia',
    );
    expect(fetchMock.mock.calls[0]![0]).toContain('lat=-33.868811&lon=151.209294');
  });

  it('returns null when the pin is somewhere with no address', async () => {
    fetchMock.mockReturnValue(photonOk({ features: [] }));
    await expect(provider.reverse(0, 0)).resolves.toBeNull();
  });
});
