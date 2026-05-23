import { NextResponse } from "next/server";

import { signOut } from "@/services/auth";

export async function POST(request: Request) {
  await signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
