import { Tag } from "antd";
import type { HealthState } from "../types";

const colorMap: Record<HealthState, string> = {
  checking: "default",
  ok: "success",
  error: "error"
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
    <Tag color={colorMap[state]} bordered={false} className="health-tag">
      {label} · {textMap[state]}
    </Tag>
  );
}
