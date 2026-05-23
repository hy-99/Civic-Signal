import { NextResponse } from "next/server";

import type { ApiResult } from "@/lib/types";

export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json({ ok: true, data, meta } satisfies ApiResult<T>);
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error } satisfies ApiResult<never>, { status });
}
