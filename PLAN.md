# Isnaad Connect — Master Plan

**Status:** Draft v1.0 — Living document. Updated at the end of each day.
**Owner:** Irshad Ansari, Head of Operations, Isnaad
**Build partner:** Claude (referred to as "Noora") + Claude Code
**Started:** Phase 1 begins on the day this document is committed to the repo.

---

## How to use this document

This is the canonical plan for the Isnaad Connect product. It lives at the root of the `isnaad-connect` repo. Every Claude Code session must read this file fully before starting work. Every meaningful architectural decision gets logged here. When the plan needs to change, this file is updated **before** code changes — never after.

There are three levels of detail in this document, on purpose:

- **Phase 1 (Week 1)** is specified day by day, task by task. We know exactly what we're doing.
- **Phase 2 (Week 2)** is specified at the feature level. We know what, but not exactly how, until Phase 1 ships.
- **Phase 3 onwards** is specified at the theme level. Direction, not tasks. We re-plan after each phase.

This is intentional. Plans that try to be specific 6 months out are fiction. Plans that have no long-term direction drift. This format is the compromise.

---

## Section 1 — Vision

### 1.1 What Isnaad Connect is

Isnaad Connect is the **conversation and operations layer** that lives inside the Isnaad Portal. It combines three things into one product:

- **Rooms** — like Slack channels for internal teams and like dedicated WhatsApp groups for each client
- **Tasks** — assigned action items with owner, due date, and status, often spawned from messages
- **Tickets** — formal client requests with SLA, lifecycle, audit trail

It is embedded into the existing Isnaad Portal (web and mobile) so users experience it as a built-in module, not a separate app. The AI Agent participates as a member of every room and can answer questions, create tasks, create tickets, and pull data from the WMS.

### 1.2 What it is NOT

- Not a generic chat tool (does not compete with WhatsApp or Slack)
- Not a CRM (does not replace customer records in the Portal)
- Not a project management tool (does not replace Jira/Linear for engineering teams)
- Not a public-facing product in v1 (Isnaad clients only)

### 1.3 Who it serves

Four user roles, no more:

| Role | Who | What they do |
|---|---|---|
| **Admin** | Senior Isnaad staff | Create rooms, manage users, full visibility |
| **Account Manager (AM)** | Isnaad AMs | Own client rooms, respond to tickets, assign tasks |
| **Internal** | Other Isnaad staff (Logistics, Returns, etc.) | Participate in cross-department rooms, get assigned tasks |
| **Client** | Isnaad's clients | Communicate in their dedicated room, raise tickets, see tasks for them |

Clients **never** see other clients' data. This is the single most important security rule of the product.

### 1.4 Product principles (unchanging)

These guide every decision. If a feature breaks one of these, the feature is wrong, not the principle.

1. **Tenant isolation is sacred.** Client A cannot see Client B's data, ever, anywhere, by any path.
2. **Audit everything.** Every write to the database creates an audit log row. No exceptions.
3. **The AI Agent is the moat.** Every workflow that can be AI-assisted should be. Generic chat without AI is commodity.
4. **Embed, don't replace.** Connect lives inside the Portal. It does not try to become the Portal.
5. **Three databases, three sources of truth.** Portal owns operational data. Connect owns conversations. Agent owns reasoning. They share IDs only.
6. **Bilingual from day one.** English-default, Arabic toggle. Saudi-native UX.
7. **Mobile-first, but PWA-first.** Native app comes after PWA proves the concept.
8. **Ship working slices, not finished features.** A working ticket without escalation is better than a half-built ticket with escalation that crashes.

---

## Section 2 — Architecture (the unchanging part)

### 2.1 The three-system model

```
ISNAAD PORTAL (WMS)            ISNAAD CONNECT             ISNAAD AI AGENT
- Already in production         - This project              - Already in production
- Dev team owns                 - You vibe-code             - Already calling Claude
- Source of truth for ops       - Source of truth for chat  - Source of truth for AI
- API: read-only for Connect    - Embedded in Portal        - Called by Connect via API
```

Connect reads from the Portal API. Connect calls the AI Agent API. The Portal embeds Connect via iframe (week 1) or React component (later). Single sign-on bridges identity across all three.

