import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Download, Film, FileUp, LoaderCircle, RefreshCw, Trash2, X } from "lucide-react";
import { deleteCaptureTask, downloadCaptureFile, downloadCaptureTask, getCaptureTasks, synthesizeCaptureTask, uploadCaptureRecoveryFile } from "../api/cloudApi";
import type { CaptureRecoveryKind, CaptureTask, CaptureTaskList } from "../types/cloud";
import { Button } from "./Button";
import "../styles/capture-tasks.css";

const KINDS: Record<string, string> = { "operator-video": "画面", "operator-input": "操作指令", "edge-state": "机械臂状态" };
const RECOVERY_FILES: Record<CaptureRecoveryKind, { accept: string; hint: string }> = {
  "operator-video": { accept: ".webm,video/webm", hint: "选择前端失败时保存的 .webm 文件" },
  "operator-input": { accept: ".json,application/json", hint: "选择同一次采集的 .json 操作记录" },
  "edge-state": { accept: ".zip,application/zip", hint: "选择 Edge 生成的状态采集 .zip 文件" },
};
const STATES: Record<string, string> = { incomplete: "等待素材", ready: "待合成", queued: "排队中", running: "合成中", completed: "已合成", failed: "合成失败" };
const bytes = (size: number) => size < 1024 ** 2 ? `${(size / 1024).toFixed(1)} KB`
  : size < 1024 ** 3 ? `${(size / 1024 ** 2).toFixed(1)} MB` : `${(size / 1024 ** 3).toFixed(2)} GB`;
function time(value: string | number | null) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";
}

