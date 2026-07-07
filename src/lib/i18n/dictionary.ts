/**
 * English-keyed Urdu dictionary. `t(text)` looks up `text` verbatim here when
 * the active language is Urdu; unmatched strings fall back to the English
 * source text so untranslated pages degrade gracefully instead of breaking.
 */
export const UR: Record<string, string> = {
  // Chrome / shell
  Dashboard: "ڈیش بورڈ",
  Overview: "جائزہ",
  Module: "ماڈیول",
  Configuration: "ترتیب",
  Sales: "فروخت",
  Stock: "اسٹاک",
  Returns: "واپسی",
  "Payment / Receipt": "ادائیگی / رسید",
  Reports: "رپورٹس",
  Database: "ڈیٹا بیس",
  Logout: "لاگ آؤٹ",
  "Search customers, vouchers…": "کسٹمرز، واؤچرز تلاش کریں…",

  // Login
  "LPG Management": "ایل پی جی مینجمنٹ",
  "Sign in to your account": "اپنے اکاؤنٹ میں سائن ان کریں",
  "Login ID": "لاگ ان آئی ڈی",
  "Financial Year": "مالی سال",
  Password: "پاس ورڈ",
  "Sign in": "سائن ان",
  "Select financial year": "مالی سال منتخب کریں",
  "Enter login ID first": "پہلے لاگ ان آئی ڈی درج کریں",
  "Login failed.": "لاگ ان ناکام ہوگیا۔",
  "(active)": "(فعال)",
  "Powered by fusion4o": "طاقت فراہم کنندہ: fusion4o",

  // Settings — Appearance / Language
  Appearance: "ظاہری شکل",
  "Choose an accent color for the interface. All themes use the deep gas blue sidebar with skeuomorphic raised surfaces.":
    "انٹرفیس کے لیے ایک نمایاں رنگ منتخب کریں۔ تمام تھیمز میں گہرے گیس بلیو سائیڈبار کے ساتھ ابھری ہوئی سطحیں شامل ہیں۔",
  "Accent color only affects module tab bars and accent highlights. The sidebar and main surfaces remain consistent.":
    "نمایاں رنگ صرف ماڈیول ٹیب بارز اور جھلکیوں پر اثر انداز ہوتا ہے۔ سائیڈبار اور مرکزی سطحیں یکساں رہتی ہیں۔",
  Language: "زبان",
  "Choose the interface language. Urdu translates menus, navigation, and labels across the app.":
    "انٹرفیس کی زبان منتخب کریں۔ اردو پورے ایپ میں مینیوز، نیویگیشن اور لیبلز کا ترجمہ کرتی ہے۔",
  English: "انگریزی",
  Urdu: "اردو",

  // Configuration → Setup
  "Company Information": "کمپنی کی معلومات",
  "User Management": "صارف کا انتظام",
  "Change Password": "پاس ورڈ تبدیل کریں",
  Cities: "شہر",
  Area: "علاقہ",
  "Day Closing": "روزانہ اختتام",

  // Configuration → Masters
  "Brand Coding": "برانڈ کوڈنگ",
  "Category Coding": "کیٹیگری کوڈنگ",
  "Item Coding": "آئٹم کوڈنگ",
  "Customer Coding": "کسٹمر کوڈنگ",
  "Vendor Coding": "وینڈر کوڈنگ",
  "Bank Coding": "بینک کوڈنگ",

  // Configuration → Fleet & Plants
  Transporters: "ٹرانسپورٹرز",
  Vehicles: "گاڑیاں",
  Drivers: "ڈرائیورز",
  Plants: "پلانٹس",
  "Stock Locations": "اسٹاک مقامات",
  "Bulk Products": "بلک مصنوعات",

  // Configuration → Opening
  "Shop Opening Balance": "دکان کا ابتدائی بیلنس",
  "Cash Opening": "نقد ابتدائیہ",
  "Customer Opening Balance": "کسٹمر کا ابتدائی بیلنس",
  "Vendor Opening Balance": "وینڈر کا ابتدائی بیلنس",
  "Opening Stock (Bulk)": "ابتدائی اسٹاک (بلک)",

  // Configuration → System
  "Expense Type Coding": "اخراجات کی قسم کوڈنگ",
  "Database Backup": "ڈیٹا بیس بیک اپ",

  // Sales tabs
  "Sale LPG": "ایل پی جی فروخت",
  "Complete Day Sale": "مکمل دن کی فروخت",
  "Decanting Sale": "ڈی کینٹنگ فروخت",
  "Empty Sale": "خالی سلنڈر فروخت",

  // Stock tabs
  "Purchase Filled Cylinder": "بھرا سلنڈر خریداری",
  "Purchase Empty Cylinder": "خالی سلنڈر خریداری",
  "Purchase Other": "دیگر خریداری",
  "Cylinder Conversion": "سلنڈر تبدیلی",
  "Warehouse Transfer": "گودام منتقلی",
  "Physical Count": "فزیکل گنتی",

  // Returns tabs
  "Cylinder Return": "سلنڈر واپسی",
  "Purchase Return Cylinder": "سلنڈر خریداری واپسی",
  "Purchase Return Other": "دیگر خریداری واپسی",

  // Payment / Receipt tabs
  "Cash Payment": "نقد ادائیگی",
  "Cash Receipt": "نقد رسید",
  "Security Receipt": "سیکیورٹی رسید",
  "Chart of Account": "چارٹ آف اکاؤنٹ",
  "Journal Vouchers": "جرنل واؤچرز",
  "Bank Payments / Receipt": "بینک ادائیگی / رسید",

  // Reports → Sales
  "Sale B/W Date": "تاریخوں کے درمیان فروخت",
  "One Customer Sale History": "ایک کسٹمر کی فروخت کی تاریخ",
  "Sale Return Report": "فروخت واپسی رپورٹ",
  "Salewise Profit": "فروخت کے حساب سے منافع",

  // Reports → Purchases
  "Vendor Wise Receiving": "وینڈر کے حساب سے وصولی",
  "Purchase Return Report": "خریداری واپسی رپورٹ",

  // Reports → Ledgers
  "Cash Book": "کیش بک",
  "Bank Book": "بینک بک",
  "General Ledger": "جنرل لیجر",
  "Customer Ledger": "کسٹمر لیجر",
  "Customer Stock Ledger": "کسٹمر اسٹاک لیجر",

  // Reports → Stock
  "Stock Report": "اسٹاک رپورٹ",
  "Stock by Location": "مقام کے حساب سے اسٹاک",
  "Cylinder Conversion B/W Date": "تاریخوں کے درمیان سلنڈر تبدیلی",
  "Access Cylinders": "زائد سلنڈر",
  "Daily Activity Report": "روزانہ سرگرمی رپورٹ",

  // Reports → Financial
  "Chart Of Account": "چارٹ آف اکاؤنٹ",
  "Group Summary": "گروپ خلاصہ",
  "Profit / Loss Report": "منافع / نقصان رپورٹ",

  // Tab group labels
  Setup: "سیٹ اپ",
  Masters: "ماسٹرز",
  "Fleet & Plants": "فلیٹ اور پلانٹس",
  Opening: "ابتدائیہ",
  System: "سسٹم",
  Purchases: "خریداری",
  Ledgers: "لیجرز",
  Financial: "مالیاتی",

  // Printable invoice labels
  "LPG Management System": "ایل پی جی مینجمنٹ سسٹم",
  "Document Number": "دستاویز نمبر",
  Date: "تاریخ",
  Generated: "تیار شدہ",
  "Invoice Language": "انوائس زبان",
  Vendor: "وینڈر",
  Customer: "کسٹمر",
  Account: "اکاؤنٹ",
  Section: "حصہ",
  Item: "آئٹم",
  State: "حالت",
  Direction: "سمت",
  Quantity: "مقدار",
  "Unit Price": "یونٹ قیمت",
  GST: "جی ایس ٹی",
  "Ex-GST": "جی ایس ٹی کے بغیر",
  "Inc-GST": "جی ایس ٹی سمیت",
  Amount: "رقم",
  Description: "تفصیل",
  Debit: "ڈیبٹ",
  Credit: "کریڈٹ",
  "Total Debit": "کل ڈیبٹ",
  "Total Credit": "کل کریڈٹ",
  "No voucher lines.": "کوئی واؤچر لائن نہیں۔",
  Print: "پرنٹ",
  "Loading printable document...": "قابلِ پرنٹ دستاویز لوڈ ہو رہی ہے...",
};

export function translatePrintLabel(label: string, invoiceLanguage?: string) {
  if (invoiceLanguage !== "Urdu") return label;
  return UR[label] ?? label;
}
