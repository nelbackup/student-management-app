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

const CATEGORY_OPTIONS = [
  { label: '專班', code: 'SPEC' },
  { label: '考小實戰遊戲班', code: 'GAME' },
];

const defaultForm: ClassRecord = {
  class_code: '',
  category: '專班',
  class_name: '',
  lesson_date: '2026-09-12',
  duration: '15:00 - 16:00',
  description: '',
  max_capacity: 15,
  status: 'active',
};

type ClassSortField = 'class_code' | 'category' | 'class_name' | 'lesson_date' | 'duration' | 'max_capacity' | 'enrolled_count';
type StudentSortField = 'name' | 'gender' | 'school' | 'payment' | 'receipt' | 'phone';

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

  // Sorting state for Admin Classes Table
  const [classSortField, setClassSortField] = useState<ClassSortField>('lesson_date');
  const [classSortAsc, setClassSortAsc] = useState<boolean>(true);

  // Sorting state for Available Classes (Assignment Tab)
  const [assignClassSortField, setAssignClassSortField] = useState<ClassSortField>('lesson_date');
  const [assignClassSortAsc, setAssignClassSortAsc] = useState<boolean>(true);

  // Sorting state for Remaining Students Table
  const [studentSortField, setStudentSortField] = useState<StudentSortField>('name');
  const [studentSortAsc, setStudentSortAsc] = useState<boolean>(true);

  // Assignment selection state
  const [selectedClassForAssign, setSelectedClassForAssign] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  // Admin modal state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [formData, setFormData] = useState<ClassRecord>(defaultForm);
  const [sessionDates, setSessionDates] = useState<string[]>(['2026-09-12']);
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
        category: c.category || '專班',
        max_capacity: c.max_capacity ?? 15,
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

  const generateDynamicClassCode = (dateStr: string, categoryLabel: string, currentEditingCode?: string): string => {
    if (modalMode === 'edit' && currentEditingCode) {
      return currentEditingCode;
    }

    const cleanDate = dateStr || '2026-09-12';
    const parsedDate = new Date(cleanDate);
    const yyyy = isNaN(parsedDate.getFullYear()) ? '2026' : String(parsedDate.getFullYear());
    const mm = isNaN(parsedDate.getMonth()) ? '09' : String(parsedDate.getMonth() + 1).padStart(2, '0');
    const yyyymm = `${yyyy}${mm}`;

    const catObj = CATEGORY_OPTIONS.find((c) => c.label === categoryLabel);
    const catCode = catObj ? catObj.code : 'SPEC';

    const prefix = `${yyyymm}-${catCode}-`;
    const matchingSeqNums = classList
      .filter((c) => c.class_code.startsWith(prefix))
      .map((c) => {
        const parts = c.class_code.split('-');
        return parseInt(parts[2], 10) || 0;
      });

    const nextSeq = matchingSeqNums.length > 0 ? Math.max(...matchingSeqNums) + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(3, '0')}`;
  };

  const currentTargetStudent = useMemo(() => {
    if (!preselectedStudent) return null;
    return students.find((s) => s.student_code === preselectedStudent) || null;
  }, [students, preselectedStudent]);

  // Sort function for Classes
  const sortClassList = (list: ClassRecord[], field: ClassSortField, asc: boolean) => {
    return [...list].sort((a, b) => {
      let res = 0;
      switch (field) {
        case 'class_code':
          res = a.class_code.localeCompare(b.class_code);
          break;
        case 'category':
          res = a.category.localeCompare(b.category, 'zh-Hant');
          break;
        case 'class_name':
          res = a.class_name.localeCompare(b.class_name, 'zh-Hant');
          break;
        case 'lesson_date':
          res = new Date(a.lesson_date).getTime() - new Date(b.lesson_date).getTime();
          break;
        case 'duration':
          res = a.duration.localeCompare(b.duration);
          break;
        case 'max_capacity':
          res = a.max_capacity - b.max_capacity;
          break;
        case 'enrolled_count':
          res = (a.enrolled_count || 0) - (b.enrolled_count || 0);
          break;
      }
      return asc ? res : -res;
    });
  };

  const sortedClassList = useMemo(() => {
    return sortClassList(classList, classSortField, classSortAsc);
  }, [classList, classSortField, classSortAsc]);

  const sortedAvailableClasses = useMemo(() => {
    const available = classList.filter(
      (cls) => cls.status !== 'suspended' && (cls.enrolled_count || 0) < cls.max_capacity
    );
    return sortClassList(available, assignClassSortField, assignClassSortAsc);
  }, [classList, assignClassSortField, assignClassSortAsc]);

  const sortedRemainingStudents = useMemo(() => {
    const remaining = students.filter((s) => s.student_code !== preselectedStudent);
    return remaining.sort((a, b) => {
      let res = 0;
      switch (studentSortField) {
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
      return studentSortAsc ? res : -res;
    });
  }, [students, preselectedStudent, studentSortField, studentSortAsc]);

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

  const renderSortArrow = (current: string, active: string, asc: boolean) => {
    if (current !== active) return <span className="ml-1 text-purple-300 opacity-60">↕</span>;
    return <span className="ml-1 text-amber-300 font-bold">{asc ? '▲' : '▼'}</span>;
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};

    if (!formData.class_code.trim()) {
      errs.class_code = '課程編號不能為空';
    }
    if (!formData.category.trim()) {
      errs.category = '請選擇課程類別';
    }
    if (!formData.class_name.trim()) {
      errs.class_name = '請輸入班別名稱';
    }
    if (sessionDates.length === 0 || !sessionDates[0]) {
      errs.lesson_date = '請至少設定一個有效上課日期堂數';
    }

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
    const initialDate = '2026-09-12';
    const initialCat = '專班';
    const initialCode = generateDynamicClassCode(initialDate, initialCat);

    setSessionDates([initialDate]);
    setFormData({
      ...defaultForm,
      class_code: initialCode,
      category: initialCat,
      lesson_date: initialDate,
    });
    setModalMode('create');
  };

  const handleOpenEdit = (cls: ClassRecord) => {
    setFieldErrors({});
    const parsedDates = cls.lesson_date.includes(',')
      ? cls.lesson_date.split(',').map((d) => d.trim())
      : [cls.lesson_date];

    setSessionDates(parsedDates);
    setFormData(cls);
    setModalMode('edit');
  };

  const handleAddSessionDate = () => {
    const lastDate = sessionDates[sessionDates.length - 1] || '2026-09-12';
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + 7);
    const nextDateStr = nextDate.toISOString().split('T')[0];

    const updated = [...sessionDates, nextDateStr];
    setSessionDates(updated);
    setFormData((prev) => ({ ...prev, lesson_date: updated.join(', ') }));
  };

  const handleRemoveSessionDate = (index: number) => {
    if (sessionDates.length <= 1) return;
    const updated = sessionDates.filter((_, i) => i !== index);
    setSessionDates(updated);
    const primaryDate = updated[0] || '2026-09-12';

    setFormData((prev) => ({
      ...prev,
      lesson_date: updated.join(', '),
      class_code: generateDynamicClassCode(primaryDate, prev.category, prev.class_code),
    }));
  };

  const handleSessionDateChange = (index: number, newDate: string) => {
    const updated = [...sessionDates];
    updated[index] = newDate;
    setSessionDates(updated);

    const primaryDate = updated[0] || newDate;
    const nextCode = generateDynamicClassCode(primaryDate, formData.category, formData.class_code);

    setFormData((prev) => ({
      ...prev,
      lesson_date: updated.join(', '),
      class_code: nextCode,
    }));
  };

  const handleCategoryChange = (newCategory: string) => {
    const primaryDate = sessionDates[0] || formData.lesson_date || '2026-09-12';
    const nextCode = generateDynamicClassCode(primaryDate, newCategory, modalMode === 'edit' ? formData.class_code : undefined);

    setFormData((prev) => ({
      ...prev,
      category: newCategory,
      class_code: nextCode,
    }));

    if (fieldErrors.category) setFieldErrors({ ...fieldErrors, category: '' });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!validateForm()) {
      setFeedback({ type: 'error', message: '課程資料填寫有誤，請依紅色標籤修正。' });
      return;
    }

    setSaving(true);
    const primaryLessonDate = sessionDates[0];
    const fullSessionDescription = sessionDates.length > 1 
      ? `【多堂數時段排程：共 ${sessionDates.length} 堂 (${sessionDates.join(', ')})】${formData.description ? ' - ' + formData.description : ''}`
      : formData.description;

    try {
      if (modalMode === 'create') {
        const { error } = await supabase.from('classes').insert([
          {
            class_code: formData.class_code.trim().toUpperCase(),
            category: formData.category.trim(),
            class_name: formData.class_name.trim(),
            lesson_date: primaryLessonDate,
            duration: formData.duration.trim(),
            description: fullSessionDescription.trim(),
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
            lesson_date: primaryLessonDate,
            duration: formData.duration.trim(),
            description: fullSessionDescription.trim(),
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

      const { error: studentUpdateErr } = await supabase
        .from('students')
        .update({ class_code: selectedClassForAssign })
        .eq('student_code', currentTargetStudent.student_code);

      if (studentUpdateErr) throw studentUpdateErr;

      const newTargetCount = (targetClassData.enrolled_count || 0) + 1;
      await supabase
        .from('classes')
        .update({ enrolled_count: newTargetCount })
        .eq('class_code', selectedClassForAssign);

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
        {/* TAB 1: 課程詳細清單 (含欄位排序)                                            */}
        {/* ========================================================================= */}
        {viewTab === 'admin' && (
          <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
              <thead className="bg-purple-700 text-white text-xs font-semibold uppercase select-none">
                <tr>
                  <th
                    onClick={() => {
                      if (classSortField === 'class_code') setClassSortAsc(!classSortAsc);
                      else { setClassSortField('class_code'); setClassSortAsc(true); }
                    }}
                    className="px-4 py-3 cursor-pointer hover:bg-purple-800 transition"
                  >
                    <div className="flex items-center">
                      <span>課程編號</span>
                      {renderSortArrow('class_code', classSortField, classSortAsc)}
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (classSortField === 'category') setClassSortAsc(!classSortAsc);
                      else { setClassSortField('category'); setClassSortAsc(true); }
                    }}
                    className="px-4 py-3 cursor-pointer hover:bg-purple-800 transition"
                  >
                    <div className="flex items-center">
                      <span>課程類別</span>
                      {renderSortArrow('category', classSortField, classSortAsc)}
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (classSortField === 'class_name') setClassSortAsc(!classSortAsc);
                      else { setClassSortField('class_name'); setClassSortAsc(true); }
                    }}
                    className="px-4 py-3 cursor-pointer hover:bg-purple-800 transition"
                  >
                    <div className="flex items-center">
                      <span>班別名稱</span>
                      {renderSortArrow('class_name', classSortField, classSortAsc)}
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (classSortField === 'lesson_date') setClassSortAsc(!classSortAsc);
                      else { setClassSortField('lesson_date'); setClassSortAsc(true); }
                    }}
                    className="px-4 py-3 cursor-pointer hover:bg-purple-800 transition"
                  >
                    <div className="flex items-center">
                      <span>上課日期</span>
                      {renderSortArrow('lesson_date', classSortField, classSortAsc)}
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (classSortField === 'duration') setClassSortAsc(!classSortAsc);
                      else { setClassSortField('duration'); setClassSortAsc(true); }
                    }}
                    className="px-4 py-3 cursor-pointer hover:bg-purple-800 transition"
                  >
                    <div className="flex items-center">
                      <span>上課時間</span>
                      {renderSortArrow('duration', classSortField, classSortAsc)}
                    </div>
                  </th>
                  <th className="px-4 py-3">課堂詳情</th>
                  <th
                    onClick={() => {
                      if (classSortField === 'max_capacity') setClassSortAsc(!classSortAsc);
                      else { setClassSortField('max_capacity'); setClassSortAsc(true); }
                    }}
                    className="px-4 py-3 text-center cursor-pointer hover:bg-purple-800 transition"
                  >
                    <div className="flex items-center justify-center">
                      <span>學額上限</span>
                      {renderSortArrow('max_capacity', classSortField, classSortAsc)}
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (classSortField === 'enrolled_count') setClassSortAsc(!classSortAsc);
                      else { setClassSortField('enrolled_count'); setClassSortAsc(true); }
                    }}
                    className="px-4 py-3 text-center cursor-pointer hover:bg-purple-800 transition"
                  >
                    <div className="flex items-center justify-center">
                      <span>已報名人數</span>
                      {renderSortArrow('enrolled_count', classSortField, classSortAsc)}
                    </div>
                  </th>
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
                ) : sortedClassList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">
                      目前暫無任何課程。
                    </td>
                  </tr>
                ) : (
                  sortedClassList.map((cls) => {
                    const isFull = (cls.enrolled_count || 0) >= cls.max_capacity;

                    return (
                      <tr key={cls.class_code} className="hover:bg-purple-50/40 transition">
                        <td className="px-4 py-3 font-mono font-bold text-purple-800 whitespace-nowrap">
                          {cls.class_code}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">
                            {cls.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-900">{cls.class_name}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono">{cls.lesson_date}</td>
                        <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">{cls.duration}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 max-w-sm truncate" title={cls.description}>
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
        {/* TAB 2: 學員分班指派 (含兩大表格獨立排序)                                     */}
        {/* ========================================================================= */}
        {viewTab === 'assignment' && isAssignmentAllowed && (
          <div className="space-y-6">
            <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl">
              <h2 className="text-sm font-bold text-purple-900">分班指派作業說明</h2>
              <p className="text-xs text-purple-700 mt-0.5">
                步驟 1：確認下方目標學員資料 ➔ 步驟 2：於可選課程表格勾選目標課堂 ➔ 步驟 3：在底部點擊「確認儲存學員分班指派」
              </p>
            </div>

            {/* Selected Student Summary Card */}
            {currentTargetStudent && (
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
            )}

            {/* 可選班別清單 (含欄位排序) */}
            <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
                <thead className="bg-purple-700 text-white text-xs font-semibold uppercase select-none">
                  <tr>
                    <th className="px-4 py-3 text-center">指派目標</th>
                    <th
                      onClick={() => {
                        if (assignClassSortField === 'class_code') setAssignClassSortAsc(!assignClassSortAsc);
                        else { setAssignClassSortField('class_code'); setAssignClassSortAsc(true); }
                      }}
                      className="px-4 py-3 cursor-pointer hover:bg-purple-800 transition"
                    >
                      <div className="flex items-center">
                        <span>課程編號</span>
                        {renderSortArrow('class_code', assignClassSortField, assignClassSortAsc)}
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        if (assignClassSortField === 'category') setAssignClassSortAsc(!assignClassSortAsc);
                        else { setAssignClassSortField('category'); setAssignClassSortAsc(true); }
                      }}
                      className="px-4 py-3 cursor-pointer hover:bg-purple-800 transition"
                    >
                      <div className="flex items-center">
                        <span>課程類別</span>
                        {renderSortArrow('category', assignClassSortField, assignClassSortAsc)}
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        if (assignClassSortField === 'class_name') setAssignClassSortAsc(!assignClassSortAsc);
                        else { setAssignClassSortField('class_name'); setAssignClassSortAsc(true); }
                      }}
                      className="px-4 py-3 cursor-pointer hover:bg-purple-800 transition"
                    >
                      <div className="flex items-center">
                        <span>班別名稱</span>
                        {renderSortArrow('class_name', assignClassSortField, assignClassSortAsc)}
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        if (assignClassSortField === 'lesson_date') setAssignClassSortAsc(!assignClassSortAsc);
                        else { setAssignClassSortField('lesson_date'); setAssignClassSortAsc(true); }
                      }}
                      className="px-4 py-3 cursor-pointer hover:bg-purple-800 transition"
                    >
                      <div className="flex items-center">
                        <span>上課日期</span>
                        {renderSortArrow('lesson_date', assignClassSortField, assignClassSortAsc)}
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        if (assignClassSortField === 'duration') setAssignClassSortAsc(!assignClassSortAsc);
                        else { setAssignClassSortField('duration'); setAssignClassSortAsc(true); }
                      }}
                      className="px-4 py-3 cursor-pointer hover:bg-purple-800 transition"
                    >
                      <div className="flex items-center">
                        <span>上課時間</span>
                        {renderSortArrow('duration', assignClassSortField, assignClassSortAsc)}
                      </div>
                    </th>
                    <th className="px-4 py-3">課堂詳情</th>
                    <th
                      onClick={() => {
                        if (assignClassSortField === 'max_capacity') setAssignClassSortAsc(!assignClassSortAsc);
                        else { setAssignClassSortField('max_capacity'); setAssignClassSortAsc(true); }
                      }}
                      className="px-4 py-3 text-center cursor-pointer hover:bg-purple-800 transition"
                    >
                      <div className="flex items-center justify-center">
                        <span>學額上限</span>
                        {renderSortArrow('max_capacity', assignClassSortField, assignClassSortAsc)}
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        if (assignClassSortField === 'enrolled_count') setAssignClassSortAsc(!assignClassSortAsc);
                        else { setAssignClassSortField('enrolled_count'); setAssignClassSortAsc(true); }
                      }}
                      className="px-4 py-3 text-center cursor-pointer hover:bg-purple-800 transition"
                    >
                      <div className="flex items-center justify-center">
                        <span>已報名人數</span>
                        {renderSortArrow('enrolled_count', assignClassSortField, assignClassSortAsc)}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedAvailableClasses.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-400">
                        暫無可供分配的空額課程。
                      </td>
                    </tr>
                  ) : (
                    sortedAvailableClasses.map((cls) => {
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
                          <td className="px-4 py-3 font-mono font-bold text-purple-800 whitespace-nowrap">
                            {cls.class_code}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border">
                              {cls.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">{cls.class_name}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono">{cls.lesson_date}</td>
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

            {/* 其餘現有名單學員 (含欄位排序) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div>
                  <h3 className="text-base font-bold text-gray-900">其餘現有名單學員</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    展示系統內其他學員（共 {sortedRemainingStudents.length} 人，已排除當前上方所選學員）
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-purple-700 text-white text-xs font-semibold uppercase sticky top-0 z-10 select-none">
                    <tr>
                      <th
                        onClick={() => {
                          if (studentSortField === 'name') setStudentSortAsc(!studentSortAsc);
                          else { setStudentSortField('name'); setStudentSortAsc(true); }
                        }}
                        className="px-4 py-3.5 text-left cursor-pointer hover:bg-purple-800 transition"
                      >
                        <div className="flex items-center">
                          <span>學生名字</span>
                          {renderSortArrow('name', studentSortField, studentSortAsc)}
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          if (studentSortField === 'gender') setStudentSortAsc(!studentSortAsc);
                          else { setStudentSortField('gender'); setStudentSortAsc(true); }
                        }}
                        className="px-4 py-3.5 text-left cursor-pointer hover:bg-purple-800 transition"
                      >
                        <div className="flex items-center">
                          <span>性別</span>
                          {renderSortArrow('gender', studentSortField, studentSortAsc)}
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          if (studentSortField === 'school') setStudentSortAsc(!studentSortAsc);
                          else { setStudentSortField('school'); setStudentSortAsc(true); }
                        }}
                        className="px-4 py-3.5 text-left cursor-pointer hover:bg-purple-800 transition"
                      >
                        <div className="flex items-center">
                          <span>就讀學校</span>
                          {renderSortArrow('school', studentSortField, studentSortAsc)}
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          if (studentSortField === 'payment') setStudentSortAsc(!studentSortAsc);
                          else { setStudentSortField('payment'); setStudentSortAsc(true); }
                        }}
                        className="px-4 py-3.5 text-center cursor-pointer hover:bg-purple-800 transition"
                      >
                        <div className="flex items-center justify-center">
                          <span>付款情況</span>
                          {renderSortArrow('payment', studentSortField, studentSortAsc)}
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          if (studentSortField === 'receipt') setStudentSortAsc(!studentSortAsc);
                          else { setStudentSortField('receipt'); setStudentSortAsc(true); }
                        }}
                        className="px-4 py-3.5 text-center cursor-pointer hover:bg-purple-800 transition"
                      >
                        <div className="flex items-center justify-center">
                          <span>收據檢視</span>
                          {renderSortArrow('receipt', studentSortField, studentSortAsc)}
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          if (studentSortField === 'phone') setStudentSortAsc(!studentSortAsc);
                          else { setStudentSortField('phone'); setStudentSortAsc(true); }
                        }}
                        className="px-4 py-3.5 text-left cursor-pointer hover:bg-purple-800 transition"
                      >
                        <div className="flex items-center">
                          <span>聯絡電話</span>
                          {renderSortArrow('phone', studentSortField, studentSortAsc)}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sortedRemainingStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-400 text-xs">
                          暫無其他學員記錄
                        </td>
                      </tr>
                    ) : (
                      sortedRemainingStudents.map((st) => (
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Assignment Confirmation */}
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
                    {modalMode === 'create' 
                      ? '系統將依所選日期與類別自動生成動態課程編號' 
                      : '調整現有課堂排程或學額設定'}
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
                      課程編號 <span className="text-xs font-normal text-purple-600">(動態自動生成・唯讀)</span>
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={formData.class_code}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono font-bold text-purple-800 bg-purple-50/60 cursor-not-allowed select-all"
                    />
                    <p className="mt-1 text-[11px] text-gray-400">格式：年月-類別-序號 (例如：202609-SPEC-001)</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1">
                      課程類別 <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white font-medium focus:ring-2 focus:ring-purple-600 focus:outline-none"
                    >
                      {CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat.code} value={cat.label}>
                          {cat.label} ({cat.code})
                        </option>
                      ))}
                    </select>
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
                    placeholder="例如：女拔協恩週末強化專班 / 考小實戰遊戲班 (A組)"
                    className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none transition ${
                      fieldErrors.class_name ? 'border-rose-400 bg-rose-50/30' : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
                    }`}
                  />
                  {fieldErrors.class_name && (
                    <p className="mt-1 text-xs text-rose-600 font-semibold">{fieldErrors.class_name}</p>
                  )}
                </div>

                <div className="space-y-2 bg-gray-50/70 p-3.5 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <span>📅</span> 上課堂數日期設定 <span className="text-rose-600">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddSessionDate}
                      className="text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 cursor-pointer"
                    >
                      + 增加課堂日期
                    </button>
                  </div>

                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {sessionDates.map((d, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-gray-400 w-14">
                          第 {index + 1} 堂:
                        </span>
                        <input
                          type="date"
                          value={d}
                          onChange={(e) => handleSessionDateChange(index, e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-purple-600 focus:outline-none"
                        />
                        {sessionDates.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSessionDate(index)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs"
                            title="刪除此堂數日期"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-gray-500 pt-1">
                    註：第 1 堂為主開課日，將同步影響動態課程編號生成與名冊時序排序。
                  </p>
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
                  <label className="block text-xs font-bold text-gray-800 mb-1">課堂詳情 / 授課地點備註</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="請輸入授課地點、教材說明或導師安排備註..."
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