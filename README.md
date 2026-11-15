# סל חכם 🛒

רשימת קניות חכמה עם השוואת מחירים **אמיתיים** בין רשתות השיווק בישראל, מתוך קובצי שקיפות המחירים הרשמיים לפי חוק המזון.
מתעדכנת אוטומטית כל בוקר. React, Tailwind CSS ו-Lucide, מותאמת לנייד, בעברית מלאה (RTL), מצב כהה/בהיר.

כתובת: https://bata2702204-hub.github.io/Shopping-/

## עקרון: אפס המצאות
- כל מוצר שמוצג הוא פריט אמיתי מקובץ PriceFull של רשת: שם, ברקוד, יצרן ומחיר מדף בשקלים.
- ההשוואה בין רשתות נעשית **לפי ברקוד**, כך שמשווים בדיוק את אותו מוצר.
- אם ברקוד לא מופיע בקובץ של רשת – המחיר הוא `null` ובממשק מופיע "לא קיים ברשת". רשת שלא נאספה מופיעה כ"אין מידע".
- פריט שהוקלד כטקסט חופשי ולא נבחר לו מוצר אמיתי נשאר "ללא מחיר" עד שבוחרים לו מוצר.
- אין מחירים משוערים, ממוצעים או סטטיסטיים.

## איך זה עובד
```
GitHub Action (כל יום 06:00 שעון ישראל, או הרצה ידנית)
  └─ scripts/fetch_real_prices.py   מוריד PriceFull של סניף מייצג לכל רשת, מנתח XML, ממזג לפי ברקוד
  └─ scripts/enrich_prices.mjs      מסווג כל מוצר למחלקה בעזרת המסווג של האפליקציה
  └─ npm test && npm run build      → public/real_prices.json + docs/
  └─ commit & push ל-main           → GitHub Pages מתעדכן
```
`public/real_prices.json` כולל `lastUpdated` (זמן קובץ המחירים), ולכל רשת: סטטוס, קוד רשת (ChainId מתוך הקובץ), סניף ושם הקובץ.
אם רשת נכשלת ביום מסוים, נשמרים המחירים האמיתיים האחרונים שלה עם סטטוס `stale` ותאריך הקובץ המקורי.

## מצב הרשתות
| רשת | מקור | סניף מייצג | מצב |
|---|---|---|---|
| שופרסל | prices.shufersal.co.il (פתוח) | דיל חולון-גולדה (123) | ✅ אוטומטי בענן |
| רמי לוי | url.publishedprices.co.il, משתמש אורח `RamiLevi` | רמת החייל (055) | ✅ בענן, כשהמשתנה מוגדר |
| יוחננוף | url.publishedprices.co.il, משתמש אורח `yohananof` | מודיעין ישפרו (017) | ✅ בענן, כשהמשתנה מוגדר |
| טיב טעם | url.publishedprices.co.il, משתמש אורח `TivTaam` | ראשון מזרח (014) | ✅ בענן, כשהמשתנה מוגדר |
| קרפור | prices.carrefour.co.il | — | 🏠 מהמחשב בבית (חסום מחוץ לישראל) — ראו למטה |
| ויקטורי | — | — | ⏸️ אין עדיין מקור מאומת |

### הפעלת רמי לוי, יוחננוף וטיב טעם בענן
ב-GitHub, במאגר `Shopping-`:
1. **Settings** (לשונית למעלה) ← בתפריט הצד **Secrets and variables** ← **Actions**.
2. לשונית **Variables** (לא Secrets) ← **New repository variable**.
3. Name: `PUBLISHEDPRICES_ENABLED` · Value: `true` ← **Add variable**.
4. לבדיקה מיידית: לשונית **Actions** ← **Daily real prices** ← **Run workflow**.

אין צורך לשנות קוד — ה-workflow מעביר את המשתנה לסקריפט (`.github/workflows/daily-prices.yml`).

