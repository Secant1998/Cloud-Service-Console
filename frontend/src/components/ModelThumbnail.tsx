import { useEffect, useRef, useState } from "react";
import { Box, ImageOff, LoaderCircle } from "lucide-react";
import { modelThumbnail } from "../api/modelLibrary";

export function ModelThumbnail({ id, label, available }: { id: string; label: string; available: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const objectUrl = useRef("");
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "160px" });
    if (host.current) observer.observe(host.current);
    return () => { observer.disconnect(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); };
  }, []);
  useEffect(() => {
    if (!visible || !available || url || failed) return;
    const controller = new AbortController();
    let timer = 0;
    async function load() {
      try {
        const blob = await modelThumbnail(id, controller.signal);
        if (controller.signal.aborted) return;
        if (!blob) { timer = window.setTimeout(() => void load(), 3000); return; }
        objectUrl.current = URL.createObjectURL(blob);
        setUrl(objectUrl.current);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [id, visible, available, url, failed]);
  return <div className="model-card-preview" ref={host} aria-busy={available && !url && !failed}>
    {url ? <img src={url} alt={`${label} 三维缩略图`} draggable={false} onError={() => { setUrl(""); setFailed(true); }}/>
      : <span className="model-preview-placeholder">{!available ? <Box size={30}/> : failed ? <ImageOff size={28}/> : <LoaderCircle size={24} className={visible ? "model-spin" : ""}/>}
        {!available ? <span>仅索引</span> : failed ? <span>预览暂不可用</span> : null}</span>}
  </div>;
}
