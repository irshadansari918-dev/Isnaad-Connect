# Isnaad Connect — Deployment & Trial Checklist

## Environment Variables

Set these in Vercel (or `.env.local` for development):

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Sanad AI agent |

## Supabase Setup

### 1. Database Schema
Run these SQL files in order via Supabase SQL Editor:
1. `db/schema.sql` — tables, indexes, enums, sequences
2. `db/rls-helpers.sql` — helper functions for RLS policies
3. `db/rls-policies.sql` — row-level security policies
4. `db/triggers.sql` — audit log, updated_at, ticket number auto-assign

### 2. Sanad AI User
Run `db/add-sanad-user.sql` to create the AI assistant user and auto-join trigger.

### 3. Storage Bucket
Create a storage bucket named `attachments` in Supabase Dashboard:
- Go to Storage → New Bucket
- Name: `attachments`
- Public: Yes (for file URL access)
- File size limit: 25MB
- Allowed MIME types: `image/jpeg, image/png, image/gif, image/webp, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/zip`

Add this RLS policy for the bucket:
```sql
-- Allow authenticated users to upload to their room folders
CREATE POLICY "Authenticated users can upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments');

-- Allow public read access
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'attachments');
```

### 4. Realtime
Enable Realtime for the `messages` table:
- Go to Database → Replication
- Enable `messages` table for Realtime (INSERT events)

### 5. Seed Data
Create initial data:
1. **Isnaad organization** (kind: `isnaad`)
2. **Admin user** (role: `admin`, org: Isnaad)
3. **At least one AM** (role: `am`, org: Isnaad)
4. **Trial client organizations** (kind: `client`)
5. **Client users** (role: `client`, linked to their org)
6. **Rooms** for each client + internal rooms

## Vercel Deployment

1. Connect the GitHub repo `Isnaad-Connect` to Vercel
2. Set environment variables in Vercel project settings
3. Deploy from the `main` branch
4. Custom domain: `connect.isnaad.ai` (when DNS is ready)

## Pre-Trial Verification

Run through these checks before onboarding trial users:

### Auth
- [ ] Admin can log in with email/password
- [ ] Client user can log in via magic link
- [ ] Unauthorized users redirected to `/login`
- [ ] Sign out works

### Chat
- [ ] Messages appear in real-time (<2s) across two browser windows
- [ ] Images upload and display inline
- [ ] File attachments upload with download link
- [ ] System messages display centered
- [ ] Date separators show between days
- [ ] Arabic toggle switches all UI strings + RTL layout

### Tickets
- [ ] Create ticket from ticket list page
- [ ] Ticket number auto-generated (ISC-NNNNN format)
- [ ] SLA countdown shows green/amber/red correctly
- [ ] Status transitions work (open → in_progress → resolved → closed)
- [ ] Client users can only set status to "resolved"
- [ ] Ticket detail page shows all metadata

### Tasks
- [ ] Create task from task list
- [ ] Filter tabs work (My Tasks / All / Overdue)
- [ ] Click checkbox toggles done/open
- [ ] Status dropdown changes status
- [ ] Overdue tasks highlighted in red

### AI Agent (Sanad)
- [ ] Type `@sanad hello` in a room → AI responds within 5s
- [ ] Sanad proposes ticket creation → confirm button works
- [ ] Sanad proposes task creation → confirm button works
- [ ] Cancel button on proposed actions works
- [ ] System message posted after ticket/task creation

### Security
- [ ] Client A cannot see Client B's rooms/messages
- [ ] Client users cannot access `/admin` pages
- [ ] Run `npm run smoke:tenant` — all 6 assertions pass

### Mobile / PWA
- [ ] App installable on mobile (PWA prompt appears)
- [ ] Notification permission prompt appears after 5s
- [ ] Mobile hamburger menu opens/closes correctly
- [ ] All pages readable at 375px width
- [ ] AR toggle works on mobile

## Trial Onboarding Steps

1. Create client organization in Admin → Organizations
2. Create client user in Admin → Users (with magic link invite)
3. Create room for the client in Admin → Rooms
4. Share magic link with client user
5. AM joins the room and sends welcome message
6. Verify client can see the room and respond
