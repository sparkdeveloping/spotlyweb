"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export function Sparkline({ values, height = 88, className, stroke = "var(--accent)", fill = "var(--accent-soft)" }) {
  const width = 320;
  const padding = 8;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (value - min) / range) * (height - padding * 2);
    return [x, y];
  });
  const linePath = points.map(([x, y], index) => `${index ? "L" : "M"}${x},${y}`).join(" ");
  const areaPath = `${linePath} L${points.at(-1)[0]},${height - padding} L${points[0][0]},${height - padding} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("w-full overflow-visible", className)} preserveAspectRatio="none" role="img" aria-label="Trend chart">
      <defs><linearGradient id="spotly-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={fill} stopOpacity="0.85" /><stop offset="100%" stopColor={fill} stopOpacity="0.05" /></linearGradient></defs>
      <motion.path d={areaPath} fill="url(#spotly-chart-fill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />
      <motion.path d={linePath} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.85, ease: "easeOut" }} />
    </svg>
  );
}

export function BarChart({ data, valueKey = "amount", labelKey = "day", height = 180, formatValue = (value) => value }) {
  const max = Math.max(...data.map((item) => Number(item[valueKey]) || 0), 1);
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((item, index) => {
        const value = Number(item[valueKey]) || 0;
        return (
          <div key={`${item[labelKey]}-${index}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(value ? 8 : 2, (value / max) * (height - 36))}px` }}
              transition={{ duration: 0.55, delay: index * 0.04 }}
              className="group relative w-full max-w-10 rounded-t-lg bg-[var(--accent)]"
            >
              <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1 text-[10px] font-semibold text-white group-hover:block">{formatValue(value)}</span>
            </motion.div>
            <span className="text-[11px] text-tertiary">{item[labelKey]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DonutChart({ segments, size = 150, thickness = 18, centerLabel, centerValue }) {
  const total = segments.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const renderedSegments = segments.reduce((result, segment) => {
    const dash = (segment.value / total) * circumference;
    const previousOffset = result.length ? result[result.length - 1].offset + result[result.length - 1].dash : 0;
    return [...result, { ...segment, dash, offset: previousOffset }];
  }, []);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        {renderedSegments.map((segment) => (
          <motion.circle key={segment.label} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={segment.color} strokeWidth={thickness} strokeLinecap="round" strokeDasharray={`${segment.dash} ${circumference - segment.dash}`} strokeDashoffset={-segment.offset} initial={{ strokeDasharray: `0 ${circumference}` }} animate={{ strokeDasharray: `${segment.dash} ${circumference - segment.dash}` }} transition={{ duration: 0.7 }} />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-2xl font-bold">{centerValue}</span><span className="mt-1 text-[11px] text-tertiary">{centerLabel}</span></div>
    </div>
  );
}
