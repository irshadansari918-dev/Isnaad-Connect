import { getMe } from "@/lib/queries/me";
import { HomeContent } from "@/components/app-shell/home-content";

export default async function HomePage() {
  const me = await getMe();

  return <HomeContent fullName={me?.fullName ?? null} />;
}
