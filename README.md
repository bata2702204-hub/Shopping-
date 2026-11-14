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
| שופרסל | prices.shufersal.co.il (פתוח) | דיל חולון-גולדה (123) | ✅ עובד |
| רמי לוי | url.publishedprices.co.il, משתמש אורח `RamiLevi` | הגדול ביותר באותו יום (כרגע רמת החייל) | ✅ עובד |
| יוחננוף | url.publishedprices.co.il, משתמש אורח `yohananof` | הגדול ביותר באותו יום (כרגע מודיעין ישפרו) | ✅ עובד |
| טיב טעם | url.publishedprices.co.il, משתמש אורח `TivTaam` | הגדול ביותר באותו יום (כרגע ראשון מזרח) | ✅ עובד |
| ויקטורי | — | — | ⏸️ אין עדיין מקור מאומת (מוסיפים שם משתמש אורח ב-`scripts/fetch_real_prices.py`) |
| קרפור | prices.carrefour.co.il | — | ⏸️ הפורטל חוסם חיבורים מחוץ לישראל |

רשתות publishedprices פעילות רק כשמשתנה המאגר `PUBLISHEDPRICES_ENABLED` = `true`
(Settings ← Secrets and variables ← Actions ← Variables).

### השוואה כשאין סל מלא
ירקות, בשר ומוצרי מותג פרטי מקבלים ברקוד פנימי שונה בכל רשת, ולכן לרוב אין רשת שיש לה את כל הסל.
במקרה כזה האפליקציה משווה את המוצרים שנמכרים בכל הרשתות (אותו ברקוד), ומציינת כמה מוצרים לא נכללו.

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