export function CaptureTasksPanel({ admin }: { admin: boolean }) {
  const [data, setData] = useState<CaptureTaskList | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState("");
  const [deleting, setDeleting] = useState<CaptureTask | null>(null);
  const [uploading, setUploading] = useState<{ taskId: string; kind: CaptureRecoveryKind; progress: number } | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const recoveryInput = useRef<HTMLInputElement>(null);
  const recoveryTarget = useRef<{ taskId: string; kind: CaptureRecoveryKind } | null>(null);
  const alive = useRef(true);
  const inFlight = useRef(false);

  const refresh = useCallback(async (visible = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (visible) setLoading(true);
    try {
      const result = await getCaptureTasks();
      if (alive.current) { setData(result); setError(""); }
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : "读取采集任务失败。");
    } finally {
      inFlight.current = false;
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh(true);
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 3500);
    return () => { alive.current = false; window.clearInterval(timer); };
  }, [refresh]);

  useEffect(() => { if (deleting) dialog.current?.showModal(); }, [deleting]);

  async function act(id: string, action: () => Promise<unknown>) {
    setBusy(id);
    setError("");
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败。");
    } finally { setBusy(""); }
  }

  function chooseRecoveryFile(taskId: string, kind: CaptureRecoveryKind) {
    if (!recoveryInput.current || uploading) return;
    recoveryTarget.current = { taskId, kind };
    recoveryInput.current.accept = RECOVERY_FILES[kind].accept;
    recoveryInput.current.value = "";
    recoveryInput.current.click();
  }

  async function handleRecoveryFile(file: File | undefined) {
    const target = recoveryTarget.current;
    if (!file || !target) return;
    const key = `${target.taskId}:${target.kind}`;
    setUploadErrors(current => ({ ...current, [key]: "" }));
    setUploading({ ...target, progress: 0 });
    try {
      await uploadCaptureRecoveryFile(target.taskId, target.kind, file, progress => {
        setUploading(current => current && current.taskId === target.taskId && current.kind === target.kind
          ? { ...current, progress } : current);
      });
      await refresh();
      setExpanded(target.taskId);
    } catch (err) {
      setUploadErrors(current => ({
        ...current,
        [key]: err instanceof Error ? err.message : "补传失败，请重试。",
      }));
    } finally {
      setUploading(null);
      recoveryTarget.current = null;
      if (recoveryInput.current) recoveryInput.current.value = "";
    }
  }

  return <div className="panel system-settings-files capture-tasks">
    <div className="capture-files-header">
      <div className="section-title">云端采集任务</div>
      <div className="capture-files-actions">
        <span className="capture-files-count">{data?.total ?? 0} 次采集 · {bytes(data?.total_bytes ?? 0)}</span>
        <Button variant="secondary" className="settings-refresh-button" aria-label="刷新采集任务" title="刷新采集任务"
          disabled={loading} onClick={() => void refresh(true)}>
          <RefreshCw size={16} className={loading ? "capture-spinning" : ""} />
        </Button>
      </div>
    </div>
    {error ? <div className="user-management-feedback error" role="alert">{error}</div> : null}
    <div className="capture-task-table-shell">
      <table className="capture-task-table">
        <thead><tr><th>采集任务</th><th>素材</th><th>状态</th><th>文件大小</th><th>操作</th></tr></thead>
        <tbody>{data?.tasks.map(task => {
          const active = task.status === "queued" || task.status === "running";
          const complete = task.status === "completed";
          const taskUploading = uploading?.taskId === task.id;
          return <Fragment key={task.id}>
            <tr>
              <td data-label="采集任务">
                <button className="capture-task-heading" aria-expanded={expanded === task.id}
                  onClick={() => setExpanded(expanded === task.id ? "" : task.id)}>
                  {expanded === task.id ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                  <span><strong>{task.room_id || "未命名房间"}</strong>
                    <small>{time(task.started_at_server_ms || task.uploaded_at)}</small>
                    <small className="capture-session" title={task.session_id}>{task.session_id || "未提供会话 ID"}</small>
                  </span>
                </button>
              </td>
              <td data-label="素材"><div className="capture-task-kinds">{Object.entries(KINDS).map(([kind, label]) =>
                <span key={kind} className={task.missing_kinds.includes(kind) ? "missing" : "present"}>{label}</span>)}</div>
                {task.ambiguous_kinds.length ? <small className="capture-task-error">存在同类素材冲突</small> : null}
              </td>
              <td data-label="状态">
                <span className={`capture-task-status ${task.status}`}>
                  {active ? <LoaderCircle size={14} className="capture-spinning" /> : null}
                  {STATES[task.status] || task.status}{task.status === "running" ? ` ${Math.floor(task.progress)}%` : ""}
                </span>
                {task.status === "running" ? <progress max={100} value={task.progress} aria-label="合成进度" /> : null}
                {task.error ? <small className="capture-task-error">{task.error}</small> : null}
              </td>
              <td data-label="文件大小"><span className="capture-size">{bytes(task.size_bytes + task.output_bytes)}</span></td>
              <td data-label="操作"><div className="capture-task-actions">
                {complete ? <Button variant="secondary" disabled={busy === task.id} onClick={() => void act(task.id, () => downloadCaptureTask(task.id))}>
                  <Download size={15} /> MP4
                </Button> : null}
                {admin ? <>
                  {task.missing_kinds.length ? <Button variant="secondary" className="capture-repair-button"
                    disabled={!task.can_repair || Boolean(busy) || Boolean(uploading)}
                    title={task.can_repair ? "展开并补传缺失素材" : "该任务缺少有效会话 ID，无法补传"}
                    onClick={() => setExpanded(task.id)}><FileUp size={15} />补传素材</Button> : null}
                  <Button variant="secondary" className="capture-synthesize-button" disabled={!task.can_synthesize || Boolean(busy) || taskUploading}
                    title={complete ? "已完成，不可重复合成" : task.missing_kinds.length ? "等待三类素材全部上传" : "合成 MP4"}
                    onClick={() => void act(task.id, () => synthesizeCaptureTask(task.id))}>
                    <Film size={15} />{complete ? "已合成" : active ? STATES[task.status] : task.status === "failed" ? "重试合成" : "合成 MP4"}
                  </Button>
                  <Button variant="ghost" className="capture-icon-button capture-delete" disabled={active || Boolean(busy) || taskUploading}
                    title={taskUploading ? "补传完成后可删除" : active ? "合成完成后可删除" : "删除整次采集"} aria-label={`删除采集 ${task.session_id}`}
                    onClick={() => setDeleting(task)}><Trash2 size={16} /></Button>
                </> : null}
              </div></td>
            </tr>
            {expanded === task.id ? <tr className="capture-task-detail"><td colSpan={5}>
              <div className="capture-source-files">{task.files.map(file =>
                <div className="capture-source-file" key={file.id}><span>
                  <strong>{KINDS[file.kind] || file.kind}</strong><small>{file.filename}</small>
                </span><span className="capture-size">{bytes(file.size_bytes)}</span>
                  <Button variant="ghost" className="capture-icon-button" title={`下载${file.filename}`} aria-label={`下载${KINDS[file.kind] || file.kind}`}
                    disabled={Boolean(busy)} onClick={() => void act(file.id, () => downloadCaptureFile(file.id, file.filename))}>
                    <Download size={16} /></Button>
                </div>)}</div>
              {admin && task.missing_kinds.length ? <div className="capture-recovery-list">
                {task.missing_kinds.map(rawKind => {
                  const kind = rawKind as CaptureRecoveryKind;
                  const currentUpload = uploading?.taskId === task.id && uploading.kind === kind ? uploading : null;
                  const uploadError = uploadErrors[`${task.id}:${kind}`];
                  return <div className="capture-recovery-file" key={kind}>
                    <span className="capture-recovery-copy"><strong>{KINDS[kind]} <em>缺失</em></strong>
                      <small>{RECOVERY_FILES[kind].hint}</small>
                      {uploadError ? <small className="capture-recovery-error">{uploadError}</small> : null}
                    </span>
                    {currentUpload ? <span className="capture-upload-progress">{currentUpload.progress}%</span> : null}
                    <Button variant="secondary" disabled={!task.can_repair || Boolean(uploading) || Boolean(busy)}
                      onClick={() => chooseRecoveryFile(task.id, kind)}>
                      {currentUpload ? <LoaderCircle size={15} className="capture-spinning" /> : <FileUp size={15} />}
                      {currentUpload ? "上传中" : "选择文件"}
                    </Button>
                  </div>;
                })}
              </div> : null}
              {task.report ? <div className="capture-report">
                <span>状态样本 {task.report.state_sample_count.toLocaleString()} 条 · 无状态画面 {task.report.frames_without_state} 帧</span>
                {task.report.warnings.map((warning, i) => <span key={i}>{warning}</span>)}
              </div> : null}
            </td></tr> : null}
          </Fragment>;
        })}</tbody>
      </table>
      {!data?.tasks.length ? <div className="capture-files-empty">{loading ? "正在读取采集任务..." : "暂无采集任务"}</div> : null}
    </div>
    <input ref={recoveryInput} className="capture-recovery-input" type="file"
      onChange={event => void handleRecoveryFile(event.currentTarget.files?.[0])} />
    <div className="capture-files-updated">更新时间：{time(data?.updated_at || null)}</div>
    {deleting ? createPortal(<dialog className="capture-delete-dialog" ref={dialog}
      onCancel={event => { if (busy || uploading?.taskId === deleting.id) event.preventDefault(); else setDeleting(null); }}
      onClick={event => { if (event.target === event.currentTarget && !busy && uploading?.taskId !== deleting.id) setDeleting(null); }}>
      <div role="document">
        <div className="capture-dialog-heading"><h2>删除这次采集？</h2>
          <Button variant="ghost" className="capture-icon-button" aria-label="关闭" title="关闭" disabled={Boolean(busy)}
            onClick={() => setDeleting(null)}><X size={18} /></Button></div>
        <p>{deleting.room_id} · {time(deleting.started_at_server_ms || deleting.uploaded_at)}</p>
        <p>将永久删除云端的 {deleting.files.length} 个原始文件{deleting.output_bytes ? "和合成 MP4" : ""}，不可恢复。</p>
        <div className="capture-task-actions">
          <Button autoFocus variant="secondary" disabled={Boolean(busy) || uploading?.taskId === deleting.id} onClick={() => setDeleting(null)}>取消</Button>
          <Button variant="danger" disabled={Boolean(busy) || uploading?.taskId === deleting.id} onClick={() => void act(deleting.id, async () => {
            await deleteCaptureTask(deleting.id); setDeleting(null);
          })}><Trash2 size={16} />{busy ? "删除中..." : "永久删除"}</Button>
        </div>
      </div>
    </dialog>, document.body) : null}
  </div>;
}
