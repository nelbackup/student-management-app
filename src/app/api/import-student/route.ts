import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const safeTrim = (val: unknown): string => (typeof val === 'string' ? val.trim() : '');

async function generateNextStudentCode(): Promise<string> {
  const { data, error } = await supabase
    .from('students')
    .select('student_code')
    .order('student_code', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return 'S0000000001';
  }

  const lastCode = data[0].student_code;
  const numericPart = parseInt(lastCode.replace(/[^0-9]/g, ''), 10);
  const nextNumber = isNaN(numericPart) ? 1 : numericPart + 1;
  return `S${nextNumber.toString().padStart(10, '0')}`;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();

    if (!rawBody) {
      return NextResponse.json({ success: false, error: '缺少請求內容 (Empty body)' }, { status: 400 });
    }

    // Defensive unpacking: accept both an array [{...}] or single object {...}
    const body = Array.isArray(rawBody) ? rawBody[0] : rawBody;

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: '無效的資料格式 (Invalid JSON object)' }, { status: 400 });
    }

    const chinese_name = safeTrim(body.chinese_name);
    const english_name = safeTrim(body.english_name);
    const school = safeTrim(body.school);
    const gender = safeTrim(body.gender) || '男';
    const phone = safeTrim(body.phone);
    const class_code = safeTrim(body.class_code);
    const payment_status = safeTrim(body.payment_status) || 'no';
    const receipt_url = safeTrim(body.receipt_url) || null;

    if (!chinese_name || !english_name || !phone || !class_code) {
      return NextResponse.json(
        { success: false, error: '必填欄位缺失：中文姓名、英文姓名、電話及班別代碼為必填項。' },
        { status: 400 }
      );
    }

    // Auto-generate next student_code if not supplied to prevent primary key collisions
    const student_code = safeTrim(body.student_code) || (await generateNextStudentCode());

    const { data: newStudent, error: insertError } = await supabase
      .from('students')
      .insert([
        {
          student_code,
          chinese_name,
          english_name,
          school,
          gender,
          phone,
          class_code,
          payment_status,
          receipt_url,
          attendance_status: false,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Supabase student insertion error:', insertError);
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: newStudent }, { status: 200 });
  } catch (err: any) {
    console.error('Unhandled import error:', err);
    return NextResponse.json({ success: false, error: err.message || '內部伺服器錯誤' }, { status: 500 });
  }
}