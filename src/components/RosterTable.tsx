'use client';

import AttendanceCheckbox from './AttendanceCheckbox';
import GenderSummary from './GenderSummary';
import { buildWhatsAppUrl } from '@/lib/phoneUtils';

export interface StudentRecord {
  id: string;
  student_code: string;
  chinese_name: string;
  english_name: string | null;
  gender: '男' | '女';
  phone: string;
  payment_status: 'yes' | 'no';
  receipt_url: string | null;
  attendance_status: boolean;
}

interface RosterTableProps {
  students: StudentRecord[];
  loading: boolean;
  onTogglePayment: (id: string, current: 'yes' | 'no') => void;
  onToggleAttendance: (id: string, current: boolean) => void;
}

export default function RosterTable({
  students,
  loading,
  onTogglePayment,
  onToggleAttendance,
}: RosterTableProps) {
  const maleCount = students.filter((s) => s.gender === '男').length;
  const femaleCount = students.filter((s) => s.gender === '女').length;

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-gray-200">
      <table className="w-full text-sm text-center">
        <thead className="bg-[#7030A0] text-white">
          <tr>
            <th className="py-3 px-4 text-left">學生編號</th>
            <th className="py-3 px-4">性別</th>
            <th className="py-3 px-4 text-left">學生名字</th>
            <th className="py-3 px-4">付款情況</th>
            <th className="py-3 px-4">收據檢視</th>
            <th className="py-3 px-4">聯絡電話</th>
            <th className="py-3 px-4">出席簽到</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {loading ? (
            <tr>
              <td colSpan={7} className="py-8 text-gray-500">
                載入中...
              </td>
            </tr>
          ) : students.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-8 text-gray-500">
                當日無指定學生記錄
              </td>
            </tr>
          ) : (
            students.map((student) => (
              <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4 text-left font-mono">{student.student_code}</td>
                <td className="py-3 px-4">{student.gender}</td>
                <td className="py-3 px-4 text-left font-medium">
                  {student.chinese_name} {student.english_name && `(${student.english_name})`}
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => onTogglePayment(student.id, student.payment_status)}
                    className={`px-3 py-1 text-xs rounded-full font-bold cursor-pointer transition ${
                      student.payment_status === 'yes'
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-red-100 text-red-800 hover:bg-red-200'
                    }`}
                  >
                    {student.payment_status}
                  </button>
                </td>
                <td className="py-3 px-4">
                  {student.receipt_url ? (
                    <a
                      href={student.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline text-xs hover:text-blue-800"
                    >
                      檢視收據
                    </a>
                  ) : (
                    <span className="text-gray-400 text-xs">無</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <a
                    href={buildWhatsAppUrl(
                      student.phone,
                      `您好 ${student.chinese_name} 家長，在此提醒您有關課堂的安排。`
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 font-semibold hover:underline"
                  >
                    {student.phone}
                  </a>
                </td>
                <td className="py-3 px-4">
                  <AttendanceCheckbox
                    checked={student.attendance_status}
                    onChange={() =>
                      onToggleAttendance(student.id, student.attendance_status)
                    }
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <GenderSummary
        maleCount={maleCount}
        femaleCount={femaleCount}
        totalCount={students.length}
      />
    </div>
  );
}
