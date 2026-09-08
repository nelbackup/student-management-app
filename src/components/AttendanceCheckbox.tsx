'use client';

interface AttendanceCheckboxProps {
  checked: boolean;
  onChange: () => void;
}

export default function AttendanceCheckbox({ checked, onChange }: AttendanceCheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
    />
  );
}
