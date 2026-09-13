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
  lesson_date: string;
  duration: string;
  max_capacity: number;
  status: string;
  enrolled_count?: number;
  description?: string;
}

interface ParsedExcelRow {
  rowNum: number;
  chinese_name: string;
  english_name: string;
  school?: string;
  gender?: string;
  phone: string;
  class_code: string;
  payment_status?: string;
  receipt_url?: string;
}

type StudentSortField = 'name' | 'gender' | 'school' | 'payment' | 'receipt' | 'phone';

export default function StudentManagementPage() {
  const [activeTab, setActiveTab] = useState<'listing' | 'enrolment'>('listing');
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classList, setClassList] = useState<ClassOption[]>([]);
  const [msg001Template, setMsg001Template] = useState<string>('');
  const [loading, setLoading] = useState(true);

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

  // Excel Migration State
  const [showExcelSection, setShowExcelSection] = useState(false);
  const [excelRows, setExcelRows] = useState<ParsedExcelRow[]>([]);
  const [savingExcel, setSavingExcel] = useState(false);

  const isClassHistorical = (cls: ClassOption): boolean => {
    try {
      if (cls.status === 'suspended' || cls.status === 'archived') return true;
      const dateMatches = (cls.description + ' ' + cls.lesson_date).match(/\d{4}-\d{2}-\d{2}/g);
      const datesToCheck = dateMatches && dateMatches.length > 0 ? dateMatches : [cls.lesson_date.split(',')[0].trim()];

      const parts = (cls.duration || '').split('-');
      const endTimeStr = (parts[1] || parts[0] || '23:59').trim();
      const [endHour, endMin] = endTimeStr.split(':').map((v) => parseInt(v, 10) || 0);

      const timestamps = datesToCheck.map((dStr) => {
        const d = new Date(dStr);
        d.setHours(endHour, endMin, 0, 0);
        return d.getTime();
      });

      return Date.now() > Math.max(...timestamps);
    } catch {
      return new Date(cls.lesson_date.split(',')[0].trim()) < new Date();
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const { data: studentData } = await supabase.from('students').select('*');
      const allStudents = studentData || [];
      setStudents(allStudents);

      const { data: classesData } = await supabase
        .from('classes')
        .select('*')
        .order('lesson_date', { ascending: true });

      const rawClasses = classesData || [];
      const countMap: Record<string, number> = {};
      allStudents.forEach((s) => {
        if (s.class_code) {
          countMap[s.class_code] = (countMap[s.class_code] || 0) + 1;
        }
      });

      const aggregated: ClassOption[] = rawClasses.map((c) => ({
        ...c,
        max_capacity: c.max_capacity ?? 15,
        status: c.status || 'active',
        enrolled_count: countMap[c.class_code] ?? c.enrolled_count ?? 0,
      }));

      setClassList(aggregated);

      // Fetch MSG-001 template for student listing WhatsApp buttons
      const { data: tmpl } = await supabase
        .from('message_templates')
        .select('content')
        .eq('message_key', 'MSG-001')
        .single();

      if (tmpl) {
        setMsg001Template(tmpl.content);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const availableEnrollmentClasses = useMemo(() => {
    return classList.filter((cls) => {
      const isHistorical = isClassHistorical(cls);
      const hasQuota = (cls.enrolled_count || 0) < cls.max_capacity;
      return !isHistorical && hasQuota;
    });
  }, [classList]);

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

  // Generate WhatsApp Web link reusing session for MSG-001
  const getWhatsAppWebLinkForStudent = (st: StudentRecord) => {
    const cleaned = (st.phone || '').replace(/[^0-9]/g, '');
    const fullNumber = cleaned.startsWith('852') ? cleaned : `852${cleaned}`;

    const enrolledClass = classList.find((c) => c.class_code === st.class_code);
    const classCategory = enrolledClass ? `${enrolledClass.class_name} [${enrolledClass.class_code}]` : '未分班課程';
    const classDate = enrolledClass ? `${enrolledClass.lesson_date} (${enrolledClass.duration})` : '待定';

    const fallbackTemplate = `家長您好~~~
溫馨提示 ({CLASSCATEGORY}) : 
上課時間: {CLASSDATE} (請家長5分鐘前到達)
上課地點: 尖沙咀漆咸道南67-71號 安年大廈 7樓

明天見~~`;

    const activeTemplate = msg001Template || fallbackTemplate;

    const message = activeTemplate
      .replace(/{STUDENTNAME}/g, st.chinese_name)
      .replace(/{CLASSCATEGORY}/g, classCategory)
      .replace(/{CLASSDATE}/g, classDate)
      .replace(/{SCHOOL}/g, st.school || '未填寫學校')
      .replace(/{PHONE}/g, st.phone);

    return `https://web.whatsapp.com/send?phone=${fullNumber}&text=${encodeURIComponent(message)}`;
  };

  const validateManualForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.chinese_name.trim()) errors.chinese_name = '請輸入中文姓名';
    const cleanPhone = formData.phone.replace(/[\s-]/g, '');
    if (!cleanPhone) errors.phone = '請輸入聯絡電話';
    else if (!/^[4-9]\d{7}$/.test(cleanPhone)) errors.phone = '請輸入有效的 8 位香港電話號碼';
    if (!formData.class_code) errors.class_code = '請選擇所屬班別代碼';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      let nextNum =
        latestRecords && latestRecords.length > 0
          ? parseInt(latestRecords[0].student_code.replace(/\D/g, ''), 10) + 1
          : 1;
      const newStudentCode = `S${nextNum.toString().padStart(10, '0')}`;

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
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingManual(false);
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFeedback(null);
    const file = e.target.files?.[0];
    if (!file) return;

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

        const mapped: ParsedExcelRow[] = rawJson.map((row) => ({
          rowNum: 0,
          chinese_name: String(row['chinese_name'] || row['中文姓名'] || '').trim(),
          english_name: String(row['english_name'] || '').trim(),
          school: String(row['school'] || '').trim(),
          gender: String(row['gender'] || '男').trim(),
          phone: String(row['phone'] || row['聯絡電話'] || '').trim(),
          class_code: String(row['class_code'] || row['班別代碼'] || '').trim(),
          payment_status: String(row['payment_status'] || 'no').trim().toLowerCase() === 'yes' ? 'yes' : 'no',
          receipt_url: String(row['receipt_url'] || '').trim(),
        }));

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

      let currentNum =
        latestRecords && latestRecords.length > 0
          ? parseInt(latestRecords[0].student_code.replace(/\D/g, ''), 10) + 1
          : 1;

      const payload = excelRows.map((row) => ({
        student_code: `S${(currentNum++).toString().padStart(10, '0')}`,
        chinese_name: row.chinese_name,
        english_name: row.english_name,
        school: row.school,
        gender: row.gender,
        phone: row.phone.replace(/\D/g, ''),
        class_code: row.class_code,
        payment_status: row.payment_status,
        receipt_url: row.receipt_url || null,
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

        {/* Tabs */}
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

        {/* TAB 1: 學員名冊列表 (WhatsApp button with session reuse targeting whatsapp_web_session) */}
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
                    <div className="flex items-center"><span>聯絡電話 (發送 MSG-001)</span>{renderSortIndicator('phone')}</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400">載入學員資料中...</td></tr>
                ) : sortedStudents.length === 0 ? (
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
                        {st.phone ? (
                          <a
                            href={getWhatsAppWebLinkForStudent(st)}
                            target="whatsapp_web_session"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
                            title="透過 WhatsApp 傳送 MSG-001 範本訊息 (重用現有工作階段)"
                          >
                            <span>💬</span> WhatsApp {st.phone}
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs">無電話</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: 新學員登記報讀 */}
        {activeTab === 'enrolment' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-sky-950 mb-1">新學員手動登記報讀表</h2>
              <p className="text-xs text-slate-500 mb-6">請依序填寫學生個人資料、繳費記錄及所屬有效班別。</p>

              <form onSubmit={handleManualSubmit} className="space-y-8" noValidate>
                {/* 第一部分：學生個人資料 */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <div className="w-2 h-4 bg-sky-900 rounded-full"></div>
                    <h2 className="text-base font-bold text-sky-950">第一部分：學生個人資料</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1">中文姓名 <span className="text-rose-600">*</span></label>
                      <input
                        type="text"
                        value={formData.chinese_name}
                        onChange={(e) => setFormData({ ...formData, chinese_name: e.target.value })}
                        placeholder="例如：陳大文"
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-700 focus:outline-none"
                      />
                      {formErrors.chinese_name && <p className="mt-1 text-xs text-rose-600 font-semibold">{formErrors.chinese_name}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1">英文姓名</label>
                      <input
                        type="text"
                        value={formData.english_name}
                        onChange={(e) => setFormData({ ...formData, english_name: e.target.value })}
                        placeholder="例如：David Chan"
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-700 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1">性別</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-sky-700 focus:outline-none"
                      >
                        <option value="男">男</option>
                        <option value="女">女</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1">聯絡電話 (8位號碼) <span className="text-rose-600">*</span></label>
                      <input
                        type="tel"
                        maxLength={8}
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="例如：91234567"
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-sky-700 focus:outline-none"
                      />
                      {formErrors.phone && <p className="mt-1 text-xs text-rose-600 font-semibold">{formErrors.phone}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">就讀學校</label>
                    <input
                      type="text"
                      value={formData.school}
                      onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                      placeholder="例如：拔萃男書院"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-700 focus:outline-none"
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
                        value={formData.payment_status}
                        onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-sky-700 focus:outline-none font-medium"
                      >
                        <option value="no">未付款</option>
                        <option value="yes">已付款</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1">收據連結 (選填)</label>
                      <input
                        type="url"
                        value={formData.receipt_url}
                        onChange={(e) => setFormData({ ...formData, receipt_url: e.target.value })}
                        placeholder="https://example.com/receipt.jpg"
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-700 focus:outline-none"
                      />
                    </div>
                  </div>
                </section>

                {/* 第三部分：所屬報讀課堂 */}
                <section className="space-y-4 pt-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-4 bg-sky-900 rounded-full"></div>
                      <h2 className="text-base font-bold text-sky-950">第三部分：所屬報讀課堂</h2>
                    </div>
                    <span className="text-xs text-slate-400">自動過濾有效且未滿額之班別</span>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">選擇班別代碼 <span className="text-rose-600">*</span></label>
                    <select
                      value={formData.class_code}
                      onChange={(e) => setFormData({ ...formData, class_code: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white font-mono focus:ring-2 focus:ring-sky-700 focus:outline-none"
                    >
                      <option value="">請選擇有效班別</option>
                      {availableEnrollmentClasses.map((c) => {
                        const remaining = c.max_capacity - (c.enrolled_count || 0);
                        return (
                          <option key={c.class_code} value={c.class_code}>
                            {c.class_code} ({c.class_name}) - 餘 {remaining} 席
                          </option>
                        );
                      })}
                    </select>
                    {formErrors.class_code && <p className="mt-1 text-xs text-rose-600 font-semibold">{formErrors.class_code}</p>}
                  </div>
                </section>

                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <button
                    type="submit"
                    disabled={savingManual}
                    className="w-full py-3 bg-sky-950 hover:bg-sky-900 text-white font-bold rounded-xl text-sm shadow transition border-b-2 border-amber-400 disabled:opacity-50 cursor-pointer"
                  >
                    {savingManual ? '正在登記...' : '確認新增學員'}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setShowExcelSection(!showExcelSection)}
                      className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-xl text-sm transition cursor-pointer"
                    >
                      {showExcelSection ? '收合試算表批次匯入' : '📁 試算表批次遷移匯入 (Excel / CSV)'}
                    </button>
                  </div>
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
                      {savingExcel ? '正在寫入資料庫...' : '確認批次寫入資料庫'}
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