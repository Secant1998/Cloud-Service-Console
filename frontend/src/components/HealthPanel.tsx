import { StatusBadge } from "./StatusBadge";
import type { HealthCheckStatus } from "../types/cloud";

type HealthPanelProps = {
  checks: HealthCheckStatus[];
};

function toneForCheck(check: HealthCheckStatus): "success" | "warning" | "danger" | "neutral" {
  if (check.ok) {
    return "success";
  }
  if (check.status === "unknown") {
    return "neutral";
  }
  return "danger";
}

export function HealthPanel({ checks }: HealthPanelProps) {
  return (
    <div className="panel health-panel">
      <div className="section-title">健康检查</div>
      <div className="health-list">
        {checks.map((check) => (
          <div className="health-row" key={check.key}>
            <div>
              <div className="health-row-title">{check.title}</div>
              <div className="health-row-note">{check.note}</div>
            </div>
            <StatusBadge label={check.status} tone={toneForCheck(check)} />
          </div>
        ))}
      </div>
    </div>
  );
}
