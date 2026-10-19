import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider, useToast, type ToastAction } from './Toast';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function Trigger({ message, action }: { message: string; action?: ToastAction }) {
  const { showToast } = useToast();
  return (
    <Pressable testID={`show-${message}`} onPress={() => showToast(message, 'success', action)}>
      <Text>{message}</Text>
    </Pressable>
  );
}

async function renderToasts(children: React.ReactNode) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ToastProvider>{children}</ToastProvider>
    </SafeAreaProvider>,
  );
}

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('offers its action and hides once the action is taken', async () => {
    const onPress = jest.fn();
    await renderToasts(<Trigger message="Started" action={{ label: 'Undo', onPress }} />);

    await fireEvent.press(screen.getByTestId('show-Started'));
    await fireEvent.press(screen.getByTestId('toast-action'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('is not cut short by the timer of the toast it replaced', async () => {
    await renderToasts(
      <>
        <Trigger message="First" />
        <Trigger message="Second" />
      </>,
    );

    await fireEvent.press(screen.getByTestId('show-First'));
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    await fireEvent.press(screen.getByTestId('show-Second'));
    // The first toast's 3s timer would have fired here.
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    expect(screen.getByTestId('toast')).toHaveTextContent(/Second/);
  });
});