### קרפור מהמחשב בבית
הפורטל של קרפור חוסם חיבורים מחוץ לישראל, ולכן מריצים אותו מהמחשב שלכם (IP ישראלי):
```bash
git clone https://github.com/bata2702204-hub/Shopping-.git && cd Shopping-
pip install requests lxml
python scripts/update_carrefour_local.py --no-push   # ניסיון ראשון בלי לדחוף
python scripts/update_carrefour_local.py             # מעדכן ודוחף
```
הסקריפט מושך מ-GitHub את הנתונים האחרונים, מעדכן **רק** את מחירי קרפור, ודוחף. אם ההורדה נכשלת – לא משתנה כלום.
Node.js אופציונלי (אם מותקן – מסווג את המוצרים החדשים מיד; אחרת זה קורה בהרצה הבאה בענן).
ההרצה היומית בענן שומרת את מחירי קרפור האחרונים ומציגה "עודכן <תאריך> (הרצה מקומית)".

הרצה יומית אוטומטית:
- **Windows** – Task Scheduler ← Create Basic Task ← Daily, 07:00 ← Start a program:
  `python` עם הארגומנט `scripts\update_carrefour_local.py` ו-"Start in" = תיקיית המאגר.
- **Mac/Linux** – `crontab -e` והוספת השורה:
  `0 7 * * * cd /path/to/Shopping- && python3 scripts/update_carrefour_local.py >> carrefour.log 2>&1`

אם קרפור מעבירה את הקבצים לכתובת אחרת: `python scripts/update_carrefour_local.py --url https://...`

### השוואת ירקות, פירות ובשר (התאמה לפי שם)
לירקות, פירות ובשר יש ברקוד פנימי שונה בכל רשת, ולכן הם מושווים לפי שם: עבור רשימה מוגדרת של מוצרים בסיסיים
(עגבניה, מלפפון, בצל, תפוח אדמה, בננה, חזה עוף טרי, שוקיים, כבד עוף, בשר טחון, סלמון ועוד – `scripts/fresh_matching.mjs`)
נבחר בכל רשת המוצר **הבסיסי שנמכר לפי ק"ג** – בלי זנים, אורגני, קפוא, פרימיום או מוצר מעובד.
במסך ההשוואה מוצג איזה מוצר אמיתי נבחר בכל רשת ("השוואה לפי שם"). מחיר שחורג פי 2.5 מהרשתות האחרות מסומן
"מחיר חריג" ולא נכלל בהשוואה. קודים פנימיים קצרים לעולם לא ממוזגים בין רשתות.

### השוואה כשאין סל מלא
אם אין שתי רשתות שיש להן את כל הסל, האפליקציה משווה את המוצרים שנמכרים בכל הרשתות (אותו ברקוד או אותה התאמה לפי שם),
ומציינת כמה מוצרים לא נכללו.

## הרצה מקומית
```bash
npm install
pip install requests lxml
python scripts/fetch_real_prices.py      # או: --only shufersal
node scripts/enrich_prices.mjs
npm test
npm run dev                               # שרת פיתוח
npm run build                             # בנייה לתיקיית docs/
```

## GitHub Pages
Settings ← Pages ← Deploy from a branch ← `main` / `/docs`.

## מבנה הקוד
```
scripts/       fetch_real_prices.py, enrich_prices.mjs, fresh_matching.mjs, update_carrefour_local.py
public/        real_prices.json (נוצר אוטומטית)
src/
  services/    priceService.js  ← טוען את real_prices.json, quoteFor, computeBasket (מחירים אמיתיים בלבד)
               realSearch.js    ← חיפוש במוצרים האמיתיים + הרחבה ממילון
               categorizer.js   ← סיווג למחלקות וחיפוש במילון
  data/        chains.js, categories.js
               catalog/*.js ← מילון חיפוש ומחלקות (שמות נרדפים, מותגים, תתי-קטגוריות) — ללא מחירים, לא מוצג כמוצרים
  store/       ShoppingContext.jsx ← ניהול מצב, פריטים מקושרים לברקוד
  components/  ListView, CompareView, ShopView, QuickAdd, ui
```
