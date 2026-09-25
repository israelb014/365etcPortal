# מדריך הקמה — מערכת החידושים

המדריך בנוי צעד אחרי צעד. בכל צעד יש פעולה אחת. הפקודות מופיעות במסגרת אפורה: מעתיקים אותן כמו שהן ומדביקים בחלון הפקודות (Terminal).

**מה צריך לפני שמתחילים:**

- מחשב (Windows או Mac).
- הדומיין שלך (לדוגמה `renewals.example.com`, או דומיין משנה של האתר שלך).
- כתובת ה־Gmail שלך.
- טלפון Android.

**בכל המדריך:**

- במקום `renewals.example.com` כותבים את הכתובת שבחרת למערכת.
- במקום `you@gmail.com` כותבים את כתובת ה־Gmail שלך.

---

## 0. הכנת המחשב (פעם אחת)

1. נכנסים ל־https://nodejs.org ומורידים את גרסת **LTS** (22 ומעלה).
2. מתקינים את הקובץ שירד (Next עד הסוף).
3. נכנסים ל־https://git-scm.com/downloads ומתקינים את Git (Next עד הסוף).
4. פותחים חלון פקודות: ב־Windows לוחצים על מקש Windows, מקלידים `Terminal` ולוחצים Enter. ב־Mac לוחצים על Cmd+רווח, מקלידים `Terminal` ולוחצים Enter.
5. מורידים את הקוד:
   ```
   git clone https://github.com/israelb014/365etcPortal.git
   ```
6. נכנסים לתיקייה:
   ```
   cd 365etcPortal
   ```
7. מתקינים את כל מה שהקוד צריך (לוקח כמה דקות):
   ```
   npm install
   ```

> **חשוב:** כל הפקודות בהמשך מריצים מתוך התיקייה `365etcPortal`. אם סגרת את החלון, פותחים חלון חדש ומריצים שוב `cd 365etcPortal`.

---

## 1. Cloudflare: חשבון, דומיין ומסד נתונים

1. נכנסים ל־https://dash.cloudflare.com/sign-up ופותחים חשבון חינמי.
2. בלוח הבקרה לוחצים **Add a domain** (או **Onboard a domain**).
3. מקלידים את הדומיין הראשי שלך (לדוגמה `example.com`) ולוחצים **Continue**.
4. בוחרים בתוכנית **Free** ולוחצים **Continue**.
5. Cloudflare מציג שתי כתובות **Nameservers**. מעתיקים את שתיהן.
6. נכנסים לאתר שבו קנית את הדומיין, ובהגדרות הדומיין מחליפים את ה־Nameservers לשתי הכתובות שהעתקת.
7. חוזרים ל־Cloudflare ולוחצים **Check nameservers**. המעבר יכול לקחת עד יום. כשהוא מסתיים מגיע מייל.
8. מתחברים ל־Cloudflare מחלון הפקודות (נפתח דפדפן, לוחצים שם **Allow**):
   ```
   npx wrangler login
   ```
9. יוצרים את מסד הנתונים:
   ```
   npx wrangler d1 create renewals
   ```
10. בפלט של הפקודה מופיעה השורה `"database_id": "..."`. מעתיקים את המספר הארוך שבין המירכאות.
11. פותחים בעורך טקסט (למשל Notepad) את הקובץ `server/wrangler.jsonc`.
12. בשורה `"database_id"` מחליפים את `00000000-0000-0000-0000-000000000000` במספר שהעתקת.
13. באותו קובץ, בשורה `"APP_URL"`, מחליפים את `https://renewals.example.com` בכתובת שלך (מתחילה ב־`https://`, בלי `/` בסוף). שומרים את הקובץ.
14. מפעילים את מבנה הטבלאות במסד הנתונים:
    ```
    npm run migrate:remote -w server
    ```
    כשהמערכת שואלת `Ok to proceed?` מקלידים `y` ולוחצים Enter.

---

## 2. סודות, העלאה לאוויר וחיבור הדומיין

