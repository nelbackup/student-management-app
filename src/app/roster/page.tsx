'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Student {
  student_code: string;
  chinese_name: string;
  english_name: string;
  school: string;
  gender: string;
  phone: string;
  class_code: string;
  payment_status: string;
  receipt_url: string | null;
  attendance_status: boolean;
  session_remark?: string | null;
}

interface ClassItem {
  class_code: string;
  class_name: string;
  category: string;
  lesson_date: string;
  duration: string;
  description: string;
  max_capacity: number;
  enrolled_count?: number;
  status?: string;
}

type SortField = 'name' | 'gender' | 'school' | 'payment' | 'receipt' | 'phone' | 'attendance' | 'remark';

export default function RosterPage() {
  const [allClasses, setAllClasses] = useState<ClassItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<string>('全部堂別');
  const [students, setStudents] = useState<Student[]>([]);
  const [msg002Template, setMsg002Template] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const [activeRemarkStudent, setActiveRemarkStudent] = useState<Student | null>(null);
  const [remarkText, setRemarkText] = useState<string>('');
  const [savingRemark, setSavingRemark] = useState<boolean>(false);
  const [remarkFeedback, setRemarkFeedback] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: classData, error: classErr } = await supabase
          .from('classes')
          .select('*')
          .neq('status', 'suspended')
          .order('lesson_date', { ascending: true });

        if (classErr) throw classErr;
        const classList = classData || [];
        setAllClasses(classList);

        const distinctDates = Array.from(new Set(classList.map((c) => c.lesson_date))).filter(Boolean);
        if (distinctDates.length > 0) {
          setSelectedDate(distinctDates[0]);
        }

        const { data: tmpl } = await supabase
          .from('message_templates')
          .select('content')
          .eq('message_key', 'MSG-002')
          .single();

        if (tmpl) {
          setMsg002Template(tmpl.content);
        }
      } catch (err: any) {
        console.error('初始化資料失敗:', err.message || err);
      }
    };

    fetchInitialData();
  }, []);

  const availableDates = useMemo(() => {
    return Array.from(new Set(allClasses.map((c) => c.lesson_date)))
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }, [allClasses]);

  const availableSessions = useMemo(() => {
    if (!selectedDate) return [];
    const dateClasses = allClasses.filter((c) => c.lesson_date === selectedDate);
    return Array.from(new Set(dateClasses.map((c) => c.duration)))
      .filter(Boolean)
      .sort((a, b) => {
        const startA = a.split('-')[0].trim();
        const startB = b.split('-')[0].trim();
        return startA.localeCompare(startB);
      });
  }, [allClasses, selectedDate]);

  useEffect(() => {
    if (!selectedDate) return;

    const fetchStudents = async () => {
      setLoading(true);
      setSelectedSession('全部堂別');

      try {
        const targetClassCodes = allClasses
          .filter((c) => c.lesson_date === selectedDate)
          .map((c) => c.class_code);

        if (targetClassCodes.length === 0) {
          setStudents([]);
          return;
        }

        const { data, error } = await supabase
          .from('students')
          .select('*')
          .in('class_code', targetClassCodes);

        if (error) throw error;
        setStudents(data || []);
      } catch (err: any) {
        console.error('讀取點名名冊失敗:', err.message || err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [selectedDate, allClasses]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedStudents = useMemo(() => {
    let filtered = students;
    if (selectedSession !== '全部堂別') {
      const targetCodes = allClasses
        .filter((c) => c.lesson_date === selectedDate && c.duration === selectedSession)
        .map((c) => c.class_code);
      filtered = students.filter((s) => targetCodes.includes(s.class_code));
    }

    return [...filtered].sort((a, b) => {
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
        case 'attendance':
          res = (a.attendance_status === b.attendance_status ? 0 : a.attendance_status ? 1 : -1);
          break;
        case 'remark':
          res = (a.session_remark || '').localeCompare(b.session_remark || '', 'zh-Hant');
          break;
      }
      return sortAsc ? res : -res;
    });
  }, [students, allClasses, selectedDate, selectedSession, sortField, sortAsc]);

  const currentSelectedClasses = useMemo(() => {
    if (!selectedDate) return [];
    if (selectedSession === '全部堂別') {
      return allClasses.filter((c) => c.lesson_date === selectedDate);
    }
    return allClasses.filter(
      (c) => c.lesson_date === selectedDate && c.duration === selectedSession
    );
  }, [allClasses, selectedDate, selectedSession]);

  const handleAttendanceCheck = async (studentCode: string, isChecked: boolean) => {
    if (!isChecked) return;

    setStudents((prev) =>
      prev.map((s) => (s.student_code === studentCode ? { ...s, attendance_status: true } : s))
    );

    const { error } = await supabase
      .from('students')
      .update({ attendance_status: true })
      .eq('student_code', studentCode);

    if (error) {
      setStudents((prev) =>
        prev.map((s) => (s.student_code === studentCode ? { ...s, attendance_status: false } : s))
      );
    }
  };

  const handleOpenRemarkPrompt = (student: Student) => {
    setActiveRemarkStudent(student);
    setRemarkText(student.session_remark || '');
    setRemarkFeedback(null);
  };

  const handleSaveRemark = async () => {
    if (!activeRemarkStudent) return;
    setSavingRemark(true);
    setRemarkFeedback(null);

    const trimmedText = remarkText.slice(0, 500).trim();

    try {
      const { error } = await supabase
        .from('students')
        .update({ session_remark: trimmedText || null })
        .eq('student_code', activeRemarkStudent.student_code);

      if (error) throw error;

      setStudents((prev) =>
        prev.map((s) =>
          s.student_code === activeRemarkStudent.student_code
            ? { ...s, session_remark: trimmedText || null }
            : s
        )
      );

      setActiveRemarkStudent(null);
    } catch (err: any) {
      setRemarkFeedback(`儲存失敗: ${err.message || '請稍後再試'}`);
    } finally {
      setSavingRemark(false);
    }
  };

  const getWhatsAppWebLinkForStudent = (student: Student) => {
    const cleaned = student.phone.replace(/[^0-9]/g, '');
    const fullNumber = cleaned.startsWith('852') ? cleaned : `852${cleaned}`;

    const enrolledClass = allClasses.find((c) => c.class_code === student.class_code);
    const classCategory = enrolledClass ? `${enrolledClass.class_name} [${enrolledClass.class_code}]` : '未分班課程';
    const classDate = enrolledClass ? `${enrolledClass.lesson_date} (${enrolledClass.duration})` : '待定';

    const fallbackTemplate = `家長您好~~~
關於 {STUDENTNAME} 於 {CLASSCATEGORY} ({CLASSDATE}) 之上課與點名狀況特此通知。

謝謝！`;

    const activeTemplate = msg002Template || fallbackTemplate;

    const message = activeTemplate
      .replace(/{STUDENTNAME}/g, student.chinese_name)
      .replace(/{CLASSCATEGORY}/g, classCategory)
      .replace(/{CLASSDATE}/g, classDate)
      .replace(/{SCHOOL}/g, student.school || '未填寫學校')
      .replace(/{PHONE}/g, student.phone);

    return `https://web.whatsapp.com/send?phone=${fullNumber}&text=${encodeURIComponent(message)}`;
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return <span className="ml-1 text-sky-200 opacity-60">↕</span>;
    return <span className="ml-1 text-amber-300 font-bold">{sortAsc ? '▲' : '▼'}</span>;
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
              <h1 className="text-2xl font-black text-sky-950 mt-0.5">課堂點名名冊</h1>
              <p className="text-xs text-slate-500">學員簽到確認、繳費核對、堂別備註記錄與通訊聯絡</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/classes"
              className="inline-flex items-center justify-center px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl shadow-sm transition"
            >
              課程管理
            </Link>
            <Link
              href="/student"
              className="inline-flex items-center justify-center px-4 py-2 bg-sky-900 hover:bg-sky-950 text-white text-sm font-semibold rounded-xl shadow-sm transition border-b-2 border-amber-400"
            >
              學員管理
            </Link>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-sky-950 mb-1.5">上課日期</label>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-700 focus:outline-none text-sm bg-white font-medium text-slate-800"
              >
                {availableDates.length === 0 ? (
                  <option value="">暫無任何有效開課日期</option>
                ) : (
                  availableDates.map((date) => (
                    <option key={date} value={date}>{date}</option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-sky-950 mb-1.5">堂別時段</label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-700 focus:outline-none text-sm bg-white font-medium text-slate-800"
              >
                <option value="全部堂別">全部堂別</option>
                {availableSessions.map((session) => (
                  <option key={session} value={session}>{session}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-sky-50 via-slate-50 to-amber-50/30 border border-sky-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-sky-100 mb-3">
            <h2 className="text-sm font-bold text-sky-950 flex items-center gap-2">
              <span className="text-amber-500">★</span> 所選課堂資訊摘要
            </h2>
            <span className="text-xs font-bold text-sky-950 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
              報讀總計：{sortedStudents.length} 人
            </span>
          </div>

          {currentSelectedClasses.length === 0 ? (
            <div className="text-xs text-slate-500 py-2">所選條件下無相應課堂排程。</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentSelectedClasses.map((cls) => (
                <div key={cls.class_code} className="bg-white p-3.5 rounded-xl border border-sky-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-bold text-sky-900 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                        {cls.class_code}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {cls.category || '專班'}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-sky-950">{cls.class_name}</div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-mono">
                    <span>📅 {cls.lesson_date}</span>
                    <span>⏰ {cls.duration}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
                  <div className="flex items-center"><span>聯絡電話 (發送 MSG-002)</span>{renderSortIndicator('phone')}</div>
                </th>
                <th onClick={() => handleSort('attendance')} className="px-4 py-3.5 text-center text-xs font-semibold cursor-pointer hover:bg-sky-900 transition">
                  <div className="flex items-center justify-center"><span>出席簽到</span>{renderSortIndicator('attendance')}</div>
                </th>
                <th onClick={() => handleSort('remark')} className="px-4 py-3.5 text-left text-xs font-semibold cursor-pointer hover:bg-sky-900 transition min-w-[160px]">
                  <div className="flex items-center"><span>課堂備註</span>{renderSortIndicator('remark')}</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedStudents.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400">{loading ? '正在讀取名冊記錄...' : '所選條件下暫無學生記錄'}</td></tr>
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
                      <a href={getWhatsAppWebLinkForStudent(st)} target="whatsapp_web_session" rel="noreferrer" className="text-blue-600 hover:text-blue-800 font-semibold underline decoration-blue-300" title="點擊透過 WhatsApp Web 發送 MSG-002">
                        {st.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {st.attendance_status ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold select-none cursor-default">
                          <span>✓</span><span>已出席</span>
                        </div>
                      ) : (
                        <input type="checkbox" checked={false} onChange={(e) => handleAttendanceCheck(st.student_code, e.target.checked)} className="w-4 h-4 text-sky-800 rounded border-slate-300 focus:ring-sky-700 cursor-pointer" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {st.session_remark ? (
                        <button type="button" onClick={() => handleOpenRemarkPrompt(st)} className="text-left group flex items-start gap-1 text-xs text-slate-700 hover:text-sky-950 transition cursor-pointer max-w-xs" title="點擊修改課堂備註">
                          <span className="line-clamp-2 underline decoration-dashed decoration-slate-300 group-hover:decoration-sky-700">{st.session_remark}</span>
                          <span className="text-amber-600 font-bold ml-1 shrink-0">✏️</span>
                        </button>
                      ) : (
                        <button type="button" onClick={() => handleOpenRemarkPrompt(st)} className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-950 hover:bg-sky-50 px-2.5 py-1 rounded-lg border border-dashed border-sky-300 transition cursor-pointer">
                          <span>+</span><span>新增備註</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {activeRemarkStudent && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 my-8 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-sky-950 flex items-center gap-2">
                    <span className="text-amber-500">📝</span> 編輯課堂備註
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    學員：<span className="font-bold text-slate-800">{activeRemarkStudent.chinese_name}</span>
                    <span className="font-mono ml-1 text-sky-800">[{activeRemarkStudent.student_code}]</span>
                  </p>
                </div>
                <button type="button" onClick={() => setActiveRemarkStudent(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 cursor-pointer">✕</button>
              </div>

              {remarkFeedback && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">{remarkFeedback}</div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>請輸入學習表現、跟進事項或課堂注意事項：</span>
                  <span className={`font-mono font-bold ${remarkText.length > 480 ? 'text-rose-600' : 'text-slate-500'}`}>{remarkText.length} / 500 字</span>
                </div>
                <textarea rows={6} maxLength={500} value={remarkText} onChange={(e) => setRemarkText(e.target.value)} placeholder="例如：課堂邏輯推演表現優異..." className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-700 focus:outline-none resize-y leading-relaxed text-slate-800" />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setActiveRemarkStudent(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer">取消</button>
                <button type="button" disabled={savingRemark} onClick={handleSaveRemark} className="px-6 py-2 text-sm font-bold text-white bg-sky-950 hover:bg-sky-900 border-b-2 border-amber-400 rounded-xl shadow transition disabled:opacity-50 cursor-pointer">
                  {savingRemark ? '正在儲存...' : '儲存備註'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}