import test from "node:test";
import assert from "node:assert/strict";

import { isDemoMode } from "@/lib/env";

test("demo mode defaults on without Supabase config", () => {
  assert.equal(isDemoMode(), true);
});