בכל פקודת `secret put` המערכת מבקשת ערך: מדביקים אותו ולוחצים Enter.

1. נכנסים לתיקיית השרת:
   ```
   cd server
   ```
2. שומרים את כתובת ה־Gmail שלך, היחידה שתוכל להיכנס:
   ```
   npx wrangler secret put OWNER_EMAIL
   ```
3. יוצרים מפתח אקראי ומעתיקים את התוצאה:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. שומרים אותו כמפתח ההתחברות:
   ```
   npx wrangler secret put SESSION_SECRET
   ```
5. חוזרים לתיקייה הראשית:
   ```
   cd ..
   ```
6. מעלים את המערכת לאוויר:
   ```
   npm run deploy
   ```
7. ב־Cloudflare, בתפריט הצד, לוחצים **Workers & Pages** ואז על **renewals**.
8. לוחצים על הלשונית **Settings**, ואז על **Domains & Routes**, ואז על **+ Add**.
9. בוחרים **Custom domain**, מקלידים את הכתובת שלך (לדוגמה `renewals.example.com`) ולוחצים **Add domain**.
10. אחרי כמה דקות נכנסים לכתובת בדפדפן. אמור להופיע מסך "חידושים" עם כפתור הכניסה. הכניסה תעבוד אחרי שלב 3.

---

## 3. כניסה עם Google (אתר + אפליקציה)

**3א. מסך ההסכמה**

1. נכנסים ל־https://console.cloud.google.com.
2. בראש הדף לוחצים על בורר הפרויקטים ואז **New project**.
3. נותנים שם (לדוגמה `renewals`) ולוחצים **Create**.
4. בתפריט הצד לוחצים **APIs & Services**, ואז **OAuth consent screen** (או **Google Auth Platform**). לוחצים **Get started**.
5. ממלאים **App name** (`חידושים`) ובוחרים את המייל שלך ב־**User support email**. לוחצים **Next**.
6. ב־**Audience** בוחרים **External** ולוחצים **Next**.
7. ממלאים שוב את המייל שלך, לוחצים **Next**, מסמנים הסכמה ולוחצים **Create**.
8. בתפריט **Audience** לוחצים **+ Add users**, מוסיפים את המייל שלך ולוחצים **Save**.

**3ב. כניסה מהאתר**

9. בתפריט לוחצים **Clients** ואז **+ Create client**.
10. ב־**Application type** בוחרים **Web application**.
11. תחת **Authorized JavaScript origins** לוחצים **+ Add URI** ומקלידים `https://renewals.example.com`.
12. תחת **Authorized redirect URIs** לוחצים **+ Add URI** ומקלידים `https://renewals.example.com/auth/google/callback`.
13. לוחצים **Create**. בחלון שנפתח מעתיקים את **Client ID** ואת **Client secret**.
14. בחלון הפקודות, מתוך `365etcPortal`, נכנסים לתיקיית השרת: `cd server`.
15. שומרים את ה־Client ID:
    ```
    npx wrangler secret put GOOGLE_WEB_CLIENT_ID
    ```
16. שומרים את ה־Client secret:
    ```
    npx wrangler secret put GOOGLE_WEB_CLIENT_SECRET
    ```
17. חוזרים לתיקייה הראשית: `cd ..`.

**3ג. מפתח החתימה של האפליקציה (SHA-1)**

18. פותחים חשבון חינמי ב־https://expo.dev/signup.
19. נכנסים לתיקיית האפליקציה: `cd app`.
20. מתחברים ל־Expo:
    ```
    npx eas-cli@24.8.0 login
    ```
21. יוצרים את הפרויקט ב־Expo:
    ```
    npx eas-cli@24.8.0 init
    ```
    בסוף מופיע **project ID** (מספר ארוך עם מקפים). מעתיקים אותו.
