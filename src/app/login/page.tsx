import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInWithPassword, signInWithMagicLink } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string; sent?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--isnaad-red)] text-white font-bold">
            I
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Sign in to Isnaad Connect
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Staff use password. Clients use a magic link.
          </p>
        </div>

        {sp.error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {sp.error}
          </div>
        )}
        {sp.sent && (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Magic link sent. Check your inbox.
          </div>
        )}

        <section className="space-y-3 rounded-lg border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-medium text-card-foreground">
            Staff sign in
          </h2>
          <form action={signInWithPassword} className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">
                Email
              </span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">
                Password
              </span>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Sign in
            </button>
          </form>
        </section>

        <section className="space-y-3 rounded-lg border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-medium text-card-foreground">
            Client sign in (magic link)
          </h2>
          <form action={signInWithMagicLink} className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">
                Email
              </span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Email me a link
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
