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
| קרפור | prices.carrefour.co.il (קוד רשת 7290055700007) | — | 🏠 מהמחשב בבית (חסום מחוץ לישראל) — ראו למטה |
| ויקטורי | laibcatalog.co.il (פורטל משותף לכמה רשתות) | החדש ביותר | 🏠 מהמחשב בבית (חסום מחוץ לישראל) — ראו למטה |

### הפעלת רמי לוי, יוחננוף וטיב טעם בענן
ב-GitHub, במאגר `Shopping-`:
1. **Settings** (לשונית למעלה) ← בתפריט הצד **Secrets and variables** ← **Actions**.
2. לשונית **Variables** (לא Secrets) ← **New repository variable**.
3. Name: `PUBLISHEDPRICES_ENABLED` · Value: `true` ← **Add variable**.
4. לבדיקה מיידית: לשונית **Actions** ← **Daily real prices** ← **Run workflow**.

אין צורך לשנות קוד — ה-workflow מעביר את המשתנה לסקריפט (`.github/workflows/daily-prices.yml`).

### מתי רץ העדכון היומי
GitHub מפעיל ריצות מתוזמנות לעיתים באיחור של שעות. לכן מתוזמנות כמה ריצות במהלך היום (UTC 03,05,08,11,14),
והראשונה שמגיעה אחרי 05:00 שעון ישראל מעדכנת; האחרות רואות שכבר עודכן היום ומדלגות.

### קרפור וויקטורי מהמחשב בבית
הפורטלים של קרפור וויקטורי חוסמים חיבורים מחוץ לישראל, ולכן מריצים אותם מהמחשב שלכם (IP ישראלי):
```bash
git clone https://github.com/bata2702204-hub/Shopping-.git && cd Shopping-
pip install requests lxml
python scripts/update_local.py --no-push   # ניסיון בלי לדחוף (קרפור + ויקטורי)
python scripts/update_local.py             # מעדכן ודוחף
python scripts/update_local.py --chains victory   # רק רשת אחת
```
הסקריפט מושך מ-GitHub את הנתונים האחרונים, מעדכן **רק** את הרשתות האלה, ודוחף. אם אף רשת לא ירדה – לא משתנה כלום;
רשת שנכשלה שומרת את המחירים האמיתיים הקודמים שלה. (`update_carrefour_local.py` עדיין עובד – רק לקרפור.)
Node.js אופציונלי (אם מותקן – מסווג את המוצרים החדשים מיד; אחרת זה קורה בהרצה הבאה בענן).
ההרצה היומית בענן שומרת את המחירים האחרונים של שתיהן ומציגה "עודכן <תאריך> (הרצה מקומית)".
לויקטורי: קוד הרשת שבקוד (7290696200003) עוד לא אומת – אם הוא שגוי, ההרצה תציג את קודי הרשתות שנמצאו בפורטל.
אם הפורטל לא מציג קישורים לקבצים, ההרצה שומרת את הדף בתיקייה `debug/` ומדפיסה איך לשלוח אותו (כדי לכתוב פענוח מתאים לדף האמיתי).

הרצה יומית אוטומטית:
- **Windows** – Task Scheduler ← Create Basic Task ← Daily, 07:00 ← Start a program:
  `python` עם הארגומנט `scripts\update_local.py` ו-"Start in" = תיקיית המאגר.
- **Mac/Linux** – `crontab -e` והוספת השורה:
  `0 7 * * * cd /path/to/Shopping- && python3 scripts/update_local.py >> local-prices.log 2>&1`

אם רשת מעבירה את הקבצים לכתובת אחרת: `python scripts/update_local.py --url victory=https://...`

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
scripts/       fetch_real_prices.py, enrich_prices.mjs, fresh_matching.mjs, update_local.py
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
