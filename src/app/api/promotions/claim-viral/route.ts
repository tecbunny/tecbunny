import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServiceClient, isSupabaseServiceConfigured } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const claimSchema = z.object({
  phone: z.string().min(10).max(15),
  serialNumber: z.string().min(3).max(64),
  action: z.string().min(1).max(64),
});

const CLAIM_RATE_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      "anonymous";

    if (!rateLimit(ip, "claim_viral_promo", CLAIM_RATE_LIMIT)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await request.json();
    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    if (!isSupabaseServiceConfigured) {
      return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from("customer_promotions").insert({
      phone_identifier: parsed.data.phone.replace(/\D/g, ""),
      trigger_source: parsed.data.serialNumber,
      action_type: parsed.data.action,
      credit_amount: 500,
      status: "UNLOCKED",
    });

    if (error) {
      logger.error("claim_viral_insert_failed", { error: error.message });
      return NextResponse.json({ error: "Could not record promotion claim." }, { status: 500 });
    }

    return NextResponse.json({ success: true, credited: 500 });
  } catch (error) {
    logger.error("claim_viral_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to process claim." }, { status: 500 });
  }
}