import { formatTime } from '@renewals/shared';
import { useIsOnline } from '../lib/online';
import { Chip } from './parts';

/** "אין חיבור — עודכן {time}" offline; sync state online. */
export function StatusChip({ updatedAt, fetching }: { updatedAt: number; fetching: boolean }) {
  const online = useIsOnline();
  const time = updatedAt ? formatTime(new Date(updatedAt)) : '—';
  if (!online) return <Chip icon="wifiOff" tone="warn" text={`אין חיבור — עודכן ${time}`} />;
  if (fetching) return <Chip icon="refresh" text="מתעדכן…" />;
  return <Chip icon="check" text={`מעודכן ${time}`} />;
}
