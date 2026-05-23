import { AdminReviewCard } from "@/components/admin/admin-review-card";
import { ErrorState, PageHeader } from "@/components/shared/states";
import { getCurrentViewer } from "@/services/auth";
import { getReviewQueue } from "@/services/moderation";

export default async function AdminReviewPage() {
  const viewer = await getCurrentViewer();
  if (!viewer || !["moderator", "admin"].includes(viewer.role)) {
    return <ErrorState title="Unauthorized admin route" body="Moderator or admin access is required to review flagged content." />;
  }

  const queue = await getReviewQueue();
  return (
    <div className="mx-auto grid max-w-[1280px] gap-6 p-4 md:p-6">
      <PageHeader eyebrow="Review Queue" title="Moderation dashboard" description="Review new reports, flagged content, high-risk items, and public signals that need review." />
      <div className="grid gap-4">
        {queue.map((item) => (
          <AdminReviewCard key={`${item.type}-${item.id}`} item={item} />
        ))}
      </div>
    </div>
  );
}
