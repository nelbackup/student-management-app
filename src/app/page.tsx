import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h1 className="text-3xl font-bold text-purple-900 mb-4">學員管理與點名系統</h1>
      <p className="text-gray-600 mb-8">Next.js & Supabase 線上管理系統</p>
      <Link
        href="/roster"
        className="px-6 py-3 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-md shadow"
      >
        進入課堂名冊 (Class Roster)
      </Link>
    </main>
  );
}
