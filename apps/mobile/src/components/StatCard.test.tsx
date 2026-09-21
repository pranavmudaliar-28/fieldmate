import { render, screen, userEvent } from '@testing-library/react-native';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('reads as one sentence for screen readers', async () => {
    await render(<StatCard label="In progress" value={4} testID="stat" />);

    expect(screen.getByTestId('stat').props.accessibilityLabel).toBe('4 In progress');
    expect(screen.getByText('4')).toBeTruthy();
  });

  /**
   * The list endpoints return a page rather than a total, so a count that fills
   * the page is shown as a floor instead of claiming an exact number.
   */
  it('marks a count that ran into the page limit', async () => {
    await render(<StatCard label="Assigned" value={50} capped testID="stat" />);

    expect(screen.getByText('50+')).toBeTruthy();
    expect(screen.getByTestId('stat').props.accessibilityLabel).toBe('50+ Assigned');
  });

  it('is only a button when it leads somewhere', async () => {
    await render(<StatCard label="Rejected" value={2} testID="stat" />);
    expect(screen.queryByRole('button')).toBeNull();

    const onPress = jest.fn();
    await render(<StatCard label="Rejected" value={2} onPress={onPress} testID="stat-link" />);
    await userEvent.setup().press(screen.getByTestId('stat-link'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
