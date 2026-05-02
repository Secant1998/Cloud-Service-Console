import { useEffect, useRef, useState } from "react";

type SummaryCardProps = {
  title: string;
  value: string;
  note: string;
  onClick?: () => void;
};

async function copyTextToClipboard(text: string) {
  const value = String(text || "").trim();
  if (!value) {
    throw new Error("No text to copy.");
  }

  try {
    const { writeText } = await import("@tauri-apps/api/clipboard");
    await writeText(value);
    return;
  } catch {
    // Fall through to browser clipboard APIs below.
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("Copy failed.");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

export function SummaryCard({ title, value, note, onClick }: SummaryCardProps) {
  const feedbackTimerRef = useRef<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const autoCopy = /^https?:\/\//i.test(String(value || "").trim());

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  async function handleClick() {
    if (onClick) {
      onClick();
      return;
    }

    if (!autoCopy) {
      return;
    }

    try {
      await copyTextToClipboard(value);
      setFeedback("已复制到剪贴板");
    } catch {
      setFeedback("复制失败，请手动复制");
    }

    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback("");
      feedbackTimerRef.current = null;
    }, 2000);
  }

  const interactive = Boolean(onClick) || autoCopy;
  const nextNote = feedback || note;

  if (interactive) {
    return (
      <button type="button" className="panel summary-card summary-card-button" onClick={handleClick}>
        <div className="summary-card-title">{title}</div>
        <div className="summary-card-value">{value}</div>
        <div className="summary-card-note">{nextNote}</div>
      </button>
    );
  }

  return (
    <div className="panel summary-card">
      <div className="summary-card-title">{title}</div>
      <div className="summary-card-value">{value}</div>
      <div className="summary-card-note">{nextNote}</div>
    </div>
  );
}
