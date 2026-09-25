/**
 * The single list of service types. Adding a type means adding one entry here
 * (id, Hebrew name, icon). Nothing else changes: the database column is free
 * text, the API validates against this list and the app renders from it.
 *
 * Icons are 24×24 stroke paths drawn with `react-native-svg`.
 */
export interface ServiceTypeDef {
  id: string;
  name: string;
  /** SVG path `d` strings, stroke-only, 24×24 view box. */
  icon: readonly string[];
  /** Default cycle when adding a service of this type. */
  defaultCycle: 'monthly' | 'yearly';
}

export const SERVICE_TYPES = [
  {
    id: 'microsoft365',
    name: 'Microsoft 365',
    icon: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
    defaultCycle: 'yearly',
  },
  {
    id: 'antivirus',
    name: 'אנטי וירוס',
    icon: ['M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z', 'M9 12l2 2 4-4'],
    defaultCycle: 'yearly',
  },
  {
    id: 'domain',
    name: 'דומיין',
    icon: [
      'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z',
      'M3.5 9h17',
      'M3.5 15h17',
      'M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9',
      'M12 3c-2.4 2.6-3.6 5.6-3.6 9s1.2 6.4 3.6 9',
    ],
    defaultCycle: 'yearly',
  },
  {
    id: 'hosting',
    name: 'אחסון אתר',
    icon: [
      'M5 4h14a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
      'M5 14h14a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z',
      'M8 7h.01',
      'M8 17h.01',
    ],
    defaultCycle: 'yearly',
  },
  {
    id: 'backup',
    name: 'גיבוי',
    icon: [
      'M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10.5a3.75 3.75 0 0 1-.5 7.5',
      'M12 20v-8',
      'M9 15l3-3 3 3',
    ],
    defaultCycle: 'monthly',
  },
  {
    id: 'other',
    name: 'אחר',
    icon: ['M21 8l-9-5-9 5 9 5 9-5z', 'M3 8v8l9 5 9-5V8', 'M12 13v8'],
    defaultCycle: 'yearly',
  },
] as const satisfies readonly ServiceTypeDef[];

export type ServiceType = string;

const byId = new Map<string, ServiceTypeDef>(SERVICE_TYPES.map((t) => [t.id, t]));

export function isServiceType(value: unknown): value is ServiceType {
  return typeof value === 'string' && byId.has(value);
}

/** The type definition; unknown ids fall back to "other" so old data never crashes. */
export function serviceTypeDef(id: string): ServiceTypeDef {
  return byId.get(id) ?? byId.get('other')!;
}
