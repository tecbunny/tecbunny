import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'Payment settings are now managed via code/environment variables.',
    paymentSettings: null 
  });
}

export async function PUT() {
  return NextResponse.json({ 
    error: 'Payment settings are managed via code. Updates via API are disabled.' 
  }, { status: 403 });
}
