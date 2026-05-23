import Link from "next/link";

import { SignupForm } from "@/components/forms/signup-form";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge, Card } from "@/components/ui/primitives";

export default function SignupPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-xl gap-6 px-4 py-16 md:px-6">
        <Card className="grid gap-6 p-8">
          <Badge tone="accent">Create CivicSignal Account</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950">Join your community signal network</h1>
            <p className="text-sm leading-7 text-slate-600">
              Reports may appear publicly, but your email will not be shown. CivicSignal focuses on places and hazards, not private individuals.
            </p>
          </div>
          <SignupForm />
          <p className="text-sm text-slate-600">
            Already have access?{" "}
            <Link href="/login" className="font-semibold text-blue-700">
              Sign in.
            </Link>
          </p>
        </Card>
      </main>
    </>
  );
}
