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

  // Admin
  "admin.title": { en: "Administration", ar: "الإدارة" },
  "admin.organizations": { en: "Organizations", ar: "المنظمات" },
  "admin.users": { en: "Users", ar: "المستخدمون" },
  "admin.rooms": { en: "Rooms", ar: "الغرف" },
  "admin.create": { en: "Create", ar: "إنشاء" },
  "admin.name": { en: "Name", ar: "الاسم" },
  "admin.email": { en: "Email", ar: "البريد الإلكتروني" },
  "admin.role": { en: "Role", ar: "الدور" },
  "admin.status": { en: "Status", ar: "الحالة" },
  "admin.actions": { en: "Actions", ar: "الإجراءات" },
  "admin.active": { en: "Active", ar: "نشط" },
  "admin.archived": { en: "Archived", ar: "مؤرشف" },
  "admin.deactivated": { en: "Deactivated", ar: "معطل" },
  "admin.archive": { en: "Archive", ar: "أرشفة" },
  "admin.restore": { en: "Restore", ar: "استعادة" },
  "admin.invite": { en: "Send Invite", ar: "إرسال دعوة" },
  "admin.deactivate": { en: "Deactivate", ar: "تعطيل" },
  "admin.reactivate": { en: "Reactivate", ar: "إعادة تفعيل" },
  "admin.kind": { en: "Type", ar: "النوع" },
  "admin.members": { en: "Members", ar: "الأعضاء" },
  "admin.organization": { en: "Organization", ar: "المنظمة" },
  "admin.fullName": { en: "Full Name", ar: "الاسم الكامل" },
  "admin.password": { en: "Password", ar: "كلمة المرور" },
  "admin.optional": { en: "Optional", ar: "اختياري" },
  "admin.selectOrg": { en: "Select organization", ar: "اختر المنظمة" },
  "admin.selectMembers": { en: "Select members", ar: "اختر الأعضاء" },
  "admin.clientOrg": { en: "Client Organization", ar: "منظمة العميل" },
  "admin.noData": { en: "No data yet.", ar: "لا توجد بيانات بعد." },
  "admin.created": { en: "Created", ar: "تم الإنشاء" },

  // Navigation
  "nav.admin": { en: "Admin", ar: "الإدارة" },

  // Language toggle
  "lang.toggle": { en: "عربي", ar: "English" },
} as const;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, locale: Locale): string {
  return strings[key]?.[locale] ?? strings[key]?.en ?? key;
}

export default strings;
