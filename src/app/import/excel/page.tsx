'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ExcelStudentRow {
  student_code?: string;
  chinese_name: string;
  english_name: string;
  school?: string;
  gender?: string;
  phone: string;
  class_code: string;
  payment_status?: string;
  receipt_url?: string;
  attendance_status?: boolean;
}

export default function ExcelMigrationPage() {
  const [parsedRows, setParsedRows] = useState<ExcelStudentRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLog(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        const mapped: ExcelStudentRow[] = rawJson.map((row) => ({
          student_code: String(row['student_code'] || row['學生編號'] || '').trim() || undefined,
          chinese_name: String(row['chinese_name'] || row['中文姓名'] || row['學生名字'] || '').trim(),
          english_name: String(row['english_name'] || row['英文姓名'] || '').trim(),
          school: String(row['school'] || row['就讀學校'] || row['學校'] || '').trim(),
          gender: String(row['gender'] || row['性別'] || '男').trim(),
          phone: String(row['phone'] || row['聯絡電話'] || row['電話'] || '').trim(),
          class_code: String(row['class_code'] || row['班別代碼'] || row['堂別編號'] || '').trim(),
          payment_status: String(row['payment_status'] || row['付款情況'] || 'no').trim().toLowerCase() === 'yes' ? 'yes' : 'no',
          receipt_url: String(row['receipt_url'] || row['收據檢視'] || row['收據'] || '').trim() || undefined,
          attendance_status: false,
        }));

        setParsedRows(mapped.filter((r) => r.chinese_name || r.english_name));
      } catch (err: any) {
        setLog({ type: 'error', message: `解析 Excel 失敗: ${err.message}` });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleMigrate = async () => {
    if (parsedRows.length === 0) return;
    setLoading(true);
    setLog(null);

    try {
      const { data: latestRecords } = await supabase
        .from('students')
        .select('student_code')
        .order('student_code', { ascending: false })
        .limit(1);

      let currentNum = 1;
      if (latestRecords && latestRecords.length > 0) {
        const numPart = parseInt(latestRecords[0].student_code.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(numPart)) currentNum = numPart + 1;
      }

      const payload = parsedRows.map((row) => {
        const code = row.student_code || `S${(currentNum++).toString().padStart(10, '0')}`;
        return {
          student_code: code,
          chinese_name: row.chinese_name,
          english_name: row.english_name,
          school: row.school || '',
          gender: row.gender || '男',
          phone: row.phone,
          class_code: row.class_code,
          payment_status: row.payment_status || 'no',
          receipt_url: row.receipt_url || null,
          attendance_status: row.attendance_status || false,
        };
      });

      const { error } = await supabase
        .from('students')
        .upsert(payload, { onConflict: 'student_code' });

      if (error) throw error;

      setLog({ type: 'success', message: `成功遷移並匯入 ${payload.length} 筆學生資料！` });
      setParsedRows([]);
      setFileName('');
    } catch (err: any) {
      setLog({ type: 'error', message: err.message || '資料寫入失敗' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Excel / CSV 批次遷移匯入</h1>
            <p className="text-sm text-gray-500 mt-1">支援中英欄位表頭自動映射與重複覆蓋寫入</p>
          </div>
          <div className="flex gap-3">
            <Link href="/import" className="px-4 py-2 text-sm text-purple-700 bg-purple-50 rounded-lg border border-purple-200">
              單筆新增
            </Link>
            <Link href="/roster" className="px-4 py-2 text-sm text-white bg-purple-700 rounded-lg">
              返回點名名冊
            </Link>
          </div>
        </div>

        {log && (
          <div className={`p-4 mb-6 rounded-lg text-sm font-medium ${log.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {log.message}
          </div>
        )}

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">上傳 Excel / CSV 檔案</label>
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
          />
          <p className="text-xs text-gray-400 mt-2">
            支援欄位：學生編號 (選填), 中文姓名, 英文姓名, 就讀學校, 性別, 聯絡電話, 班別代碼 (例如 C2026-A), 付款情況 (yes/no)
          </p>
        </div>

        {parsedRows.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <span className="font-semibold text-sm text-gray-700">檔案預覽: {fileName} ({parsedRows.length} 筆資料)</span>
              <button
                onClick={handleMigrate}
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg shadow-sm disabled:opacity-50"
              >
                {loading ? '匯入中...' : '確認寫入 Supabase 資料庫'}
              </button>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
                <thead className="bg-gray-100 text-gray-600">
                  <tr>
                    <th className="p-3">編號</th>
                    <th className="p-3">姓名</th>
                    <th className="p-3">性別</th>
                    <th className="p-3">學校</th>
                    <th className="p-3">電話</th>
                    <th className="p-3">班別代碼</th>
                    <th className="p-3">付款</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {parsedRows.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-500">{r.student_code || '(自動遞增)'}</td>
                      <td className="p-3 font-medium text-gray-900">{r.chinese_name} ({r.english_name})</td>
                      <td className="p-3">{r.gender}</td>
                      <td className="p-3">{r.school || '-'}</td>
                      <td className="p-3">{r.phone}</td>
                      <td className="p-3 font-mono text-purple-700">{r.class_code}</td>
                      <td className="p-3">{r.payment_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}