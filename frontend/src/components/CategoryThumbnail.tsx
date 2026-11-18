import { useEffect, useRef, useState } from "react";
import { Box, ImageOff, LoaderCircle } from "lucide-react";
import { categoryPreviews, modelThumbnail, type CategoryPreviews } from "../api/modelLibrary";

type Slide = { id: string; label: string; url: string };

export function CategoryThumbnail({ category, initial }: { category: string; initial: CategoryPreviews }) {
  const host = useRef<HTMLDivElement>(null);
  const batch = useRef(initial);
  const cursor = useRef(0);
  const current = useRef<Slide | null>(null);
  const shownAt = useRef(0);
  const urls = useRef(new Set<string>());
  const [visible, setVisible] = useState(false);
  const [awake, setAwake] = useState(!document.hidden);
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [layers, setLayers] = useState<Slide[]>([]);
  const [front, setFront] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (host.current) observer.observe(host.current);
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(preference.matches);
    const visibility = () => setAwake(!document.hidden);
    preference.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current.clear();
    };
  }, []);

  useEffect(() => {
    // Keep at most two decoded images, and only the current image while paused.
    function trim() {
      for (const url of urls.current) if (url !== current.current?.url) {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      }
      setLayers(current.current ? [current.current] : []);
      setFront(current.current?.id || "");
    }
    trim();
    if (!visible || !awake || !initial.total || (reduced && current.current)) return;
    const controller = new AbortController();
    const { signal } = controller;
    function wait(ms: number) {
      return new Promise<void>(resolve => {
        const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
        const timer = window.setTimeout(done, ms);
        signal.addEventListener("abort", done, { once: true });
        if (signal.aborted) done();
      });
    }
    async function play() {
      let misses = 0;
      while (!signal.aborted) {
        try {
          if (cursor.current >= batch.current.items.length) {
            const offset = batch.current.offset + batch.current.items.length;
            batch.current = await categoryPreviews(category, offset >= batch.current.total ? 0 : offset, signal);
            cursor.current = 0;
            if (signal.aborted) return;
          }
          const item = batch.current.items[cursor.current];
          if (!item) { setFailed(!current.current); return; }
          if (item.id === current.current?.id) {
            cursor.current++;
            if (batch.current.total <= 1) return;
            continue;
          }
          // Pending renders are skipped after a short poll; one slow model must not block its category.
          let blob = await modelThumbnail(item.id, signal);
          for (let poll = 0; !blob && poll < 2 && !signal.aborted; poll++) {
            await wait(3000);
            if (!signal.aborted) blob = await modelThumbnail(item.id, signal);
          }
          if (signal.aborted) return;
          if (!blob) throw new Error("pending");
          const next = { ...item, url: URL.createObjectURL(blob) };
          urls.current.add(next.url);
          const image = new Image();
          image.src = next.url;
          await image.decode();
          if (signal.aborted) { URL.revokeObjectURL(next.url); urls.current.delete(next.url); return; }
          cursor.current++;
          misses = 0;
          setFailed(false);
          const previous = current.current;
          setLayers(previous ? [previous, next] : [next]);
          // Fetch and decode during the current slide's hold time, not at its end.
          if (previous) await wait(Math.max(80, shownAt.current + 4000 - performance.now()));
          if (signal.aborted) return;
          current.current = next;
          shownAt.current = performance.now();
          setFront(next.id);
          if (previous) {
            await wait(800);
            if (signal.aborted) return;
            URL.revokeObjectURL(previous.url);
            urls.current.delete(previous.url);
            setLayers([next]);
          }
          if (reduced || batch.current.total <= 1) return;
        } catch {
          if (signal.aborted) return;
          trim();
          // A bad image or network error never replaces a working thumbnail.
          setFailed(!current.current);
          misses++;
          cursor.current++;
          await wait(misses >= Math.min(batch.current.total, 6) ? 30000 : current.current ? 150 : 1000);
        }
      }
    }
    void play();
    return () => { controller.abort(); trim(); };
  }, [category, initial.total, visible, awake, reduced]);

  return <div className="model-card-preview model-category-preview" ref={host} data-fading={layers.length > 1} aria-busy={!!initial.total && !layers.length && !failed}>
    {layers.map(slide => <img key={slide.url} src={slide.url} alt={`${slide.label} 三维缩略图`} draggable={false}
      className={slide.id === front ? "is-current" : ""} aria-hidden={slide.id !== front} data-preview-id={slide.id}/>)}
    {!layers.length ? <span className="model-preview-placeholder">{!initial.total ? <Box size={30}/> : failed ? <ImageOff size={28}/> : <LoaderCircle size={24} className={visible && awake && !reduced ? "model-spin" : ""}/>}
      {!initial.total ? <span>仅索引</span> : failed ? <span>预览暂不可用</span> : null}</span> : null}
  </div>;
}