22. פותחים את `app/eas.json` ומדביקים את ה־project ID בשורה `"EAS_PROJECT_ID"`, בין המירכאות.
23. באותו קובץ, בשורה `"APP_URL"`, כותבים את הכתובת שלך. שומרים.
24. יוצרים את מפתח החתימה:
    ```
    npx eas-cli@24.8.0 credentials -p android
    ```
    בוחרים **production**, אחר כך **Keystore**, אחר כך **Set up a new keystore** ואשרו.
25. באותו מסך מופיעה השורה **SHA1 Fingerprint**. מעתיקים אותה ויוצאים (Exit).

**3ד. כניסה מהאפליקציה**

26. חוזרים ל־Google Cloud, לוחצים **Clients** ואז **+ Create client**.
27. ב־**Application type** בוחרים **Android**.
28. ב־**Package name** מקלידים `com.ibfix.renewals`.
29. ב־**SHA-1 certificate fingerprint** מדביקים את ה־SHA1 שהעתקת.
30. פותחים את **Advanced settings**, מסמנים **Enable custom URI scheme** ולוחצים **Create**.
31. מעתיקים את **Client ID** של לקוח ה־Android.
32. ב־`app/eas.json` מדביקים אותו בשורה `"GOOGLE_ANDROID_CLIENT_ID"`, ואת ה־Client ID של האתר (משלב 13) בשורה `"GOOGLE_WEB_CLIENT_ID"`. שומרים.
33. בחלון הפקודות עוברים לתיקיית השרת: `cd ../server`.
34. שומרים את ה־Client ID של ה־Android:
    ```
    npx wrangler secret put GOOGLE_ANDROID_CLIENT_ID
    ```
35. חוזרים לתיקייה הראשית ומעלים שוב:
    ```
    cd ..
    npm run deploy
    ```
36. בודקים: נכנסים לכתובת שלך ולוחצים "כניסה עם Google". עם המייל שלך נכנסים. עם כל מייל אחר מופיע "אין הרשאה".

---

## 4. חיבור ל־Microsoft 365 (לא חובה)

1. נכנסים ל־https://portal.azure.com עם חשבון מנהל של הארגון שלך.
2. בשורת החיפוש מקלידים **App registrations** ולוחצים על התוצאה.
3. לוחצים **+ New registration**.
4. ב־**Name** מקלידים `Renewals`.
5. ב־**Supported account types** בוחרים **Accounts in this organizational directory only (Single tenant)** ולוחצים **Register**.
6. במסך שנפתח מעתיקים את **Application (client) ID** ואת **Directory (tenant) ID**.
7. בתפריט הצד לוחצים **API permissions** ואז **+ Add a permission**.
8. לוחצים **Microsoft Graph** ואז **Application permissions**.
9. מחפשים `Directory.Read.All`, מסמנים אותו ולוחצים **Add permissions**.
10. לוחצים **Grant admin consent for ...** ואז **Yes**. ליד ההרשאה אמור להופיע סימן ירוק.
11. בתפריט הצד לוחצים **Certificates & secrets**, ואז **Client secrets**, ואז **+ New client secret**.
12. ב־**Expires** בוחרים **24 months** ולוחצים **Add**.
13. מעתיקים מיד את **Value** (לא את Secret ID). הוא מוצג רק פעם אחת.
14. רושמים את התאריך שבעמודה **Expires**.
15. בחלון הפקודות עוברים לתיקיית השרת: `cd server`.
16. שומרים את ה־tenant:
    ```
    npx wrangler secret put MS_TENANT_ID
    ```
17. שומרים את ה־client:
    ```
    npx wrangler secret put MS_CLIENT_ID
    ```
18. שומרים את ה־Value מצעד 13:
    ```
    npx wrangler secret put MS_CLIENT_SECRET
    ```
19. שומרים את תאריך התפוגה בפורמט `2028-09-25` (שנה-חודש-יום):
    ```
    npx wrangler secret put MS_SECRET_EXPIRES_AT
    ```
20. חוזרים לתיקייה הראשית ומעלים:
    ```
    cd ..
    npm run deploy
    ```
