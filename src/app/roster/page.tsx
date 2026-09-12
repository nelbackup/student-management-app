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
  lesson_date: string;
  duration: string;
  status?: string;
}

export default function RosterPage() {
  const [allClasses, setAllClasses] = useState<ClassItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<string>('ALL');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 1. Fetch available classes (chronologically sorted)
  useEffect(() => {
    const fetchAvailableClasses = async () => {
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('class_code, class_name, lesson_date, duration, status')
          .neq('status', 'suspended')
          .order('lesson_date', { ascending: true });

        if (error) throw error;

        const classList = data || [];
        setAllClasses(classList);

        // Extract distinct chronological dates
        const distinctDates = Array.from(new Set(classList.map((c) => c.lesson_date))).filter(Boolean);
        if (distinctDates.length > 0) {
          setSelectedDate(distinctDates[0]);
        }
      } catch (err: any) {
        console.error('Error fetching classes:', err.message || err);
      }
    };

    fetchAvailableClasses();
  }, []);

  // Distinct available dates sorted chronologically
  const availableDates = useMemo(() => {
    return Array.from(new Set(allClasses.map((c) => c.lesson_date)))
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }, [allClasses]);

  // Distinct available sessions for selected date sorted chronologically
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

  // Fetch students when selectedDate changes
  useEffect(() => {
    if (!selectedDate) return;

    const fetchStudents = async () => {
      setLoading(true);
      setSelectedSession('ALL');

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
        console.error('Error fetching roster students:', err.message || err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [selectedDate, allClasses]);

  // Filter students based on chosen session
  const filteredStudents = useMemo(() => {
    if (selectedSession === 'ALL') return students;
    const targetCodes = allClasses
      .filter((c) => c.lesson_date === selectedDate && c.duration === selectedSession)
      .map((c) => c.class_code);
    return students.filter((s) => targetCodes.includes(s.class_code));
  }, [students, allClasses, selectedDate, selectedSession]);

  // Toggle Attendance Checkbox (Only editable control)
  const handleAttendanceToggle = async (studentCode: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    setStudents((prev) =>
      prev.map((s) => (s.student_code === studentCode ? { ...s, attendance_status: nextStatus } : s))
    );

    const { error } = await supabase
      .from('students')
      .update({ attendance_status: nextStatus })
      .eq('student_code', studentCode);

    if (error) {
      console.error('Failed to update attendance status:', error.message);
    }
  };

  const getWhatsAppLink = (phone: string, studentName: string) => {
    const cleaned = phone.replace(/[^0-9]/g, '');
    const fullNumber = cleaned.startsWith('852') ? cleaned : `852${cleaned}`;
    const text = encodeURIComponent(`您好，這是關於 ${studentName} 的課堂點名與上課通知。`);
    return `https://wa.me/${fullNumber}?text=${text}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-gray-200 gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900">課堂點名名冊</h1>
            <p className="text-sm text-gray-500 mt-1">即時學員簽到、繳費檢視、學員資料管理與 WhatsApp 聯絡</p>
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
              學員管理 (Student Management)
            </Link>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">
                上課日期 (Available Dates)
              </label>
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
              <label className="block text-sm font-bold text-gray-800 mb-1.5">
                堂別時段 (Available Sessions)
              </label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none text-sm bg-white font-medium text-gray-800"
              >
                <option value="ALL">全部堂別時段 (All Sessions)</option>
                {availableSessions.map((session) => (
                  <option key={session} value={session}>
                    {session}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
            <div>
              <span className="font-bold text-gray-800">名冊統計：</span>
              <span className="font-bold text-purple-700 ml-1">共 {filteredStudents.length} 人</span>
            </div>
            {loading && <span className="text-purple-600 font-medium animate-pulse">資料讀取中...</span>}
          </div>
        </div>

        {/* Strictly Ordered Read-Only Table (Only Attendance Editable) */}
        <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-purple-700 text-white">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase">學生名字</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase">性別</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase">就讀學校</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase">付款情況</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase">收據檢視</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase">聯絡電話</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase">出席簽到</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    {loading ? '正在讀取名冊記錄...' : '所選日期及時段暫無學生記錄'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => (
                  <tr key={st.student_code} className="hover:bg-purple-50/40 transition">
                    {/* 1. 學生名字 (Linked to Edit Page) */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/student/edit/${st.student_code}`}
                        className="group flex flex-col hover:opacity-80"
                      >
                        <span className="font-bold text-purple-800 underline decoration-purple-300 group-hover:text-purple-950">
                          {st.chinese_name}
                        </span>
                        <span className="text-xs text-gray-400">{st.english_name}</span>
                      </Link>
                    </td>

                    {/* 2. 性別 (Readonly) */}
                    <td className="px-4 py-3 text-gray-600">{st.gender}</td>

                    {/* 3. 就讀學校 (Readonly) */}
                    <td className="px-4 py-3 text-gray-600">{st.school || '-'}</td>

                    {/* 4. 付款情況 (Readonly) */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full ${
                          st.payment_status === 'yes'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {st.payment_status === 'yes' ? '已付款 (yes)' : '未付款 (no)'}
                      </span>
                    </td>

                    {/* 5. 收據檢視 (Readonly link) */}
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

                    {/* 6. 聯絡電話 (Readonly WhatsApp link) */}
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

                    {/* 7. 出席簽到 (Editable checkbox) */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={st.attendance_status}
                        onChange={() => handleAttendanceToggle(st.student_code, st.attendance_status)}
                        className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                      />
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