### 2.2 Tech stack (locked for v1)

- **Frontend:** Next.js 15 + TypeScript + Tailwind + shadcn/ui
- **Backend:** Next.js API routes + Supabase (Postgres + Auth + Realtime + Storage)
- **Real-time:** Supabase Realtime on the messages table
- **Background jobs:** Inngest (for SLA timers, scheduled tasks)
- **AI:** Reuse the Isnaad AI Agent's Anthropic Claude API setup — call it as a service, do not duplicate
- **Hosting:** Vercel (production at `connect.isnaad.ai`)
- **Auth:** Supabase Auth — email/password for staff, magic link for clients
- **Push notifications:** Web Push API (Android/desktop full, iOS 16.4+ best-effort)

### 2.3 Repo and infra

- **GitHub:** new repo `isnaad-connect`, separate from Portal and AI Agent
- **Supabase:** new project `isnaad-connect-prod`, region Bahrain or Frankfurt
- **Vercel:** new project `isnaad-connect`, deployed to `connect.isnaad.ai`

### 2.4 The data model (8 tables)

| Table | Owns | Critical fields |
|---|---|---|
| `organizations` | Isnaad + each client company | `kind` (isnaad/client), `portal_org_id` |
| `users` | Everyone who can log in | `org_id`, `role`, `portal_user_id`, `is_ai` |
| `rooms` | Conversation containers | `kind` (client/internal/dm), `client_org_id` |
| `room_members` | Membership | `is_assigned_am` flag |
| `messages` | Every message | `kind` (text/image/system/ai), `body`, `metadata` |
| `tasks` | Action items | `assignee_id`, `due_at`, `status`, `source_message_id` |
| `tickets` | Client requests with SLA | `ticket_number`, `status`, `sla_due_at`, `assigned_am_id` |
| `events` | Audit log, append-only | `actor_id`, `entity_type`, `action`, `changes` |

Full SQL is in `/db/schema.sql` after Day 1.

### 2.5 RLS strategy

- Every table has Row Level Security enabled.
- Helper functions: `current_user_org_id()`, `current_user_role()`, `is_room_member(room_id)`, `is_isnaad_admin()`, `is_isnaad_internal()`.
- Clients can only read data scoped to their `org_id`.
- Internal staff can read across orgs (subject to room membership for messages).
- Admins can read everything.
- The Day 1 smoke test verifies these rules. **No code merges to main if smoke test fails.**

---

## Section 3 — Phase 1: Week 1 (Days 1-7)

The trial-ready MVP. End of week 1, two trial clients use it for real.

### 3.1 Phase 1 success criteria (the contract)

The trial is "successful" if, on Day 8:

- 2 trial clients log in via magic link, see only their room
- 2-3 AMs log in via password, see all assigned client rooms + internal rooms
- Real-time messages flow in both directions, including images
- Tasks can be created from messages, assigned, and marked done
- Tickets can be raised by clients, have SLA timer, AM can update status
- AI Agent responds when @mentioned in any room
- Audit log records every write
- Mobile users can install the PWA and receive push notifications (Android/desktop)
- Tenant isolation smoke test passes

If 7 of 8 above pass, we ship and iterate. If less than 7, we slip the trial, no exceptions.

### 3.2 Day-by-day plan

#### Day 1 — Foundation

**Goal:** Database, auth, security, base layout. No features yet.

**Tasks:**
1. Initialize Next.js 15 + TypeScript + Tailwind + shadcn/ui project
2. Create Supabase project, paste credentials into `.env.local`
3. Create GitHub repo `isnaad-connect`, first commit, push
4. Apply database schema (8 tables, enums, indexes) — `/db/schema.sql`
5. Apply RLS helper functions — `/db/rls-helpers.sql`
6. Apply RLS policies on all 8 tables — `/db/rls-policies.sql`
7. Apply audit log triggers — `/db/triggers.sql`
8. Set up Supabase Auth — email/password + magic link
9. Build login page, logout button, protected route middleware
10. Seed data: 1 Isnaad org, 1 admin, 2 client orgs, 2 client users, 1 AM, 2 rooms, 3 messages
11. Build base layout: top bar (logo + logout), sidebar (rooms list), main empty state
12. Set up Vercel project, deploy to production
13. Set up `connect.isnaad.ai` subdomain (or `.vercel.app` if DNS not ready)
14. **Smoke test:** TypeScript test script that logs in as 4 different users and asserts isolation

