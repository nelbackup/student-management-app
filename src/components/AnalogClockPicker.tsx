'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface AnalogClockPickerProps {
  label: string;
  value: string; // e.g. "15:00"
  onChange: (newTime: string) => void;
}

export default function AnalogClockPicker({ label, value, onChange }: AnalogClockPickerProps) {
  // Parse initial 24h string (e.g. "15:00")
  const parseTime = (timeStr: string) => {
    const parts = (timeStr || '09:00').split(':');
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    if (isNaN(h)) h = 9;
    if (isNaN(m)) m = 0;
    return {
      h24: h,
      h12: h % 12 === 0 ? 12 : h % 12,
      m: m,
      isPM: h >= 12,
    };
  };

  const parsed = parseTime(value);
  const [hour, setHour] = useState<number>(parsed.h12);
  const [minute, setMinute] = useState<number>(parsed.m);
  const [isPM, setIsPM] = useState<boolean>(parsed.isPM);
  const [activePin, setActivePin] = useState<'hour' | 'minute'>('hour');
  const [isDragging, setIsDragging] = useState(false);

  const clockRef = useRef<SVGSVGElement | null>(null);

  // Sync state if external value changes
  useEffect(() => {
    const p = parseTime(value);
    setHour(p.h12);
    setMinute(p.m);
    setIsPM(p.isPM);
  }, [value]);

  // Propagate changes upstream in 24h "HH:mm" format
  const emitChange = (h12: number, m: number, pm: boolean) => {
    let h24 = h12 % 12;
    if (pm) h24 += 12;
    const formatted = `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    onChange(formatted);
  };

  const handlePointerAngle = useCallback(
    (clientX: number, clientY: number) => {
      if (!clockRef.current) return;
      const rect = clockRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;

      // Angle in degrees clockwise from 12 o'clock (0 to 360)
      let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;

      if (activePin === 'hour') {
        // 360 deg / 12 hrs = 30 deg per hr
        let selectedH = Math.round(angle / 30);
        if (selectedH === 0) selectedH = 12;
        if (selectedH > 12) selectedH = 12;
        setHour(selectedH);
        emitChange(selectedH, minute, isPM);
      } else {
        // 360 deg / 60 mins = 6 deg per min (snap to 5-min intervals)
        let selectedM = Math.round(angle / 6);
        // snap to nearest 5 minutes
        selectedM = Math.round(selectedM / 5) * 5;
        if (selectedM >= 60) selectedM = 0;
        setMinute(selectedM);
        emitChange(hour, selectedM, isPM);
      }
    },
    [activePin, hour, minute, isPM]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handlePointerAngle(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    handlePointerAngle(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
  };

  const togglePeriod = (pm: boolean) => {
    setIsPM(pm);
    emitChange(hour, minute, pm);
  };

  // Compute needle angles
  const hourAngle = (hour % 12) * 30 + (minute / 60) * 30;
  const minuteAngle = minute * 6;

  const clockSize = 150;
  const center = clockSize / 2;
  const radius = 60;

  // Generate 1 to 12 clock numbers
  const clockNumbers = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="flex flex-col items-center p-3 bg-gray-50 border border-gray-200 rounded-xl">
      {/* Title & Digital Output */}
      <div className="flex items-center justify-between w-full mb-2">
        <span className="text-xs font-bold text-gray-700">{label}</span>
        <span className="text-sm font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
          {String(isPM ? (hour % 12) + 12 : hour % 12 === 0 ? 0 : hour).padStart(2, '0')}:
          {String(minute).padStart(2, '0')}
        </span>
      </div>

      {/* AM / PM Toggle & Needle Mode Selector */}
      <div className="flex items-center justify-between w-full mb-2 gap-1">
        {/* Hand selector */}
        <div className="flex bg-white rounded-md border border-gray-200 p-0.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setActivePin('hour')}
            className={`px-2 py-0.5 rounded transition ${
              activePin === 'hour' ? 'bg-purple-700 text-white shadow-sm' : 'text-gray-600 hover:text-black'
            }`}
          >
            調整時針
          </button>
          <button
            type="button"
            onClick={() => setActivePin('minute')}
            className={`px-2 py-0.5 rounded transition ${
              activePin === 'minute' ? 'bg-purple-700 text-white shadow-sm' : 'text-gray-600 hover:text-black'
            }`}
          >
            調整分針
          </button>
        </div>

        {/* AM/PM Switch */}
        <div className="flex bg-white rounded-md border border-gray-200 p-0.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => togglePeriod(false)}
            className={`px-1.5 py-0.5 rounded transition ${
              !isPM ? 'bg-purple-700 text-white shadow-sm' : 'text-gray-600 hover:text-black'
            }`}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => togglePeriod(true)}
            className={`px-1.5 py-0.5 rounded transition ${
              isPM ? 'bg-purple-700 text-white shadow-sm' : 'text-gray-600 hover:text-black'
            }`}
          >
            PM
          </button>
        </div>
      </div>

      {/* Interactive SVG Clock Face */}
      <div className="relative touch-none select-none">
        <svg
          ref={clockRef}
          width={clockSize}
          height={clockSize}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="cursor-crosshair drop-shadow-sm"
        >
          {/* Outer Dial Face */}
          <circle cx={center} cy={center} r={radius + 8} fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />

          {/* Clock Ticks & Numbers */}
          {clockNumbers.map((num) => {
            const rot = (num * 30 - 90) * (Math.PI / 180);
            const nx = center + (radius - 12) * Math.cos(rot);
            const ny = center + (radius - 12) * Math.sin(rot);
            return (
              <text
                key={num}
                x={nx}
                y={ny + 3}
                textAnchor="middle"
                fontSize="9"
                fontWeight="bold"
                fill="#64748b"
              >
                {num}
              </text>
            );
          })}

          {/* Hour Hand (時針 - thicker and shorter) */}
          <line
            x1={center}
            y1={center}
            x2={center + 30 * Math.sin((hourAngle * Math.PI) / 180)}
            y2={center - 30 * Math.cos((hourAngle * Math.PI) / 180)}
            stroke={activePin === 'hour' ? '#7e22ce' : '#334155'}
            strokeWidth={activePin === 'hour' ? 4 : 3}
            strokeLinecap="round"
          />

          {/* Hour Pin Cap/Circle */}
          <circle
            cx={center + 30 * Math.sin((hourAngle * Math.PI) / 180)}
            cy={center - 30 * Math.cos((hourAngle * Math.PI) / 180)}
            r={activePin === 'hour' ? 4 : 2}
            fill={activePin === 'hour' ? '#7e22ce' : '#334155'}
          />

          {/* Minute Hand (分針 - longer and thinner) */}
          <line
            x1={center}
            y1={center}
            x2={center + 45 * Math.sin((minuteAngle * Math.PI) / 180)}
            y2={center - 45 * Math.cos((minuteAngle * Math.PI) / 180)}
            stroke={activePin === 'minute' ? '#7e22ce' : '#94a3b8'}
            strokeWidth={activePin === 'minute' ? 3 : 2}
            strokeLinecap="round"
          />

          {/* Minute Pin Cap/Circle */}
          <circle
            cx={center + 45 * Math.sin((minuteAngle * Math.PI) / 180)}
            cy={center - 45 * Math.cos((minuteAngle * Math.PI) / 180)}
            r={activePin === 'minute' ? 3.5 : 2}
            fill={activePin === 'minute' ? '#7e22ce' : '#94a3b8'}
          />

          {/* Center Pin */}
          <circle cx={center} cy={center} r="3" fill="#7e22ce" />
        </svg>
      </div>

      <p className="text-[10px] text-gray-400 mt-1">拖曳錶面針尖調整時間（刻度為5分鐘）</p>
    </div>
  );
}