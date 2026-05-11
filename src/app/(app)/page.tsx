import { getMe } from "@/lib/queries/me";

export default async function HomePage() {
  const me = await getMe();

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Welcome to Isnaad Connect
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {me
            ? `Signed in as ${me.fullName}. Pick a room from the sidebar to start.`
            : "Loading…"}
        </p>
      </div>
    </div>
  );
}
