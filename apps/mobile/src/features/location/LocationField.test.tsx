import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { LocationField, type LocationValue } from './LocationField';
import type { LocationProvider, PlaceSuggestion } from './provider';
import { setLocationProvider } from './useAddressSearch';

/**
 * Stands in for the web views. The preview is still; the full-screen picker is
 * where a point is chosen, so a test reports one through its confirm.
 */
let reportMove: ((point: { latitude: number; longitude: number }) => void) | null = null;
jest.mock('./MapPicker', () => {
  const { Pressable, View } = jest.requireActual('react-native');
  return {
    MapPreview: (props: { testID?: string; onPress: () => void }) => (
      <Pressable testID={props.testID} onPress={props.onPress} accessibilityRole="button" />
    ),
    MapPickerModal: (props: {
      visible: boolean;
      testID?: string;
      onConfirm: (p: { latitude: number; longitude: number }) => void;
    }) => {
      reportMove = props.onConfirm;
      return props.visible ? <View testID={props.testID} /> : null;
    },
  };
});

const search = jest.fn<Promise<PlaceSuggestion[]>, [string]>();
const reverse = jest.fn<Promise<string | null>, [number, number]>();
const provider: LocationProvider = {
  name: 'test',
  search: (query) => search(query),
  reverse: (lat, lng) => reverse(lat, lng),
};

const SUGGESTION: PlaceSuggestion = {
  id: 'p1',
  address: 'Connaught Place, New Delhi, India',
  primary: 'Connaught Place',
  secondary: 'New Delhi, India',
  latitude: 28.631769,
  longitude: 77.21938,
};

const EMPTY: LocationValue = {
  address: '',
  addressDetails: null,
  latitude: null,
  longitude: null,
};

/** The real form holds this state, so the field is exercised the same way here. */
function Harness({ initial = EMPTY }: { initial?: LocationValue }) {
  const [value, setValue] = useState(initial);
  return <LocationField value={value} onChange={setValue} />;
}

beforeEach(() => {
  jest.clearAllMocks();
  reportMove = null;
  setLocationProvider(provider);
  search.mockResolvedValue([SUGGESTION]);
  reverse.mockResolvedValue('Outer Circle, New Delhi, 110001, India');
});

async function pickSuggestion(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId('address-search'), 'connaught');
  await waitFor(() => expect(screen.getByTestId(`suggestion-${SUGGESTION.id}`)).toBeTruthy());
  await user.press(screen.getByTestId(`suggestion-${SUGGESTION.id}`));
  await waitFor(() => expect(screen.getByTestId('map-picker')).toBeTruthy());
}

describe('LocationField', () => {
  it('opens on the search box when there is no address yet', async () => {
    await render(<Harness />);
    expect(screen.getByTestId('address-search')).toBeTruthy();
    expect(screen.getByTestId('task-address').props.value).toBe('');
  });

  it('starts closed for a task that already has an address', async () => {
    await render(<Harness initial={{ ...EMPTY, address: '14 Harbour Rd' }} />);
    expect(screen.queryByTestId('address-search')).toBeNull();
    expect(screen.getByTestId('open-search')).toBeTruthy();
  });

  it('refreshes the address after the pin is dragged', async () => {
    const user = userEvent.setup();
    await render(<Harness />);
    await pickSuggestion(user);

    reportMove?.({ latitude: 28.6271, longitude: 77.2166 });

    await waitFor(() =>
      expect(screen.getByTestId('task-address').props.value).toBe(
        'Outer Circle, New Delhi, 110001, India',
      ),
    );
    expect(screen.getByText(/Pin: 28.6271, 77.2166/)).toBeTruthy();
  });

  it('keeps the address, and says so, when the pin moves but the lookup fails', async () => {
    const user = userEvent.setup();
    await render(<Harness />);
    await pickSuggestion(user);

    reverse.mockRejectedValue(new Error('offline'));
    reportMove?.({ latitude: 28.6271, longitude: 77.2166 });

    await waitFor(() => expect(screen.getByText(/could not be refreshed/)).toBeTruthy());
    expect(screen.getByTestId('task-address').props.value).toBe(SUGGESTION.address);
    // The pin itself still moved, so the worker gets the corrected spot.
    expect(screen.getByText(/Pin: 28.6271, 77.2166/)).toBeTruthy();
  });

  it('ignores a slow lookup once the pin has moved again', async () => {
    const user = userEvent.setup();
    await render(<Harness />);
    await pickSuggestion(user);

    let finishFirst: (address: string) => void = () => {};
    reverse.mockReturnValueOnce(
      new Promise<string | null>((resolve) => {
        finishFirst = resolve;
      }),
    );
    reverse.mockResolvedValueOnce('Second drag address');

    reportMove?.({ latitude: 28.1, longitude: 77.1 });
    reportMove?.({ latitude: 28.2, longitude: 77.2 });

    await waitFor(() =>
      expect(screen.getByTestId('task-address').props.value).toBe('Second drag address'),
    );

    finishFirst('First drag address');
    await waitFor(() => expect(screen.getByText(/Pin: 28.2, 77.2/)).toBeTruthy());
    expect(screen.getByTestId('task-address').props.value).toBe('Second drag address');
  });

  it('keeps details typed while the lookup was in flight', async () => {
    const user = userEvent.setup();
    await render(<Harness />);
    await pickSuggestion(user);

    let finish: (address: string) => void = () => {};
    reverse.mockReturnValueOnce(
      new Promise<string | null>((resolve) => {
        finish = resolve;
      }),
    );

    reportMove?.({ latitude: 28.1, longitude: 77.1 });
    await user.type(screen.getByTestId('task-address-details'), 'Gate 4');

    finish('Refreshed address');

    await waitFor(() =>
      expect(screen.getByTestId('task-address').props.value).toBe('Refreshed address'),
    );
    expect(screen.getByTestId('task-address-details').props.value).toBe('Gate 4');
  });

  /**
   * Dragging a marker inside the form's scroll view meant the form scrolled
   * instead. The map is now still here and the pin is placed full-screen.
   */
  it('opens the full-screen map from the preview', async () => {
    const user = userEvent.setup();
    await render(<Harness />);
    await pickSuggestion(user);

    expect(screen.queryByTestId('map-picker-modal')).toBeNull();

    await user.press(screen.getByTestId('map-picker'));
    expect(screen.getByTestId('map-picker-modal')).toBeTruthy();
  });

  it('removes the pin without touching the address', async () => {
    const user = userEvent.setup();
    await render(<Harness />);
    await pickSuggestion(user);

    await user.press(screen.getByTestId('remove-pin'));

    expect(screen.queryByTestId('map-picker')).toBeNull();
    expect(screen.getByTestId('task-address').props.value).toBe(SUGGESTION.address);
    expect(screen.getByText(/No map pin yet/)).toBeTruthy();
  });

  it('can reopen search and keep the address already chosen', async () => {
    const user = userEvent.setup();
    await render(<Harness />);
    await pickSuggestion(user);

    await user.press(screen.getByTestId('open-search'));
    expect(screen.getByTestId('address-search')).toBeTruthy();

    await user.press(screen.getByTestId('close-search'));
    expect(screen.getByTestId('task-address').props.value).toBe(SUGGESTION.address);
  });
});
