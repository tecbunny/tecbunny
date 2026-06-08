import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { phone, serialNumber, action } = await req.json();
  const supabase = await createServerClient();

  await supabase.from("customer_promotions").insert({
    phone_identifier: phone,
    trigger_source: serialNumber,
    action_type: action,
    credit_amount: 500,
    status: "UNLOCKED"
  });

  return NextResponse.json({ success: true, credited: 500 });
}