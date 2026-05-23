import { Card } from "@/components/ui/primitives";

export function ModerationPanel() {
  return (
    <Card className="grid gap-3 p-5">
      <h3 className="text-lg font-semibold text-slate-950">Moderator Tools</h3>
      <p className="text-sm leading-7 text-slate-600">
        Approve, hide, mark false alarm, merge duplicates, override status, and leave moderator notes through the admin API routes.
      </p>
    </Card>
  );
}
