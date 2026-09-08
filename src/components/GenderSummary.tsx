'use client';

interface GenderSummaryProps {
  maleCount: number;
  femaleCount: number;
  totalCount: number;
}

export default function GenderSummary({ maleCount, femaleCount, totalCount }: GenderSummaryProps) {
  if (totalCount === 0) return null;

  return (
    <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 font-semibold text-gray-800 text-left">
      性別總計 (Gender Count):{' '}
      <span className="text-purple-900 ml-2">
        {maleCount} 男 / {femaleCount} 女 (共 {totalCount} 人)
      </span>
    </div>
  );
}
