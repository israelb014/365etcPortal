import {
  agorotToInput,
  CYCLE_NAMES,
  defaultRenewalDate,
  formatDate,
  fromStoredDate,
  isValidDateOnly,
  israelDate,
  parseMoney,
  SERVICE_TYPES,
  serviceTypeDef,
  type Cycle,
  type Service,
} from '@renewals/shared';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ServiceBody } from '../lib/hooks';
import { Button } from './Button';
import { TextField, Segmented } from './fields';
import { Icon, ServiceIcon } from './Icon';
import { Press } from './Press';
import { colors, fonts, radius, space, type } from './theme';

/** "dd/MM/yyyy" (also d.m.yyyy) → "YYYY-MM-DD", or null. */
export function parseDateInput(input: string): string | null {
  const m = /^\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s*$/.exec(input);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return isValidDateOnly(iso) ? iso : null;
}

interface Props {
  clientId: number;
  initial?: Service;
  saving: boolean;
  canMutate: boolean;
  error?: string | null;
  onSave: (body: ServiceBody) => void;
}

export function ServiceForm({ clientId, initial, saving, canMutate, error, onSave }: Props) {
  const today = israelDate(new Date());
  const [serviceType, setServiceType] = useState<string | null>(initial?.type ?? null);
  const [cycle, setCycle] = useState<Cycle>(initial?.cycle ?? 'yearly');
  const [date, setDate] = useState(formatDate(initial ? fromStoredDate(initial.renewal_date) : defaultRenewalDate(today, 'yearly')));
  const [dateTouched, setDateTouched] = useState(Boolean(initial));
  const [price, setPrice] = useState(initial ? agorotToInput(initial.price_agorot) : '');
  const [more, setMore] = useState(Boolean(initial));
  const [cost, setCost] = useState(initial ? agorotToInput(initial.cost_agorot) : '');
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [label, setLabel] = useState(initial?.label ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [showErrors, setShowErrors] = useState(false);

  const changeCycle = (next: Cycle) => {
    setCycle(next);
    if (!dateTouched) setDate(formatDate(defaultRenewalDate(today, next)));
  };

  const chooseType = (id: string) => {
    setServiceType(id);
    if (!initial && !dateTouched) changeCycle(serviceTypeDef(id).defaultCycle);
  };

  const isoDate = parseDateInput(date);
  const priceAgorot = price.trim() === '' ? 0 : parseMoney(price);
  const costAgorot = cost.trim() === '' ? 0 : parseMoney(cost);
  const qty = Number.parseInt(quantity, 10);
  const valid =
    serviceType !== null && isoDate !== null && priceAgorot !== null && costAgorot !== null && qty >= 1;

  const save = () => {
    setShowErrors(true);
    if (!valid || !serviceType || !isoDate) return;
    onSave({
      client_id: clientId,
      type: serviceType,
      renewal_date: isoDate,
      price_agorot: priceAgorot ?? 0,
      cost_agorot: costAgorot ?? 0,
      quantity: qty,
      cycle,
      label: label.trim() || null,
      note: note.trim() || null,
    });
  };

  return (
    <View>
      <Text style={[type.label, { marginBottom: space.sm }]}>סוג השירות</Text>
      <View style={styles.grid}>
        {SERVICE_TYPES.map((t) => {
          const active = t.id === serviceType;
          return (
            <Press
              key={t.id}
              onPress={() => chooseType(t.id)}
              accessibilityRole="button"
              accessibilityLabel={t.name}
              accessibilityState={{ selected: active }}
              style={[styles.tile, active && styles.tileActive]}
            >
              <ServiceIcon type={t.id} size={30} color={active ? colors.accent : colors.text} />
              <Text style={[styles.tileText, active && { color: colors.accent }]} numberOfLines={1}>
                {t.name}
              </Text>
            </Press>
          );
        })}
      </View>

      {serviceType ? (
        <View style={{ marginTop: space.xl }}>
          <TextField
            label="תאריך חידוש"
            value={date}
            onChangeText={(v) => {
              setDate(v);
              setDateTouched(true);
            }}
            placeholder="dd/MM/yyyy"
            keyboardType="numbers-and-punctuation"
            error={showErrors && !isoDate ? 'תאריך לא תקין (למשל 01/10/2027)' : null}
            suffix={<Icon name="calendar" size={18} color={colors.muted} />}
          />
          <TextField
            label="מחיר ללקוח (₪)"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="0"
            error={showErrors && priceAgorot === null ? 'מחיר לא תקין' : null}
          />

          <Press
            onPress={() => setMore(!more)}
            accessibilityRole="button"
            accessibilityState={{ expanded: more }}
            style={styles.moreToggle}
          >
            <Text style={styles.moreText}>עוד פרטים</Text>
            <View style={{ transform: [{ rotate: more ? '180deg' : '0deg' }] }}>
              <Icon name="chevronDown" size={18} color={colors.accent} />
            </View>
          </Press>

          {more ? (
            <View>
              <Segmented
                label="מחזור חיוב"
                value={cycle}
                onChange={changeCycle}
                options={(['monthly', 'yearly', 'once'] as const).map((c) => ({ value: c, label: CYCLE_NAMES[c] }))}
              />
              <TextField
                label="עלות לי (₪)"
                value={cost}
                onChangeText={setCost}
                keyboardType="decimal-pad"
                placeholder="0"
                error={showErrors && costAgorot === null ? 'עלות לא תקינה' : null}
              />
              <TextField
                label="כמות"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="number-pad"
                error={showErrors && !(qty >= 1) ? 'כמות לא תקינה' : null}
              />
              <TextField
                label="שם / פירוט"
                value={label}
                onChangeText={setLabel}
                placeholder="למשל ESET או example.co.il"
                maxLength={120}
              />
              <TextField label="הערה" value={note} onChangeText={setNote} multiline maxLength={2000} />
            </View>
          ) : null}

          {error ? <Text style={[type.label, { color: colors.unpaid, marginBottom: space.md }]}>{error}</Text> : null}
          <Button title="שמור" big onPress={save} loading={saving} disabled={!canMutate} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    width: '31.5%',
    flexGrow: 1,
    aspectRatio: 1.05,
    backgroundColor: colors.card,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.sm,
  },
  tileActive: { borderColor: colors.accent, backgroundColor: colors.pendingBg },
  tileText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  moreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    alignSelf: 'flex-start',
    marginBottom: space.md,
  },
  moreText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.accent },
});
