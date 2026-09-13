'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  session_remark?: string | null;
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

  const [classSortField, setClassSortField] = useState<ClassSortField>('lesson_date');
  const [classSortAsc, setClassSortAsc] = useState<boolean>(true);

  const [assignClassSortField, setAssignClassSortField] = useState<ClassSortField>('lesson_date');
  const [assignClassSortAsc, setAssignClassSortAsc] = useState<boolean>(true);

  const [studentSortField, setStudentSortField] = useState<StudentSortField>('name');
  const [studentSortAsc, setStudentSortAsc] = useState<boolean>(true);

  const [selectedClassForAssign, setSelectedClassForAssign] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [viewingClassStudents, setViewingClassStudents] = useState<ClassRecord | null>(null);

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

  const isClassHistorical = (cls: ClassRecord): boolean => {
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

      const { data: rawStudents, error: studentErr } = await supabase.from('students').select('*');
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
    if (modalMode === 'edit' && currentEditingCode) return currentEditingCode;
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
      .map((c) => parseInt(c.class_code.split('-')[2], 10) || 0);

    const nextSeq = matchingSeqNums.length > 0 ? Math.max(...matchingSeqNums) + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(3, '0')}`;
  };

  const currentTargetStudent = useMemo(() => {
    if (!preselectedStudent) return null;
    return students.find((s) => s.student_code === preselectedStudent) || null;
  }, [students, preselectedStudent]);

  const sortClassList = (list: ClassRecord[], field: ClassSortField, asc: boolean) => {
    return [...list].sort((a, b) => {
      let res = 0;
      switch (field) {
        case 'class_code': res = a.class_code.localeCompare(b.class_code); break;
        case 'category': res = a.category.localeCompare(b.category, 'zh-Hant'); break;
        case 'class_name': res = a.class_name.localeCompare(b.class_name, 'zh-Hant'); break;
        case 'lesson_date': res = new Date(a.lesson_date).getTime() - new Date(b.lesson_date).getTime(); break;
        case 'duration': res = a.duration.localeCompare(b.duration); break;
        case 'max_capacity': res = a.max_capacity - b.max_capacity; break;
        case 'enrolled_count': res = (a.enrolled_count || 0) - (b.enrolled_count || 0); break;
      }
      return asc ? res : -res;
    });
  };

  const sortedClassList = useMemo(() => sortClassList(classList, classSortField, classSortAsc), [classList, classSortField, classSortAsc]);

  const sortedAvailableClasses = useMemo(() => {
    const available = classList.filter((cls) => !isClassHistorical(cls) && (cls.enrolled_count || 0) < cls.max_capacity);
    return sortClassList(available, assignClassSortField, assignClassSortAsc);
  }, [classList, assignClassSortField, assignClassSortAsc]);

  const popupClassStudents = useMemo(() => {
    if (!viewingClassStudents) return [];
    return students.filter((s) => s.class_code === viewingClassStudents.class_code);
  }, [students, viewingClassStudents]);

  const targetClassData = useMemo(() => classList.find((c) => c.class_code === selectedClassForAssign), [classList, selectedClassForAssign]);
  const remainingQuota = useMemo(() => targetClassData ? targetClassData.max_capacity - (targetClassData.enrolled_count || 0) : 0, [targetClassData]);

  const getWhatsAppLink = (phone: string, studentName: string) => {
    const cleaned = (phone || '').replace(/[^0-9]/g, '');
    const fullNumber = cleaned.startsWith('852') ? cleaned : `852${cleaned}`;
    return `https://web.whatsapp.com/send?phone=${fullNumber}&text=${encodeURIComponent(`您好，這是關於 ${studentName} 的課堂點名與上課通知。`)}`;
  };

  const handleOpenCreate = () => {
    setFieldErrors({});
    const initialDate = '2026-09-12';
    const initialCode = generateDynamicClassCode(initialDate, '專班');
    setSessionDates([initialDate]);
    setFormData({ ...defaultForm, class_code: initialCode, lesson_date: initialDate });
    setModalMode('create');
  };

  const handleOpenEdit = (cls: ClassRecord) => {
    setFieldErrors({});
    const parsedDates = cls.lesson_date.includes(',') ? cls.lesson_date.split(',').map((d) => d.trim()) : [cls.lesson_date];
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
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    const primaryLessonDate = sessionDates[0];
    const fullDesc = sessionDates.length > 1 ? `【多堂數時段排程：共 ${sessionDates.length} 堂 (${sessionDates.join(', ')})】${formData.description ? ' - ' + formData.description : ''}` : formData.description;

    try {
      if (modalMode === 'create') {
        const { error } = await supabase.from('classes').insert([{
          class_code: formData.class_code.trim().toUpperCase(),
          category: formData.category.trim(),
          class_name: formData.class_name.trim(),
          lesson_date: primaryLessonDate,
          duration: formData.duration.trim(),
          description: fullDesc.trim(),
          max_capacity: Number(formData.max_capacity),
          enrolled_count: 0,
          status: 'active',
        }]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('classes').update({
          category: formData.category.trim(),
          class_name: formData.class_name.trim(),
          lesson_date: primaryLessonDate,
          duration: formData.duration.trim(),
          description: fullDesc.trim(),
          max_capacity: Number(formData.max_capacity),
        }).eq('class_code', formData.class_code);
        if (error) throw error;
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
    if (!currentTargetStudent || !selectedClassForAssign || !targetClassData) return;
    setAssigning(true);
    try {
      const prevClassCode = currentTargetStudent.class_code;
      await supabase.from('students').update({ class_code: selectedClassForAssign }).eq('student_code', currentTargetStudent.student_code);
      const newTargetCount = (targetClassData.enrolled_count || 0) + 1;
      await supabase.from('classes').update({ enrolled_count: newTargetCount }).eq('class_code', selectedClassForAssign);

      if (prevClassCode) {
        const { count } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('class_code', prevClassCode);
        if (count !== null) await supabase.from('classes').update({ enrolled_count: count }).eq('class_code', prevClassCode);
      }

      setFeedback({
        type: 'success',
        title: '🎉 學員分班指派已成功完成！',
        message: '已成功將學員分配至新課堂。',
        details: {
          studentName: `${currentTargetStudent.chinese_name}`,
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
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAssigning(false);
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
                <span className="text-xs uppercase tracking-wider font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Luminous Minds</span>
                <span className="text-xs font-bold text-slate-500">Miss Ann</span>
              </div>
              <h1 className="text-2xl font-black text-sky-950 mt-0.5">課程與堂別中心</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/roster" className="px-4 py-2 text-sm font-semibold text-sky-900 bg-white hover:bg-sky-50 rounded-xl border border-sky-200 shadow-sm transition">返回點名名冊</Link>
            {viewTab === 'admin' && (
              <button onClick={handleOpenCreate} className="px-4 py-2 bg-sky-950 hover:bg-sky-900 text-white text-sm font-bold rounded-xl shadow-sm transition cursor-pointer border-b-2 border-amber-400">+ 新增課程</button>
            )}
          </div>
        </div>

        <div className="flex border-b border-slate-200 bg-white p-1 rounded-2xl shadow-sm">
          <button onClick={() => { setViewTab('admin'); setFeedback(null); }} className={`flex-1 py-3 text-sm font-bold rounded-xl transition cursor-pointer ${viewTab === 'admin' ? 'bg-sky-950 text-white shadow-md border-b-2 border-amber-400' : 'text-slate-600 hover:text-sky-950 hover:bg-slate-50'}`}>📋 課程詳細清單</button>
          <button disabled={!isAssignmentAllowed} onClick={() => isAssignmentAllowed && setViewTab('assignment')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 ${!isAssignmentAllowed ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-dashed border-slate-300' : viewTab === 'assignment' ? 'bg-sky-950 text-white shadow-md border-b-2 border-amber-400' : 'text-slate-600 hover:text-sky-950 hover:bg-slate-50 cursor-pointer'}`}>
            <span>🎓 學員分班指派</span>
            {!isAssignmentAllowed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">需由學員修改頁進入</span>}
          </button>
        </div>

        {feedback && (
          <div className={`p-5 rounded-2xl border shadow-sm ${feedback.type === 'success' ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
            <h3 className="text-base font-black">{feedback.title || '操作成功'}</h3>
            <p className="text-sm font-medium mt-0.5">{feedback.message}</p>
          </div>
        )}

        {viewTab === 'admin' && (
          <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
              <thead className="bg-sky-950 text-white text-xs font-semibold uppercase select-none">
                <tr>
                  <th onClick={() => setClassSortField('class_code')} className="px-4 py-3 cursor-pointer">課程編號</th>
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
              <tbody className="divide-y divide-slate-200">
                {sortedClassList.map((cls) => {
                  const isFull = (cls.enrolled_count || 0) >= cls.max_capacity;
                  const isHistorical = isClassHistorical(cls);
                  return (
                    <tr key={cls.class_code} className={`transition ${isHistorical ? 'bg-slate-50/50' : 'hover:bg-sky-50/40'}`}>
                      <td className="px-4 py-3 font-mono font-bold whitespace-nowrap">
                        <button type="button" onClick={() => setViewingClassStudents(cls)} className="text-sky-950 hover:text-amber-600 underline decoration-sky-300 font-bold cursor-pointer">
                          {cls.class_code}
                        </button>
                      </td>
                      <td className="px-4 py-3"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-900 border">{cls.category}</span></td>
                      <td className="px-4 py-3 font-bold text-slate-900">{cls.class_name}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono">{cls.lesson_date}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{cls.duration}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-sm truncate">{cls.description || '-'}</td>
                      <td className="px-4 py-3 text-center font-bold">{cls.max_capacity} 人</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${isFull ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'}`}>
                          {cls.enrolled_count} 人
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isHistorical ? <span className="text-slate-300 text-xs">-</span> : (
                          <button onClick={() => handleOpenEdit(cls)} className="px-3 py-1 text-xs font-bold text-sky-900 bg-sky-50 hover:bg-sky-100 rounded-lg border cursor-pointer">修改</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {viewTab === 'assignment' && isAssignmentAllowed && (
          <div className="space-y-6">
            <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-sky-950 text-white text-xs font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3 text-center">指派目標</th>
                    <th className="px-4 py-3">課程編號</th>
                    <th className="px-4 py-3">班別名稱</th>
                    <th className="px-4 py-3">上課日期</th>
                    <th className="px-4 py-3">時段</th>
                    <th className="px-4 py-3 text-center">學額</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedAvailableClasses.map((cls) => {
                    const isSelected = selectedClassForAssign === cls.class_code;
                    return (
                      <tr key={cls.class_code} onClick={() => setSelectedClassForAssign(cls.class_code)} className={`cursor-pointer ${isSelected ? 'bg-sky-50 ring-2 ring-sky-700' : 'hover:bg-slate-50'}`}>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => setSelectedClassForAssign(isSelected ? null : cls.class_code)} className="w-4 h-4 text-sky-800 rounded cursor-pointer" />
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-sky-950">{cls.class_code}</td>
                        <td className="px-4 py-3 font-medium">{cls.class_name}</td>
                        <td className="px-4 py-3 font-mono">{cls.lesson_date}</td>
                        <td className="px-4 py-3 font-mono">{cls.duration}</td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-700">餘 {cls.max_capacity - (cls.enrolled_count || 0)} 席</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="sticky bottom-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-sky-200 flex items-center justify-between">
              <div className="text-xs text-slate-600">
                調配學員：<span className="font-bold text-sky-950">{currentTargetStudent?.chinese_name}</span> | 目標班別：<span className="font-mono font-bold text-sky-800">{selectedClassForAssign || '未選取'}</span>
              </div>
              <button disabled={assigning || !selectedClassForAssign || !currentTargetStudent} onClick={handleAssignSubmit} className="px-8 py-3 bg-sky-950 hover:bg-sky-900 text-white font-bold text-sm rounded-xl shadow cursor-pointer">
                {assigning ? '儲存中...' : '確認儲存學員分班指派'}
              </button>
            </div>
          </div>
        )}

        {viewingClassStudents && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border my-8 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b">
                <h3 className="text-lg font-black text-sky-950">{viewingClassStudents.class_name} [{viewingClassStudents.class_code}] 已登記名冊</h3>
                <button type="button" onClick={() => setViewingClassStudents(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer">✕</button>
              </div>
              <div className="overflow-x-auto max-h-96 border rounded-xl">
                <table className="min-w-full divide-y text-sm">
                  <thead className="bg-sky-950 text-white text-xs uppercase sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left">學生名字</th>
                      <th className="px-4 py-3 text-left">性別</th>
                      <th className="px-4 py-3 text-left">學校</th>
                      <th className="px-4 py-3 text-center">付款</th>
                      <th className="px-4 py-3 text-left">電話</th>
                      <th className="px-4 py-3 text-center">出席狀態 (唯讀)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {popupClassStudents.map((st) => (
                      <tr key={st.student_code} className="hover:bg-sky-50/40">
                        <td className="px-4 py-3 font-bold text-sky-950">{st.chinese_name}</td>
                        <td className="px-4 py-3">{st.gender}</td>
                        <td className="px-4 py-3">{st.school || '-'}</td>
                        <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 text-xs font-bold rounded-full ${st.payment_status === 'yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{st.payment_status === 'yes' ? '已付款' : '未付款'}</span></td>
                        <td className="px-4 py-3 font-mono"><a href={getWhatsAppLink(st.phone, st.chinese_name)} target="whatsapp_web_session" rel="noreferrer" className="text-blue-600 underline">{st.phone}</a></td>
                        <td className="px-4 py-3 text-center">
                          {st.attendance_status ? <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border rounded-lg text-xs font-bold">✓ 已出席</span> : <span className="px-2.5 py-1 bg-slate-100 text-slate-500 border rounded-lg text-xs">未簽到</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {modalMode && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl my-8 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b">
                <h3 className="text-xl font-bold text-sky-950">{modalMode === 'create' ? '新增課程資料' : '修改課程'}</h3>
                <button type="button" onClick={() => setModalMode(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">班別名稱</label>
                  <input type="text" value={formData.class_name} onChange={(e) => setFormData({ ...formData, class_name: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">學額上限</label>
                  <input type="number" value={formData.max_capacity} onChange={(e) => setFormData({ ...formData, max_capacity: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-xl text-sm" />
                </div>

                {/* Multiple Session Dates Section */}
                <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">📅 上課堂數日期設定 *</label>
                    <button type="button" onClick={handleAddSessionDate} className="text-xs font-bold text-sky-900 bg-white px-2.5 py-1 rounded-lg border cursor-pointer">+ 增加課堂日期</button>
                  </div>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {sessionDates.map((d, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-400 w-14">第 {index + 1} 堂:</span>
                        <input type="date" value={d} onChange={(e) => handleSessionDateChange(index, e.target.value)} className="flex-1 px-3 py-1.5 border rounded-xl text-xs font-mono bg-white" />
                        {sessionDates.length > 1 && (
                          <button type="button" onClick={() => handleRemoveSessionDate(index)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs">✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">上課時段</label>
                  <AnalogClockPicker label="時段設定" value={formData.duration.split('-')[0].trim()} onChange={(newStart) => setFormData({ ...formData, duration: `${newStart} - 16:00` })} />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setModalMode(null)} className="px-4 py-2 text-sm text-slate-600 cursor-pointer">取消</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-sky-950 text-white font-bold rounded-xl text-sm cursor-pointer">{saving ? '儲存中...' : '儲存變更'}</button>
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
  return <Suspense fallback={<div className="p-8 text-center text-slate-500">載入中...</div>}><ClassesAdminContent /></Suspense>;
}