**Smoke test script** (test/tenant-isolation.test.ts) must verify:
- Client A user cannot SELECT from rooms where they're not a member
- Client A user cannot SELECT messages from a room they're not a member of
- Client A user cannot SELECT users from Client B's org
- AM can SELECT rooms they're members of from both Client A and Client B
- Admin can SELECT all rooms, all users, all messages
- Direct attempts via service role key bypass RLS (intentional, for system operations)

**Done criteria:**
- All 14 tasks complete
- Smoke test passes (output pasted in commit message)
- Production URL reachable, login works for admin, AM, both clients
- `PLAN.md` committed to repo

#### Day 2 — Messaging core

**Goal:** Real-time chat works in rooms.

**Tasks:**
1. Build room view page (`/rooms/[id]`) — message list + composer
2. Wire Supabase Realtime subscription to messages table for the active room
3. Implement send-message API endpoint (POST /api/messages)
4. Render messages with sender name, avatar (initials), timestamp
5. Auto-scroll to bottom on new messages
6. Add typing indicator (purely client-side, optional polish)
7. Bilingual UI shell: English default, Arabic toggle in top bar that switches `dir="rtl"` and Arabic strings
8. Implement Arabic strings for all UI labels touched today (no Arabic for messages themselves — messages are user-typed)
9. Mark messages as read (best-effort, last-read-message-id per room_member)
10. Empty states: "Send the first message..."

**Smoke test:**
- AM and Client A user open the same room in two browsers
- AM sends a message, Client A sees it appear in real time (under 2 seconds)
- Client A replies, AM sees it
- Toggle to Arabic — UI flips to RTL, Arabic labels appear, messages stay as typed

#### Day 3 — Roles, members, invites

**Goal:** Admins can onboard clients and AMs without developer help.

**Tasks:**
1. Admin-only page `/admin/organizations` — list, create, archive client orgs
2. Admin-only page `/admin/users` — list, invite (email), assign role, deactivate
3. Admin-only page `/admin/rooms` — create room (client/internal), assign members
4. "Invite client" flow: admin enters email → magic link sent → client lands in their room
5. AM can see "their" client rooms in sidebar
6. Permission matrix enforced on every endpoint (server-side, not just UI)

**Smoke test:**
- Admin creates a new client org "Trial Client X" via UI
- Admin invites trial client user via email → magic link arrives
- Trial client clicks link, lands directly in their room
- Trial client cannot navigate to `/admin/*` (403)
- Trial client cannot read another client's room (URL-tampering test)

#### Day 4 — Tasks and tickets

**Goal:** The other two object types work.

**Tasks:**
1. Tasks list page (`/tasks`) — filter by mine/all/overdue, status
2. Create task UI: from a message ("..." menu → "Create task") or standalone
3. Tasks panel inside a room — show tasks linked to that room
4. Tickets list page (`/tickets`) — filter by status, client, AM
5. Create ticket UI: clients can create from their room, AMs can create on behalf
6. Ticket detail page — title, description, status, SLA timer (countdown), AM, audit
7. Inngest job: every 5 minutes, scan tickets, mark `sla_breached = true` on overdue
8. Visual SLA state: green (>2h left), amber (<2h), red (breached)
9. Status transitions: clients can mark `pending_client → resolved`; AMs can move freely
10. Email notification on ticket created (to AM) and on status change (to client)

**Smoke test:**
- AM creates task from a client message, assigns to internal staff, due tomorrow
- Internal staff sees task in "my tasks", marks done
- Client creates ticket "Where is shipment X?", sets SLA 4h
- AM updates ticket to "in progress", then "resolved"
- Inngest test: backdate a ticket SLA, run job, confirm `sla_breached = true`

#### Day 5 — AI Agent integration

**Goal:** The differentiator goes live.

