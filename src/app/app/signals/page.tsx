import { PageHeader } from "@/components/shared/states";
import { SignalCard } from "@/components/signals/signal-card";
import { getPublicSignals } from "@/services/signals";

export default async function SignalsPage() {
  const signals = await getPublicSignals({ sort: "recent" });
  return (
    <div className="mx-auto grid max-w-[1280px] gap-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Public Signals"
        title="Public-source evidence feed"
        description="Review city alerts, weather advisories, manual imports, and matched supporting signals."
      />
      <div className="grid gap-4">
        {signals.map((signal) => (
          <SignalCard key={signal.id} signal={signal} />
        ))}
      </div>
    </div>
  );
}
