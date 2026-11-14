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
| רשת | מקור | מצב |
|---|---|---|
| שופרסל | prices.shufersal.co.il (פתוח) | ✅ נבדק ועובד — סניף דיל חולון-גולדה (123) |
| רמי לוי, יוחננוף, טיב טעם | url.publishedprices.co.il (כניסה עם משתמש אורח ציבורי של כל רשת) | ⏸️ כבוי כברירת מחדל — מפעילים עם משתנה המאגר `PUBLISHEDPRICES_ENABLED=true` |
| ויקטורי | matrixcatalog.co.il (http) | ⚠️ לא נבדק — לא נגיש מסביבת הפיתוח |
| קרפור | prices.carrefour.co.il / prices.ybitan.co.il | ⚠️ השרת ניתק את החיבור מסביבת הפיתוח (ככל הנראה חסימה לכתובות מחוץ לישראל) |

הפעלת רשתות publishedprices: ב-GitHub ← Settings ← Secrets and variables ← Actions ← Variables ← New repository variable: `PUBLISHEDPRICES_ENABLED` = `true`.

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
scripts/       fetch_real_prices.py, enrich_prices.mjs
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
