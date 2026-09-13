'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface AnalogClockPickerProps {
  label: string;
  value: string; // 'HH:MM' (24-hour format)
  onChange: (val: string) => void;
}

export default function AnalogClockPicker({ label, value, onChange }: AnalogClockPickerProps) {
  const parseTime = (valStr: string) => {
    const parts = (valStr || '15:00').split(':');
    let h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const validH = isNaN(h) ? 15 : h;
    const validM = isNaN(m) ? 0 : m;

    const period: 'AM' | 'PM' = validH >= 12 ? 'PM' : 'AM';
    let h12 = validH % 12;
    if (h12 === 0) h12 = 12;

    return {
      hours12: h12,
      minutes: validM,
      period,
    };
  };

  const initial = parseTime(value);
  const [hours12, setHours12] = useState<number>(initial.hours12);
  const [minutes, setMinutes] = useState<number>(initial.minutes);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial.period);
  const [mode, setMode] = useState<'hours' | 'minutes'>('hours');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const clockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const next = parseTime(value);
    setHours12(next.hours12);
    setMinutes(next.minutes);
    setPeriod(next.period);
  }, [value]);

  const emitChange = useCallback(
    (h12: number, m: number, p: 'AM' | 'PM') => {
      let h24 = h12;
      if (p === 'PM' && h12 !== 12) h24 = h12 + 12;
      if (p === 'AM' && h12 === 12) h24 = 0;

      const formatted = `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      onChange(formatted);
    },
    [onChange]
  );

  const calculateAngleAndValue = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    if (!clockRef.current) return;
    const rect = clockRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;

    let angleRad = Math.atan2(deltaY, deltaX) + Math.PI / 2;
    if (angleRad < 0) angleRad += 2 * Math.PI;
    const angleDeg = (angleRad * 180) / Math.PI;

    if (mode === 'hours') {
      let selectedH = Math.round(angleDeg / 30);
      if (selectedH === 0) selectedH = 12;
      setHours12(selectedH);
      emitChange(selectedH, minutes, period);
    } else {
      let selectedM = Math.round(angleDeg / 6);
      selectedM = Math.round(selectedM / 5) * 5;
      if (selectedM === 60) selectedM = 0;
      setMinutes(selectedM);
      emitChange(hours12, selectedM, period);
    }
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    calculateAngleAndValue(e);
  };

  useEffect(() => {
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      calculateAngleAndValue(e);
    };

    const handlePointerUp = () => {
      if (isDragging) {
        setIsDragging(false);
        if (mode === 'hours') {
          setMode('minutes');
        }
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove);
      window.addEventListener('touchend', handlePointerUp);
    }

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, mode, hours12, minutes, period]);

  const handAngle = mode === 'hours' ? (hours12 % 12) * 30 : minutes * 6;

  const renderHoursNumbers = () => {
    const numbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    return numbers.map((num) => {
      const angle = (num % 12) * 30 * (Math.PI / 180);
      const radius = 62;
      const x = Math.sin(angle) * radius;
      const y = -Math.cos(angle) * radius;
      const isSelected = hours12 === num;

      return (
        <span
          key={num}
          style={{ transform: `translate(${x}px, ${y}px)` }}
          className={`absolute text-xs font-semibold select-none flex items-center justify-center w-5 h-5 rounded-full transition-colors ${
            isSelected ? 'bg-amber-500 text-sky-950 font-black shadow-sm' : 'text-slate-600 hover:text-sky-950'
          }`}
        >
          {num}
        </span>
      );
    });
  };

  const renderMinutesNumbers = () => {
    const marks = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    return marks.map((num) => {
      const angle = num * 6 * (Math.PI / 180);
      const radius = 62;
      const x = Math.sin(angle) * radius;
      const y = -Math.cos(angle) * radius;
      const isSelected = minutes === num;

      return (
        <span
          key={num}
          style={{ transform: `translate(${x}px, ${y}px)` }}
          className={`absolute text-[11px] font-mono select-none flex items-center justify-center w-5 h-5 rounded-full transition-colors ${
            isSelected ? 'bg-amber-500 text-sky-950 font-black shadow-sm' : 'text-slate-500'
          }`}
        >
          {String(num).padStart(2, '0')}
        </span>
      );
    });
  };

  return (
    <div className="bg-slate-50/80 border border-slate-200 p-4 rounded-2xl flex flex-col shadow-sm w-full">
      <div className="flex items-center justify-between w-full mb-4 pb-3 border-b border-slate-200">
        <span className="text-xs font-black text-sky-950">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-black text-sky-950 bg-white px-3 py-1 rounded-lg border border-sky-200 shadow-sm">
            {String(hours12).padStart(2, '0')}:{String(minutes).padStart(2, '0')}
          </span>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
            {period}
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex flex-col gap-3 w-full sm:w-44">
          <div className="flex flex-col bg-slate-200/80 p-0.5 rounded-xl border border-slate-300 gap-1">
            <button
              type="button"
              onClick={() => setMode('hours')}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'hours' ? 'bg-[#0b253a] text-white shadow-sm border-l-4 border-amber-400' : 'text-slate-600 hover:text-sky-950'
              }`}
            >
              調整時針
            </button>
            <button
              type="button"
              onClick={() => setMode('minutes')}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'minutes' ? 'bg-[#0b253a] text-white shadow-sm border-l-4 border-amber-400' : 'text-slate-600 hover:text-sky-950'
              }`}
            >
              調整分針
            </button>
          </div>

          <div className="flex bg-slate-200/80 p-0.5 rounded-xl border border-slate-300">
            <button
              type="button"
              onClick={() => {
                setPeriod('AM');
                emitChange(hours12, minutes, 'AM');
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                period === 'AM' ? 'bg-[#0b253a] text-white shadow-sm' : 'text-slate-600 hover:text-sky-950'
              }`}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriod('PM');
                emitChange(hours12, minutes, 'PM');
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                period === 'PM' ? 'bg-[#0b253a] text-white shadow-sm' : 'text-slate-600 hover:text-sky-950'
              }`}
            >
              PM
            </button>
          </div>
        </div>

        <div
          ref={clockRef}
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
          className="relative w-40 h-40 rounded-full bg-white border-2 border-slate-300 shadow-inner flex items-center justify-center cursor-pointer select-none touch-none shrink-0"
        >
          <div className="w-3 h-3 rounded-full bg-[#0b253a] z-20 shadow"></div>
          <div
            style={{
              transform: `rotate(${handAngle}deg)`,
              transformOrigin: 'bottom center',
              bottom: '50%',
              left: 'calc(50% - 1.5px)',
            }}
            className="absolute w-[3px] h-[52px] bg-[#0b253a] rounded-t-full transition-transform duration-75 z-10"
          >
            <div className="w-5 h-5 rounded-full bg-amber-500 border-2 border-[#0b253a] absolute -top-2.5 -left-[8.5px] shadow"></div>
          </div>
          {mode === 'hours' ? renderHoursNumbers() : renderMinutesNumbers()}
        </div>
      </div>
    </div>
  );
}