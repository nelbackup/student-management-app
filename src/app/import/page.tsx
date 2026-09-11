'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface StudentForm {
  chinese_name: string;
  english_name: string;
  school: string;
  gender: string;
  phone: string;
  class_code: string;
  payment_status: string;
  receipt_url: string;
}

const initialForm: StudentForm = {
  chinese_name: '',
  english_name: '',
  school: '',
  gender: '男',
  phone: '',
  class_code: 'C2026-A',
  payment_status: 'no',
  receipt_url: '',
};

export default function ImportStudentPage() {
  const [form, setForm] = useState<StudentForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/import-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || data.success === false) {
        throw new Error(data.error || '匯入失敗，請檢查資料欄位');
      }

      setStatusMessage({ type: 'success', text: `學員 ${form.chinese_name} (${form.english_name}) 成功匯入！` });
      setForm(initialForm);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || '連線錯誤' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-md border border-gray-100">
        <div className="flex items-center justify-between pb-6 border-b mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">學員匯入登記</h1>
            <p className="text-sm text-gray-500 mt-1">手動新增或批次登記至指定堂別</p>
          </div>
          <Link
            href="/roster"
            className="px-4 py-2 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow-sm transition"
          >
            返回點名名冊
          </Link>
        </div>

        {statusMessage && (
          <div
            className={`p-4 mb-6 rounded-lg text-sm font-medium ${
              statusMessage.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">中文姓名 *</label>
              <input
                required
                type="text"
                name="chinese_name"
                value={form.chinese_name}
                onChange={handleChange}
                placeholder="例如：周小龍"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">英文姓名 *</label>
              <input
                required
                type="text"
                name="english_name"
                value={form.english_name}
                onChange={handleChange}
                placeholder="例如：Bruce"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">性別 *</label>
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
              >
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">聯絡電話 (香港手機) *</label>
              <input
                required
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="例如：98765432"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">就讀學校</label>
            <input
              type="text"
              name="school"
              value={form.school}
              onChange={handleChange}
              placeholder="例如：拔萃小學"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">分配班別代碼 *</label>
              <select
                name="class_code"
                value={form.class_code}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
              >
                <option value="C2026-A">C2026-A (15:00 - 16:00)</option>
                <option value="C2026-B">C2026-B (16:15 - 17:15)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">付款狀態 *</label>
              <select
                name="payment_status"
                value={form.payment_status}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
              >
                <option value="no">未付款 (no)</option>
                <option value="yes">已付款 (yes)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">收據圖片或雲端網址</label>
            <input
              type="url"
              name="receipt_url"
              value={form.receipt_url}
              onChange={handleChange}
              placeholder="https://..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg shadow transition disabled:opacity-50"
          >
            {loading ? '正在匯入中...' : '提交學員資料'}
          </button>
        </form>
      </div>
    </div>
  );
}