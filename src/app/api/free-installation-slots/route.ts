import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase is not configured');
  }
  return createClient(url, key);
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const currentMonth = new Date();
    currentMonth.setDate(1);
    const monthStart = currentMonth.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('free_installation_slots')
      .select('remaining_slots, confirmed_count, total_slots')
      .eq('month', monthStart)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      throw error;
    }

    // If no record exists for this month, return 10 remaining (will be created on first update)
    if (!data) {
      return NextResponse.json({
        success: true,
        remainingSlots: 10,
        confirmedCount: 0,
        totalSlots: 10,
      });
    }

    return NextResponse.json({
      success: true,
      remainingSlots: data.remaining_slots,
      confirmedCount: data.confirmed_count,
      totalSlots: data.total_slots,
    });
  } catch (error: any) {
    console.error('Error fetching free installation slots:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const supabase = getSupabase();
    const currentMonth = new Date();
    currentMonth.setDate(1);
    const monthStart = currentMonth.toISOString().split('T')[0];

    // First try to get existing record
    let { data: existingSlot } = await supabase
      .from('free_installation_slots')
      .select('remaining_slots, confirmed_count, total_slots, id')
      .eq('month', monthStart)
      .single();

    // If no record exists, create one
    if (!existingSlot) {
      const { data: newSlot, error: createError } = await supabase
        .from('free_installation_slots')
        .insert({
          month: monthStart,
          total_slots: 10,
          remaining_slots: 10,
          confirmed_count: 0,
        })
        .select()
        .single();

      if (createError) throw createError;
      existingSlot = newSlot;
    }

    // Ensure existingSlot is not null before proceeding
    if (!existingSlot || !existingSlot.id) {
      throw new Error('Failed to get or create free installation slots record');
    }

    // Decrement remaining slots if any left
    if (existingSlot.remaining_slots > 0) {
      const { data: updatedSlot, error: updateError } = await supabase
        .from('free_installation_slots')
        .update({
          remaining_slots: existingSlot.remaining_slots - 1,
          confirmed_count: existingSlot.confirmed_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSlot.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        message: 'Free installation slot decremented',
        remainingSlots: updatedSlot.remaining_slots,
        confirmedCount: updatedSlot.confirmed_count,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'No free installation slots remaining for this month',
          remainingSlots: 0,
          confirmedCount: existingSlot.confirmed_count,
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error decrementing free installation slots:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
