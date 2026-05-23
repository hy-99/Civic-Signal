"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { signupSchema } from "@/lib/validation";
import { Button, Field, Input } from "@/components/ui/primitives";

type SignupValues = z.input<typeof signupSchema>;

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const submitRef = useRef<HTMLButtonElement | null>(null);
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      display_name: "",
      email: "",
      password: "",
      home_city: "",
      agreed_to_safety: true,
    },
  });

  useEffect(() => {
    if (submitRef.current) submitRef.current.dataset.civicClientReady = "true";
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setError("");
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (!payload.ok) {
      setError(payload.error || "Unable to create account.");
      return;
    }
    router.push("/app/map");
    router.refresh();
  });

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <Field label="Display Name">
        <Input {...form.register("display_name")} />
      </Field>
      <Field label="Email">
        <Input type="email" {...form.register("email")} />
      </Field>
      <Field label="Password">
        <Input type="password" {...form.register("password")} />
      </Field>
      <Field label="City / Area">
        <Input {...form.register("home_city")} />
      </Field>
      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <input type="checkbox" className="mt-1" {...form.register("agreed_to_safety")} />
        <span>I agree not to submit false or harmful reports.</span>
      </label>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <Button ref={submitRef} type="submit" disabled={form.formState.isSubmitting} data-civic-client-ready="false">
        Create Account
      </Button>
    </form>
  );
}
