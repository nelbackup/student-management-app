import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const p = await req.json();
    const { data, error } = await supabase
      .from('students')
      .upsert(
        [
          {
            chinese_name: p.chinese_name.trim(),
            english_name: p.english_name ? p.english_name.trim() : null,
            school: p.school ? p.school.trim() : null,
            gender: p.gender,
            phone: p.phone.replace(/[^0-9]/g, ''),
            class_code: p.class_code.trim(),
            receipt_url: p.receipt_url || null,
            payment_status: 'no',
            reminder_status: 'no',
          },
        ],
        { onConflict: 'chinese_name,phone,class_code', ignoreDuplicates: true }
      )
      .select();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, imported: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
