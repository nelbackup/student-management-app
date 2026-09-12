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
  rowNum: number;
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
  validationError?: string;
}

interface ErrorDetails {
  title: string;
  cause: string;
  solution: string;
  failedItems?: { row: number; name: string; class_code: string; reason: string }[];
  rawError?: string;
}

export default function ExcelMigrationPage() {
  const [parsedRows, setParsedRows] = useState<ExcelStudentRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSuccessMessage(null);
    setErrorDetails(null);
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

        if (rawJson.length === 0) {
          setErrorDetails({
            title: '空檔案或格式無效',
            cause: '試算表內沒有可讀取的資料列。',
            solution: '請確認 Excel 第一行包含正確表頭欄位（例如：中文姓名、英文姓名、聯絡電話、班別代碼）。',
          });
          return;
        }

        const seenInFile = new Set<string>();
        const mapped: ExcelStudentRow[] = rawJson.map((row, idx) => {
          const rowNum = idx + 2; // Excel row numbering (header = row 1)
          const chinese_name = String(row['chinese_name'] || row['中文姓名'] || row['學生名字'] || '').trim();
          const english_name = String(row['english_name'] || row['英文姓名'] || '').trim();
          const phone = String(row['phone'] || row['聯絡電話'] || row['電話'] || '').trim();
          const class_code = String(row['class_code'] || row['班別代碼'] || row['堂別編號'] || '').trim();
          const student_code = String(row['student_code'] || row['學生編號'] || '').trim() || undefined;

          // Pre-validation checks
          let validationError: string | undefined;
          if (!chinese_name && !english_name) {
            validationError = '缺少姓名';
          } else if (!phone) {
            validationError = '缺少聯絡電話';
          } else if (!class_code) {
            validationError = '缺少班別代碼';
          }

          // Duplicate in same file check
          const duplicateKey = `${phone}_${class_code}`;
          if (phone && class_code) {
            if (seenInFile.has(duplicateKey)) {
              validationError = `檔案內重複報讀同一班別 (${class_code})`;
            } else {
              seenInFile.add(duplicateKey);
            }
          }

          return {
            rowNum,
            student_code,
            chinese_name,
            english_name,
            school: String(row['school'] || row['就讀學校'] || row['學校'] || '').trim(),
            gender: String(row['gender'] || row['性別'] || '男').trim(),
            phone,
            class_code,
            payment_status: String(row['payment_status'] || row['付款情況'] || 'no').trim().toLowerCase() === 'yes' ? 'yes' : 'no',
            receipt_url: String(row['receipt_url'] || row['收據檢視'] || row['收據'] || '').trim() || undefined,
            attendance_status: false,
            validationError,
          };
        });

        setParsedRows(mapped);
      } catch (err: any) {
        setErrorDetails({
          title: '檔案解析失敗',
          cause: err.message,
          solution: '請確認檔案為標準 .xlsx, .xls 或 UTF-8 編碼之 .csv 格式。',
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleMigrate = async () => {
    if (parsedRows.length === 0) return;

    // Check for pre-validation issues
    const validationFails = parsedRows.filter((r) => r.validationError);
    if (validationFails.length > 0) {
      setErrorDetails({
        title: '檔案內容格式未符標準',
        cause: `發現 ${validationFails.length} 筆資料欄位有缺漏或檔案內重複登記。`,
        solution: '請依照下方預覽表格中標註為紅色的列進行修正後再重新上傳。',
        failedItems: validationFails.map((r) => ({
          row: r.rowNum,
          name: `${r.chinese_name} ${r.english_name}`.trim() || '未填姓名',
          class_code: r.class_code || '未填班別',
          reason: r.validationError!,
        })),
      });
      return;
    }

    setLoading(true);
    setSuccessMessage(null);
    setErrorDetails(null);

    try {
      // Fetch latest sequence ID
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

      const payload = parsedRows.map((row) => ({
        student_code: row.student_code || `S${(currentNum++).toString().padStart(10, '0')}`,
        chinese_name: row.chinese_name,
        english_name: row.english_name,
        school: row.school || '',
        gender: row.gender || '男',
        phone: row.phone,
        class_code: row.class_code,
        payment_status: row.payment_status || 'no',
        receipt_url: row.receipt_url || null,
        attendance_status: row.attendance_status || false,
      }));

      // Insert sequentially with error attribution per record
      const errorList: { row: number; name: string; class_code: string; reason: string }[] = [];

      for (let i = 0; i < payload.length; i++) {
        const item = payload[i];
        const rowNum = parsedRows[i].rowNum;

        // Try upserting record
        const { error } = await supabase
          .from('students')
          .upsert(item, { onConflict: 'student_code' });

        if (error) {
          let reason = error.message;
          if (error.message.includes('unique_student_per_class')) {
            reason = `該學員/電話已報讀此堂別 (${item.class_code})，系統不允許重複報名。`;
          } else if (error.message.includes('foreign key constraint')) {
            reason = `班別代碼「${item.class_code}」不存在於 classes 資料表中。`;
          }

          errorList.push({
            row: rowNum,
            name: `${item.chinese_name} (${item.english_name})`,
            class_code: item.class_code,
            reason,
          });
        }
      }

      if (errorList.length > 0) {
        setErrorDetails({
          title: `寫入過程發現 ${errorList.length} 筆衝突錯誤`,
          cause: '部分學員資料違反了資料庫約束規則 (例如已在該班名單中，或所填班別不存在)。',
          solution: '其他無衝突資料已成功處理。請針對下列發生錯誤的學員進行核對並更正班別或電話。',
          failedItems: errorList,
        });
      } else {
        setSuccessMessage(`全數匯入成功！共新增/更新 ${payload.length} 筆學員資料。`);
        setParsedRows([]);
        setFileName('');
      }
    } catch (err: any) {
      setErrorDetails({
        title: '資料庫通訊中斷',
        cause: err.message || '無法連線至 Supabase',
        solution: '請檢查網路連線或稍後再試。',
        rawError: JSON.stringify(err),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Excel / CSV 批次遷移匯入</h1>
            <p className="text-sm text-gray-500 mt-1">智慧欄位映射、衝突即時定位與診斷提示</p>
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

        {/* Success Alert */}
        {successMessage && (
          <div className="p-4 mb-6 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium text-sm flex items-center gap-2">
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Detailed Actionable Error Diagnostic Box */}
        {errorDetails && (
          <div className="p-5 mb-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div className="w-full">
                <h3 className="text-base font-bold text-rose-900">{errorDetails.title}</h3>
                <p className="text-sm text-rose-700 mt-1"><strong>原因分析：</strong>{errorDetails.cause}</p>
                <p className="text-sm text-rose-700 mt-1"><strong>建議處置：</strong>{errorDetails.solution}</p>

                {errorDetails.failedItems && errorDetails.failedItems.length > 0 && (
                  <div className="mt-4 border-t border-rose-200 pt-3">
                    <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2">錯誤對應清單 (請對照 Excel 列號)：</h4>
                    <div className="overflow-x-auto bg-white rounded-lg border border-rose-200">
                      <table className="min-w-full divide-y divide-rose-100 text-xs text-left">
                        <thead className="bg-rose-100/60 text-rose-900 font-semibold">
                          <tr>
                            <th className="p-2.5">Excel 列號</th>
                            <th className="p-2.5">學員姓名</th>
                            <th className="p-2.5">班別代碼</th>
                            <th className="p-2.5">衝突原因 / 說明</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-50 text-rose-800">
                          {errorDetails.failedItems.map((item, i) => (
                            <tr key={i} className="hover:bg-rose-50/50">
                              <td className="p-2.5 font-bold text-rose-900">第 {item.row} 列</td>
                              <td className="p-2.5 font-medium">{item.name}</td>
                              <td className="p-2.5 font-mono text-purple-700">{item.class_code}</td>
                              <td className="p-2.5 text-rose-700 font-medium">{item.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Upload Card */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">上傳 Excel / CSV 檔案</label>
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
          />
          <p className="text-xs text-gray-400 mt-2">
            支援欄位：學生編號 (選填), 中文姓名, 英文姓名, 就讀學校, 性別, 聯絡電話, 班別代碼 (例如 C2026-A), 付款情況 (yes/no)
          </p>
        </div>

        {/* Preview and Validation Table */}
        {parsedRows.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
            <div className="p-4 border-b flex flex-wrap gap-2 justify-between items-center bg-gray-50">
              <div>
                <span className="font-semibold text-sm text-gray-800">預覽清單: {fileName} ({parsedRows.length} 筆)</span>
                {parsedRows.some((r) => r.validationError) && (
                  <span className="ml-2 text-xs text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    存在格式問題
                  </span>
                )}
              </div>
              <button
                onClick={handleMigrate}
                disabled={loading}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-sm rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {loading ? '正在檢查並寫入...' : '確認寫入 Supabase 資料庫'}
              </button>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
                <thead className="bg-gray-100 text-gray-600 sticky top-0">
                  <tr>
                    <th className="p-3">列號</th>
                    <th className="p-3">編號</th>
                    <th className="p-3">姓名</th>
                    <th className="p-3">性別</th>
                    <th className="p-3">學校</th>
                    <th className="p-3">電話</th>
                    <th className="p-3">班別代碼</th>
                    <th className="p-3">付款</th>
                    <th className="p-3">狀態檢驗</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {parsedRows.map((r, i) => (
                    <tr key={i} className={r.validationError ? 'bg-rose-50/60' : 'hover:bg-gray-50'}>
                      <td className="p-3 font-mono text-gray-400">#{r.rowNum}</td>
                      <td className="p-3 text-gray-500 font-mono">{r.student_code || '(自動遞增)'}</td>
                      <td className="p-3 font-medium text-gray-900">{r.chinese_name} ({r.english_name})</td>
                      <td className="p-3">{r.gender}</td>
                      <td className="p-3">{r.school || '-'}</td>
                      <td className="p-3 font-mono">{r.phone}</td>
                      <td className="p-3 font-mono text-purple-700 font-semibold">{r.class_code}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${r.payment_status === 'yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {r.payment_status}
                        </span>
                      </td>
                      <td className="p-3">
                        {r.validationError ? (
                          <span className="text-rose-600 font-bold flex items-center gap-1">
                            ❌ {r.validationError}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-semibold">✓ 正常</span>
                        )}
                      </td>
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