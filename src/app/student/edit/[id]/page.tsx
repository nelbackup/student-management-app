'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ClassOption {
  class_code: string;
  class_name: string;
  lesson_date: string;
  duration: string;
}

interface FormState {
  chinese_name: string;
  english_name: string;
  school: string;
  gender: string;
  phone: string;
  class_code: string;
  payment_status: string;
  receipt_url: string;
  attendance_status: boolean;
}

export default function EditStudentPage() {
  const params = useParams();
  const router = useRouter();
  const studentCode = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<ClassOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
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

    const loadData = async () => {
      setLoading(true);
      setGeneralError(null);

      try {
        // 1. Fetch available classes from database
        const { data: classList, error: classErr } = await supabase
          .from('classes')
          .select('class_code, class_name, lesson_date, duration')
          .order('lesson_date', { ascending: true });

        if (classErr) throw classErr;
        setAvailableClasses(classList || []);

        // 2. Fetch student details by ID
        const { data: student, error: studentErr } = await supabase
          .from('students')
          .select('*')
          .eq('student_code', studentCode)
          .single();

        if (studentErr || !student) {
          throw new Error('找不到該學生資料或編號無效。');
        }

        setForm({
          chinese_name: student.chinese_name || '',
          english_name: student.english_name || '',
          school: student.school || '',
          gender: student.gender || '男',
          phone: student.phone || '',
          class_code: student.class_code || '',
          payment_status: student.payment_status || 'no',
          receipt_url: student.receipt_url || '',
          attendance_status: !!student.attendance_status,
        });
      } catch (err: any) {
        setGeneralError(err.message || '載入資料失敗');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [studentCode]);

  // Client-side strict validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Chinese Name Validation
    if (!form.chinese_name.trim()) {
      newErrors.chinese_name = '請輸入中文姓名';
    } else if (!/^[\u4e00-\u9fa5a-zA-Z\s]{2,20}$/.test(form.chinese_name.trim())) {
      newErrors.chinese_name = '中文姓名格式不正確（長度需介乎 2 至 20 字元）';
    }

    // English Name Validation
    if (!form.english_name.trim()) {
      newErrors.english_name = '請輸入英文姓名';
    } else if (!/^[A-Za-z\s'-]{2,40}$/.test(form.english_name.trim())) {
      newErrors.english_name = '英文姓名只可包含英文字母、空格或連字號';
    }

    // Phone Validation (Hong Kong 8-digit mobile standard)
    const cleanPhone = form.phone.replace(/[\s-]/g, '');
    if (!cleanPhone) {
      newErrors.phone = '請輸入聯絡電話';
    } else if (!/^[4-9]\d{7}$/.test(cleanPhone)) {
      newErrors.phone = '請填寫有效的 8 位香港電話號碼（例如：91234567）';
    }

    // Class Code Validation against database records
    if (!form.class_code) {
      newErrors.class_code = '請選擇分配班別';
    } else if (
      availableClasses.length > 0 &&
      !availableClasses.some((c) => c.class_code === form.class_code)
    ) {
      newErrors.class_code = '所選班別代碼不存在於資料庫中，請重新選擇';
    }

    // Receipt URL Validation
    if (form.receipt_url.trim()) {
      try {
        const parsedUrl = new URL(form.receipt_url.trim());
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          newErrors.receipt_url = '收據網址必須以 http:// 或 https:// 開頭';
        }
      } catch {
        newErrors.receipt_url = '請輸入有效的網址格式（例如：https://...）';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setForm((prev) => ({ ...prev, [name]: val }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('students')
        .update({
          chinese_name: form.chinese_name.trim(),
          english_name: form.english_name.trim(),
          school: form.school.trim(),
          gender: form.gender,
          phone: form.phone.replace(/[\s-]/g, '').trim(),
          class_code: form.class_code.trim(),
          payment_status: form.payment_status,
          receipt_url: form.receipt_url.trim() || null,
          attendance_status: form.attendance_status,
        })
        .eq('student_code', studentCode);

      if (error) {
        if (error.message.includes('unique_student_per_class')) {
          throw new Error('更新失敗：此學員或電話已在該班級登記，不可重複報讀。');
        }
        throw error;
      }

      router.push('/roster');
    } catch (err: any) {
      setGeneralError(err.message || '更新資料時發生錯誤');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`確定要刪除學員【${form.chinese_name} (${studentCode})】的登記記錄嗎？此操作無法還原。`)) {
      return;
    }

    setSaving(true);
    setGeneralError(null);

    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('student_code', studentCode);

      if (error) throw error;

      router.push('/roster');
    } catch (err: any) {
      setGeneralError(err.message || '刪除學員記錄失敗');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <span>正在載入學員資料與班別清單...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
        {/* Header with enlarged ID */}
        <div className="flex items-start justify-between pb-5 mb-6 border-b border-gray-100">
          <div>
            <h1 className="text-2xl font-black text-gray-900">修改學員資料</h1>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">學員編號</span>
              <span className="text-base font-mono font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200">
                {studentCode}
              </span>
            </div>
          </div>
          <Link
            href="/roster"
            className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition"
          >
            取消返回
          </Link>
        </div>

        {/* Diagnostic Banner */}
        {generalError && (
          <div className="p-4 mb-6 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-start gap-2">
            <span>⚠️</span>
            <span>{generalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Chinese & English Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">
                中文姓名 <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                name="chinese_name"
                value={form.chinese_name}
                onChange={handleChange}
                placeholder="例如：黃子健"
                className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none transition ${
                  errors.chinese_name
                    ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-400'
                    : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
                }`}
              />
              {errors.chinese_name && (
                <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.chinese_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">
                英文姓名 <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                name="english_name"
                value={form.english_name}
                onChange={handleChange}
                placeholder="例如：Lucas"
                className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none transition ${
                  errors.english_name
                    ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-400'
                    : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
                }`}
              />
              {errors.english_name && (
                <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.english_name}</p>
              )}
            </div>
          </div>

          {/* Gender & HK Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">
                性別 <span className="text-rose-600">*</span>
              </label>
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">
                聯絡電話 (香港 8 位號碼) <span className="text-rose-600">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="例如：98765432"
                maxLength={8}
                className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none transition ${
                  errors.phone
                    ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-400'
                    : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
                }`}
              />
              {errors.phone && (
                <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.phone}</p>
              )}
            </div>
          </div>

          {/* School */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">就讀學校</label>
            <input
              type="text"
              name="school"
              value={form.school}
              onChange={handleChange}
              placeholder="例如：喇沙小學"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
          </div>

          {/* Class Code & Payment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">
                班別代碼 (從資料庫查詢) <span className="text-rose-600">*</span>
              </label>
              <select
                name="class_code"
                value={form.class_code}
                onChange={handleChange}
                className={`w-full px-3.5 py-2.5 border rounded-xl text-sm bg-white font-mono focus:outline-none transition ${
                  errors.class_code
                    ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-400'
                    : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
                }`}
              >
                <option value="">請選擇班別代碼</option>
                {availableClasses.map((cls) => (
                  <option key={cls.class_code} value={cls.class_code}>
                    {cls.class_code} ({cls.duration || cls.class_name})
                  </option>
                ))}
              </select>
              {errors.class_code && (
                <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.class_code}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">
                繳費情況 <span className="text-rose-600">*</span>
              </label>
              <select
                name="payment_status"
                value={form.payment_status}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                <option value="no">未付款 (no)</option>
                <option value="yes">已付款 (yes)</option>
              </select>
            </div>
          </div>

          {/* Receipt URL */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">收據連結</label>
            <input
              type="url"
              name="receipt_url"
              value={form.receipt_url}
              onChange={handleChange}
              placeholder="https://example.com/receipt.jpg"
              className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none transition ${
                errors.receipt_url
                  ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-400'
                  : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
              }`}
            />
            {errors.receipt_url && (
              <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.receipt_url}</p>
            )}
          </div>

          {/* Attendance Checkbox */}
          <div className="flex items-center pt-2">
            <input
              id="attendance_status"
              type="checkbox"
              name="attendance_status"
              checked={form.attendance_status}
              onChange={handleChange}
              className="w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
            />
            <label
              htmlFor="attendance_status"
              className="ml-2.5 text-sm font-bold text-gray-700 select-none cursor-pointer"
            >
              出席簽到 (Checked = Present)
            </label>
          </div>

          {/* Split Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="w-1/3 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-sm border border-rose-200 transition cursor-pointer disabled:opacity-50"
            >
              刪除此學員
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-2/3 py-3 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-sm shadow transition disabled:opacity-50 cursor-pointer"
            >
              {saving ? '正在儲存變更...' : '儲存變更'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}