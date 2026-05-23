import { signupSchema } from "@/lib/validation";
import { fail, ok } from "@/lib/http";
import { signUp } from "@/services/auth";

export async function POST(request: Request) {
  try {
    const input = signupSchema.parse(await request.json());
    const profile = await signUp(input);
    return ok({ id: profile.id, role: profile.role });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create account.", 400);
  }
}
