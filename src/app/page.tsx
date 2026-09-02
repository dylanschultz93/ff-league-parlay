import ParlayBoard from "@/components/ParlayBoard";
import { LEAGUE } from "@/lib/league";
import { listLegs } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Home() {
  return <ParlayBoard league={LEAGUE} initialLegs={listLegs()} />;
}