**Tasks:**
1. Add `is_ai = true` user "Noora" to Isnaad org, role = internal
2. Auto-add Noora to every room on creation (trigger)
3. Build `/api/agent/respond` endpoint — receives message context, calls AI Agent's API, posts reply
4. Webhook from Connect to AI Agent: when a message contains `@noora` or starts with `/`, call the agent
5. AI Agent receives: room context (last 20 messages), client_org info from Portal API, the triggering message
6. AI Agent responds via Anthropic Claude (existing setup, no duplication)
7. Reply posted as a message with `kind = 'ai'` and special styling (Noora avatar, "AI" badge)
8. Intent routing in agent prompt:
   - Question about a shipment/customer → answer from Portal data
   - "Please ship X" / "Need to schedule Y" → propose creating a task
   - "There's a problem with Z" → propose creating a ticket
   - When agent proposes an action, message includes inline confirm/cancel buttons
9. Confirmation buttons: clicking creates the actual task/ticket via Connect API
10. Daily summary job: 8am Riyadh time, agent posts in each client room: "Summary of yesterday's activity"

**Smoke test:**
- Client types `@noora where is order ORD-10245?` → agent replies with status from Portal
- AM types `@noora create a task to follow up with Client A about returns` → agent proposes task with assignee/due, AM confirms, task is created
- Client types `@noora I have an issue with damaged package` → agent proposes ticket, client confirms, ticket is created with SLA
- Verify audit log: every agent message has `actor_id = noora's id`

#### Day 6 — Polish and image attachments

**Goal:** Stops feeling like a prototype.

**Tasks:**
1. Image upload in message composer (drag-drop + paste + button)
2. Supabase Storage bucket `message-images` with RLS (only room members can read)
3. Inline image preview in messages, click to enlarge
4. Mobile responsive layout pass: sidebar collapses, full-width message view
5. PWA manifest + service worker — installable on iOS/Android home screen
6. Web Push notification setup (Android/desktop): on new message in room you're a member of, on task assigned to you, on ticket SLA breach
7. iOS push: implement, document the iOS 16.4+ requirement, accept the limitation
8. Mention syntax: `@username` highlights but doesn't notify yet (notifications are Tier 2)
9. Brand polish: Isnaad red #C02526 accents, navy #0E1629 dark surfaces, logo in topbar
10. Loading states, empty states, error states for every page

**Smoke test:**
- Send image from desktop, receive on mobile PWA, image renders inline
- Trigger push notification: receive on Android Chrome installed PWA
- Toggle Arabic, screenshot main pages — Arabic readable, layout correct
- Lighthouse PWA score >85

#### Day 7 — Trial onboarding and bug bash

**Goal:** Trial clients onboard without drama. Plan a calm Day 8.

**Tasks:**
1. Onboard 2 trial clients: create orgs, send magic links, walk them through (live or recorded)
2. Onboard 2-3 AMs: passwords, training session, walk through their daily flow
3. Write 1-page user guide (English + Arabic): how to log in, send a message, raise a ticket
4. Set up monitoring: Vercel logs, Supabase logs, Inngest dashboard, error tracking (Sentry free tier)
5. Set up an internal "feedback" room where trial users can post issues
6. Bug bash: run through the smoke tests from Days 1-6 in production, fix what's broken
7. Performance check: messages load <1s, real-time delivery <2s, page navigation <500ms
8. Backup verification: confirm Supabase point-in-time recovery is on
9. Plan Day 8 calm: nothing to ship, only respond to trial feedback

**Done criteria:**
- 2 trial clients, 2 AMs, all logged in successfully
- User guide shared with all
- Monitoring confirmed working (test alert fires)
- Backup confirmed
- All Day 1-6 smoke tests pass in production
- PLAN.md updated with Phase 1 lessons learned (final 30 min of Day 7)

---

## Section 4 — Phase 2: Week 2 (Days 8-14)

Polish and the four features we explicitly cut from Phase 1.

### 4.1 Goals

Take the trial product from "works" to "feels professional." Add the features that prevent users from saying "this is missing the basics."

### 4.2 Features (in priority order)

