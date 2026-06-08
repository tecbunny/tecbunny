import { NextResponse } from "next/server";
import { WhatsAppService } from "@/lib/whatsapp-service";
import { createServerClient } from "@/lib/supabase/server";

interface Payload {
  serialNumber: string;
  phone: string;
  deviceType: string;
}

const ADJACENT_COMPUTE_MATRIX: Record<string, string[]> = {
  "IP_CAMERA": ["Surveillance-rated 2TB Storage Unit", "PoE Power Layout Switch"],
  "BIOMETRIC": ["Magnetic Strike Lock", "Battery Backup UPS System"],
  "DEFAULT": ["Annual Maintenance Contract (AMC)", "Surge Protection Module"]
};

export async function POST(req: Request) {
  const { serialNumber, phone, deviceType } = await req.json() as Payload;
  const supabase = await createServerClient();
  
  const recommendations = ADJACENT_COMPUTE_MATRIX[deviceType] || ADJACENT_COMPUTE_MATRIX["DEFAULT"];
  
  await supabase.from("warranties").insert({
    serial_number: serialNumber,
    phone_identifier: phone,
    device_type: deviceType,
    status: "ACTIVE_SLA"
  });

  const message = `✅ *TECBUNNY WARRANTY ACTIVATED*\n\nSerial: ${serialNumber}\nDevice: ${deviceType}\nStatus: Active SLA\n\n⚡ *SYSTEM UPGRADE SUGGESTION:*\nTo optimize your recent setup, we recommend integrating:\n1. ${recommendations[0]}\n2. ${recommendations[1]}\n\n🎁 *YOUR 48-HR UPGRADE COUPON:*\nUse code *UPGRADE48* for 15% off adjacent hardware.\n\nTap to deploy: https://tecbunny.com/shop?apply=UPGRADE48`;

  const whatsappService = new WhatsAppService();
  await whatsappService.sendMessage(phone, message, "text");

  return NextResponse.json({ success: true, recommendations });
}