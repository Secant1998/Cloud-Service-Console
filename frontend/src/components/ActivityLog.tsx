import type { LogEntry } from "../types/cloud";

type ActivityLogProps = {
  logs: LogEntry[];
};

export function ActivityLog({ logs }: ActivityLogProps) {
  return (
    <div className="panel activity-log">
      <div className="section-title">活动日志</div>
      <div className="activity-log-body">
        {logs.length === 0 ? (
          <div className="activity-log-empty">还没有日志</div>
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
