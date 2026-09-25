import { toStoredDate, type ClientDetail } from '@renewals/shared';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ClientScreen from '../src/app/(app)/client/[id]';
import NewClient from '../src/app/(app)/client/new';
import { keys } from '../src/lib/query';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ id: '1' }),
}));

const fetchMock = jest.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
global.fetch = fetchMock as unknown as typeof fetch;

const detail: ClientDetail = {
  client: { id: 1, name: 'כהן', phone: '050-1234567', note: null, archived_at: null, created_at: '2026-01-01T00:00:00Z' },
  services: [
    {
      id: 7,
      client_id: 1,
      type: 'antivirus',
      label: 'ESET',
      quantity: 1,
      renewal_date: toStoredDate('2020-01-01'), // long overdue → "סמן כשולם" shown
      anchor_day: 1,
      cycle: 'yearly',
      cost_agorot: 0,
      price_agorot: 10000,
      paid_until: null,
      auto_renew: false,
      source: 'manual',
      external_ref: null,
      note: null,
      archived_at: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
  history: [],
};

function wrap(ui: ReactNode, client: QueryClient) {
  return (
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
    >
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </SafeAreaProvider>
  );
}

function cachedClient(): QueryClient {
  const qc = new QueryClient({
    defaultOptions: { queries: { networkMode: 'offlineFirst', retry: false, staleTime: Infinity, gcTime: Infinity } },
  });
  qc.setQueryData(keys.client(1), detail, { updatedAt: new Date('2026-09-25T09:41:00Z').getTime() });
  return qc;
}

afterEach(() => {
  act(() => onlineManager.setOnline(true));
  fetchMock.mockClear();
});

describe('offline mode', () => {
  it('shows the cached client with the offline chip and disables every mutation', async () => {
    act(() => onlineManager.setOnline(false));
    render(wrap(<ClientScreen />, cachedClient()));

    expect(await screen.findByText('כהן')).toBeOnTheScreen();
    expect(screen.getByText(/^אין חיבור — עודכן \d{2}:\d{2}$/)).toBeOnTheScreen();

    const markPaid = screen.getByRole('button', { name: 'סמן כשולם' });
    expect(markPaid).toBeDisabled();
    expect(screen.getByRole('button', { name: 'עריכת לקוח' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'שירות' })).toBeDisabled();

    fireEvent.press(markPaid);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('enables the same buttons when back online', async () => {
    render(wrap(<ClientScreen />, cachedClient()));
    expect(await screen.findByText('כהן')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'סמן כשולם' })).toBeEnabled();
    expect(screen.queryByText(/אין חיבור/)).toBeNull();
  });

  it('blocks saving a new client offline', async () => {
    act(() => onlineManager.setOnline(false));
    render(wrap(<NewClient />, new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })));
    fireEvent.changeText(screen.getByLabelText('שם הלקוח'), 'לקוח חדש');
    const save = screen.getByRole('button', { name: 'שמור' });
    expect(save).toBeDisabled();
    fireEvent.press(save);
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => onlineManager.setOnline(true));
    expect(screen.getByRole('button', { name: 'שמור' })).toBeEnabled();
  });
});
