import { ErrorState, PageHeader } from "@/components/shared/states";
import { Card } from "@/components/ui/primitives";
import { loadState } from "@/lib/data-store";
import { getCurrentViewer } from "@/services/auth";

export default async function AdminUsersPage() {
  const viewer = await getCurrentViewer();
  if (!viewer || viewer.role !== "admin") {
    return <ErrorState title="Unauthorized admin route" body="Admin access is required to view users and trust scores." />;
  }

  const state = await loadState();
  return (
    <div className="mx-auto grid max-w-[1280px] gap-6 p-4 md:p-6">
      <PageHeader eyebrow="Users" title="Community user management" description="Review roles, trust scores, report counts, and user activity shells." />
      <div className="grid gap-4">
        {state.profiles.map((profile) => (
          <Card key={profile.id} className="grid gap-3 p-5">
            <h3 className="text-lg font-semibold text-slate-950">{profile.display_name}</h3>
            <p className="text-sm text-slate-600">Role: {profile.role}</p>
            <p className="text-sm text-slate-600">Trust score: {profile.trust_score}</p>
            <p className="text-sm text-slate-600">Reports: {state.reports.filter((report) => report.user_id === profile.id).length}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