1. **Search across messages, tasks, tickets** — Postgres full-text search, scoped by what user can read
2. **Mention notifications** — when @mentioned, push + email notification, in-app inbox
3. **AM auto-assignment** — rules engine: when client room created, auto-assign AM based on client→AM mapping
4. **SLA escalation actions** — on breach, auto-notify AM's manager, post escalation message in room, mark high-priority
5. **In-app notifications inbox** — `/notifications` page showing mentions, assignments, status changes
6. **Edit and delete own messages** — soft delete with "edited" / "deleted" indicator
7. **Reactions** — 6 fixed reactions (👍 ❤️ ✅ 👀 🎉 🤔), no custom emoji
8. **File uploads beyond images** — PDF, doc, zip up to 25MB
9. **Read receipts** — show "read by AM at HH:MM" on important messages
10. **Search inside Portal data via AI** — "find all shipments delayed today" → agent queries Portal API, returns list

### 4.3 Phase 2 success criteria

- Trial users stop reporting "I can't find X" complaints
- AMs stop manually assigning rooms
- Tickets get attention before they breach (escalation works)
- Mention notifications work and are not annoying (volume controls in place)

### 4.4 What's still NOT in Phase 2

- Native mobile app (Phase 3)
- Threading (Phase 3)
- Custom permissions per room (Phase 4)
- Webhook integrations to other tools (Phase 4)
- Workflow automation builder (Phase 5+)

---

## Section 5 — Phase 3: Weeks 3-4

Native mobile app + portal embedding.

### 5.1 Goals

- Real iOS and Android apps in stores (or TestFlight/internal Play track)
- Connect embedded into Isnaad Portal as a real module (not just iframe)
- Threading on messages
- AI Agent skill expansion

### 5.2 Themes

1. **React Native via Expo** — same codebase, native shell, push notifications native
2. **Component embed in Portal** — replace iframe with React component, deeper integration
3. **Single sign-on production hardening** — Portal issues JWT, Connect verifies, no separate logins
4. **Threading** — replies on messages, thread sidebar
5. **AI Agent v2** — multi-step actions in Portal (create shipment, update status with approval)
6. **Performance pass** — large rooms (>500 messages), pagination, virtualized lists

### 5.3 Open questions to resolve

- App Store account setup — Isnaad org dev account or Irshad personal?
- Portal team's preferred SSO mechanism — JWT, OAuth2, custom?
- Trial expansion: 2 → 5 → 10 clients? At what pace?

---

## Section 6 — Phase 4: Months 2-3

Production hardening and scale.

### 6.1 Themes

1. **Compliance** — Saudi PDPL, data residency, retention rules, GDPR-style export and purge
2. **Custom permissions** — per-room admin, read-only members, guest access
3. **Workflow automation** — when ticket SLA <1h, auto-escalate; when message contains keyword, auto-tag
4. **Webhook out** — Slack/Teams integration for internal team
5. **Reporting** — admin dashboards, AM performance metrics, ticket SLA stats
6. **Knowledge base** — searchable FAQ, AI Agent uses it for answers
7. **Internationalization** — proper i18n framework, multi-language beyond AR/EN
8. **Onboarding flows** — self-serve client signup (admin approves), guided first-use

---

## Section 7 — Phase 5-7: Months 4-12

Strategic themes. Specifics decided based on Phase 1-4 learnings.

### 7.1 Possible directions (not commitments)

- **Phase 5 (months 4-5):** Productize Connect for sale to other 3PLs in Saudi/GCC
- **Phase 6 (months 6-8):** Voice and video calls inside rooms
- **Phase 7 (months 9-12):** AI agent does multi-step Portal actions autonomously with approval workflows; Connect becomes the primary UI for many Portal operations

### 7.2 Decision points

At end of each phase, we ask:
- Is the trial expanding? → Continue
- Are users requesting features faster than we ship? → Hire developers
- Has the Portal team absorbed Connect via component embed? → De-risk handoff
- Is there commercial demand outside Isnaad? → Spin out as separate product

---

## Section 8 — The unchanging rules

These are non-negotiable. Any code change that violates one of these is rejected.

### 8.1 Security rules

