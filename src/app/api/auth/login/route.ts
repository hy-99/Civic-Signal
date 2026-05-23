import { loginSchema } from "@/lib/validation";
import { fail, ok } from "@/lib/http";
import { signIn } from "@/services/auth";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const profile = await signIn(input);
    return ok({ id: profile.id, role: profile.role });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to sign in.", 400);
  }
}
