import ParlayBoard from "@/components/ParlayBoard";
import { LEAGUE } from "@/lib/league";
import { listLegs } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-24">
      <ParlayBoard league={LEAGUE} initialLegs={listLegs()} />
    </main>
  );
}