1. **RLS on every table.** New table without RLS = blocked merge.
2. **Tenant isolation tested.** Smoke test runs on every deploy.
3. **No service role key in client-side code, ever.** Only in API routes / server actions / edge functions.
4. **Magic links expire in 1 hour.** Passwords meet complexity rules. No password reuse across roles.
5. **Audit log triggers on every write to messages, tasks, tickets, rooms, room_members.** No exceptions.
6. **No PII in logs.** Sentry/Vercel logs scrub email, phone, full message body.
7. **Image uploads scanned** — file type whitelist, size limit, no executables.

### 8.2 Architecture rules

1. **Connect does not write to the Portal database.** Read-only via API. Writes go through Portal's official mutations (Phase 3+).
2. **Connect does not duplicate AI logic.** All AI calls go through the Isnaad AI Agent service.
3. **Three databases stay separate.** No cross-database joins, no shared tables.
4. **Server-side state of truth.** Client UI is presentation only. Permissions and validation always server-side.

### 8.3 Product rules

1. **Bilingual from day one.** Every new string added in English + Arabic. No "we'll translate later."
2. **Mobile responsive on every page.** Test at 375px width minimum.
3. **No feature without an audit log entry** (where applicable).
4. **No feature without a smoke test.** Add to `/test/`. CI runs them all.
5. **No feature behind a feature flag for >2 weeks.** Either ship or kill.

### 8.4 Process rules

1. **Plan first, then code.** Every Claude Code session starts with reading PLAN.md.
2. **Smoke test before merge.** Day's work isn't done until the test passes.
3. **PLAN.md updated within 24h of any significant decision.** Stale plan = lost truth.
4. **Decisions logged.** Section 10 of this doc grows over time.
5. **Daily checkpoint.** End of day: what shipped, what's blocked, what's next. 10 lines max.

---

## Section 9 — How Claude Code works on this project

### 9.1 The contract with Claude Code

Every Claude Code session must:

1. **Read this entire PLAN.md before doing anything else.**
2. **Confirm which phase + day + tasks it is working on, and get explicit approval from Irshad before writing code.**
3. **Only execute the tasks for the current day. Do not get ahead.**
4. **Report progress after every major task (not silently for 2 hours).**
5. **End the day by running the smoke test for that day and pasting the output.**
6. **Update PLAN.md with anything learned, blocked, or changed.**
7. **Push to GitHub at end of each successful task. Daily branch: `day-N-<phase>`. Merge to `main` only after smoke test passes.**

### 9.2 What Claude Code MUST NOT do

- Skip ahead to a later phase or day, even if "it's quick"
- Add features not in PLAN.md without proposing them and getting approval
- Modify the schema without updating PLAN.md and creating a migration
- Disable RLS, even temporarily for testing
- Commit secrets, API keys, or `.env` files
- Touch the Isnaad Portal repo or AI Agent repo from this codebase

### 9.3 How decisions get made mid-session

If Claude Code hits a decision point (e.g., "Supabase Realtime has an unexpected limitation, two ways to work around it"):

1. STOP. Don't pick.
2. Summarize the issue, the two options, the trade-offs, in 5 lines max.
3. Ask Irshad to pick.
4. After Irshad picks, log the decision in Section 10 of PLAN.md.
5. Continue.

### 9.4 End-of-day handoff format

At the end of each day's session, paste a summary in this format:

```
DAY [N] COMPLETE

✅ Shipped: <bullet list>
🚧 Skipped/deferred: <bullet list with reasons>
🐛 Known issues: <bullet list>
📋 Smoke test: PASS / FAIL — <output>
🔜 Day [N+1] preview: <one line>
🔄 PLAN.md updates: <commit hash>
```

---

## Section 10 — Decision log

Append-only. Every major architectural or product decision goes here, dated.

### Pre-Day-1 decisions

**Decision: Separate repo, separate Supabase, iframe embed (initial).**
- *Date:* Pre-Day 1
- *Why:* Building inside Portal repo risks production WMS during vibe-coding. Iframe is fastest embed; component embed is Phase 3.
- *Reconsider when:* Phase 3, when Portal team can absorb component-embed work.

**Decision: Reuse Isnaad AI Agent as a service.**
- *Date:* Pre-Day 1
- *Why:* One brain, multiple surfaces. Avoids forking the agent. Keeps reasoning consistent across Google Chat and Connect rooms.
- *Reconsider when:* If AI Agent's API performance becomes a bottleneck, evaluate caching/proxying.

