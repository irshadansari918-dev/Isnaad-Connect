export type Locale = "en" | "ar";

const strings = {
  // App shell
  "app.title": { en: "Isnaad Connect", ar: "اسناد كونكت" },
  "app.signOut": { en: "Sign out", ar: "تسجيل خروج" },
  "app.rooms": { en: "Rooms", ar: "الغرف" },
  "app.noRooms": { en: "No rooms yet. An admin will add you.", ar: "لا توجد غرف بعد. سيضيفك المسؤول." },

  // Chat
  "chat.sendMessage": { en: "Type a message…", ar: "اكتب رسالة…" },
  "chat.send": { en: "Send", ar: "إرسال" },
  "chat.firstMessage": { en: "Send the first message to start the conversation.", ar: "أرسل أول رسالة لبدء المحادثة." },
  "chat.today": { en: "Today", ar: "اليوم" },
  "chat.yesterday": { en: "Yesterday", ar: "أمس" },
  "chat.members": { en: "Members", ar: "الأعضاء" },
  "chat.loading": { en: "Loading messages…", ar: "جاري تحميل الرسائل…" },
  "chat.loadMore": { en: "Load earlier messages", ar: "تحميل رسائل سابقة" },

  // Room kinds
  "room.client": { en: "Client Room", ar: "غرفة العميل" },
  "room.internal": { en: "Internal Room", ar: "غرفة داخلية" },
  "room.dm": { en: "Direct Message", ar: "رسالة مباشرة" },

  // Roles
  "role.admin": { en: "Admin", ar: "مسؤول" },
  "role.am": { en: "Account Manager", ar: "مدير حساب" },
  "role.internal": { en: "Internal", ar: "داخلي" },
  "role.client": { en: "Client", ar: "عميل" },

  // Language toggle
  "lang.toggle": { en: "عربي", ar: "English" },
} as const;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, locale: Locale): string {
  return strings[key]?.[locale] ?? strings[key]?.en ?? key;
}

export default strings;
