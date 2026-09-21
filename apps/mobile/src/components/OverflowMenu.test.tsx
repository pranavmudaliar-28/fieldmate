import { render, screen, userEvent } from '@testing-library/react-native';
import { OverflowMenu, type OverflowAction } from './OverflowMenu';

function actions(overrides: Partial<OverflowAction> = {}): OverflowAction[] {
  return [
    { label: 'Edit task', icon: 'create-outline', onPress: jest.fn(), testID: 'action-edit' },
    {
      label: 'Cancel task',
      icon: 'ban-outline',
      destructive: true,
      onPress: jest.fn(),
      testID: 'action-cancel',
      ...overrides,
    },
  ];
}

describe('OverflowMenu', () => {
  it('shows nothing until it is opened', async () => {
    await render(<OverflowMenu visible={false} onClose={jest.fn()} actions={actions()} />);
    expect(screen.queryByText('Edit task')).toBeNull();
  });

  it('lists its actions', async () => {
    await render(<OverflowMenu visible onClose={jest.fn()} actions={actions()} />);

    expect(screen.getByText('Edit task')).toBeTruthy();
    expect(screen.getByText('Cancel task')).toBeTruthy();
  });

  it('closes before running the action, so the screen is not left covered', async () => {
    const onClose = jest.fn();
    const items = actions();
    await render(<OverflowMenu visible onClose={onClose} actions={items} />);

    await userEvent.setup().press(screen.getByTestId('action-edit'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(items[0]?.onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps a blocked action visible and explains why', async () => {
    const onPress = jest.fn();
    const items = actions({
      disabled: true,
      disabledReason: 'This task was already completed.',
      onPress,
    });
    await render(<OverflowMenu visible onClose={jest.fn()} actions={items} />);

    const blocked = screen.getByTestId('action-cancel');
    expect(blocked).toBeDisabled();
    expect(blocked.props.accessibilityHint).toBe('This task was already completed.');

    await userEvent.setup().press(blocked);
    expect(onPress).not.toHaveBeenCalled();
  });
});
