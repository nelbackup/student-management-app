'use client';

interface SessionFilterProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  selectedDuration: string;
  onDurationChange: (duration: string) => void;
  availableDurations: string[];
}

export default function SessionFilter({
  selectedDate,
  onDateChange,
  selectedDuration,
  onDurationChange,
  availableDurations,
}: SessionFilterProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          上課日期 (Select Date)
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-gray-900 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          堂別時段 (Session)
        </label>
        <select
          value={selectedDuration}
          onChange={(e) => onDurationChange(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-gray-900 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="ALL">全部堂別 (All Sessions)</option>
          {availableDurations.map((dur) => (
            <option key={dur} value={dur}>
              {dur}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
