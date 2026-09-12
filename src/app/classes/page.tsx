'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import AnalogClockPicker from '@/components/AnalogClockPicker';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ClassRecord {
  class_code: string;
  category: string;
  class_name: string;
  lesson_date: string;
  duration: string;
  description: string;
  max_capacity: number;
  status: string;
  enrolled_count?: number;
}

interface StudentFull {
  student_code: string;
  chinese_name: string;
  english_name: string;
  gender: string;
  school: string;
  phone: string;
  class_code: string | null;
  payment_status: string;
  receipt_url: string | null;
  attendance_status: boolean;
}

const defaultForm: ClassRecord = {
  class_code: '',
  category: '數學思維',
  class_name: '',
  lesson_date: '2026-09-12',
  duration: '15:00 - 16:00',
  description: '',
  max_capacity: 15,
  status: 'active',
};

function ClassesAdminContent() {
  const searchParams = useSearchParams();
  const preselectedStudent = searchParams.get('student');

  const isAssignmentAllowed = Boolean(preselectedStudent);
  const [viewTab, setViewTab] = useState<'admin' | 'assignment'>(
    isAssignmentAllowed ? 'assignment' : 'admin'
  );

  const [classList, setClassList] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<StudentFull[]>([]);
  const [loading, setLoading] = useState(true);

  // Assignment selection state
  const [selectedClassForAssign, setSelectedClassForAssign] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  // Admin modal state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [formData, setFormData] = useState<ClassRecord>(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    title?: string;
    message: string;
    details?: {
      studentName: string;
      studentCode: string;
      previousClass: string;
      targetClass: string;
      lessonDate: string;
      duration: string;
      newRemainingSeats: number;
    };
  } | null>(null);

  const getStartEndTime = (durationStr: string) => {
    const parts = (durationStr || '').split('-').map((s) => s.trim());
    return {
      start: parts[0] || '15:00',
      end: parts[1] || '16:00',
    };
  };

  const loadData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const { data: rawClasses, error: classErr } = await supabase
        .from('classes')
        .select('*')
        .order('lesson_date', { ascending: true })
        .order('class_code', { ascending: true });

      if (classErr) throw classErr;

      const { data: rawStudents, error: studentErr } = await supabase
        .from('students')
        .select('*');

      if (studentErr) throw studentErr;

      const currentStudents = (rawStudents || []).filter(
        (s) => s.student_code && (s.chinese_name || s.english_name)
      );
      setStudents(currentStudents);

      const countMap: Record<string, number> = {};
      currentStudents.forEach((s) => {
        if (s.class_code) {
          countMap[s.class_code] = (countMap[s.class_code] || 0) + 1;
        }
      });

      const aggregated: ClassRecord[] = (rawClasses || []).map((c) => ({
        ...c,
        category: c.category || '常規課程',
        max_capacity: c.max_capacity ?? 20,
        status: c.status || 'active',
        description: c.description || '',
        enrolled_count: countMap[c.class_code] ?? c.enrolled_count ?? 0,
      }));

      setClassList(aggregated);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || '讀取資料失敗' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Locate the dedicated student currently being edited
  const currentTargetStudent = useMemo(() => {
    if (!preselectedStudent) return null;
    return students.find((s) => s.student_code === preselectedStudent) || null;
  }, [students, preselectedStudent]);

  // Exclude current targeted student from the general registered student listing
  const remainingRegisteredStudents = useMemo(() => {
    return students
      .filter((s) => s.student_code !== preselectedStudent)
      .sort((a, b) => {
        const nameA = a.chinese_name || a.english_name || '';
        const nameB = b.chinese_name || b.english_name || '';
        return nameA.localeCompare(nameB, 'zh-Hant');
      });
  }, [students, preselectedStudent]);

  const availableClassesForAssignment = useMemo(() => {
    return classList.filter(
      (cls) => cls.status !== 'suspended' && (cls.enrolled_count || 0) < cls.max_capacity
    );
  }, [classList]);

  const targetClassData = useMemo(() => {
    return classList.find((c) => c.class_code === selectedClassForAssign);
  }, [classList, selectedClassForAssign]);

  const remainingQuota = useMemo(() => {
    if (!targetClassData) return 0;
    return targetClassData.max_capacity - (targetClassData.enrolled_count || 0);
  }, [targetClassData]);

  const getWhatsAppLink = (phone: string, studentName: string) => {
    const cleaned = (phone || '').replace(/[^0-9]/g, '');
    const fullNumber = cleaned.startsWith('852') ? cleaned : `852${cleaned}`;
    const text = encodeURIComponent(`您好，這是關於 ${studentName} 的課堂分班與點名通知。`);
    return `https://wa.me/${fullNumber}?text=${text}`;
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    const cleanCode = formData.class_code.trim();

    if (!cleanCode) {
      errs.class_code = '請輸入課程編號';
    } else if (!/^C\d{4}-[A-Z0-9]+$/i.test(cleanCode)) {
      errs.class_code = '格式需為 C年份-班別，例如：C2026-A';
    } else if (
      modalMode === 'create' &&
      classList.some((c) => c.class_code.toUpperCase() === cleanCode.toUpperCase())
    ) {
      errs.class_code = `課程編號「${cleanCode}」已存在`;
    }

    if (!formData.category.trim()) errs.category = '請輸入課程類別';
    if (!formData.class_name.trim()) errs.class_name = '請輸入班別名稱';
    if (!formData.lesson_date) errs.lesson_date = '請選擇有效上課日期';

    const { start, end } = getStartEndTime(formData.duration);
    const startMinutes = parseInt(start.split(':')[0], 10) * 60 + parseInt(start.split(':')[1], 10);
    const endMinutes = parseInt(end.split(':')[0], 10) * 60 + parseInt(end.split(':')[1], 10);

    if (isNaN(startMinutes) || isNaN(endMinutes)) {
      errs.duration = '上課時段格式不正確';
    } else if (startMinutes >= endMinutes) {
      errs.duration = `結束時間 (${end}) 必須晚於開始時間 (${start})`;
    }

    const cap = Number(formData.max_capacity);
    if (isNaN(cap) || cap < 1 || cap > 100) {
      errs.max_capacity = '學額上限必須為 1 至 100 之間的整數';
    } else if (modalMode === 'edit' && formData.enrolled_count && cap < formData.enrolled_count) {
      errs.max_capacity = `學額不可少於目前已報名人數 (${formData.enrolled_count} 人)`;
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleOpenCreate = () => {
    setFieldErrors({});
    setFormData({
      ...defaultForm,
      class_code: `C2026-${String.fromCharCode(65 + (classList.length % 26))}`,
    });
    setModalMode('create');
  };

  const handleOpenEdit = (cls: ClassRecord) => {
    setFieldErrors({});
    setFormData(cls);
    setModalMode('edit');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!validateForm()) {
      setFeedback({ type: 'error', message: '課程資料填寫有誤，請依紅色標籤修正。' });
      return;
    }

    setSaving(true);
    try {
      if (modalMode === 'create') {
        const { error } = await supabase.from('classes').insert([
          {
            class_code: formData.class_code.trim().toUpperCase(),
            category: formData.category.trim(),
            class_name: formData.class_name.trim(),
            lesson_date: formData.lesson_date,
            duration: formData.duration.trim(),
            description: formData.description.trim(),
            max_capacity: Number(formData.max_capacity),
            enrolled_count: 0,
            status: 'active',
          },
        ]);
        if (error) throw error;
        setFeedback({ type: 'success', message: `課程「${formData.class_code}」新增成功！` });
      } else {
        const { error } = await supabase
          .from('classes')
          .update({
            category: formData.category.trim(),
            class_name: formData.class_name.trim(),
            lesson_date: formData.lesson_date,
            duration: formData.duration.trim(),
            description: formData.description.trim(),
            max_capacity: Number(formData.max_capacity),
          })
          .eq('class_code', formData.class_code);
        if (error) throw error;
        setFeedback({ type: 'success', message: `課程「${formData.class_code}」資料更新成功！` });
      }

      setModalMode(null);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || '儲存失敗' });
    } finally {
      setSaving(false);
    }
  };

  // Student Assignment Action
  const handleAssignSubmit = async () => {
    setFeedback(null);

    if (!currentTargetStudent) {
      setFeedback({ type: 'error', message: '未指定欲分班之學員資料。' });
      return;
    }

    if (!selectedClassForAssign) {
      setFeedback({ type: 'error', message: '請在課程表格中選取一班作為指派目標。' });
      return;
    }

    if (!targetClassData) return;

    if (currentTargetStudent.class_code === selectedClassForAssign) {
      setFeedback({
        type: 'error',
        message: `學員已在班別【${selectedClassForAssign}】中，無需重複指派。`,
      });
      return;
    }

    if (remainingQuota <= 0) {
      setFeedback({
        type: 'error',
        message: `班別【${selectedClassForAssign}】名額已滿，無法再指派學員。`,
      });
      return;
    }

    setAssigning(true);
    try {
      const prevClassCode = currentTargetStudent.class_code;

      // 1. Update student's class_code
      const { error: studentUpdateErr } = await supabase
        .from('students')
        .update({ class_code: selectedClassForAssign })
        .eq('student_code', currentTargetStudent.student_code);

      if (studentUpdateErr) throw studentUpdateErr;

      // 2. Update new target class enrolled_count
      const newTargetCount = (targetClassData.enrolled_count || 0) + 1;
      await supabase
        .from('classes')
        .update({ enrolled_count: newTargetCount })
        .eq('class_code', selectedClassForAssign);

      // 3. Decrement previous class enrolled_count if existed
      if (prevClassCode) {
        const { count, error: countErr } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('class_code', prevClassCode);

        if (!countErr && count !== null) {
          await supabase
            .from('classes')
            .update({ enrolled_count: count })
            .eq('class_code', prevClassCode);
        }
      }

      // Display detailed success notification
      setFeedback({
        type: 'success',
        title: '🎉 學員分班指派已成功完成！',
        message: `已成功將學員分配至新課堂，資料庫記錄及班別人數已即時同步更新。`,
        details: {
          studentName: `${currentTargetStudent.chinese_name} ${
            currentTargetStudent.english_name ? `(${currentTargetStudent.english_name})` : ''
          }`,
          studentCode: currentTargetStudent.student_code,
          previousClass: prevClassCode || '未分班',
          targetClass: `${targetClassData.class_name} [${targetClassData.class_code}]`,
          lessonDate: targetClassData.lesson_date,
          duration: targetClassData.duration,
          newRemainingSeats: targetClassData.max_capacity - newTargetCount,
        },
      });

      setSelectedClassForAssign(null);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: `分班指派失敗: ${err.message}` });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-gray-200 gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900">課程與堂別中心</h1>
            <p className="text-sm text-gray-500 mt-1">課程詳細管理與學員分班指派作業</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/roster"
              className="px-4 py-2 text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 transition"
            >
              返回點名名冊
            </Link>
            {viewTab === 'admin' && (
              <button
                onClick={handleOpenCreate}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-bold rounded-xl shadow-sm transition cursor-pointer"
              >
                + 新增課程
              </button>
            )}
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-gray-200 bg-white p-1 rounded-2xl shadow-sm">
          <button
            onClick={() => {
              setViewTab('admin');
              setFeedback(null);
            }}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition cursor-pointer ${
              viewTab === 'admin'
                ? 'bg-purple-700 text-white shadow'
                : 'text-gray-600 hover:text-purple-700 hover:bg-gray-50'
            }`}
          >
            📋 課程詳細清單
          </button>

          <button
            disabled={!isAssignmentAllowed}
            onClick={() => {
              if (isAssignmentAllowed) {
                setViewTab('assignment');
                setFeedback(null);
              }
            }}
            title={!isAssignmentAllowed ? '請先至「修改學員資料」點選有效課堂按鈕進入分班指派' : ''}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 ${
              !isAssignmentAllowed
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-dashed border-gray-300'
                : viewTab === 'assignment'
                ? 'bg-purple-700 text-white shadow'
                : 'text-gray-600 hover:text-purple-700 hover:bg-gray-50 cursor-pointer'
            }`}
          >
            <span>🎓 學員分班指派</span>
            {!isAssignmentAllowed && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                需由學員修改頁進入
              </span>
            )}
          </button>
        </div>

        {/* Prominent Feedback Banner with Detailed Success Panel */}
        {feedback && (
          <div
            className={`p-5 rounded-2xl border shadow-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{feedback.type === 'success' ? '✅' : '⚠️'}</span>
              <div className="w-full">
                <h3 className="text-base font-black">
                  {feedback.title || (feedback.type === 'success' ? '操作成功' : '操作失敗')}
                </h3>
                <p className="text-sm font-medium mt-0.5 opacity-90">{feedback.message}</p>

                {feedback.details && (
                  <div className="mt-4 p-3.5 bg-white/95 rounded-xl border border-emerald-200 text-xs space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <span className="text-gray-500 font-medium block">指派學員：</span>
                        <span className="font-bold text-gray-900 text-sm">
                          {feedback.details.studentName}
                        </span>
                        <span className="font-mono text-purple-700 ml-1.5 font-bold">
                          [{feedback.details.studentCode}]
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium block">所調班別異動：</span>
                        <div className="font-bold">
                          <span className="text-gray-500">{feedback.details.previousClass}</span>
                          <span className="mx-1 text-emerald-600">➔</span>
                          <span className="text-emerald-800">{feedback.details.targetClass}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium block">新課堂時段 / 剩餘學額：</span>
                        <span className="font-mono font-bold text-gray-800">
                          {feedback.details.lessonDate} ({feedback.details.duration})
                        </span>
                        <span className="ml-2 font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[11px]">
                          餘 {feedback.details.newRemainingSeats} 席
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: 課程詳細清單                                                        */}
        {/* ========================================================================= */}
        {viewTab === 'admin' && (
          <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
              <thead className="bg-purple-700 text-white text-xs font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3">課程編號</th>
                  <th className="px-4 py-3">課程類別</th>
                  <th className="px-4 py-3">班別名稱</th>
                  <th className="px-4 py-3">上課日期</th>
                  <th className="px-4 py-3">上課時間</th>
                  <th className="px-4 py-3">課堂詳情</th>
                  <th className="px-4 py-3 text-center">學額上限</th>
                  <th className="px-4 py-3 text-center">已報名人數</th>
                  <th className="px-4 py-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">
                      載入課程清單中...
                    </td>
                  </tr>
                ) : classList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">
                      目前暫無任何課程。
                    </td>
                  </tr>
                ) : (
                  classList.map((cls) => {
                    const isFull = (cls.enrolled_count || 0) >= cls.max_capacity;

                    return (
                      <tr key={cls.class_code} className="hover:bg-purple-50/40 transition">
                        <td className="px-4 py-3 font-mono font-bold text-purple-800">
                          {cls.class_code}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border">
                            {cls.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{cls.class_name}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{cls.lesson_date}</td>
                        <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">{cls.duration}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate" title={cls.description}>
                          {cls.description || '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-gray-700">
                          {cls.max_capacity} 人
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              isFull
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {cls.enrolled_count} 人 {isFull && '(已滿額)'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleOpenEdit(cls)}
                            className="px-3 py-1 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition cursor-pointer"
                          >
                            修改
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: 學員分班指派                                                       */}
        {/* ========================================================================= */}
        {viewTab === 'assignment' && isAssignmentAllowed && (
          <div className="space-y-6">
            {/* 1. 分班指派作業說明 */}
            <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl">
              <h2 className="text-sm font-bold text-purple-900">分班指派作業說明</h2>
              <p className="text-xs text-purple-700 mt-0.5">
                步驟 1：確認下方目標學員資料 ➔ 步驟 2：於可選課程表格勾選目標課堂 ➔ 步驟 3：在底部點擊「確認儲存學員分班指派」
              </p>
            </div>

            {/* 2. Selected Student Summary Card (專屬所選學員資料卡) */}
            {currentTargetStudent ? (
              <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border-2 border-purple-300 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-purple-200/80 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎯</span>
                    <h2 className="text-sm font-black text-purple-950">
                      當前所選學員資料 (Selected Student)
                    </h2>
                  </div>
                  <span className="text-xs font-bold text-amber-900 bg-amber-200/80 px-2.5 py-0.5 rounded-md border border-amber-300">
                    現正進行分班調配
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-purple-100">
                    <span className="text-gray-400 block mb-0.5 font-semibold">學生名字</span>
                    <span className="font-black text-gray-900 text-sm block">
                      {currentTargetStudent.chinese_name}
                    </span>
                    {currentTargetStudent.english_name && (
                      <span className="text-[11px] text-gray-500 block truncate">
                        {currentTargetStudent.english_name}
                      </span>
                    )}
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-purple-100">
                    <span className="text-gray-400 block mb-0.5 font-semibold">學員編號</span>
                    <span className="font-mono font-black text-purple-800 text-sm">
                      {currentTargetStudent.student_code}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-purple-100">
                    <span className="text-gray-400 block mb-0.5 font-semibold">性別 / 學校</span>
                    <span className="font-bold text-gray-800 block">{currentTargetStudent.gender}</span>
                    <span className="text-[11px] text-gray-500 block truncate" title={currentTargetStudent.school}>
                      {currentTargetStudent.school || '-'}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-purple-100">
                    <span className="text-gray-400 block mb-0.5 font-semibold">繳費情況</span>
                    <span
                      className={`inline-block mt-0.5 px-2 py-0.5 text-[11px] font-bold rounded-full ${
                        currentTargetStudent.payment_status === 'yes'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {currentTargetStudent.payment_status === 'yes' ? '已付款' : '未付款'}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-purple-100">
                    <span className="text-gray-400 block mb-0.5 font-semibold">聯絡電話</span>
                    <a
                      href={getWhatsAppLink(currentTargetStudent.phone, currentTargetStudent.chinese_name)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono font-bold text-blue-600 hover:text-blue-800 underline block"
                    >
                      {currentTargetStudent.phone}
                    </a>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-purple-100">
                    <span className="text-gray-400 block mb-0.5 font-semibold">現屬班別</span>
                    <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 inline-block">
                      {currentTargetStudent.class_code || '未分班'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
                ⚠️ 查無相符之當前學員資料，請由學員修改資料頁面點擊進入。
              </div>
            )}

            {/* 3. Available Class Listing Table (可選班別清單) */}
            <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
                <thead className="bg-purple-700 text-white text-xs font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3 text-center">指派目標</th>
                    <th className="px-4 py-3">課程編號</th>
                    <th className="px-4 py-3">課程類別</th>
                    <th className="px-4 py-3">班別名稱</th>
                    <th className="px-4 py-3">上課日期</th>
                    <th className="px-4 py-3">上課時間</th>
                    <th className="px-4 py-3">課堂詳情</th>
                    <th className="px-4 py-3 text-center">學額上限</th>
                    <th className="px-4 py-3 text-center">已報名人數</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {availableClassesForAssignment.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-400">
                        暫無可供分配的空額課程。
                      </td>
                    </tr>
                  ) : (
                    availableClassesForAssignment.map((cls) => {
                      const isSelected = selectedClassForAssign === cls.class_code;
                      const remaining = cls.max_capacity - (cls.enrolled_count || 0);

                      return (
                        <tr
                          key={cls.class_code}
                          onClick={() => setSelectedClassForAssign(cls.class_code)}
                          className={`cursor-pointer transition ${
                            isSelected ? 'bg-purple-50 ring-1 ring-purple-500' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              name="assignClassCheckbox"
                              checked={isSelected}
                              onChange={() =>
                                setSelectedClassForAssign(isSelected ? null : cls.class_code)
                              }
                              className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-purple-800">
                            {cls.class_code}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border">
                              {cls.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">{cls.class_name}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{cls.lesson_date}</td>
                          <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">{cls.duration}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate" title={cls.description}>
                            {cls.description || '-'}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-gray-700">
                            {cls.max_capacity} 人
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              {cls.enrolled_count} / {cls.max_capacity} (餘 {remaining} 席)
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 4. 其餘已登記學員名冊 (完全對齊點名名冊 6 欄位：學生名字, 性別, 就讀學校, 付款情況, 收據檢視, 聯絡電話) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div>
                  <h3 className="text-base font-bold text-gray-900">其餘現有名單學員</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    展示系統內其他學員（共 {remainingRegisteredStudents.length} 人，已排除當前上方所選學員）
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-purple-700 text-white text-xs font-semibold uppercase sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3.5 text-left">學生名字</th>
                      <th className="px-4 py-3.5 text-left">性別</th>
                      <th className="px-4 py-3.5 text-left">就讀學校</th>
                      <th className="px-4 py-3.5 text-center">付款情況</th>
                      <th className="px-4 py-3.5 text-center">收據檢視</th>
                      <th className="px-4 py-3.5 text-left">聯絡電話</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {remainingRegisteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-400 text-xs">
                          暫無其他學員記錄
                        </td>
                      </tr>
                    ) : (
                      remainingRegisteredStudents.map((st) => (
                        <tr key={st.student_code} className="hover:bg-purple-50/40 transition">
                          {/* 學生名字 (點擊跳轉至該學員修改頁) */}
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

                          {/* 性別 */}
                          <td className="px-4 py-3 text-gray-600">{st.gender}</td>

                          {/* 就讀學校 */}
                          <td className="px-4 py-3 text-gray-600">{st.school || '-'}</td>

                          {/* 付款情況 */}
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

                          {/* 收據檢視 */}
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

                          {/* 聯絡電話 (WhatsApp 連結) */}
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. 底部確認儲存操作列 */}
            <div className="sticky bottom-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-purple-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-gray-600">
                <span className="font-bold text-gray-900 block text-sm">分班指派設定確認</span>
                調配學員：
                <span className="font-bold text-purple-800 ml-1">
                  {currentTargetStudent ? currentTargetStudent.chinese_name : '未選取'}
                </span>
                <span className="mx-2">|</span>
                目標班別：
                <span className="font-mono font-bold text-purple-700 ml-1">
                  {selectedClassForAssign || '未選取'}
                </span>
                {selectedClassForAssign && (
                  <>
                    <span className="mx-2">|</span>
                    該班剩餘學額：
                    <span
                      className={`font-mono font-bold ml-1 ${
                        remainingQuota <= 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {remainingQuota} 席
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                disabled={assigning || !selectedClassForAssign || !currentTargetStudent}
                onClick={handleAssignSubmit}
                className="w-full sm:w-auto px-8 py-3 bg-purple-700 hover:bg-purple-800 text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {assigning ? '正在儲存至資料庫...' : '確認儲存學員分班指派'}
              </button>
            </div>
          </div>
        )}

        {/* Modal: 新增 / 修改課程 */}
        {modalMode && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 my-8">
              <div className="flex items-center justify-between pb-4 mb-4 border-b">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {modalMode === 'create' ? '新增課程資料' : `修改課程: ${formData.class_code}`}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {modalMode === 'create' ? '請設定課程編號、班別名稱及上課時段' : '調整現有課堂排程或學額設定'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1">
                      課程編號 <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      disabled={modalMode === 'edit'}
                      value={formData.class_code}
                      onChange={(e) => {
                        setFormData({ ...formData, class_code: e.target.value });
                        if (fieldErrors.class_code) setFieldErrors({ ...fieldErrors, class_code: '' });
                      }}
                      placeholder="例如：C2026-A"
                      className={`w-full px-3 py-2 border rounded-xl text-sm font-mono focus:outline-none transition ${
                        modalMode === 'edit'
                          ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200'
                          : fieldErrors.class_code
                          ? 'border-rose-400 bg-rose-50/30'
                          : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
                      }`}
                    />
                    {fieldErrors.class_code && (
                      <p className="mt-1 text-xs text-rose-600 font-semibold">{fieldErrors.class_code}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1">
                      課程類別 <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => {
                        setFormData({ ...formData, category: e.target.value });
                        if (fieldErrors.category) setFieldErrors({ ...fieldErrors, category: '' });
                      }}
                      placeholder="例如：數學思維"
                      className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none transition ${
                        fieldErrors.category ? 'border-rose-400 bg-rose-50/30' : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
                      }`}
                    />
                    {fieldErrors.category && (
                      <p className="mt-1 text-xs text-rose-600 font-semibold">{fieldErrors.category}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    班別名稱 <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.class_name}
                    onChange={(e) => {
                      setFormData({ ...formData, class_name: e.target.value });
                      if (fieldErrors.class_name) setFieldErrors({ ...fieldErrors, class_name: '' });
                    }}
                    placeholder="例如：小學奧數進階週六班"
                    className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none transition ${
                      fieldErrors.class_name ? 'border-rose-400 bg-rose-50/30' : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
                    }`}
                  />
                  {fieldErrors.class_name && (
                    <p className="mt-1 text-xs text-rose-600 font-semibold">{fieldErrors.class_name}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1">
                      上課日期 <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.lesson_date}
                      onChange={(e) => {
                        setFormData({ ...formData, lesson_date: e.target.value });
                        if (fieldErrors.lesson_date) setFieldErrors({ ...fieldErrors, lesson_date: '' });
                      }}
                      className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none transition ${
                        fieldErrors.lesson_date ? 'border-rose-400 bg-rose-50/30' : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
                      }`}
                    />
                    {fieldErrors.lesson_date && (
                      <p className="mt-1 text-xs text-rose-600 font-semibold">{fieldErrors.lesson_date}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1">
                      學額上限 (人) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={formData.max_capacity}
                      onChange={(e) => {
                        setFormData({ ...formData, max_capacity: parseInt(e.target.value, 10) || 0 });
                        if (fieldErrors.max_capacity) setFieldErrors({ ...fieldErrors, max_capacity: '' });
                      }}
                      className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none transition ${
                        fieldErrors.max_capacity ? 'border-rose-400 bg-rose-50/30' : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
                      }`}
                    />
                    {fieldErrors.max_capacity && (
                      <p className="mt-1 text-xs text-rose-600 font-semibold">{fieldErrors.max_capacity}</p>
                    )}
                  </div>
                </div>

                <div className="pt-1">
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    上課時段 (雙時鐘設定) <span className="text-rose-600">*</span>
                  </label>

                  <div className="mb-2.5 p-2.5 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between">
                    <span className="text-xs text-gray-600 font-medium">目前設定時段：</span>
                    <span className="font-mono font-bold text-purple-800 text-sm tracking-wide">
                      {formData.duration}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <AnalogClockPicker
                      label="開始時間"
                      value={getStartEndTime(formData.duration).start}
                      onChange={(newStart) => {
                        const currentEnd = getStartEndTime(formData.duration).end;
                        setFormData({ ...formData, duration: `${newStart} - ${currentEnd}` });
                        if (fieldErrors.duration) setFieldErrors({ ...fieldErrors, duration: '' });
                      }}
                    />

                    <AnalogClockPicker
                      label="結束時間"
                      value={getStartEndTime(formData.duration).end}
                      onChange={(newEnd) => {
                        const currentStart = getStartEndTime(formData.duration).start;
                        setFormData({ ...formData, duration: `${currentStart} - ${newEnd}` });
                        if (fieldErrors.duration) setFieldErrors({ ...fieldErrors, duration: '' });
                      }}
                    />
                  </div>

                  {fieldErrors.duration && (
                    <p className="mt-2 text-xs text-rose-600 font-semibold bg-rose-50 p-2 rounded-lg border border-rose-200">
                      ⚠️ {fieldErrors.duration}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">課堂詳情 / 備註</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="請輸入授課地點、教材或導師備註..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 text-sm font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow transition disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? '正在儲存...' : modalMode === 'create' ? '確認新增' : '儲存變更'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClassAdminPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">載入中...</div>}>
      <ClassesAdminContent />
    </Suspense>
  );
}