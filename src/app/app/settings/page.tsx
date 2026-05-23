import { PageHeader } from "@/components/shared/states";
import { Card } from "@/components/ui/primitives";
import { getCurrentViewer } from "@/services/auth";

export default async function SettingsPage() {
  const viewer = await getCurrentViewer();
  return (
    <div className="mx-auto grid max-w-[1280px] gap-6 p-4 md:p-6">
      <PageHeader eyebrow="Settings" title="Profile and privacy preferences" description="Choose your default area, privacy defaults, and notification shell preferences." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="grid gap-3 p-5">
          <h3 className="text-lg font-semibold text-slate-950">Profile</h3>
          <p className="text-sm text-slate-600">Display name: {viewer?.display_name || "Guest"}</p>
          <p className="text-sm text-slate-600">Default city: {viewer?.home_city || "Not set"}</p>
        </Card>
        <Card className="grid gap-3 p-5">
          <h3 className="text-lg font-semibold text-slate-950">Privacy</h3>
          <p className="text-sm leading-7 text-slate-600">Anonymous by default toggle shell, profile detail visibility shell, and notification preferences shell live here in v1.</p>
        </Card>
      </div>
    </div>
  );
}
