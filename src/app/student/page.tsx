'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import * as XLSX from 'xlsx';
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

type StudentSortField = 'name' | 'gender' | 'school' | 'payment' | 'receipt' | 'phone';

export default function StudentManagementPage() {
  const [activeTab, setActiveTab] = useState<'listing' | 'enrolment'>('listing');
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classList, setClassList] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [sortField, setSortField] = useState<StudentSortField>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [savingManual, setSavingManual] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [showExcelSection, setShowExcelSection] = useState(false);
  const [excelRows, setExcelRows] = useState<any[]>([]);
  const [savingExcel, setSavingExcel] = useState(false);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const { data: studentData } = await supabase.from('students').select('*');
      setStudents(studentData || []);
      const { data: classesData } = await supabase.from('classes').select('class_code, class_name, duration');
      setClassList(classesData || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleSort = (field: StudentSortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      let res = 0;
      switch (sortField) {
        case 'name':
          res = (a.chinese_name || '').localeCompare(b.chinese_name || '', 'zh-Hant');
          break;
        case 'gender':
          res = a.gender.localeCompare(b.gender, 'zh-Hant');
          break;
        case 'school':
          res = (a.school || '').localeCompare(b.school || '', 'zh-Hant');
          break;
        case 'payment':
          res = a.payment_status.localeCompare(b.payment_status);
          break;
        case 'receipt':
          res = (a.receipt_url ? '1' : '0').localeCompare(b.receipt_url ? '1' : '0');
          break;
        case 'phone':
          res = a.phone.localeCompare(b.phone);
          break;
      }
      return sortAsc ? res : -res;
    });
  }, [students, sortField, sortAsc]);

  const renderSortIndicator = (field: StudentSortField) => {
    if (sortField !== field) return <span className="ml-1 text-sky-200 opacity-60">↕</span>;
    return <span className="ml-1 text-amber-300 font-bold">{sortAsc ? '▲' : '▼'}</span>;
  };

  const getWhatsAppLink = (phone: string, studentName: string) => {
    const cleaned = phone.replace(/[^0-9]/g, '');
    const fullNumber = cleaned.startsWith('852') ? cleaned : `852${cleaned}`;
    return `https://web.whatsapp.com/send?phone=${fullNumber}&text=${encodeURIComponent(
      `您好，這是關於 ${studentName} 的課堂點名與上課通知。`
    )}`;
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.chinese_name.trim() || !formData.phone || !formData.class_code) {
      setFeedback({ type: 'error', message: '請填寫必填欄位。' });
      return;
    }
    setSavingManual(true);
    try {
      const { data: latestRecords } = await supabase
        .from('students')
        .select('student_code')
        .order('student_code', { ascending: false })
        .limit(1);

      let nextNum =
        latestRecords && latestRecords.length > 0
          ? parseInt(latestRecords[0].student_code.replace(/\D/g, ''), 10) + 1
          : 1;
      const newStudentCode = `S${nextNum.toString().padStart(10, '0')}`;

      // Fixed: changed brackets to parentheses for supabase.from(...)
      const { error } = await supabase.from('students').insert([
        {
          student_code: newStudentCode,
          chinese_name: formData.chinese_name.trim(),
          english_name: formData.english_name.trim(),
          gender: formData.gender,
          school: formData.school.trim(),
          phone: formData.phone.replace(/\D/g, ''),
          class_code: formData.class_code.trim(),
          payment_status: formData.payment_status,
          attendance_status: false,
        },
      ]);

      if (error) throw error;

      setFeedback({ type: 'success', message: '學員登記成功！' });
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
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingManual(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 bg-white rounded-full shadow-md border-2 border-amber-400 p-1">
              <Image src="/logo.png" alt="Logo" fill className="object-contain rounded-full" priority />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Luminous Minds
                </span>
                <span className="text-xs font-bold text-slate-500">Miss Ann</span>
              </div>
              <h1 className="text-2xl font-black text-sky-950 mt-0.5">學員管理中心</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/templates"
              className="px-4 py-2 text-sm font-bold text-sky-900 bg-amber-100 hover:bg-amber-200 rounded-xl border border-amber-300 shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>💬</span> 預設通訊範本管理
            </Link>
            <Link
              href="/roster"
              className="px-4 py-2 text-sm font-semibold text-sky-900 bg-white hover:bg-sky-50 rounded-xl border border-sky-200 shadow-sm transition"
            >
              返回點名名冊
            </Link>
          </div>
        </div>

        <div className="flex border-b border-slate-200 bg-white p-1 rounded-2xl shadow-sm">
          <button
            onClick={() => { setActiveTab('listing'); setFeedback(null); }}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition cursor-pointer ${
              activeTab === 'listing' ? 'bg-sky-950 text-white shadow-md border-b-2 border-amber-400' : 'text-slate-600 hover:text-sky-950 hover:bg-slate-50'
            }`}
          >
            📋 學員名冊列表
          </button>
          <button
            onClick={() => { setActiveTab('enrolment'); setFeedback(null); }}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition cursor-pointer ${
              activeTab === 'enrolment' ? 'bg-sky-950 text-white shadow-md border-b-2 border-amber-400' : 'text-slate-600 hover:text-sky-950 hover:bg-slate-50'
            }`}
          >
            ✍️ 新學員登記報讀
          </button>
        </div>

        {feedback && (
          <div className={`p-4 rounded-xl text-sm font-medium border flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
            <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{feedback.message}</span>
          </div>
        )}

        {activeTab === 'listing' && (
          <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-sky-950 text-white select-none">
                <tr>
                  <th onClick={() => handleSort('name')} className="px-4 py-3.5 text-left text-xs font-semibold cursor-pointer">學生名字 {renderSortIndicator('name')}</th>
                  <th onClick={() => handleSort('gender')} className="px-4 py-3.5 text-left text-xs font-semibold cursor-pointer">性別 {renderSortIndicator('gender')}</th>
                  <th onClick={() => handleSort('school')} className="px-4 py-3.5 text-left text-xs font-semibold cursor-pointer">就讀學校 {renderSortIndicator('school')}</th>
                  <th onClick={() => handleSort('payment')} className="px-4 py-3.5 text-center text-xs font-semibold cursor-pointer">付款情況 {renderSortIndicator('payment')}</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold">收據檢視</th>
                  <th onClick={() => handleSort('phone')} className="px-4 py-3.5 text-left text-xs font-semibold cursor-pointer">聯絡電話 {renderSortIndicator('phone')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedStudents.map((st) => (
                  <tr key={st.student_code} className="hover:bg-sky-50/40 transition">
                    <td className="px-4 py-3">
                      <Link href={`/student/edit/${st.student_code}`} className="font-bold text-sky-950 underline decoration-sky-300 hover:text-amber-600">{st.chinese_name}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{st.gender}</td>
                    <td className="px-4 py-3 text-slate-600">{st.school || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${st.payment_status === 'yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {st.payment_status === 'yes' ? '已付款' : '未付款'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{st.receipt_url ? <a href={st.receipt_url} target="_blank" rel="noreferrer" className="text-sky-700 underline text-xs">檢視收據</a> : '-'}</td>
                    <td className="px-4 py-3 font-mono">
                      <a href={getWhatsAppLink(st.phone, st.chinese_name)} target="whatsapp_web_session" rel="noreferrer" className="text-blue-600 underline">{st.phone}</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'enrolment' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-sky-950 mb-6 pb-3 border-b">新學員手動登記表</h2>
              <form onSubmit={handleManualSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">中文姓名 *</label>
                  <input type="text" value={formData.chinese_name} onChange={(e) => setFormData({ ...formData, chinese_name: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">聯絡電話 (8位) *</label>
                  <input type="tel" maxLength={8} value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">所屬班別 *</label>
                  <select value={formData.class_code} onChange={(e) => setFormData({ ...formData, class_code: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm bg-white font-mono">
                    <option value="">請選擇班別代碼</option>
                    {classList.map((c) => <option key={c.class_code} value={c.class_code}>{c.class_code} ({c.class_name})</option>)}
                  </select>
                </div>
                <button type="submit" disabled={savingManual} className="w-full py-3 bg-sky-950 hover:bg-sky-900 text-white font-bold rounded-xl text-sm shadow cursor-pointer">
                  {savingManual ? '登記中...' : '確認新增學員'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}