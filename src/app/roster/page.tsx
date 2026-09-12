'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
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

type SortField = 'name' | 'gender' | 'school' | 'payment' | 'receipt' | 'phone' | 'attendance';

export default function RosterPage() {
  const [allClasses, setAllClasses] = useState<ClassItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<string>('全部堂別');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  useEffect(() => {
    const fetchAvailableClasses = async () => {
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('*')
          .neq('status', 'suspended')
          .order('lesson_date', { ascending: true });

        if (error) throw error;

        const classList = data || [];
        setAllClasses(classList);

        const distinctDates = Array.from(new Set(classList.map((c) => c.lesson_date))).filter(Boolean);
        if (distinctDates.length > 0) {
          setSelectedDate(distinctDates[0]);
        }
      } catch (err: any) {
        console.error('讀取課程資料失敗:', err.message || err);
      }
    };

    fetchAvailableClasses();
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
      console.error('更新簽到狀態失敗:', error.message);
      setStudents((prev) =>
        prev.map((s) => (s.student_code === studentCode ? { ...s, attendance_status: false } : s))
      );
    }
  };

  const getWhatsAppLink = (phone: string, studentName: string) => {
    const cleaned = phone.replace(/[^0-9]/g, '');
    const fullNumber = cleaned.startsWith('852') ? cleaned : `852${cleaned}`;
    const text = encodeURIComponent(`您好，這是關於 ${studentName} 的課堂點名與上課通知。`);
    return `https://wa.me/${fullNumber}?text=${text}`;
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return <span className="ml-1 text-purple-300 opacity-60">↕</span>;
    return <span className="ml-1 text-amber-300 font-bold">{sortAsc ? '▲' : '▼'}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-gray-200 gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900">課堂點名名冊</h1>
            <p className="text-sm text-gray-500 mt-1">學員即時簽到、繳費核對、資料管理與通訊聯絡</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/classes"
              className="inline-flex items-center justify-center px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-semibold rounded-xl shadow-sm transition"
            >
              課程管理
            </Link>
            <Link
              href="/student"
              className="inline-flex items-center justify-center px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl shadow-sm transition"
            >
              學員管理
            </Link>
          </div>
        </div>

        {/* 篩選下拉選單 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">上課日期</label>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none text-sm bg-white font-medium text-gray-800"
              >
                {availableDates.length === 0 ? (
                  <option value="">暫無任何有效開課日期</option>
                ) : (
                  availableDates.map((date) => (
                    <option key={date} value={date}>
                      {date}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">堂別時段</label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none text-sm bg-white font-medium text-gray-800"
              >
                <option value="全部堂別">全部堂別</option>
                {availableSessions.map((session) => (
                  <option key={session} value={session}>
                    {session}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 所選課堂摘要區塊 */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-purple-200/70 mb-3">
            <h2 className="text-sm font-bold text-purple-900 flex items-center gap-2">
              <span>📌</span> 所選課堂資訊摘要
            </h2>
            <span className="text-xs font-bold text-purple-800 bg-purple-200/60 px-2.5 py-1 rounded-full">
              報讀總計：{sortedStudents.length} 人
            </span>
          </div>

          {currentSelectedClasses.length === 0 ? (
            <div className="text-xs text-gray-500 py-2">所選條件下無相應課堂排程。</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentSelectedClasses.map((cls) => (
                <div
                  key={cls.class_code}
                  className="bg-white p-3.5 rounded-xl border border-purple-100 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        {cls.class_code}
                      </span>
                      <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {cls.category || '常規專班'}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-gray-900">{cls.class_name}</div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600 font-mono">
                    <span>📅 {cls.lesson_date}</span>
                    <span>⏰ {cls.duration}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 點名表格（含欄位排序功能） */}
        <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-purple-700 text-white select-none">
              <tr>
                <th
                  onClick={() => handleSort('name')}
                  className="px-4 py-3.5 text-left text-xs font-semibold cursor-pointer hover:bg-purple-800 transition"
                >
                  <div className="flex items-center">
                    <span>學生名字</span>
                    {renderSortIndicator('name')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('gender')}
                  className="px-4 py-3.5 text-left text-xs font-semibold cursor-pointer hover:bg-purple-800 transition"
                >
                  <div className="flex items-center">
                    <span>性別</span>
                    {renderSortIndicator('gender')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('school')}
                  className="px-4 py-3.5 text-left text-xs font-semibold cursor-pointer hover:bg-purple-800 transition"
                >
                  <div className="flex items-center">
                    <span>就讀學校</span>
                    {renderSortIndicator('school')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('payment')}
                  className="px-4 py-3.5 text-center text-xs font-semibold cursor-pointer hover:bg-purple-800 transition"
                >
                  <div className="flex items-center justify-center">
                    <span>付款情況</span>
                    {renderSortIndicator('payment')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('receipt')}
                  className="px-4 py-3.5 text-center text-xs font-semibold cursor-pointer hover:bg-purple-800 transition"
                >
                  <div className="flex items-center justify-center">
                    <span>收據檢視</span>
                    {renderSortIndicator('receipt')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('phone')}
                  className="px-4 py-3.5 text-left text-xs font-semibold cursor-pointer hover:bg-purple-800 transition"
                >
                  <div className="flex items-center">
                    <span>聯絡電話</span>
                    {renderSortIndicator('phone')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('attendance')}
                  className="px-4 py-3.5 text-center text-xs font-semibold cursor-pointer hover:bg-purple-800 transition"
                >
                  <div className="flex items-center justify-center">
                    <span>出席簽到</span>
                    {renderSortIndicator('attendance')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    {loading ? '正在讀取名冊記錄...' : '所選條件下暫無學生記錄'}
                  </td>
                </tr>
              ) : (
                sortedStudents.map((st) => (
                  <tr key={st.student_code} className="hover:bg-purple-50/40 transition">
                    <td className="px-4 py-3">
                      <Link
                        href={`/student/edit/${st.student_code}`}
                        className="group flex flex-col hover:opacity-80"
                      >
                        <span className="font-bold text-purple-800 underline decoration-purple-300 group-hover:text-purple-950">
                          {st.chinese_name}
                        </span>
                        {st.english_name && (
                          <span className="text-xs text-gray-400">{st.english_name}</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{st.gender}</td>
                    <td className="px-4 py-3 text-gray-600">{st.school || '-'}</td>
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
                          檢視收據
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">無</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <a
                        href={getWhatsAppLink(st.phone, st.chinese_name)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-semibold underline decoration-blue-300"
                      >
                        {st.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {st.attendance_status ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold select-none cursor-default">
                          <span>✓</span>
                          <span>已出席</span>
                        </div>
                      ) : (
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={(e) => handleAttendanceCheck(st.student_code, e.target.checked)}
                          className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}