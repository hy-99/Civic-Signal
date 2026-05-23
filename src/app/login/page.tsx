import Link from "next/link";

import { LoginForm } from "@/components/forms/login-form";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, Badge } from "@/components/ui/primitives";

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-xl gap-6 px-4 py-16 md:px-6">
        <Card className="grid gap-6 p-8">
          <Badge tone="accent">CivicSignal Access</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950">Sign in to CivicSignal</h1>
            <p className="text-sm leading-7 text-slate-600">
              Sign in to verify reports, track your submissions, and help keep place-based hazard information accurate.
            </p>
          </div>
          <LoginForm />
          <p className="text-sm text-slate-600">
            Need an account?{" "}
            <Link href="/signup" className="font-semibold text-blue-700">
              Create one here.
            </Link>
          </p>
        </Card>
      </main>
    </>
  );
}
