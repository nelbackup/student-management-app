'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import SessionFilter from '@/components/SessionFilter';
import RosterTable, { StudentRecord } from '@/components/RosterTable';

export default function RosterPage() {
  const [selectedDate, setSelectedDate] = useState('2026-09-13');
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedDuration, setSelectedDuration] = useState('ALL');
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadSessions() {
      const { data } = await supabase.from('classes').select('*').eq('lesson_date', selectedDate);
      setSessions(data || []);
      setSelectedDuration('ALL');
    }
    loadSessions();
  }, [selectedDate]);

  useEffect(() => {
    async function loadStudents() {
      if (sessions.length === 0) {
        setStudents([]);
        return;
      }
      setLoading(true);
      const filtered =
        selectedDuration === 'ALL'
          ? sessions
          : sessions.filter((s) => s.duration === selectedDuration);
      const codes = filtered.map((s) => s.class_code);

      const { data } = await supabase.from('students').select('*').in('class_code', codes);
      setStudents((data as StudentRecord[]) || []);
      setLoading(false);
    }
    loadStudents();
  }, [sessions, selectedDuration]);

  const handleTogglePayment = async (id: string, current: 'yes' | 'no') => {
    const next = current === 'yes' ? 'no' : 'yes';
    await supabase.from('students').update({ payment_status: next }).eq('id', id);
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, payment_status: next } : s))
    );
  };

  const handleToggleAttendance = async (id: string, current: boolean) => {
    await supabase.from('students').update({ attendance_status: !current }).eq('id', id);
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, attendance_status: !current } : s))
    );
  };

  const availableDurations = Array.from(new Set(sessions.map((s) => s.duration)));

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <SessionFilter
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        selectedDuration={selectedDuration}
        onDurationChange={setSelectedDuration}
        availableDurations={availableDurations}
      />
      <RosterTable
        students={students}
        loading={loading}
        onTogglePayment={handleTogglePayment}
        onToggleAttendance={handleToggleAttendance}
      />
    </div>
  );
}
