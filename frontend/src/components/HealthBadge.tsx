import type { HealthState } from "../types";

const toneMap: Record<HealthState, string> = {
  checking: "bg-white/[0.72] text-ink-700 shadow-[inset_0_0_0_1px_rgba(19,34,56,0.08)]",
  ok: "bg-emerald-500/[0.12] text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.16)]",
  error: "bg-rose-500/[0.12] text-rose-700 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.16)]"
};

const textMap: Record<HealthState, string> = {
  checking: "检查中",
  ok: "可用",
  error: "异常"
};

interface HealthBadgeProps {
  label: string;
  state: HealthState;
}

export function HealthBadge({ label, state }: HealthBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${toneMap[state]}`}
    >
      {label} · {textMap[state]}
    </span>
  );
}
