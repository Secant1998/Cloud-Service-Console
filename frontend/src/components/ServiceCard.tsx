import { StatusBadge } from "./StatusBadge";
import { ToggleSwitch } from "./ToggleSwitch";
import type { ServiceStatus } from "../types/cloud";

type ServiceCardProps = {
  service: ServiceStatus;
  busy?: boolean;
  onStart: (name: string) => void;
  onStop: (name: string) => void;
};

function toneForService(service: ServiceStatus): "success" | "warning" | "danger" | "neutral" {
  const active = service.active_state.toLowerCase();
  const sub = service.sub_state.toLowerCase();
  if (active === "active" && sub === "running") {
    return "success";
  }
  if (active === "failed") {
    return "danger";
  }
  if (active === "activating" || active === "deactivating") {
    return "warning";
  }
  return "neutral";
}

function labelForService(service: ServiceStatus): string {
  const active = service.active_state.toLowerCase();
  const sub = service.sub_state.toLowerCase();

  if (active === "active" && sub === "running") {
    return "Active";
  }
  if (active === "activating") {
    return "Starting";
  }
  if (active === "deactivating") {
    return "Stopping";
  }
  if (active === "failed") {
    return "Failed";
  }
  if (active === "inactive") {
    return "Inactive";
  }
  if (active === "reloading") {
    return "Reloading";
  }
  if (active === "maintenance") {
    return "Maint";
  }
  if (active === "unknown") {
    return "Unknown";
  }

  return active ? active.charAt(0).toUpperCase() + active.slice(1) : "Unknown";
}

function isServiceRunning(service: ServiceStatus) {
  return (
    service.active_state.toLowerCase() === "active" &&
    service.sub_state.toLowerCase() === "running"
  );
}

function isServiceSwitchBusy(service: ServiceStatus, busy: boolean) {
  const active = service.active_state.toLowerCase();
  return busy || active === "activating" || active === "deactivating";
}

export function ServiceCard({ service, busy = false, onStart, onStop }: ServiceCardProps) {
  const checked = isServiceRunning(service);
  const switchBusy = isServiceSwitchBusy(service, busy);

  return (
    <div className="panel service-card">
      <div className="service-card-header">
        <div>
          <div className="service-card-title">{service.title}</div>
          <div className="service-card-desc">{service.description}</div>
        </div>
        <StatusBadge label={labelForService(service)} tone={toneForService(service)} />
      </div>
      <div className="service-card-meta">
        <div>
          <span className="service-card-label">PID</span>
          <strong>{service.pid || "-"}</strong>
        </div>
        <div>
          <span className="service-card-label">Autostart</span>
          <strong>{service.unit_state}</strong>
        </div>
      </div>
      <div className="service-card-detail">{service.detail}</div>
      <div className="service-card-actions service-card-actions-switch">
        <ToggleSwitch
          checked={checked}
          busy={switchBusy}
          size="lg"
          ariaLabel={`${service.title} ${checked ? "stop" : "start"}`}
          onClick={() => (checked ? onStop(service.name) : onStart(service.name))}
        />
      </div>
    </div>
  );
}
