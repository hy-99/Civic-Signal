import { PageHeader, StatCard } from "@/components/shared/states";
import { Card } from "@/components/ui/primitives";
import { getCurrentViewer } from "@/services/auth";
import { getLocalTrends, getSystemAnalytics } from "@/services/analytics";

export default async function AnalyticsPage() {
  const viewer = await getCurrentViewer();
  const [system, trends] = await Promise.all([getSystemAnalytics(), getLocalTrends({ city: viewer?.home_city })]);

  return (
    <div className="mx-auto grid max-w-[1280px] gap-6 p-4 md:p-6">
      <PageHeader eyebrow="Analytics" title="Local trends and operating metrics" description="See how active risks, categories, and community verification are shifting over time." />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Active Risks" value={system.active_reports} />
        <StatCard label="Resolved Issues" value={system.resolved_reports} />
        <StatCard label="Signals Ingested" value={system.public_signals_ingested} />
        <StatCard label="Moderation Queue" value={system.moderation_queue_size} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="grid gap-4 p-5">
          <h3 className="text-lg font-semibold text-slate-950">Top Categories</h3>
          {trends.top_categories.map(([label, count]) => (
            <div key={label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span>{label.replace(/_/g, " ")}</span>
              <span className="font-bold text-slate-950">{count}</span>
            </div>
          ))}
        </Card>
        <Card className="grid gap-4 p-5">
          <h3 className="text-lg font-semibold text-slate-950">Most Active Areas</h3>
          {system.most_active_areas.map((area) => (
            <div key={area.label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span>{area.label}</span>
              <span className="font-bold text-slate-950">{area.count}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
