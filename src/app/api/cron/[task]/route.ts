import { fail, ok } from "@/lib/http";
import { runSchedulerJob } from "@/lib/scheduler/runner";
import { getCurrentViewer } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET || "";
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const vercelSignature = request.headers.get("x-vercel-cron-signature") || "";

  if (secret && (bearer === secret || vercelSignature === secret)) {
    return true;
  }

  try {
    const viewer = await getCurrentViewer();
    return viewer?.role === "admin";
  } catch {
    return false;
  }
}

function parseRequestBody(raw: string) {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ task: string }> }) {
  try {
    if (!(await isAuthorized(request))) {
      return fail("Unauthorized.", 401);
    }

    const { task } = await params;
    const input = parseRequestBody(await request.text());
    const result = await runSchedulerJob(task, input);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run scheduler task.";
    return fail(message, message.includes("Unknown scheduler task") ? 404 : 400);
  }
}
