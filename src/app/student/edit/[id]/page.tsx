'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
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
  const [templateContent, setTemplateContent] = useState<string>('');
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
        setAvailableClasses(classList || []);

        const { data: tmpl, error: tmplErr } = await supabase
          .from('message_templates')
          .select('content')
          .eq('message_key', 'MSG-001')
          .single();

        if (!tmplErr && tmpl) {
          setTemplateContent(tmpl.content);
        }

        const { data: student, error: studentErr } = await supabase
          .from('students')
          .select('*')
          .eq('student_code', studentCode)
          .single();

        if (studentErr || !student) {
          throw new Error('找不到該學員資料或編號無效。');
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

  // Generate native WhatsApp Desktop Client link (whatsapp://send)
  const getWhatsAppDesktopLink = (phone: string) => {
    const cleaned = phone.replace(/[^0-9]/g, '');
    const fullNumber = cleaned.startsWith('852') ? cleaned : `852${cleaned}`;

    const enrolledClass = availableClasses.find((c) => c.class_code === form.class_code);
    const classCategory = enrolledClass ? `${enrolledClass.class_name} [${enrolledClass.class_code}]` : '未分班課程';
    const classDate = enrolledClass ? `${enrolledClass.lesson_date} (${enrolledClass.duration})` : '待定';

    const fallbackTemplate = `家長您好~~~
溫馨提示 ({CLASSCATEGORY}) : 
上課時間: {CLASSDATE} (請家長5分鐘前到達)
上課地點: 尖沙咀漆咸道南67-71號 安年大廈 7樓

明天見~~`;

    const activeTemplate = templateContent || fallbackTemplate;

    const message = activeTemplate
      .replace(/{STUDENTNAME}/g, form.chinese_name)
      .replace(/{CLASSCATEGORY}/g, classCategory)
      .replace(/{CLASSDATE}/g, classDate)
      .replace(/{SCHOOL}/g, form.school || '未填寫學校')
      .replace(/{PHONE}/g, form.phone);

    // Using whatsapp:// protocol directly calls up the installed WhatsApp Desktop application
    return `whatsapp://send?phone=${fullNumber}&text=${encodeURIComponent(message)}`;
  };

  const isSessionExpired = (lessonDate: string, durationStr: string) => {
    try {
      const parts = (durationStr || '').split('-');
      const endTimeStr = (parts[1] || parts[0] || '23:59').trim();
      const [endHour, endMin] = endTimeStr.split(':').map((v) => parseInt(v, 10) || 0);
      const classEnd = new Date(lessonDate.split(',')[0].trim());
      classEnd.setHours(endHour, endMin, 0, 0);
      return new Date() > classEnd;
    } catch {
      return new Date(lessonDate.split(',')[0].trim()) < new Date();
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.chinese_name.trim()) {
      newErrors.chinese_name = '請輸入中文姓名';
    } else if (!/^[\u4e00-\u9fa5a-zA-Z\s]{2,20}$/.test(form.chinese_name.trim())) {
      newErrors.chinese_name = '中文姓名格式不符（長度需介乎 2 至 20 字元）';
    }

    if (form.english_name.trim() && !/^[A-Za-z\s'-]{2,40}$/.test(form.english_name.trim())) {
      newErrors.english_name = '英文姓名只可包含英文字母、空格或連字號';
    }

    const cleanPhone = form.phone.replace(/[\s-]/g, '');
    if (!cleanPhone) {
      newErrors.phone = '請輸入聯絡電話';
    } else if (!/^[4-9]\d{7}$/.test(cleanPhone)) {
      newErrors.phone = '請填寫有效的 8 位香港電話號碼（例如：91234567）';
    }

    if (form.receipt_url.trim()) {
      try {
        const parsedUrl = new URL(form.receipt_url.trim());
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          newErrors.receipt_url = '收據網址必須以 http:// 或 https:// 開頭';
        }
      } catch {
        newErrors.receipt_url = '請輸入正確的網址格式';
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

    if (!validate()) {
      setGeneralError('表單資料填寫有誤，請檢查下方各欄位的紅色提示。');
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
          class_code: form.class_code || null,
          payment_status: form.payment_status,
          receipt_url: form.receipt_url.trim() || null,
          attendance_status: form.attendance_status,
        })
        .eq('student_code', studentCode);

      if (error) {
        if (error.message.includes('unique_student_per_class')) {
          throw new Error('更新失敗：此學員或電話已在該班別登記，不可重複報讀。');
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500">
        <div className="w-8 h-8 border-4 border-sky-800 border-t-transparent rounded-full animate-spin mb-3"></div>
        <span>正在載入學員資料與排堂清單...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-5 mb-6 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="relative w-12 h-12 flex-shrink-0 bg-white rounded-full shadow border border-amber-300 p-0.5">
              <Image
                src="/logo.png"
                alt="Luminous Minds Miss Ann Logo"
                fill
                className="object-contain rounded-full"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-amber-600">
                  Luminous Minds
                </span>
                <span className="text-[11px] font-bold text-slate-400">Miss Ann</span>
              </div>
              <h1 className="text-xl font-black text-sky-950">修改學員資料</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">學員編號</span>
            <span className="text-sm font-mono font-bold text-sky-900 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-200">
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
          {/* 第一部分：學生個人資料 */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-2 h-4 bg-sky-900 rounded-full"></div>
              <h2 className="text-base font-bold text-sky-950">第一部分：學生個人資料</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">
                  中文姓名 <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  name="chinese_name"
                  value={form.chinese_name}
                  onChange={handleChange}
                  placeholder="例如：黃子健"
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none transition ${
                    errors.chinese_name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 focus:ring-2 focus:ring-sky-700'
                  }`}
                />
                {errors.chinese_name && (
                  <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.chinese_name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">英文姓名</label>
                <input
                  type="text"
                  name="english_name"
                  value={form.english_name}
                  onChange={handleChange}
                  placeholder="例如：Lucas"
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none transition ${
                    errors.english_name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 focus:ring-2 focus:ring-sky-700'
                  }`}
                />
                {errors.english_name && (
                  <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.english_name}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">性別</label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-700"
                >
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">
                  聯絡電話 <span className="text-rose-600">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="例如：98765432"
                  maxLength={8}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none transition font-mono ${
                    errors.phone ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 focus:ring-2 focus:ring-sky-700'
                  }`}
                />
                {errors.phone && (
                  <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.phone}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">就讀學校</label>
              <input
                type="text"
                name="school"
                value={form.school}
                onChange={handleChange}
                placeholder="例如：喇沙小學"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-700"
              />
            </div>
          </section>

          {/* 第二部分：繳費及收據記錄 */}
          <section className="space-y-4 pt-2">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-2 h-4 bg-emerald-600 rounded-full"></div>
              <h2 className="text-base font-bold text-sky-950">第二部分：繳費及收據記錄</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">繳費情況</label>
                <select
                  name="payment_status"
                  value={form.payment_status}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-700 font-medium"
                >
                  <option value="no">未付款</option>
                  <option value="yes">已付款</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-bold text-slate-800">收據連結</label>
                  {form.receipt_url && (
                    <a
                      href={form.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-sky-700 underline font-semibold hover:text-sky-950"
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
                    errors.receipt_url ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 focus:ring-2 focus:ring-sky-700'
                  }`}
                />
                {errors.receipt_url && (
                  <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.receipt_url}</p>
                )}
              </div>
            </div>

            {/* WhatsApp Desktop App Button (Labeled "WhatsApp {phone}") */}
            <div className="pt-2">
              <label className="block text-sm font-bold text-slate-800 mb-1.5">
                快速通訊 (直接呼叫 WhatsApp 桌面客戶端發送 MSG-001)
              </label>
              <div>
                {form.phone ? (
                  <a
                    href={getWhatsAppDesktopLink(form.phone)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
                    title="直接透過 WhatsApp 桌面應用程式傳送 MSG-001 範本訊息"
                  >
                    <span>💬</span> WhatsApp {form.phone}
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 italic">請先填寫聯絡電話以啟用 WhatsApp 快捷鍵</span>
                )}
              </div>
            </div>
          </section>

          {/* 第三部分：所屬報讀課堂與出席紀錄 */}
          <section className="space-y-4 pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-4 bg-sky-900 rounded-full"></div>
                <h2 className="text-base font-bold text-sky-950">第三部分：所屬報讀課堂與出席紀錄</h2>
              </div>
              <span className="text-xs text-slate-400">學員登記堂別</span>
            </div>

            <div className="flex flex-wrap gap-4 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block"></span>
                <span className="text-slate-700 font-medium">綠色：有效堂別（點擊前往調整分班）</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-600 inline-block"></span>
                <span className="text-slate-700 font-medium">紅色：已過期缺席（停用）</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-400 inline-block"></span>
                <span className="text-slate-700 font-medium">灰色：已過期出席 / 封存（停用）</span>
              </div>
            </div>

            {(() => {
              const enrolledClass = availableClasses.find((c) => c.class_code === form.class_code);

              if (!form.class_code || !enrolledClass) {
                return (
                  <div className="p-6 bg-amber-50/70 border border-amber-200 rounded-2xl text-center space-y-3">
                    <div className="text-amber-800 text-sm font-bold">
                      ⚠️ 此學員目前尚未指派任何班別（未分班）
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/classes?student=${encodeURIComponent(studentCode)}`)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-950 hover:bg-sky-900 border-b-2 border-amber-400 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
                    >
                      <span>👉</span> 前往分班指派中心為此學員分班
                    </button>
                  </div>
                );
              }

              const expired = isSessionExpired(enrolledClass.lesson_date, enrolledClass.duration);
              const isSuspended = enrolledClass.status === 'suspended';

              let buttonState: 'active' | 'inactive-absent' | 'inactive-grey' = 'active';

              if (expired || isSuspended) {
                if (!form.attendance_status) {
                  buttonState = 'inactive-absent';
                } else {
                  buttonState = 'inactive-grey';
                }
              } else {
                buttonState = 'active';
              }

              return (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={buttonState !== 'active'}
                    onClick={() => {
                      if (buttonState === 'active') {
                        router.push(`/classes?student=${encodeURIComponent(studentCode)}`);
                      }
                    }}
                    className={`w-full p-4 rounded-xl border text-left transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      buttonState === 'active'
                        ? 'bg-emerald-600 border-emerald-700 text-white shadow-md ring-2 ring-emerald-400 cursor-pointer hover:bg-emerald-700'
                        : buttonState === 'inactive-absent'
                        ? 'bg-rose-50 border-rose-300 text-rose-900 cursor-not-allowed'
                        : 'bg-slate-100 border-slate-200 text-slate-500 opacity-80 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg ${
                          buttonState === 'active'
                            ? 'bg-white/20 text-white'
                            : buttonState === 'inactive-absent'
                            ? 'bg-rose-200 text-rose-900'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {enrolledClass.class_code}
                      </span>
                      <div>
                        <span className="font-bold text-sm block">
                          {enrolledClass.class_name}
                        </span>
                        <div
                          className={`text-xs font-mono mt-0.5 ${
                            buttonState === 'active' ? 'text-white/90' : 'text-slate-500'
                          }`}
                        >
                          📅 {enrolledClass.lesson_date} | ⏰ {enrolledClass.duration}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          buttonState === 'active'
                            ? 'bg-white text-emerald-800 shadow-sm'
                            : buttonState === 'inactive-absent'
                            ? 'bg-rose-200 text-rose-900'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        已登記所屬堂別
                      </span>

                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          buttonState === 'active'
                            ? 'bg-emerald-700 text-white border border-emerald-400/60'
                            : buttonState === 'inactive-absent'
                            ? 'bg-rose-100 text-rose-700 border border-rose-300'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {buttonState === 'active'
                          ? '有效堂別 (點擊調整分班 ➔)'
                          : buttonState === 'inactive-absent'
                          ? '✕ 已過期缺席 (停用)'
                          : '✓ 已出席 / 封存 (停用)'}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })()}
          </section>

          {/* 操作按鈕 */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-sky-950 hover:bg-sky-900 text-white font-bold rounded-xl text-sm shadow transition border-b-2 border-amber-400 disabled:opacity-50 cursor-pointer"
            >
              {saving ? '正在儲存變更...' : '儲存變更'}
            </button>

            <Link
              href="/roster"
              className="block w-full py-2.5 text-center text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
            >
              取消返回
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}