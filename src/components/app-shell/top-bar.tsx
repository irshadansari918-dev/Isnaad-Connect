import type { Me } from "@/lib/queries/me";

export function TopBar({ me }: { me: Me }) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--isnaad-red)] text-xs font-bold text-white">
          I
        </div>
        <span className="text-sm font-semibold tracking-tight">
          Isnaad Connect
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-xs text-muted-foreground sm:flex sm:flex-col sm:items-end">
          <span className="font-medium text-foreground">{me.fullName}</span>
          <span>
            {me.role.toUpperCase()} · {me.orgName}
          </span>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