21. במערכת נכנסים ל**הגדרות** ולוחצים **חיבור** תחת Microsoft 365. אמור להופיע "מחובר". החיבור הראשון רק שומר את המצב הקיים ולא שולח התראות.

---

## 5. התראות לטלפון (Firebase)

1. נכנסים ל־https://console.firebase.google.com ולוחצים **Create a project**.
2. נותנים שם (`renewals`), לוחצים **Continue**, מכבים את **Google Analytics** ולוחצים **Create project**.
3. בעמוד הפרויקט לוחצים על סמל ה־Android כדי להוסיף אפליקציה.
4. ב־**Android package name** מקלידים `com.ibfix.renewals` ולוחצים **Register app**.
5. לוחצים **Download google-services.json** ושומרים את הקובץ בתוך התיקייה `365etcPortal/app`.
6. לוחצים **Next** עד הסוף ואז **Continue to console**.
7. בחלון הפקודות, מתוך `365etcPortal/app`, מעלים את הקובץ ל־Expo:
   ```
   npx eas-cli@24.8.0 env:create --scope project --environment production --name GOOGLE_SERVICES_JSON --type file --visibility secret --value ./google-services.json
   ```
8. ב־Firebase לוחצים על גלגל השיניים (למעלה בצד), ואז **Project settings**, ואז הלשונית **Service accounts**.
9. לוחצים **Generate new private key** ואז **Generate key**. יורד קובץ JSON. שומרים אותו במקום בטוח ולא משתפים אותו.
10. נכנסים ל־https://expo.dev, בוחרים את הפרויקט **renewals**, ובתפריט הצד לוחצים **Credentials**.
11. לוחצים **Android** ואז `com.ibfix.renewals`.
12. תחת **FCM V1 service account key** לוחצים **Add a service account key**, בוחרים את קובץ ה־JSON מצעד 9 ולוחצים **Save**.

---

## 6. בניית האפליקציה (APK) והעלאתה

1. בחלון הפקודות, מתוך `365etcPortal`, בונים את האפליקציה (לוקח בערך 15 דקות, רץ בענן של Expo):
   ```
   npm run build:apk
   ```
2. בסוף מופיע קישור לקובץ `.apk`. מורידים אותו למחשב.
3. ב־Cloudflare, בתפריט הצד, לוחצים **R2 Object Storage**. בפעם הראשונה צריך להפעיל את השירות: יש מכסה חינמית, אבל Cloudflare מבקשת אמצעי תשלום.
4. לוחצים **Create bucket**, קוראים לו `renewals-downloads` ולוחצים **Create bucket**.
5. בתוך ה־bucket לוחצים **Upload**, בוחרים את קובץ ה־APK ומשנים את שמו ל־`renewals.apk` לפני ההעלאה.
6. בלשונית **Settings** של ה־bucket, תחת **Public access**, לוחצים **Connect Domain** ומקלידים `downloads.example.com` (דומיין משנה שלך). מאשרים.
7. כתובת ההורדה היא עכשיו `https://downloads.example.com/renewals.apk`. בחלון הפקודות נכנסים לתיקיית השרת (`cd server`) ושומרים אותה:
   ```
   npx wrangler secret put APK_URL
   ```
8. חוזרים לתיקייה הראשית (`cd ..`) ומעלים שוב:
   ```
   npm run deploy
   ```
9. בטלפון פותחים את כתובת ההורדה בכרום, מורידים ולוחצים על הקובץ.
10. אם מופיע "התקנה ממקור לא ידוע", לוחצים **הגדרות**, מאשרים את **Chrome** וחוזרים להתקנה.
11. פותחים את האפליקציה, נכנסים עם Google, מאשרים התראות ולוחצים **פתח הגדרות סוללה**. שם בוחרים **ללא הגבלה** לאפליקציה "חידושים".
12. בודקים: **הגדרות** ← **שלח התראת בדיקה**. תוך כמה שניות אמורה להגיע התראה.

