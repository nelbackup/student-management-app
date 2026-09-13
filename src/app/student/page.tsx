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

interface ParsedExcelRow {
  rowNum: number;
  student_code?: string;
  chinese_name: string;
  english_name: string;
  school?: string;
  gender?: string;
  phone: string;
  class_code: string;
  payment_status?: string;
  receipt_url?: string;
  validationError?: string;
}

type StudentSortField = 'name' | 'gender' | 'school' | 'payment' | 'receipt' | 'phone';

export default function StudentManagementPage() {
  const [activeTab, setActiveTab] = useState<'listing' | 'enrolment'>('listing');
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classList, setClassList] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting state
  const [sortField, setSortField] = useState<StudentSortField>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Manual Form State
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

  // Excel Migration Inline State
  const [showExcelSection, setShowExcelSection] = useState(false);
  const [excelRows, setExcelRows] = useState<ParsedExcelRow[]>([]);
  const [excelFileName, setExcelFileName] = useState('');
  const [savingExcel, setSavingExcel] = useState(false);

  const loadInitialData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const { data: studentData, error: studentErr } = await supabase.from('students').select('*');
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

  const handleSort = (field: StudentSortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      let res = 0;
      switch (sortField) {
        case 'name': {
          const nameA = a.chinese_name || a.english_name || '';
          const nameB = b.chinese_name || b.english_name || '';
          res = nameA.localeCompare(nameB, 'zh-Hant');
          break;
        }
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
    const text = encodeURIComponent(`您好，這是關於 ${studentName} 的課堂點名與上課通知。`);
    return `https://web.whatsapp.com/send?phone=${fullNumber}&text=${text}`;
  };

  const validateManualForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.chinese_name.trim()) {
      errors.chinese_name = '請輸入中文姓名';
    }
    const cleanPhone = formData.phone.replace(/[\s-]/g, '');
    if (!cleanPhone) {
      errors.phone = '請輸入聯絡電話';
    } else if (!/^[4-9]\d{7}$/.test(cleanPhone)) {
      errors.phone = '請輸入有效的 8 位香港電話號碼（4-9 開頭）';
    }
    if (!formData.class_code) {
      errors.class_code = '請選擇所屬班別代碼';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!validateManualForm()) {
      setFeedback({ type: 'error', message: '表單填寫有誤，請修正後再送出。' });
      return;
    }

    setSavingManual(true);
    try {
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

      const { error } = await supabase.from('students').insert([
        {
          student_code: newStudentCode,
          chinese_name: formData.chinese_name.trim(),
          english_name: formData.english_name.trim(),
          gender: formData.gender,
          school: formData.school.trim(),
          phone: formData.phone.replace(/[\s-]/g, '').trim(),
          class_code: formData.class_code.trim(),
          payment_status: formData.payment_status,
          receipt_url: formData.receipt_url.trim() || null,
          attendance_status: false,
        },
      ]);

      if (error) throw error;

      setFeedback({ type: 'success', message: `學員 ${formData.chinese_name} 登記成功！` });
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
      setFeedback({ type: 'error', message: err.message || '登記失敗' });
    } finally {
      setSavingManual(false);
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFeedback(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        if (rawJson.length === 0) {
          setFeedback({ type: 'error', message: '試算表內沒有可讀取的資料列。' });
          return;
        }

        const mapped: ParsedExcelRow[] = rawJson.map((row, idx) => {
          const rowNum = idx + 2;
          const chinese_name = String(row['chinese_name'] || row['中文姓名'] || row['學生名字'] || '').trim();
          const phone = String(row['phone'] || row['聯絡電話'] || row['電話'] || '').trim();
          const class_code = String(row['class_code'] || row['班別代碼'] || '').trim();

          let validationError: string | undefined;
          if (!chinese_name) validationError = '缺少姓名';
          else if (!phone) validationError = '缺少聯絡電話';
          else if (!class_code) validationError = '缺少班別代碼';

          return {
            rowNum,
            chinese_name,
            english_name: String(row['english_name'] || '').trim(),
            school: String(row['school'] || '').trim(),
            gender: String(row['gender'] || '男').trim(),
            phone,
            class_code,
            payment_status: String(row['payment_status'] || 'no').trim().toLowerCase() === 'yes' ? 'yes' : 'no',
            validationError,
          };
        });

        setExcelRows(mapped);
      } catch (err: any) {
        setFeedback({ type: 'error', message: `解析失敗: ${err.message}` });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmBatchMigrate = async () => {
    if (excelRows.length === 0) return;
    setSavingExcel(true);
    try {
      const { data: latestRecords } = await supabase
        .from('students')
        .select('student_code')
        .order('student_code', { ascending: false })
        .limit(1);

      let currentNum = 1;
      if (latestRecords && latestRecords.length > 0) {
        const numPart = parseInt(latestRecords[0].student_code.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(numPart)) currentNum = numPart + 1;
      }

      const payload = excelRows.map((row) => ({
        student_code: `S${(currentNum++).toString().padStart(10, '0')}`,
        chinese_name: row.chinese_name,
        english_name: row.english_name,
        school: row.school,
        gender: row.gender,
        phone: row.phone.replace(/[\s-]/g, ''),
        class_code: row.class_code,
        payment_status: row.payment_status,
        attendance_status: false,
      }));

      for (const item of payload) {
        const { error } = await supabase.from('students').upsert(item, { onConflict: 'student_code' });
        if (error) throw error;
      }

      setFeedback({ type: 'success', message: `批次匯入成功！共處理 ${payload.length} 筆資料。` });
      setExcelRows([]);
      setShowExcelSection(false);
      await loadInitialData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: `匯入錯誤: ${err.message}` });
    } finally {
      setSavingExcel(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Brand Header */}
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
              <p className="text-xs text-slate-500">學員名冊瀏覽、登記報讀與通訊管理</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/templates"
              className="px-4 py-2 text-sm font-bold text-sky-900 bg-amber-100 hover:bg-amber-200 rounded-xl border border-amber-300 shadow-sm transition flex items-center gap-1.5"
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

        {/* 頁籤切換 (僅保留兩大功能頁籤) */}
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
          <div className={`p-4 rounded-xl text-sm font-medium border flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
            <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{feedback.message}</span>
          </div>
        )}

        {/* 頁籤 1: 學員名冊列表 */}
        {activeTab === 'listing' && (
          <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-sky-950 text-white select-none">
                <tr>
                  <th onClick={() => handleSort('name')} className="px-4 py-3.5 text-left text-xs font-semibold cursor-pointer hover:bg-sky-900 transition">
                    <div className="flex items-center"><span>學生名字</span>{renderSortIndicator('name')}</div>
                  </th>
                  <th onClick={() => handleSort('gender')} className="px-4 py-3.5 text-left text-xs font-semibold cursor-pointer hover:bg-sky-900 transition">
                    <div className="flex items-center"><span>性別</span>{renderSortIndicator('gender')}</div>
                  </th>
                  <th onClick={() => handleSort('school')} className="px-4 py-3.5 text-left text-xs font-semibold cursor-pointer hover:bg-sky-900 transition">
                    <div className="flex items-center"><span>就讀學校</span>{renderSortIndicator('school')}</div>
                  </th>
                  <th onClick={() => handleSort('payment')} className="px-4 py-3.5 text-center text-xs font-semibold cursor-pointer hover:bg-sky-900 transition">
                    <div className="flex items-center justify-center"><span>付款情況</span>{renderSortIndicator('payment')}</div>
                  </th>
                  <th onClick={() => handleSort('receipt')} className="px-4 py-3.5 text-center text-xs font-semibold cursor-pointer hover:bg-sky-900 transition">
                    <div className="flex items-center justify-center"><span>收據檢視</span>{renderSortIndicator('receipt')}</div>
                  </th>
                  <th onClick={() => handleSort('phone')} className="px-4 py-3.5 text-left text-xs font-semibold cursor-pointer hover:bg-sky-900 transition">
                    <div className="flex items-center"><span>聯絡電話</span>{renderSortIndicator('phone')}</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedStudents.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400">暫無學員登記記錄。</td></tr>
                ) : (
                  sortedStudents.map((st) => (
                    <tr key={st.student_code} className="hover:bg-sky-50/40 transition">
                      <td className="px-4 py-3">
                        <Link href={`/student/edit/${st.student_code}`} className="group flex flex-col hover:opacity-80">
                          <span className="font-bold text-sky-950 underline decoration-sky-300 group-hover:text-amber-600">{st.chinese_name}</span>
                          {st.english_name && <span className="text-xs text-slate-400">{st.english_name}</span>}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{st.gender}</td>
                      <td className="px-4 py-3 text-slate-600">{st.school || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full ${st.payment_status === 'yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {st.payment_status === 'yes' ? '已付款' : '未付款'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {st.receipt_url ? (
                          <a href={st.receipt_url} target="_blank" rel="noreferrer" className="text-sky-700 hover:text-sky-900 font-semibold underline text-xs">檢視收據</a>
                        ) : <span className="text-slate-400 text-xs">無</span>}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <a href={getWhatsAppLink(st.phone, st.chinese_name)} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 font-semibold underline decoration-blue-300">
                          {st.phone}
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 頁籤 2: 新學員登記報讀 */}
        {activeTab === 'enrolment' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-sky-950 mb-6 pb-3 border-b">新學員手動登記表</h2>

              <form onSubmit={handleManualSubmit} className="space-y-5" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">中文姓名 <span className="text-rose-600">*</span></label>
                    <input
                      type="text"
                      value={formData.chinese_name}
                      onChange={(e) => setFormData({ ...formData, chinese_name: e.target.value })}
                      placeholder="例如：陳大文"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-700 focus:outline-none"
                    />
                    {formErrors.chinese_name && <p className="mt-1 text-xs text-rose-600 font-semibold">{formErrors.chinese_name}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">英文姓名</label>
                    <input
                      type="text"
                      value={formData.english_name}
                      onChange={(e) => setFormData({ ...formData, english_name: e.target.value })}
                      placeholder="例如：David Chan"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-700 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">性別</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-sky-700 focus:outline-none"
                    >
                      <option value="男">男</option>
                      <option value="女">女</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">聯絡電話 (8位號碼) <span className="text-rose-600">*</span></label>
                    <input
                      type="tel"
                      maxLength={8}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="例如：91234567"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-sky-700 focus:outline-none"
                    />
                    {formErrors.phone && <p className="mt-1 text-xs text-rose-600 font-semibold">{formErrors.phone}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">就讀學校</label>
                  <input
                    type="text"
                    value={formData.school}
                    onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                    placeholder="例如：拔萃男書院"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-700 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">所屬班別 <span className="text-rose-600">*</span></label>
                    <select
                      value={formData.class_code}
                      onChange={(e) => setFormData({ ...formData, class_code: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white font-mono focus:ring-2 focus:ring-sky-700 focus:outline-none"
                    >
                      <option value="">請選擇班別代碼</option>
                      {classList.map((c) => (
                        <option key={c.class_code} value={c.class_code}>{c.class_code} ({c.class_name})</option>
                      ))}
                    </select>
                    {formErrors.class_code && <p className="mt-1 text-xs text-rose-600 font-semibold">{formErrors.class_code}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">繳費情況</label>
                    <select
                      value={formData.payment_status}
                      onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-sky-700 focus:outline-none"
                    >
                      <option value="no">未付款</option>
                      <option value="yes">已付款</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingManual}
                  className="w-full py-3 bg-sky-950 hover:bg-sky-900 text-white font-bold rounded-xl text-sm shadow transition border-b-2 border-amber-400 disabled:opacity-50 cursor-pointer"
                >
                  {savingManual ? '正在登記...' : '確認新增學員'}
                </button>

                <div className="pt-2 border-t border-slate-100 text-center">
                  <button
                    type="button"
                    onClick={() => setShowExcelSection(!showExcelSection)}
                    className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-xl text-sm transition cursor-pointer"
                  >
                    {showExcelSection ? '收合試算表批次匯入' : '批次試算表遷移匯入'}
                  </button>
                </div>
              </form>
            </div>

            {showExcelSection && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-amber-200 space-y-5">
                <h3 className="text-lg font-bold text-sky-950">試算表批次遷移匯入</h3>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelUpload}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-900 hover:file:bg-sky-100 cursor-pointer"
                />

                {excelRows.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <span className="text-sm font-bold text-slate-800">檔案預覽 (共 {excelRows.length} 筆)</span>
                    <button
                      type="button"
                      disabled={savingExcel}
                      onClick={handleConfirmBatchMigrate}
                      className="w-full py-3 bg-sky-950 hover:bg-sky-900 text-white font-bold rounded-xl text-sm shadow transition border-b-2 border-amber-400 cursor-pointer"
                    >
                      {savingExcel ? '正在寫入...' : '確認批次寫入資料庫'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}