'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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

export default function ClassAdminPage() {
  const [classList, setClassList] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [formData, setFormData] = useState<ClassRecord>(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Helper to split "HH:mm - HH:mm" into start and end strings
  const getStartEndTime = (durationStr: string) => {
    const parts = (durationStr || '').split('-').map((s) => s.trim());
    return {
      start: parts[0] || '15:00',
      end: parts[1] || '16:00',
    };
  };

  const loadClassesAndEnrolments = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const { data: rawClasses, error: classErr } = await supabase
        .from('classes')
        .select('*')
        .order('lesson_date', { ascending: true })
        .order('class_code', { ascending: true });

      if (classErr) throw classErr;

      const { data: students, error: studentErr } = await supabase
        .from('students')
        .select('class_code');

      if (studentErr) throw studentErr;

      const countMap: Record<string, number> = {};
      (students || []).forEach((s) => {
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
        enrolled_count: countMap[c.class_code] || 0,
      }));

      setClassList(aggregated);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || '讀取課程資料失敗' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClassesAndEnrolments();
  }, []);

  // Shared validation suite across Create and Edit modes
  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};

    // 1. Class Code Validation
    const cleanCode = formData.class_code.trim();
    if (!cleanCode) {
      errs.class_code = '請輸入課程編號';
    } else if (!/^C\d{4}-[A-Z0-9]+$/i.test(cleanCode)) {
      errs.class_code = '課程編號格式需為 C年份-班別，例如：C2026-A';
    } else if (
      modalMode === 'create' &&
      classList.some((c) => c.class_code.toUpperCase() === cleanCode.toUpperCase())
    ) {
      errs.class_code = `課程編號「${cleanCode}」已存在，請使用不同代碼`;
    }

    // 2. Category Validation
    if (!formData.category.trim()) {
      errs.category = '請輸入課程類別';
    } else if (formData.category.trim().length < 2) {
      errs.category = '課程類別長度最少需 2 個字元';
    }

    // 3. Class Name Validation
    if (!formData.class_name.trim()) {
      errs.class_name = '請輸入班別名稱';
    } else if (formData.class_name.trim().length < 2) {
      errs.class_name = '班別名稱長度最少需 2 個字元';
    }

    // 4. Lesson Date Validation
    if (!formData.lesson_date) {
      errs.lesson_date = '請選擇有效上課日期';
    }

    // 5. Duration (Clock) Validation
    const { start, end } = getStartEndTime(formData.duration);
    const startMinutes = parseInt(start.split(':')[0], 10) * 60 + parseInt(start.split(':')[1], 10);
    const endMinutes = parseInt(end.split(':')[0], 10) * 60 + parseInt(end.split(':')[1], 10);

    if (isNaN(startMinutes) || isNaN(endMinutes)) {
      errs.duration = '上課時段格式不正確';
    } else if (startMinutes >= endMinutes) {
      errs.duration = `結束時間 (${end}) 必須晚於開始時間 (${start})`;
    }

    // 6. Capacity Validation
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

  const handleToggleSuspend = async (cls: ClassRecord) => {
    const nextStatus = cls.status === 'suspended' ? 'active' : 'suspended';
    const actionLabel = nextStatus === 'suspended' ? '暫停' : '恢復開班';

    if (!confirm(`確定要將課程「${cls.class_name} (${cls.class_code})」設定為【${actionLabel}】狀態嗎？`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('classes')
        .update({ status: nextStatus })
        .eq('class_code', cls.class_code);

      if (error) throw error;

      setClassList((prev) =>
        prev.map((c) => (c.class_code === cls.class_code ? { ...c, status: nextStatus } : c))
      );
      setFeedback({ type: 'success', message: `課程「${cls.class_code}」已成功設定為【${actionLabel}】。` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `更新失敗: ${err.message}` });
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!validateForm()) {
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
            status: formData.status || 'active',
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
            status: formData.status,
          })
          .eq('class_code', formData.class_code);
        if (error) throw error;
        setFeedback({ type: 'success', message: `課程「${formData.class_code}」變更儲存成功！` });
      }

      setModalMode(null);
      await loadClassesAndEnrolments();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || '儲存失敗' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-gray-200 gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900">課程與堂別管理中心</h1>
            <p className="text-sm text-gray-500 mt-1">管理課堂排程、學額上限、停課狀態與即時報名人數</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/roster"
              className="px-4 py-2 text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 transition"
            >
              返回名冊 (Roster)
            </Link>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-bold rounded-xl shadow-sm transition"
            >
              + 新增課程
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={`p-4 mb-6 rounded-xl text-sm font-medium border flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Classes Table */}
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
                <th className="px-4 py-3 text-center">狀態</th>
                <th className="px-4 py-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    載入課程列表中...
                  </td>
                </tr>
              ) : classList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    目前暫無課程，請點擊上方按鈕新增。
                  </td>
                </tr>
              ) : (
                classList.map((cls) => {
                  const isFull = (cls.enrolled_count || 0) >= cls.max_capacity;
                  const isSuspended = cls.status === 'suspended';

                  return (
                    <tr
                      key={cls.class_code}
                      className={`hover:bg-purple-50/40 transition ${
                        isSuspended ? 'bg-gray-50 opacity-60' : ''
                      }`}
                    >
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
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            isSuspended
                              ? 'bg-gray-200 text-gray-600'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {isSuspended ? '已暫停' : '進行中'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(cls)}
                            className="px-2.5 py-1 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition"
                          >
                            修改
                          </button>
                          <button
                            onClick={() => handleToggleSuspend(cls)}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition ${
                              isSuspended
                                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                                : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200'
                            }`}
                          >
                            {isSuspended ? '恢復' : '暫停'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal: Form with Unified Validation & Clocks */}
        {modalMode && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 my-8">
              <div className="flex items-center justify-between pb-4 mb-4 border-b">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {modalMode === 'create' ? '新增課程資料' : `修改課程: ${formData.class_code}`}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {modalMode === 'create' ? '請填寫下列各項課程參數以排定新課程' : '調整現有課堂排程或學額設定'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4" noValidate>
                {/* Class Code & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1">
                      課程編號 <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      disabled={modalMode === 'edit'}
                      value={formData.class_code}
                      onChange={(e) => setFormData({ ...formData, class_code: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="例如：數學思維 / 英語進階"
                      className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none transition ${
                        fieldErrors.category ? 'border-rose-400 bg-rose-50/30' : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
                      }`}
                    />
                    {fieldErrors.category && (
                      <p className="mt-1 text-xs text-rose-600 font-semibold">{fieldErrors.category}</p>
                    )}
                  </div>
                </div>

                {/* Class Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    班別名稱 <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.class_name}
                    onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                    placeholder="例如：小學奧數進階週六班"
                    className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none transition ${
                      fieldErrors.class_name ? 'border-rose-400 bg-rose-50/30' : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
                    }`}
                  />
                  {fieldErrors.class_name && (
                    <p className="mt-1 text-xs text-rose-600 font-semibold">{fieldErrors.class_name}</p>
                  )}
                </div>

                {/* Date & Capacity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1">
                      上課日期 <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.lesson_date}
                      onChange={(e) => setFormData({ ...formData, lesson_date: e.target.value })}
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
                      onChange={(e) =>
                        setFormData({ ...formData, max_capacity: parseInt(e.target.value, 10) || 0 })
                      }
                      className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none transition ${
                        fieldErrors.max_capacity ? 'border-rose-400 bg-rose-50/30' : 'border-gray-300 focus:ring-2 focus:ring-purple-600'
                      }`}
                    />
                    {fieldErrors.max_capacity && (
                      <p className="mt-1 text-xs text-rose-600 font-semibold">{fieldErrors.max_capacity}</p>
                    )}
                  </div>
                </div>

                {/* Dual Graphic Analog Clock Pickers */}
                <div className="pt-1">
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    上課時段 (拖動鐘面指針設定時間) <span className="text-rose-600">*</span>
                  </label>

                  <div className="mb-2.5 p-2.5 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between">
                    <span className="text-xs text-gray-600 font-medium">目前設定時段：</span>
                    <span className="font-mono font-bold text-purple-800 text-sm tracking-wide">
                      {formData.duration}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <AnalogClockPicker
                      label="開始時間 (Start Time)"
                      value={getStartEndTime(formData.duration).start}
                      onChange={(newStart) => {
                        const currentEnd = getStartEndTime(formData.duration).end;
                        setFormData({ ...formData, duration: `${newStart} - ${currentEnd}` });
                      }}
                    />

                    <AnalogClockPicker
                      label="結束時間 (End Time)"
                      value={getStartEndTime(formData.duration).end}
                      onChange={(newEnd) => {
                        const currentStart = getStartEndTime(formData.duration).start;
                        setFormData({ ...formData, duration: `${currentStart} - ${newEnd}` });
                      }}
                    />
                  </div>

                  {fieldErrors.duration && (
                    <p className="mt-2 text-xs text-rose-600 font-semibold bg-rose-50 p-2 rounded-lg border border-rose-200">
                      ⚠️ {fieldErrors.duration}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">課程營運狀態</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                  >
                    <option value="active">進行中 (Active)</option>
                    <option value="suspended">暫停開課 (Suspended)</option>
                  </select>
                </div>

                {/* Details / Remarks */}
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">課堂詳情 / 備註</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="請輸入課堂導師、教材需求或授課地點等備註..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 text-sm font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow transition disabled:opacity-50"
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