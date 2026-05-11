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
  "chat.attach": { en: "Attach file", ar: "إرفاق ملف" },
  "chat.image": { en: "Send image", ar: "إرسال صورة" },
  "chat.uploading": { en: "Uploading…", ar: "جاري الرفع…" },

  // Message actions
  "message.reply": { en: "Reply", ar: "رد" },
  "message.edit": { en: "Edit", ar: "تعديل" },
  "message.delete": { en: "Delete", ar: "حذف" },
  "message.edited": { en: "edited", ar: "تم التعديل" },
  "message.deleted": { en: "This message was deleted", ar: "تم حذف هذه الرسالة" },
  "message.replyingTo": { en: "Replying to", ar: "الرد على" },

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

  // Tasks
  "tasks.title": { en: "Tasks", ar: "المهام" },
  "tasks.create": { en: "New Task", ar: "مهمة جديدة" },
  "tasks.assignee": { en: "Assignee", ar: "المسؤول" },
  "tasks.dueDate": { en: "Due Date", ar: "تاريخ الاستحقاق" },
  "tasks.filterMine": { en: "My Tasks", ar: "مهامي" },
  "tasks.filterAll": { en: "All Tasks", ar: "كل المهام" },
  "tasks.filterOverdue": { en: "Overdue", ar: "متأخرة" },
  "tasks.open": { en: "Open", ar: "مفتوحة" },
  "tasks.inProgress": { en: "In Progress", ar: "قيد التنفيذ" },
  "tasks.done": { en: "Done", ar: "منجزة" },
  "tasks.cancelled": { en: "Cancelled", ar: "ملغاة" },
  "tasks.markDone": { en: "Mark Done", ar: "إنجاز" },
  "tasks.noTasks": { en: "No tasks yet.", ar: "لا توجد مهام بعد." },

  // Tickets
  "tickets.title": { en: "Tickets", ar: "التذاكر" },
  "tickets.create": { en: "New Ticket", ar: "تذكرة جديدة" },
  "tickets.ticketNumber": { en: "Ticket #", ar: "رقم التذكرة" },
  "tickets.sla": { en: "SLA", ar: "اتفاقية الخدمة" },
  "tickets.slaHours": { en: "SLA Hours", ar: "ساعات SLA" },
  "tickets.breached": { en: "Breached", ar: "مخالفة" },
  "tickets.onTrack": { en: "On Track", ar: "في الموعد" },
  "tickets.warning": { en: "At Risk", ar: "في خطر" },
  "tickets.open": { en: "Open", ar: "مفتوحة" },
  "tickets.inProgress": { en: "In Progress", ar: "قيد التنفيذ" },
  "tickets.pendingClient": { en: "Pending Client", ar: "بانتظار العميل" },
  "tickets.resolved": { en: "Resolved", ar: "تم الحل" },
  "tickets.closed": { en: "Closed", ar: "مغلقة" },
  "tickets.assignedAm": { en: "Assigned AM", ar: "مدير الحساب" },
  "tickets.client": { en: "Client", ar: "العميل" },
  "tickets.description": { en: "Description", ar: "الوصف" },
  "tickets.noTickets": { en: "No tickets yet.", ar: "لا توجد تذاكر بعد." },

  // Agent (Sanad)
  "agent.confirm": { en: "Confirm", ar: "تأكيد" },
  "agent.cancel": { en: "Cancel", ar: "إلغاء" },
  "agent.confirmed": { en: "Action confirmed", ar: "تم التأكيد" },
  "agent.cancelled": { en: "Action cancelled", ar: "تم الإلغاء" },
  "agent.viewTask": { en: "View task", ar: "عرض المهمة" },
  "agent.thinking": { en: "Sanad is thinking…", ar: "سند يفكر…" },

  // Search
  "search.placeholder": { en: "Search…", ar: "بحث…" },
  "search.all": { en: "All", ar: "الكل" },
  "search.messages": { en: "Messages", ar: "الرسائل" },
  "search.tasks": { en: "Tasks", ar: "المهام" },
  "search.tickets": { en: "Tickets", ar: "التذاكر" },
  "search.noResults": { en: "No results found.", ar: "لم يتم العثور على نتائج." },
  "search.hint": { en: "Type at least 2 characters to search.", ar: "اكتب حرفين على الأقل للبحث." },
  "search.close": { en: "to close", ar: "للإغلاق" },

  // Notifications
  "notifications.enable": { en: "Enable notifications", ar: "تفعيل الإشعارات" },
  "notifications.description": { en: "Get notified about new messages and updates.", ar: "احصل على إشعارات بالرسائل والتحديثات الجديدة." },
  "notifications.allow": { en: "Allow", ar: "السماح" },
  "notifications.title": { en: "Notifications", ar: "الإشعارات" },
  "notifications.markAllRead": { en: "Mark all read", ar: "تحديد الكل كمقروء" },
  "notifications.empty": { en: "No notifications yet.", ar: "لا توجد إشعارات بعد." },

  // Navigation
  "nav.admin": { en: "Admin", ar: "الإدارة" },
  "nav.tasks": { en: "Tasks", ar: "المهام" },
  "nav.tickets": { en: "Tickets", ar: "التذاكر" },

  // Language toggle
  "lang.toggle": { en: "عربي", ar: "English" },
} as const;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, locale: Locale): string {
  return strings[key]?.[locale] ?? strings[key]?.en ?? key;
}

export default strings;
