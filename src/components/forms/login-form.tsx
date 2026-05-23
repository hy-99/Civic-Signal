"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { loginSchema } from "@/lib/validation";
import { Button, Field, Input } from "@/components/ui/primitives";

type LoginValues = z.input<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const submitRef = useRef<HTMLButtonElement | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (submitRef.current) submitRef.current.dataset.civicClientReady = "true";
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (!payload.ok) {
      setError(payload.error || "Unable to sign in.");
      return;
    }
    router.push("/app/map");
    router.refresh();
  });

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <Field label="Email">
        <Input type="email" {...form.register("email")} />
      </Field>
      <Field label="Password">
        <Input type="password" {...form.register("password")} />
      </Field>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <Button ref={submitRef} type="submit" disabled={form.formState.isSubmitting} data-civic-client-ready="false">
        Sign In
      </Button>
    </form>
  );
}
