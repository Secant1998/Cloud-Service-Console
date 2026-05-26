import { useEffect, useRef } from "react";
import type { LogEntry } from "../types/cloud";

type ActivityLogProps = {
  title: string;
  subtitle?: string;
  emptyLabel?: string;
  logs: LogEntry[];
};

export function ActivityLog({ title, subtitle, emptyLabel = "还没有日志", logs }: ActivityLogProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }
    body.scrollTop = body.scrollHeight;
  }, [logs]);

  return (
    <div className="panel activity-log">
      <div className="activity-log-header">
        <div className="section-title">{title}</div>
        {subtitle ? <div className="section-subtitle">{subtitle}</div> : null}
      </div>
      <div ref={bodyRef} className="activity-log-body log-console" data-selectable-log="true">
        {logs.length === 0 ? (
          <div className="activity-log-empty">{emptyLabel}</div>
        ) : (
          logs.map((log, index) => (
            <div className="log-line" key={`${log.timestamp}-${index}`}>
              <span className={`log-level log-level-${log.level}`}>{log.level}</span>
              <span className="log-time">{log.timestamp}</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
