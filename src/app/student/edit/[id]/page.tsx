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
  status?: string;
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

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
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
        const { data: classList, error: classErr } = await supabase
          .from('classes')
          .select('class_code, class_name, lesson_date, duration, status')
          .order('lesson_date', { ascending: true });

        if (classErr) throw classErr;

        const sortedClasses = (classList || []).sort((a, b) => {
          const timeA = a.duration ? a.duration.split('-')[0].trim() : '00:00';
          const timeB = b.duration ? b.duration.split('-')[0].trim() : '00:00';
          const dtA = new Date(`${a.lesson_date}T${timeA.length === 4 ? '0' + timeA : timeA}:00`);
          const dtB = new Date(`${b.lesson_date}T${timeB.length === 4 ? '0' + timeB : timeB}:00`);
          return dtA.getTime() - dtB.getTime();
        });

        setAvailableClasses(sortedClasses);

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

  const isSessionExpired = (lessonDate: string, durationStr: string) => {
    try {
      const parts = (durationStr || '').split('-');
      const endTimeStr = (parts[1] || parts[0] || '23:59').trim();
      const [endHour, endMin] = endTimeStr.split(':').map((v) => parseInt(v, 10) || 0);
      const classEnd = new Date(lessonDate);
      classEnd.setHours(endHour, endMin, 0, 0);
      return new Date() > classEnd;
    } catch {
      return new Date(lessonDate) < new Date();
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.chinese_name.trim()) {
      newErrors.chinese_name = '請輸入中文姓名';
    } else if (!/^[\u4e00-\u9fa5a-zA-Z\s]{2,20}$/.test(form.chinese_name.trim())) {
      newErrors.chinese_name = '中文姓名格式不正確（長度需介乎 2 至 20 字元）';
    }

    if (!form.english_name.trim()) {
      newErrors.english_name = '請輸入英文姓名';
    } else if (!/^[A-Za-z\s'-]{2,40}$/.test(form.english_name.trim())) {
      newErrors.english_name = '英文姓名只可包含英文字母、空格或連字號';
    }

    const cleanPhone = form.phone.replace(/[\s-]/g, '');
    if (!cleanPhone) {
      newErrors.phone = '請輸入聯絡電話';
    } else if (!/^[4-9]\d{7}$/.test(cleanPhone)) {
      newErrors.phone = '請填寫有效的 8 位香港電話號碼（例如：91234567）';
    }

    if (!form.class_code) {
      newErrors.class_code = '請選擇所屬堂別時段';
    }

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
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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

    if (!validate()) return;
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <span>正在載入學員資料與排堂清單...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
        {/* Header */}
        <div className="pb-5 mb-6 border-b border-gray-100">
          <h1 className="text-2xl font-black text-gray-900">修改學員資料</h1>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">學員編號</span>
            <span className="text-base font-mono font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200">
              {studentCode}
            </span>
          </div>
        </div>

        {generalError && (
          <div className="p-4 mb-6 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-start gap-2">
            <span>⚠️</span>
            <span>{generalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8" noValidate>
          {/* SECTION 1: 學生個人資料 */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <div className="w-2 h-4 bg-purple-700 rounded-full"></div>
              <h2 className="text-base font-bold text-gray-900">第一部分：學生個人資料</h2>
            </div>

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
                    errors.chinese_name ? 'border-rose-400 bg-rose-50/30' : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
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
                    errors.english_name ? 'border-rose-400 bg-rose-50/30' : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
                  }`}
                />
                {errors.english_name && (
                  <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.english_name}</p>
                )}
              </div>
            </div>

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
                  聯絡電話 (香港手機) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="例如：98765432"
                  maxLength={8}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none transition ${
                    errors.phone ? 'border-rose-400 bg-rose-50/30' : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
                  }`}
                />
                {errors.phone && (
                  <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.phone}</p>
                )}
              </div>
            </div>

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
          </section>

          {/* SECTION 2: 繳費情況與收據 */}
          <section className="space-y-4 pt-2">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <div className="w-2 h-4 bg-emerald-600 rounded-full"></div>
              <h2 className="text-base font-bold text-gray-900">第二部分：繳費及收據記錄</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">
                  繳費情況 <span className="text-rose-600">*</span>
                </label>
                <select
                  name="payment_status"
                  value={form.payment_status}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 font-medium"
                >
                  <option value="no">未付款 (no)</option>
                  <option value="yes">已付款 (yes)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-bold text-gray-800">收據連結</label>
                  {form.receipt_url && (
                    <a
                      href={form.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-purple-600 underline font-semibold hover:text-purple-800"
                    >
                      開啟預覽
                    </a>
                  )}
                </div>
                <input
                  type="url"
                  name="receipt_url"
                  value={form.receipt_url}
                  onChange={handleChange}
                  placeholder="https://example.com/receipt.jpg"
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none transition ${
                    errors.receipt_url ? 'border-rose-400 bg-rose-50/30' : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
                  }`}
                />
                {errors.receipt_url && (
                  <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.receipt_url}</p>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 3: 課堂報讀與出席紀錄 (Vertical Chronological Order) */}
          <section className="space-y-4 pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-4 bg-indigo-600 rounded-full"></div>
                <h2 className="text-base font-bold text-gray-900">第三部分：課堂報讀與出席紀錄</h2>
              </div>
              <span className="text-xs text-gray-400">依時序直列排序</span>
            </div>

            <div className="flex flex-wrap gap-4 text-xs bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block"></span>
                <span className="text-gray-700 font-medium">綠色：有效課堂（點擊進入分班指派）</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-600 inline-block"></span>
                <span className="text-gray-700 font-medium">紅色：已過期缺席（停用）</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-gray-400 inline-block"></span>
                <span className="text-gray-700 font-medium">灰色：已過期出席 / 已封存（停用）</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {availableClasses.map((cls) => {
                const isSelected = form.class_code === cls.class_code;
                const expired = isSessionExpired(cls.lesson_date, cls.duration);
                const isSuspended = cls.status === 'suspended';

                let buttonState: 'active' | 'inactive-absent' | 'inactive-grey' = 'active';

                if (expired || isSuspended) {
                  if (isSelected && !form.attendance_status) {
                    buttonState = 'inactive-absent';
                  } else {
                    buttonState = 'inactive-grey';
                  }
                } else {
                  buttonState = 'active';
                }

                const handleSessionClick = () => {
                  if (buttonState === 'active') {
                    router.push(`/classes?tab=assignment&student=${encodeURIComponent(studentCode)}`);
                  }
                };

                return (
                  <button
                    key={cls.class_code}
                    type="button"
                    disabled={buttonState !== 'active'}
                    onClick={handleSessionClick}
                    className={`w-full p-4 rounded-xl border text-left transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      buttonState === 'active'
                        ? 'bg-emerald-600 border-emerald-700 text-white shadow-sm hover:bg-emerald-700 hover:shadow-md cursor-pointer'
                        : buttonState === 'inactive-absent'
                        ? 'bg-rose-50 border-rose-200 text-rose-800 opacity-80 cursor-not-allowed'
                        : 'bg-gray-100 border-gray-200 text-gray-500 opacity-60 cursor-not-allowed'
                    } ${
                      isSelected && buttonState === 'active'
                        ? 'ring-2 ring-emerald-300 ring-offset-2'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg ${
                          buttonState === 'active'
                            ? 'bg-white/20 text-white'
                            : buttonState === 'inactive-absent'
                            ? 'bg-rose-200 text-rose-900'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {cls.class_code}
                      </span>
                      <div>
                        <span className="font-bold text-sm block">{cls.class_name}</span>
                        <div className="text-xs font-mono opacity-90 mt-0.5">
                          📅 {cls.lesson_date} | ⏰ {cls.duration}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {isSelected && (
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            buttonState === 'active' ? 'bg-white text-emerald-800' : 'bg-rose-200 text-rose-900'
                          }`}
                        >
                          現讀堂別
                        </span>
                      )}
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          buttonState === 'active'
                            ? 'bg-emerald-700/80 text-white border border-emerald-400/50'
                            : buttonState === 'inactive-absent'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {buttonState === 'active'
                          ? '有效堂別 (點擊前往分班指派 ➔)'
                          : buttonState === 'inactive-absent'
                          ? '✕ 已過期缺席 (停用)'
                          : '已封存 / 已出席 (停用)'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Submission and Relocated Cancel Action */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-sm shadow transition disabled:opacity-50 cursor-pointer"
            >
              {saving ? '正在儲存變更...' : '儲存變更'}
            </button>

            <Link
              href="/roster"
              className="block w-full py-2.5 text-center text-sm font-semibold text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition"
            >
              取消返回
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}