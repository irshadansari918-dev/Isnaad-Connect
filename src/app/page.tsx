import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Isnaad Connect
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Day 1 foundation. Login coming next.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm underline underline-offset-4"
        >
          Go to login
        </Link>
      </div>
    </main>
  );
}
