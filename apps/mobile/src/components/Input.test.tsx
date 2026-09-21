import { render, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Input } from './Input';

function flatten(style: unknown) {
  return StyleSheet.flatten(style as never) as Record<string, unknown>;
}

describe('Input', () => {
  it('shows its label and accepts typing', async () => {
    const onChangeText = jest.fn();
    await render(<Input label="Title" testID="field" onChangeText={onChangeText} />);

    expect(screen.getByText('Title')).toBeTruthy();
    await userEvent.setup().type(screen.getByTestId('field'), 'Hello');
    expect(onChangeText).toHaveBeenCalled();
  });

  it('marks a required field for screen readers', async () => {
    await render(<Input label="Address" required testID="field" />);
    expect(screen.getByText('Address *')).toBeTruthy();
  });

  /**
   * A caller style used to replace the base style, dropping flex:1 and
   * collapsing multi-line fields so they could not be tapped.
   */
  it('merges a caller style instead of replacing the base one', async () => {
    await render(<Input label="Description" testID="field" style={{ minHeight: 96 }} />);

    const style = flatten(screen.getByTestId('field').props.style);
    expect(style.minHeight).toBe(96);
    expect(style.flex).toBe(1);
  });

  it('keeps a multi-line field tappable across its whole height', async () => {
    const onChangeText = jest.fn();
    await render(
      <Input
        label="Description"
        testID="field"
        multiline
        numberOfLines={4}
        style={{ minHeight: 96 }}
        onChangeText={onChangeText}
      />,
    );

    const style = flatten(screen.getByTestId('field').props.style);
    expect(style.flex).toBe(1);
    expect(style.textAlignVertical).toBe('top');

    await userEvent.setup().type(screen.getByTestId('field'), 'Some detail');
    expect(onChangeText).toHaveBeenCalled();
  });

  it('shows an error instead of the helper text', async () => {
    await render(
      <Input label="Email" helper="We never share it" error="Enter a valid email address." />,
    );

    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.queryByText('We never share it')).toBeNull();
  });

  it('offers a show/hide toggle for passwords', async () => {
    await render(<Input label="Password" secure testID="field" />);

    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(screen.getByTestId('field').props.secureTextEntry).toBe(true);

    await userEvent.setup().press(toggle);
    expect(screen.getByTestId('field').props.secureTextEntry).toBe(false);
  });
});
