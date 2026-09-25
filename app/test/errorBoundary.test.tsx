import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';

let shouldThrow = true;
function Flaky() {
  if (shouldThrow) throw new Error('boom');
  return <Text>עובד</Text>;
}

describe('global error boundary', () => {
  it('shows "משהו השתבש" with "נסה שוב" instead of a white screen', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText('משהו השתבש')).toBeOnTheScreen();
    shouldThrow = false;
    fireEvent.press(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(screen.getByText('עובד')).toBeOnTheScreen();
  });
});