**Decision: Bilingual English-default with Arabic toggle (not Arabic-default).**
- *Date:* Pre-Day 1
- *Why:* English-default reduces RTL polish risk during 7-day sprint. Arabic toggle ensures Saudi clients can switch.
- *Reconsider when:* Phase 2, based on trial client preference data.

**Decision: 4 roles only (admin, AM, internal, client). No custom roles in v1.**
- *Date:* Pre-Day 1
- *Why:* Custom permissions are Phase 4. Four roles cover every Phase 1 use case.
- *Reconsider when:* Phase 4, with real usage data.

**Decision: Tier 2 features (search, AM auto-assign, mention notifications, SLA escalation) cut from Week 1.**
- *Date:* Pre-Day 1
- *Why:* Adding them to Week 1 makes Week 1 ~10 days of work in 7 days. They are committed to Week 2.
- *Reconsider when:* If trial reveals one is genuinely critical earlier, pull in. Otherwise hold.

**Decision: Mobile = PWA for Phase 1. React Native for Phase 3.**
- *Date:* Pre-Day 1
- *Why:* PWA gives 90% of mobile UX with 5% of effort. Native app earns its place after concept proves.
- *Reconsider when:* End of Phase 2.

---

## Section 11 — Open questions and risks

### 11.1 Open questions (resolve before they become blockers)

- **Q1:** Domain for Connect — `connect.isnaad.ai` or another path? *Resolution needed: Day 1.*
- **Q2:** Apple Developer account holder — Irshad personal or Isnaad org? *Resolution needed: Phase 3, week 3.*
- **Q3:** Production push notification certificates — VAPID keys generated, stored where? *Resolution needed: Day 6.*
- **Q4:** Backup/disaster recovery — Supabase Pro for PITR ($25/mo) — when to upgrade? *Resolution: end of trial week.*
- **Q5:** AI cost per client — track tokens per room, set monthly budget. *Resolution: Phase 2.*

### 11.2 Top risks

- **R1: Tenant isolation bug ships to production.** *Mitigation:* Day 1 smoke test, runs on every deploy, blocks merge on fail.
- **R2: Portal API changes break Connect.** *Mitigation:* All Portal API calls behind a single client module; failures degrade gracefully.
- **R3: Real-time delivery degrades at scale.** *Mitigation:* Supabase Realtime monitored from Day 2; pagination + virtualization in Phase 3.
- **R4: Trial client churns due to early bugs.** *Mitigation:* Onboard them with realistic expectations ("this is a trial, please tell us what breaks"); fix within 24h.
- **R5: AI Agent gives wrong answer in client room.** *Mitigation:* Agent always cites source; clients can react with "wrong" → flagged for review; Phase 2 adds confidence scoring.
- **R6: Irshad's other businesses pull attention away mid-build.** *Mitigation:* Daily progress tracked here; if a day slips, replan honestly, not heroically.

---

## Section 12 — Glossary

- **Connect:** Isnaad Connect, this product
- **Portal:** Isnaad's existing WMS, in production
- **AI Agent:** The existing Isnaad AI Agent on Google Chat, calling Anthropic Claude API
- **Noora:** The AI Agent's user-facing identity inside Connect
- **AM:** Account Manager — Isnaad staff who own client relationships
- **Tenant isolation:** Hard guarantee that Client A cannot see Client B's data
- **PWA:** Progressive Web App — installable from browser, no app store
- **RLS:** Row Level Security — Postgres feature for per-row access control
- **SLA:** Service Level Agreement — the time within which a ticket must be resolved
- **SSO:** Single Sign-On — log in once, access multiple systems
- **Smoke test:** Quick automated verification that core flows still work

---

## Section 13 — How this document evolves

This is version 1.0, written before Day 1. It will be wrong in places. That's fine.

It updates at three moments:
- **End of each day during Phase 1** — append to "Decision log," update task status, refine next day if needed
- **End of each phase** — review what worked, rewrite the next phase's plan with current knowledge
- **When something significant changes** — pivot, new client request, technical discovery

Old versions stay in git history. The current version is always truth.

---

*End of PLAN.md v1.0*
