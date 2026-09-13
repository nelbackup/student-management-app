'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface MessageTemplate {
  message_key: string;
  title: string;
  content: string;
}

const AVAILABLE_VARIABLES = [
  { label: '學生中文姓名', tag: '{STUDENTNAME}' },
  { label: '課程及班別名稱', tag: '{CLASSCATEGORY}' },
  { label: '上課日期與時間', tag: '{CLASSDATE}' },
  { label: '就讀學校', tag: '{SCHOOL}' },
  { label: '聯絡電話', tag: '{PHONE}' },
];

export default function MessageTemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('message_templates').select('*').order('message_key', { ascending: true });
      setTemplates(data || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTemplates(); }, []);

  const nextMessageKey = useMemo(() => {
    if (templates.length === 0) return 'MSG-001';
    const nums = templates.map((t) => parseInt(t.message_key.replace(/\D/g, ''), 10) || 0);
    return `MSG-${String(Math.max(...nums) + 1).padStart(3, '0')}`;
  }, [templates]);

  const handleInsertVariable = (tag: string) => {
    if (content.length + tag.length > 500) return;
    setContent((prev) => prev + tag);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setFeedback({ type: 'error', message: '請填寫標題與內容' });
      return;
    }
    setSaving(true);
    try {
      await supabase.from('message_templates').insert([{ message_key: nextMessageKey, title: title.trim(), content: content.trim() }]);
      setFeedback({ type: 'success', message: `範本 [${nextMessageKey}] 新增成功！` });
      setTitle('');
      setContent('');
      await loadTemplates();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Brand Header aligned with roster and class pages */}
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
              <h1 className="text-2xl font-black text-sky-950 mt-0.5">預設通訊範本管理</h1>
              <p className="text-xs text-slate-500">設定與維護 WhatsApp 提醒訊息範本及動態變數標籤</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/student"
              className="px-4 py-2 text-sm font-semibold text-sky-900 bg-white hover:bg-sky-50 rounded-xl border border-sky-200 shadow-sm transition"
            >
              返回學員管理
            </Link>
          </div>
        </div>

        {feedback && (
          <div className={`p-4 rounded-xl text-sm font-medium border flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
            <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{feedback.message}</span>
          </div>
        )}

        {/* New Template Form */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-5xl mx-auto">
          <h2 className="text-lg font-bold text-sky-950 mb-1">新增預設通訊範本</h2>
          <p className="text-xs text-slate-500 mb-6">設定 WhatsApp 提醒訊息範本及動態變數標籤。</p>

          <form onSubmit={handleSaveTemplate} className="space-y-5" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  訊息代碼 (自動生成・唯讀)
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={nextMessageKey}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono font-bold text-sky-950 bg-slate-100 cursor-not-allowed select-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  範本標題名稱 <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：上課前溫馨提示"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2 bg-sky-50/70 p-4 rounded-xl border border-sky-200">
              <span className="text-xs font-bold text-sky-950 block">點擊下方變數標籤快速插入：</span>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_VARIABLES.map((v) => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => handleInsertVariable(v.tag)}
                    className="px-3 py-1.5 bg-white hover:bg-sky-100 text-sky-900 border border-sky-300 rounded-lg text-xs font-mono font-bold shadow-sm transition cursor-pointer"
                  >
                    {v.label} <span className="text-amber-600 ml-1">{v.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-800">
                  訊息內容 <span className="text-rose-600">*</span> (上限 500 字)
                </label>
                <span className={`font-mono text-xs font-bold ${content.length > 480 ? 'text-rose-600' : 'text-slate-500'}`}>
                  {content.length} / 500 字
                </span>
              </div>
              <textarea
                rows={6}
                maxLength={500}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="家長您好~~~..."
                className="w-full p-3.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-700 focus:outline-none leading-relaxed text-slate-800 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-sky-950 hover:bg-sky-900 text-white font-bold rounded-xl text-sm shadow transition border-b-2 border-amber-400 disabled:opacity-50 cursor-pointer"
            >
              {saving ? '儲存中...' : '儲存新預設通訊範本'}
            </button>
          </form>
        </div>

        {/* Existing Templates Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-5xl mx-auto">
          <div className="p-4 border-b border-slate-100 bg-sky-50 font-bold text-sm text-sky-950">
            現有預設通訊範本清單 ({templates.length})
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-sky-950 text-white text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">代碼</th>
                  <th className="px-4 py-3 text-left">標題</th>
                  <th className="px-4 py-3 text-left">內容預覽</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr><td colSpan={3} className="py-10 text-center text-slate-400 text-xs">載入中...</td></tr>
                ) : templates.length === 0 ? (
                  <tr><td colSpan={3} className="py-10 text-center text-slate-400 text-xs">暫無任何通訊範本記錄。</td></tr>
                ) : (
                  templates.map((t) => (
                    <tr key={t.message_key} className="hover:bg-sky-50/40">
                      <td className="px-4 py-3 font-mono font-bold text-sky-900">{t.message_key}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{t.title}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-pre-line font-mono">{t.content}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}