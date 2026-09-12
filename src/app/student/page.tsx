'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface StudentRecord {
  student_code: string;
  chinese_name: string;
  english_name: string;
  gender: string;
  school: string;
  phone: string;
  class_code: string;
  payment_status: string;
  receipt_url: string | null;
  attendance_status: boolean;
}

interface ClassOption {
  class_code: string;
  class_name: string;
  duration: string;
}

export default function StudentManagementPage() {
  const [activeTab, setActiveTab] = useState<'listing' | 'enrolment'>('listing');
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classList, setClassList] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual Enrolment Form State
  const [formData, setFormData] = useState({
    chinese_name: '',
    english_name: '',
    gender: '男',
    school: '',
    phone: '',
    class_code: '',
    payment_status: 'no',
    receipt_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadInitialData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const { data: studentData, error: studentErr } = await supabase
        .from('students')
        .select('*')
        .order('student_code', { ascending: false });
      if (studentErr) throw studentErr;
      setStudents(studentData || []);

      const { data: classesData, error: classErr } = await supabase
        .from('classes')
        .select('class_code, class_name, duration')
        .order('lesson_date', { ascending: true });
      if (classErr) throw classErr;
      setClassList(classesData || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || '無法載入學員資料' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!formData.chinese_name.trim() || !formData.phone.trim() || !formData.class_code.trim()) {
      setFeedback({ type: 'error', message: '請填寫必填欄位（中文姓名、電話及班別代碼）。' });
      return;
    }

    setSaving(true);
    try {
      // 1. Generate sequential student ID
      const { data: latestRecords } = await supabase
        .from('students')
        .select('student_code')
        .order('student_code', { ascending: false })
        .limit(1);

      let nextNum = 1;
      if (latestRecords && latestRecords.length > 0) {
        const numPart = parseInt(latestRecords[0].student_code.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(numPart)) nextNum = numPart + 1;
      }
      const newStudentCode = `S${nextNum.toString().padStart(10, '0')}`;

      // 2. Insert student
      const { error } = await supabase.from('students').insert([
        {
          student_code: newStudentCode,
          chinese_name: formData.chinese_name.trim(),
          english_name: formData.english_name.trim(),
          gender: formData.gender,
          school: formData.school.trim(),
          phone: formData.phone.trim(),
          class_code: formData.class_code.trim(),
          payment_status: formData.payment_status,
          receipt_url: formData.receipt_url.trim() || null,
          attendance_status: false,
        },
      ]);

      if (error) {
        if (error.message.includes('unique_student_per_class')) {
          throw new Error('該學員或電話已在所選班別登記，不可重複報名。');
        }
        throw error;
      }

      setFeedback({ type: 'success', message: `學員 ${formData.chinese_name} (${newStudentCode}) 報讀成功！` });
      setFormData({
        chinese_name: '',
        english_name: '',
        gender: '男',
        school: '',
        phone: '',
        class_code: '',
        payment_status: 'no',
        receipt_url: '',
      });
      await loadInitialData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || '報讀失敗' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-gray-200 gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900">學員管理中心 (Student Management)</h1>
            <p className="text-sm text-gray-500 mt-1">管理學員名單、個別登記報讀及批次試算表遷移</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/roster"
              className="px-4 py-2 text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 transition"
            >
              返回點名名冊 (Roster)
            </Link>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6 bg-white p-1 rounded-2xl shadow-sm">
          <button
            onClick={() => {
              setActiveTab('listing');
              setFeedback(null);
            }}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition cursor-pointer ${
              activeTab === 'listing'
                ? 'bg-purple-700 text-white shadow'
                : 'text-gray-600 hover:text-purple-700 hover:bg-gray-50'
            }`}
          >
            📋 學員名冊列表 (Student Listing)
          </button>
          <button
            onClick={() => {
              setActiveTab('enrolment');
              setFeedback(null);
            }}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition cursor-pointer ${
              activeTab === 'enrolment'
                ? 'bg-purple-700 text-white shadow'
                : 'text-gray-600 hover:text-purple-700 hover:bg-gray-50'
            }`}
          >
            ✍️ 新學員登記報讀 (New Student Enrolment)
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 mb-6 rounded-xl text-sm font-medium border flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{feedback.message}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: Student Listing                                                    */}
        {/* ========================================================================= */}
        {activeTab === 'listing' && (
          <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-purple-700 text-white">
                <tr>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase">學生名字</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase">學生編號</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase">性別</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase">就讀學校</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase">所屬班別</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase">付款情況</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase">收據檢視</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase">聯絡電話</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      載入學員名單中...
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      暫無學員登記記錄。
                    </td>
                  </tr>
                ) : (
                  students.map((st) => (
                    <tr key={st.student_code} className="hover:bg-purple-50/40 transition">
                      <td className="px-4 py-3">
                        <Link
                          href={`/student/edit/${st.student_code}`}
                          className="font-bold text-purple-700 hover:text-purple-900 underline"
                        >
                          {st.chinese_name} {st.english_name ? `(${st.english_name})` : ''}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-700">{st.student_code}</td>
                      <td className="px-4 py-3 text-gray-600">{st.gender}</td>
                      <td className="px-4 py-3 text-gray-600">{st.school || '-'}</td>
                      <td className="px-4 py-3 font-mono font-bold text-purple-800">{st.class_code || '未分班'}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full ${
                            st.payment_status === 'yes'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {st.payment_status === 'yes' ? '已付款' : '未付款'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {st.receipt_url ? (
                          <a
                            href={st.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-purple-600 hover:text-purple-900 font-semibold underline text-xs"
                          >
                            檢視
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700">{st.phone}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: New Student Enrolment                                              */}
        {/* ========================================================================= */}
        {activeTab === 'enrolment' && (
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6 pb-3 border-b">新學員手動登記表</h2>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    中文姓名 <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.chinese_name}
                    onChange={(e) => setFormData({ ...formData, chinese_name: e.target.value })}
                    placeholder="例如：陳大文"
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">英文姓名</label>
                  <input
                    type="text"
                    value={formData.english_name}
                    onChange={(e) => setFormData({ ...formData, english_name: e.target.value })}
                    placeholder="例如：David Chan"
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">性別</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  >
                    <option value="男">男</option>
                    <option value="女">女</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    聯絡電話 (香港 8 位號碼) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={8}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="例如：91234567"
                    className="w-full px-3 py-2 border rounded-xl text-sm font-mono focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">就讀學校</label>
                <input
                  type="text"
                  value={formData.school}
                  onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                  placeholder="例如：拔萃男書院"
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    所屬班別 <span className="text-rose-600">*</span>
                  </label>
                  <select
                    required
                    value={formData.class_code}
                    onChange={(e) => setFormData({ ...formData, class_code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-white font-mono focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  >
                    <option value="">請選擇班別代碼</option>
                    {classList.map((c) => (
                      <option key={c.class_code} value={c.class_code}>
                        {c.class_code} ({c.class_name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">繳費情況</label>
                  <select
                    value={formData.payment_status}
                    onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  >
                    <option value="no">未付款 (no)</option>
                    <option value="yes">已付款 (yes)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">收據連結</label>
                <input
                  type="url"
                  value={formData.receipt_url}
                  onChange={(e) => setFormData({ ...formData, receipt_url: e.target.value })}
                  placeholder="https://example.com/receipt.jpg"
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
              </div>

              <div className="pt-4 space-y-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-sm shadow transition disabled:opacity-50 cursor-pointer"
                >
                  {saving ? '正在登記...' : '確認單筆新增'}
                </button>

                {/* Batch Migration Button */}
                <div className="pt-2 border-t border-gray-100 text-center">
                  <Link
                    href="/import/excel"
                    className="inline-flex items-center justify-center w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-xl text-sm transition"
                  >
                    📥 批次試算表遷移 (Batch Migration via Excel / CSV)
                  </Link>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}