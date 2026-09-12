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

    // If user clicked closer to center, or active hand is hours, update hours; else minutes
    // Or respect active tab toggle. Let's respect activeHand toggle or distance if intuitive.
    let targetHand = activeHand;
    if (distance < 38) {
      targetHand = 'hours';
    } else if (distance > 58) {
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

  // Hand Angles
  const hourAngle = (hours12 % 12) * 30 + (minutes / 60) * 30;
  const minuteAngle = minutes * 6;

  // Render both 12-hour numbers (inner circle) and 5-minute intervals (outer circle)
  const renderAllDialNumbers = () => {
    const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const minutesMark = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

    return (
      <>
        {/* Hour Numbers (Inner Ring) */}
        {hours.map((num) => {
          const angle = (num % 12) * 30 * (Math.PI / 180);
          const radius = 46;
          const x = Math.sin(angle) * radius;
          const y = -Math.cos(angle) * radius;
          const isSelected = hours12 === num;

          return (
            <span
              key={`h-${num}`}
              style={{ transform: `translate(${x}px, ${y}px)` }}
              className={`absolute text-[11px] font-bold select-none flex items-center justify-center w-5 h-5 rounded-full transition-colors ${
                isSelected && activeHand === 'hours'
                  ? 'bg-sky-950 text-white shadow-sm'
                  : 'text-slate-700 hover:text-sky-950'
              }`}
            >
              {num}
            </span>
          );
        })}

        {/* Minute Numbers (Outer Ring) */}
        {minutesMark.map((num) => {
          const angle = num * 6 * (Math.PI / 180);
          const radius = 68;
          const x = Math.sin(angle) * radius;
          const y = -Math.cos(angle) * radius;
          const isSelected = minutes === num;

          return (
            <span
              key={`m-${num}`}
              style={{ transform: `translate(${x}px, ${y}px)` }}
              className={`absolute text-[10px] font-mono select-none flex items-center justify-center w-5 h-5 rounded-full transition-colors ${
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
    <div className="bg-slate-50/80 border border-slate-200 p-3.5 rounded-2xl flex flex-col items-center shadow-sm w-full">
      {/* Top Header: Label & Time Display Badge */}
      <div className="flex items-center justify-between w-full mb-3">
        <span className="text-xs font-black text-sky-950">{label}</span>
        <div className="px-2.5 py-1 bg-white border border-sky-200 rounded-lg shadow-sm">
          <span className="font-mono text-sm font-black text-sky-950">
            {String(hours12).padStart(2, '0')}:{String(minutes).padStart(2, '0')}
          </span>
          <span className="ml-1 text-[11px] font-bold text-amber-600">{period}</span>
        </div>
      </div>

      {/* Hand Focus Toggle & AM/PM */}
      <div className="flex items-center justify-between w-full mb-3 gap-2">
        <div className="inline-flex bg-slate-200/80 p-0.5 rounded-xl border border-slate-300">
          <button
            type="button"
            onClick={() => setActiveHand('hours')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              activeHand === 'hours'
                ? 'bg-sky-950 text-white shadow-sm border-b-2 border-amber-400'
                : 'text-slate-600 hover:text-sky-950'
            }`}
          >
            調整時針
          </button>
          <button
            type="button"
            onClick={() => setActiveHand('minutes')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              activeHand === 'minutes'
                ? 'bg-sky-950 text-white shadow-sm border-b-2 border-amber-400'
                : 'text-slate-600 hover:text-sky-950'
            }`}
          >
            調整分針
          </button>
        </div>

        <div className="inline-flex bg-slate-200/80 p-0.5 rounded-xl border border-slate-300">
          <button
            type="button"
            onClick={() => {
              setPeriod('AM');
              emitChange(hours12, minutes, 'AM');
            }}
            className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              period === 'AM'
                ? 'bg-sky-950 text-white shadow-sm'
                : 'text-slate-600 hover:text-sky-950'
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
            className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              period === 'PM'
                ? 'bg-sky-950 text-white shadow-sm'
                : 'text-slate-600 hover:text-sky-950'
            }`}
          >
            PM
          </button>
        </div>
      </div>

      {/* Analog Clock Face with Dual Hands */}
      <div
        ref={clockRef}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        className="relative w-44 h-44 rounded-full bg-white border-2 border-slate-300 shadow-inner flex items-center justify-center cursor-pointer select-none touch-none"
      >
        {/* Center Pivot Dot */}
        <div className="w-3 h-3 rounded-full bg-sky-950 z-30 shadow"></div>

        {/* 1. Hour Hand (Shorter, Deep Navy) */}
        <div
          style={{
            transform: `rotate(${hourAngle}deg)`,
            transformOrigin: 'bottom center',
            bottom: '50%',
            left: 'calc(50% - 2px)',
          }}
          className={`absolute w-[4px] h-[40px] rounded-t-full transition-transform duration-75 z-20 ${
            activeHand === 'hours' ? 'bg-sky-900 ring-2 ring-sky-300' : 'bg-sky-950'
          }`}
        >
          <div className="w-3.5 h-3.5 rounded-full bg-sky-950 border-2 border-white absolute -top-1.5 -left-[4.5px] shadow"></div>
        </div>

        {/* 2. Minute Hand (Longer, Luminous Amber Gold) */}
        <div
          style={{
            transform: `rotate(${minuteAngle}deg)`,
            transformOrigin: 'bottom center',
            bottom: '50%',
            left: 'calc(50% - 1.5px)',
          }}
          className={`absolute w-[3px] h-[58px] rounded-t-full transition-transform duration-75 z-20 ${
            activeHand === 'minutes' ? 'bg-amber-600 ring-2 ring-amber-300' : 'bg-sky-950'
          }`}
        >
          <div className="w-5 h-5 rounded-full bg-amber-500 border-2 border-sky-950 absolute -top-2.5 -left-[8.5px] shadow"></div>
        </div>

        {/* Dial Numbers (Both Hour & Minute Rings) */}
        {renderAllDialNumbers()}
      </div>

      <span className="text-[10px] text-slate-400 mt-2.5 font-medium">
        同時顯示時針與分針・可直接拖曳錶面調整時間
      </span>
    </div>
  );
}