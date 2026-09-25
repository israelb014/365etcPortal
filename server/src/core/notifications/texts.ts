import { formatDate } from '@renewals/shared';

/** Notification texts: Hebrew, short, no emoji, no technical words. */
export interface Text {
  title: string;
  body: string;
}

export const texts = {
  renewalSoon(days: number, client: string, service: string): Text {
    const title = days <= 0 ? 'חידוש היום' : days === 1 ? 'חידוש מחר' : `חידוש בעוד ${days} ימים`;
    return { title, body: `${client} — ${service}` };
  },
  notPaid(client: string, service: string, renewalDate: string): Text {
    return { title: `${client} לא שילם`, body: `${service} — מאז ${formatDate(renewalDate)}` };
  },
  licensesBought(total: number, free: number): Text {
    return { title: 'נקנה רישיון', body: `יש עכשיו ${total} רישיונות, ${free} פנויים` };
  },
  licensesReduced(total: number): Text {
    return { title: 'הוסר רישיון מהמנוי', body: `נשארו ${total} רישיונות` };
  },
  subscriptionWarning(): Text {
    return { title: 'מנוי מיקרוסופט פג', body: 'יש עוד זמן לחדש לפני השבתה' };
  },
  subscriptionSuspended(): Text {
    return { title: 'מנוי מיקרוסופט הושבת', body: 'הלקוחות לא יכולים לעבוד. צריך לחדש עכשיו' };
  },
  subscriptionDeleted(product: string): Text {
    return { title: 'מנוי מיקרוסופט נמחק', body: product };
  },
  subscriptionEnabled(product: string): Text {
    return { title: 'מנוי מיקרוסופט פעיל שוב', body: product };
  },
  licenseAssigned(client: string): Text {
    return { title: 'רישיון הוקצה', body: client };
  },
  licenseRemoved(client: string): Text {
    return { title: 'רישיון הוסר', body: `${client} — הרישיון פנוי עכשיו` };
  },
  newUser(): Text {
    return { title: 'משתמש חדש', body: 'למי הוא שייך?' };
  },
  microsoftFailing(): Text {
    return { title: 'יש בעיה בחיבור למיקרוסופט', body: 'עדכוני הרישיונות לא מגיעים. כדאי לבדוק בהגדרות' };
  },
  microsoftRecovered(): Text {
    return { title: 'החיבור למיקרוסופט חזר לעבוד', body: 'עדכוני הרישיונות מגיעים שוב' };
  },
  secretExpiring(days: number): Text {
    const when = days <= 1 ? 'מחר' : `בעוד ${days} ימים`;
    return { title: `החיבור למיקרוסופט ייפסק ${when}`, body: 'צריך לחדש את המפתח לפי המדריך' };
  },
  systemError(): Text {
    return { title: 'תקלה במערכת', body: 'חלק מהבדיקות האוטומטיות לא רצו. ננסה שוב בעוד רבע שעה' };
  },
  summary(count: number, lines: string[]): Text {
    return { title: `נאספו ${count} עדכונים`, body: lines.slice(0, 5).join('\n') };
  },
  test(): Text {
    return { title: 'התראת בדיקה', body: 'ההתראות מגיעות לטלפון' };
  },
};
