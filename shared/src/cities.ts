/** Israeli cities for the quiet-hours (Shabbat) calculation. */
export interface City {
  name: string;
  lat: number;
  lon: number;
}

export const DEFAULT_CITY = 'רמלה';

export const ISRAEL_CITIES: readonly City[] = [
  { name: 'אבן יהודה', lat: 32.27, lon: 34.887 },
  { name: 'אום אל-פחם', lat: 32.519, lon: 35.153 },
  { name: 'אופקים', lat: 31.314, lon: 34.62 },
  { name: 'אור יהודה', lat: 32.029, lon: 34.857 },
  { name: 'אילת', lat: 29.5577, lon: 34.9519 },
  { name: 'אלעד', lat: 32.052, lon: 34.951 },
  { name: 'אריאל', lat: 32.105, lon: 35.171 },
  { name: 'אשדוד', lat: 31.8014, lon: 34.6435 },
  { name: 'אשקלון', lat: 31.6688, lon: 34.5743 },
  { name: 'באר שבע', lat: 31.252, lon: 34.7915 },
  { name: 'בית שאן', lat: 32.497, lon: 35.497 },
  { name: 'בית שמש', lat: 31.747, lon: 34.9881 },
  { name: 'ביתר עילית', lat: 31.696, lon: 35.117 },
  { name: 'בני ברק', lat: 32.0807, lon: 34.8338 },
  { name: 'בת ים', lat: 32.0132, lon: 34.748 },
  { name: 'גבעתיים', lat: 32.0722, lon: 34.8125 },
  { name: 'גדרה', lat: 31.812, lon: 34.777 },
  { name: 'דימונה', lat: 31.069, lon: 35.033 },
  { name: 'הוד השרון', lat: 32.15, lon: 34.888 },
  { name: 'הרצליה', lat: 32.1624, lon: 34.8447 },
  { name: 'זכרון יעקב', lat: 32.57, lon: 34.954 },
  { name: 'חדרה', lat: 32.434, lon: 34.9196 },
  { name: 'חולון', lat: 32.0158, lon: 34.7874 },
  { name: 'חיפה', lat: 32.794, lon: 34.9896 },
  { name: 'טבריה', lat: 32.7922, lon: 35.5312 },
  { name: 'טירת כרמל', lat: 32.76, lon: 34.971 },
  { name: 'יבנה', lat: 31.8781, lon: 34.739 },
  { name: 'יהוד-מונוסון', lat: 32.033, lon: 34.89 },
  { name: 'יקנעם עילית', lat: 32.659, lon: 35.11 },
  { name: 'ירושלים', lat: 31.7683, lon: 35.2137 },
  { name: 'כפר יונה', lat: 32.317, lon: 34.935 },
  { name: 'כפר סבא', lat: 32.175, lon: 34.907 },
  { name: 'כרמיאל', lat: 32.919, lon: 35.295 },
  { name: 'לוד', lat: 31.951, lon: 34.895 },
  { name: 'מגדל העמק', lat: 32.676, lon: 35.24 },
  { name: 'מודיעין עילית', lat: 31.933, lon: 35.044 },
  { name: 'מודיעין-מכבים-רעות', lat: 31.898, lon: 35.0104 },
  { name: 'מעלה אדומים', lat: 31.777, lon: 35.298 },
  { name: 'נהריה', lat: 33.011, lon: 35.098 },
  { name: 'נס ציונה', lat: 31.9296, lon: 34.7987 },
  { name: 'נצרת', lat: 32.6996, lon: 35.3035 },
  { name: 'נתיבות', lat: 31.421, lon: 34.589 },
  { name: 'נתניה', lat: 32.3215, lon: 34.8532 },
  { name: 'עכו', lat: 32.9281, lon: 35.0818 },
  { name: 'עפולה', lat: 32.6078, lon: 35.2897 },
  { name: 'ערד', lat: 31.261, lon: 35.215 },
  { name: 'פתח תקווה', lat: 32.084, lon: 34.8878 },
  { name: 'צפת', lat: 32.9646, lon: 35.496 },
  { name: 'קצרין', lat: 32.992, lon: 35.691 },
  { name: 'קריית אתא', lat: 32.809, lon: 35.106 },
  { name: 'קריית ביאליק', lat: 32.833, lon: 35.088 },
  { name: 'קריית גת', lat: 31.61, lon: 34.7642 },
  { name: 'קריית ים', lat: 32.849, lon: 35.069 },
  { name: 'קריית מוצקין', lat: 32.837, lon: 35.077 },
  { name: 'קריית מלאכי', lat: 31.731, lon: 34.746 },
  { name: 'קריית שמונה', lat: 33.2073, lon: 35.57 },
  { name: 'ראש העין', lat: 32.0956, lon: 34.9566 },
  { name: 'ראשון לציון', lat: 31.973, lon: 34.7925 },
  { name: 'רחובות', lat: 31.8928, lon: 34.8113 },
  { name: 'רמלה', lat: 31.9275, lon: 34.8625 },
  { name: 'רמת גן', lat: 32.0823, lon: 34.8107 },
  { name: 'רעננה', lat: 32.1848, lon: 34.8713 },
  { name: 'שדרות', lat: 31.525, lon: 34.596 },
  { name: 'שוהם', lat: 31.999, lon: 34.946 },
  { name: 'תל אביב-יפו', lat: 32.0853, lon: 34.7818 },
];

export function findCity(name: string): City {
  return (
    ISRAEL_CITIES.find((c) => c.name === name) ??
    ISRAEL_CITIES.find((c) => c.name === DEFAULT_CITY)!
  );
}

/** Case- and dash-insensitive search for the city picker. */
export function searchCities(query: string): City[] {
  const q = normalize(query);
  if (!q) return [...ISRAEL_CITIES];
  return ISRAEL_CITIES.filter((c) => normalize(c.name).includes(q));
}

function normalize(s: string): string {
  return s.replace(/[-\s'"״׳]/g, '').trim();
}
