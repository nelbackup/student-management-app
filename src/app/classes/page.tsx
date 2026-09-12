'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ClassRecord {
  class_code: string;      // 課程編號
  category: string;        // 課程類別
  class_name: string;      // 班別名稱
  lesson_date: string;     // 上課日期
  duration: string;        // 上課時間 (如 15:00 - 16:00)
  description: string;     // 課堂詳情
  max_capacity: number;    // 學額上限
  status: string;          // 狀態 ('active' | 'suspended')
  enrolled_count?: number; // 已報名人數 (動態聚合)
}

const emptyForm: ClassRecord = {
  class_code: '',
  category: '數學思維',
  class_name: '',
  lesson_date: new Date().toISOString().split('T')[0],
  duration: '15:00 - 16:00',
  description: '',
  max_capacity: 15,
  status: 'active',
};

export default function ClassAdminPage() {
  const [classList, setClassList] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [formData, setFormData] = useState<ClassRecord>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch all classes and dynamically calculate enrollment counts
  const loadClassesAndEnrolments = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      // 1. Query classes
      const { data: rawClasses, error: classErr } = await supabase
        .from('classes')
        .select('*')
        .order('lesson_date', { ascending: true })
        .order('class_code', { ascending: true });

      if (classErr) throw classErr;

      // 2. Query all student counts grouped by class_code
      const { data: students, error: studentErr } = await supabase
        .from('students')
        .select('class_code');

      if (studentErr) throw studentErr;

      // Map count per class_code
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

  const handleOpenCreate = () => {
    setFormData({
      ...emptyForm,
      class_code: `C${new Date().getFullYear()}-${String.fromCharCode(65 + (classList.length % 26))}`,
    });
    setModalMode('create');
  };

  const handleOpenEdit = (cls: ClassRecord) => {
    setFormData(cls);
    setModalMode('edit');
  };

  const handleToggleSuspend = async (cls: ClassRecord) => {
    const nextStatus = cls.status === 'suspended' ? 'active' : 'suspended';
    const actionName = nextStatus === 'suspended' ? '暫停' : '恢復開班';
    if (!confirm(`確定要將課程「${cls.class_name} (${cls.class_code})」設定為【${actionName}】狀態嗎？`)) {
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
      setFeedback({ type: 'success', message: `已成功將 ${cls.class_code} 標記為【${actionName}】。` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `更新失敗: ${err.message}` });
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      if (modalMode === 'create') {
        const { error } = await supabase.from('classes').insert([
          {
            class_code: formData.class_code.trim(),
            category: formData.category.trim(),
            class_name: formData.class_name.trim(),
            lesson_date: formData.lesson_date,
            duration: formData.duration.trim(),
            description: formData.description.trim(),
            max_capacity: Number(formData.max_capacity) || 20,
            status: formData.status || 'active',
          },
        ]);
        if (error) throw error;
        setFeedback({ type: 'success', message: `課程「${formData.class_code}」已成功新增！` });
      } else {
        const { error } = await supabase
          .from('classes')
          .update({
            category: formData.category.trim(),
            class_name: formData.class_name.trim(),
            lesson_date: formData.lesson_date,
            duration: formData.duration.trim(),
            description: formData.description.trim(),
            max_capacity: Number(formData.max_capacity) || 20,
            status: formData.status,
          })
          .eq('class_code', formData.class_code);
        if (error) throw error;
        setFeedback({ type: 'success', message: `課程「${formData.class_code}」資料已更新！` });
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
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-gray-200 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">課程與堂別管理中心</h1>
            <p className="text-sm text-gray-500 mt-1">管理課程類別、開課時段、學額上限、停課狀態與即時報名人數</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/roster"
              className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition"
            >
              返回名冊 (Roster)
            </Link>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-lg shadow-sm transition"
            >
              + 新增課程
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 mb-6 rounded-xl text-sm font-medium border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {feedback.message}
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
                            className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded border border-purple-200"
                          >
                            修改
                          </button>
                          <button
                            onClick={() => handleToggleSuspend(cls)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded border ${
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

        {/* Modal: Add or Edit Class */}
        {modalMode && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100">
              <div className="flex items-center justify-between pb-4 mb-4 border-b">
                <h3 className="text-lg font-bold text-gray-900">
                  {modalMode === 'create' ? '新增課程資料' : `修改課程: ${formData.class_code}`}
                </h3>
                <button
                  onClick={() => setModalMode(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">課程編號 *</label>
                    <input
                      type="text"
                      required
                      disabled={modalMode === 'edit'}
                      value={formData.class_code}
                      onChange={(e) => setFormData({ ...formData, class_code: e.target.value })}
                      placeholder="例：C2026-A"
                      className="w-full px-3 py-2 border rounded-lg text-sm font-mono disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">課程類別 *</label>
                    <input
                      type="text"
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="例：奧數 / 英語常規班"
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">班別名稱 *</label>
                  <input
                    type="text"
                    required
                    value={formData.class_name}
                    onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                    placeholder="例：小學奧數進階週六班"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">上課日期 *</label>
                    <input
                      type="date"
                      required
                      value={formData.lesson_date}
                      onChange={(e) => setFormData({ ...formData, lesson_date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">上課時間 (時段) *</label>
                    <input
                      type="text"
                      required
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      placeholder="例：15:00 - 16:00"
                      className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">學額上限 (人) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={formData.max_capacity}
                      onChange={(e) =>
                        setFormData({ ...formData, max_capacity: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">課程營運狀態</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    >
                      <option value="active">進行中 (Active)</option>
                      <option value="suspended">暫停開課 (Suspended)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">課堂詳情 / 備註</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="請輸入課堂導師、教材需求或授課地點等備註..."
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 text-sm font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow disabled:opacity-50"
                  >
                    {saving ? '正在儲存...' : '確認送出'}
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