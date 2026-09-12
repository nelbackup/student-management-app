'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EditStudentPage() {
  const params = useParams();
  const router = useRouter();
  const studentCode = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    chinese_name: '',
    english_name: '',
    school: '',
    gender: '男',
    phone: '',
    class_code: '',
    payment_status: 'no',
    receipt_url: '',
    attendance_status: false,
  });

  useEffect(() => {
    if (!studentCode) return;
    const fetchStudent = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('student_code', studentCode)
        .single();

      if (error || !data) {
        setErrorMsg('找不到該學員資料');
      } else {
        setForm({
          chinese_name: data.chinese_name || '',
          english_name: data.english_name || '',
          school: data.school || '',
          gender: data.gender || '男',
          phone: data.phone || '',
          class_code: data.class_code || '',
          payment_status: data.payment_status || 'no',
          receipt_url: data.receipt_url || '',
          attendance_status: !!data.attendance_status,
        });
      }
      setLoading(false);
    };

    fetchStudent();
  }, [studentCode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    const { error } = await supabase
      .from('students')
      .update({
        chinese_name: form.chinese_name.trim(),
        english_name: form.english_name.trim(),
        school: form.school.trim(),
        gender: form.gender,
        phone: form.phone.trim(),
        class_code: form.class_code.trim(),
        payment_status: form.payment_status,
        receipt_url: form.receipt_url.trim() || null,
        attendance_status: form.attendance_status,
      })
      .eq('student_code', studentCode);

    setSaving(false);

    if (error) {
      setErrorMsg(`更新失敗: ${error.message}`);
    } else {
      router.push('/roster');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">載入學員資料中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-md border border-gray-100">
        <div className="flex items-center justify-between pb-4 mb-6 border-b">
          <div>
            <h1 className="text-xl font-bold text-gray-800">修改學員資料</h1>
            <p className="text-xs text-purple-700 font-mono mt-1">{studentCode}</p>
          </div>
          <Link href="/roster" className="text-sm text-gray-500 hover:text-gray-800">
            取消返回
          </Link>
        </div>

        {errorMsg && <div className="p-3 mb-4 rounded bg-red-50 text-red-700 text-sm border border-red-200">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">中文姓名 *</label>
              <input required type="text" name="chinese_name" value={form.chinese_name} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">英文姓名 *</label>
              <input required type="text" name="english_name" value={form.english_name} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">性別</label>
              <select name="gender" value={form.gender} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">聯絡電話 *</label>
              <input required type="text" name="phone" value={form.phone} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">就讀學校</label>
            <input type="text" name="school" value={form.school} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">班別代碼 *</label>
              <input required type="text" name="class_code" value={form.class_code} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">繳費情況</label>
              <select name="payment_status" value={form.payment_status} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="no">未付款 (no)</option>
                <option value="yes">已付款 (yes)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">收據連結</label>
            <input type="url" name="receipt_url" value={form.receipt_url} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>

          <div className="flex items-center pt-2">
            <input id="attendance_status" type="checkbox" name="attendance_status" checked={form.attendance_status} onChange={handleChange} className="w-4 h-4 text-purple-600 rounded" />
            <label htmlFor="attendance_status" className="ml-2 text-sm text-gray-700">出席簽到 (Checked = Present)</label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full mt-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-medium rounded-lg text-sm shadow transition disabled:opacity-50"
          >
            {saving ? '儲存中...' : '儲存變更'}
          </button>
        </form>
      </div>
    </div>
  );
}