---

## 7. אזהרה: מפתח החתימה

> **אזהרה: תמיד בונים עם אותו מפתח חתימה של EAS. אם המפתח משתנה, אי אפשר להתקין עדכון מעל הגרסה הקיימת.** צריך למחוק את האפליקציה, ואיתה את ההגדרות שבטלפון.

המפתח שמור אצל Expo. גיבוי:

1. בחלון הפקודות נכנסים לתיקייה `365etcPortal/app`.
2. מריצים:
   ```
   npx eas-cli@24.8.0 credentials -p android
   ```
3. בוחרים **production**, אחר כך **Keystore**, אחר כך **Download existing keystore**.
4. יורד קובץ `.jks`, ועל המסך מוצגות שלוש סיסמאות: **Keystore password**, **Key alias**, **Key password**.
5. שומרים את הקובץ ואת שלוש הסיסמאות במנהל סיסמאות (למשל Bitwarden או 1Password).
6. שומרים עותק נוסף של הקובץ במקום נפרד (למשל דיסק און קי בבית).
7. לא מוחקים את הפרויקט ב־expo.dev ולא בוחרים באפשרות "Remove keystore".

---

## 8. חידוש המפתח של מיקרוסופט

המערכת שולחת התראה 30, 7 ויום אחד לפני שהמפתח פג.

1. נכנסים ל־https://portal.azure.com ← **App registrations** ← **Renewals**.
2. לוחצים **Certificates & secrets**, ואז **+ New client secret**, בוחרים **24 months** ולוחצים **Add**.
3. מעתיקים מיד את **Value**.
4. בחלון הפקודות, מתוך `365etcPortal/server`, שומרים את המפתח החדש:
   ```
   npx wrangler secret put MS_CLIENT_SECRET
   ```
5. שומרים את תאריך התפוגה החדש (שנה-חודש-יום):
   ```
   npx wrangler secret put MS_SECRET_EXPIRES_AT
   ```
6. במערכת נכנסים ל**הגדרות** ומוודאים שכתוב "מחובר" ושהשעה של "עודכן" מתקדמת (תוך רבע שעה).
7. חוזרים ל־Azure ומוחקים את המפתח הישן (סמל הפח בשורה שלו).

---

## 9. שחרור עדכון

**עדכון של השרת או של האתר בלבד:**

1. מורידים את הקוד החדש:
   ```
   git pull
   ```
2. מתקינים:
   ```
   npm install
   ```
3. מעלים. הפקודה גם מעדכנת את מבנה מסד הנתונים אם צריך:
   ```
   npm run deploy
   ```

**עדכון של האפליקציה בטלפון:**

4. בקובץ `app/app.config.ts` מעלים את `version` (לדוגמה מ־`1.0.0` ל־`1.1.0`) ואת `versionCode` באחד (לדוגמה מ־`1` ל־`2`). שומרים.
5. בונים:
   ```
   npm run build:apk
   ```
6. מעלים את ה־APK החדש ל־R2 באותו שם (`renewals.apk`), כדי שיחליף את הישן.
7. אם חייבים שכולם יעדכנו: בקובץ `server/wrangler.jsonc` משנים את `MIN_APP_VERSION` לגרסה החדשה ושומרים.
8. מעלים:
   ```
   npm run deploy
   ```
9. בגרסה הישנה יופיע "יש גרסה חדשה" עם כפתור הורדה. ההתקנה מעל הגרסה הקיימת שומרת את הכניסה.

---

## גיבוי ושחזור

- Cloudflare D1 שומר היסטוריה של 30 יום (Time Travel). כדי לשחזר לנקודת זמן, מתוך `365etcPortal/server`:
  ```
  npx wrangler d1 time-travel restore renewals --timestamp=2026-09-25T08:00:00Z
  ```
- בנוסף, **הגדרות** ← **ייצוא כל הנתונים** מוריד קובץ עם כל הנתונים. מומלץ פעם בחודש.
