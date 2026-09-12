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
  category?: string;
  description?: string;
}

export default function RosterPage() {
  const [selectedDate, setSelectedDate] = useState('2026-09-09');
  const [selectedSession, setSelectedSession] = useState('ALL');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch classes and matching enrolled students by selected date
  const fetchData = async (dateStr: string) => {
    setLoading(true);
    try {
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('lesson_date', dateStr);

      if (classError) throw classError;
      setClasses(classData || []);

      if (classData && classData.length > 0) {
        const classCodes = classData.map((c) => c.class_code);
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('*')
          .in('class_code', classCodes);

        if (studentError) throw studentError;
        setStudents(studentData || []);
      } else {
        setStudents([]);
      }
    } catch (err: any) {
      console.error('Error loading roster data:', err.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate]);

  // Derive distinct duration time slots for current classes
  const sessionOptions = useMemo(() => {
    return Array.from(new Set(classes.map((c) => c.duration))).filter(Boolean);
  }, [classes]);

  // Filter students based on chosen session
  const filteredStudents = useMemo(() => {
    if (selectedSession === 'ALL') return students;
    const targetCodes = classes
      .filter((c) => c.duration === selectedSession)
      .map((c) => c.class_code);
    return students.filter((s) => targetCodes.includes(s.class_code));
  }, [students, classes, selectedSession]);

  // Calculate live gender distribution and headcounts
  const stats = useMemo(() => {
    const boys = filteredStudents.filter((s) => s.gender === '男').length;
    const girls = filteredStudents.filter((s) => s.gender === '女').length;
    return { boys, girls, total: filteredStudents.length };
  }, [filteredStudents]);

  // Toggle payment status
  const handlePaymentToggle = async (studentCode: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'yes' ? 'no' : 'yes';
    setStudents((prev) =>
      prev.map((s) => (s.student_code === studentCode ? { ...s, payment_status: nextStatus } : s))
    );

    const { error } = await supabase
      .from('students')
      .update({ payment_status: nextStatus })
      .eq('student_code', studentCode);

    if (error) {
      console.error('Failed to update payment status:', error.message);
      fetchData(selectedDate);
    }
  };

  // Toggle attendance status
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
      console.error('Failed to update attendance:', error.message);
      fetchData(selectedDate);
    }
  };

  // Format WhatsApp Click-to-Chat Link (Default HK prefix 852)
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
            <h1 className="text-2xl font-bold text-gray-900">課堂點名名冊</h1>
            <p className="text-sm text-gray-500 mt-1">即時學員簽到、繳費確認、資料修改與 WhatsApp 聯絡</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/classes"
              className="inline-flex items-center justify-center px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-medium rounded-lg shadow-sm transition"
            >
              課程管理
            </Link>
            <Link
              href="/import/excel"
              className="inline-flex items-center justify-center px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium rounded-lg shadow-sm transition"
            >
              Excel 遷移
            </Link>
            <Link
              href="/import"
              className="inline-flex items-center justify-center px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-medium rounded-lg shadow-sm transition"
            >
              + 匯入學員
            </Link>
          </div>
        </div>

        {/* Filters & Demographic Counter */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">
                上課日期 (Select Date)
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">
                堂別時段 (Session)
              </label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none text-sm bg-white"
              >
                <option value="ALL">全部堂別 (All Sessions)</option>
                {sessionOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between text-sm text-gray-600">
            <div>
              <span className="font-bold text-gray-800">名冊統計：</span> {stats.boys} 男 / {stats.girls} 女 
              <span className="font-bold text-purple-700 ml-1.5">(共 {stats.total} 人)</span>
            </div>
            {loading && <span className="text-purple-600 font-medium animate-pulse">資料載入中...</span>}
          </div>
        </div>

        {/* Student Table */}
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-purple-700 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">學生編號</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">性別</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">學生名字</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">就讀學校</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase">付款情況</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase">收據檢視</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">聯絡電話</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase">出席簽到</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    {loading ? '正在讀取記錄...' : '當日無指定學生記錄'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.student_code} className="hover:bg-purple-50/40 transition">
                    <td className="px-4 py-3 font-mono text-gray-800 font-semibold">{student.student_code}</td>
                    <td className="px-4 py-3 text-gray-600">{student.gender}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900">{student.chinese_name}</div>
                      <div className="text-xs text-gray-500">{student.english_name}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{student.school || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handlePaymentToggle(student.student_code, student.payment_status)}
                        className={`px-3 py-1 text-xs font-bold rounded-full transition ${
                          student.payment_status === 'yes'
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {student.payment_status === 'yes' ? '已付款 (yes)' : '未付款 (no)'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {student.receipt_url ? (
                        <a
                          href={student.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-600 hover:text-purple-900 font-medium underline text-xs"
                        >
                          檢視收據
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">無</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={getWhatsAppLink(student.phone, student.chinese_name)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-mono"
                      >
                        <span>{student.phone}</span>
                      </a>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={student.attendance_status}
                        onChange={() =>
                          handleAttendanceToggle(student.student_code, student.attendance_status)
                        }
                        className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/student/edit/${student.student_code}`}
                        className="text-xs text-purple-700 hover:text-purple-900 font-bold underline px-2.5 py-1 bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition"
                      >
                        編輯
                      </Link>
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