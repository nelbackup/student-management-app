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
  const [activeHand, setActiveHand] = useState<'hours' | 'minutes'>('hours');
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
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    let angleRad = Math.atan2(deltaY, deltaX) + Math.PI / 2;
    if (angleRad < 0) angleRad += 2 * Math.PI;
    const angleDeg = (angleRad * 180) / Math.PI;

    let targetHand = activeHand;
    if (distance < 36) {
      targetHand = 'hours';
    } else if (distance > 54) {
      targetHand = 'minutes';
    }

    if (targetHand === 'hours') {
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
  }, [isDragging, activeHand, hours12, minutes, period]);

  const hourAngle = (hours12 % 12) * 30 + (minutes / 60) * 30;
  const minuteAngle = minutes * 6;

  const renderAllDialNumbers = () => {
    const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const minutesMark = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

    return (
      <>
        {hours.map((num) => {
          const angle = (num % 12) * 30 * (Math.PI / 180);
          const radius = 38;
          const x = Math.sin(angle) * radius;
          const y = -Math.cos(angle) * radius;
          const isSelected = hours12 === num;

          return (
            <span
              key={`h-${num}`}
              style={{ transform: `translate(${x}px, ${y}px)` }}
              className={`absolute text-[10px] font-bold select-none flex items-center justify-center w-4 h-4 rounded-full transition-colors ${
                isSelected && activeHand === 'hours'
                  ? 'bg-sky-950 text-white shadow-sm'
                  : 'text-slate-700 hover:text-sky-950'
              }`}
            >
              {num}
            </span>
          );
        })}

        {minutesMark.map((num) => {
          const angle = num * 6 * (Math.PI / 180);
          const radius = 58;
          const x = Math.sin(angle) * radius;
          const y = -Math.cos(angle) * radius;
          const isSelected = minutes === num;

          return (
            <span
              key={`m-${num}`}
              style={{ transform: `translate(${x}px, ${y}px)` }}
              className={`absolute text-[9px] font-mono select-none flex items-center justify-center w-4 h-4 rounded-full transition-colors ${
                isSelected && activeHand === 'minutes'
                  ? 'bg-amber-500 text-sky-950 font-black shadow-sm'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              {String(num).padStart(2, '0')}
            </span>
          );
        })}
      </>
    );
  };

  return (
    <div className="bg-slate-50/90 border border-slate-200 p-3 rounded-2xl flex flex-col shadow-sm w-full">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
        <span className="text-xs font-black text-sky-950">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-black text-sky-950 bg-white px-2 py-0.5 rounded border border-sky-200 shadow-sm">
            {String(hours12).padStart(2, '0')}:{String(minutes).padStart(2, '0')}
          </span>
          <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
            {period}
          </span>
        </div>
      </div>

      {/* Main Body: Left Controls, Right Clock Face */}
      <div className="flex items-center justify-between gap-3">
        {/* Left Hand Controls & AM/PM */}
        <div className="flex flex-col gap-2 w-32">
          <div className="flex flex-col bg-slate-200/80 p-0.5 rounded-xl border border-slate-300 gap-0.5">
            <button
              type="button"
              onClick={() => setActiveHand('hours')}
              className={`py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                activeHand === 'hours'
                  ? 'bg-sky-950 text-white shadow-sm border-l-2 border-amber-400'
                  : 'text-slate-600 hover:text-sky-950'
              }`}
            >
              調整時針
            </button>
            <button
              type="button"
              onClick={() => setActiveHand('minutes')}
              className={`py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                activeHand === 'minutes'
                  ? 'bg-sky-950 text-white shadow-sm border-l-2 border-amber-400'
                  : 'text-slate-600 hover:text-sky-950'
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
              className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                period === 'AM' ? 'bg-sky-950 text-white shadow-sm' : 'text-slate-600 hover:text-sky-950'
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
              className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                period === 'PM' ? 'bg-sky-950 text-white shadow-sm' : 'text-slate-600 hover:text-sky-950'
              }`}
            >
              PM
            </button>
          </div>
        </div>

        {/* Right-Hand Side Clock Face */}
        <div
          ref={clockRef}
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
          className="relative w-36 h-36 rounded-full bg-white border-2 border-slate-300 shadow-inner flex items-center justify-center cursor-pointer select-none touch-none shrink-0"
        >
          {/* Center Pivot Dot */}
          <div className="w-2.5 h-2.5 rounded-full bg-sky-950 z-30 shadow"></div>

          {/* Hour Hand */}
          <div
            style={{
              transform: `rotate(${hourAngle}deg)`,
              transformOrigin: 'bottom center',
              bottom: '50%',
              left: 'calc(50% - 2px)',
            }}
            className={`absolute w-[3.5px] h-[30px] rounded-t-full transition-transform duration-75 z-20 ${
              activeHand === 'hours' ? 'bg-sky-900 ring-2 ring-sky-300' : 'bg-sky-950'
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-sky-950 border-2 border-white absolute -top-1.5 -left-[4.5px] shadow"></div>
          </div>

          {/* Minute Hand */}
          <div
            style={{
              transform: `rotate(${minuteAngle}deg)`,
              transformOrigin: 'bottom center',
              bottom: '50%',
              left: 'calc(50% - 1.5px)',
            }}
            className={`absolute w-[3px] h-[46px] rounded-t-full transition-transform duration-75 z-20 ${
              activeHand === 'minutes' ? 'bg-amber-600 ring-2 ring-amber-300' : 'bg-sky-950'
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-amber-500 border-2 border-sky-950 absolute -top-2 -left-[7px] shadow"></div>
          </div>

          {renderAllDialNumbers()}
        </div>
      </div>
    </div>
  );
}