import { JobsPanel } from "@/components/admin/jobs-panel";
import { ErrorState, PageHeader } from "@/components/shared/states";
import { SourceFeedCard } from "@/components/signals/source-feed-card";
import { getCurrentViewer } from "@/services/auth";
import { getSourceFeeds } from "@/services/source-feeds";

export default async function AdminSourcesPage() {
  const viewer = await getCurrentViewer();
  if (!viewer || viewer.role !== "admin") {
    return <ErrorState title="Unauthorized admin route" body="Admin access is required to manage public source feeds." />;
  }

  const feeds = await getSourceFeeds();
  return (
    <div className="mx-auto grid max-w-[1280px] gap-6 p-4 md:p-6">
      <PageHeader eyebrow="Source Feeds" title="Manage public data sources" description="Configure RSS, city alerts, manual sources, and low-frequency scan shells." />
      <JobsPanel />
      <div className="grid gap-4">
        {feeds.map((feed) => (
          <SourceFeedCard key={feed.id} feed={feed} />
        ))}
      </div>
    </div>
  );
}
