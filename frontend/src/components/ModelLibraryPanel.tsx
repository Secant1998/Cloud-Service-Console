import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Database, RefreshCw, Search, Waypoints } from "lucide-react";
import { listCategories, listModels, modelDetail, type CategoryList, type ModelDetail, type ModelList } from "../api/modelLibrary";
import { AppSelect } from "./AppSelect";
import { ModelThumbnail } from "./ModelThumbnail";
import { CategoryThumbnail } from "./CategoryThumbnail";
import "../styles/model-library.css";

const ModelViewport = lazy(() => import("./ModelViewport").then(module => ({ default: module.ModelViewport })));
const sourceNames: Record<string, string> = { gso: "GSO", robocasa: "RoboCasa", partnet: "PartNet-Mobility", robosuite: "Robosuite", libero: "LIBERO" };
const formatBytes = (bytes: number) => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GiB` : `${(bytes / 1024 ** 2).toFixed(1)} MiB`;

function LibraryCard({ label, modelId, category, articulated = false, children, disabled, onSelect }: {
  label: string; modelId?: string; category?: string; articulated?: boolean; children: ReactNode; disabled: boolean; onSelect: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const motion = useRef<MediaQueryList | null>(null);
  const frame = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  function resetTilt() {
    window.cancelAnimationFrame(frame.current);
    frame.current = 0;
    surface.current?.removeAttribute("data-tilting");
    for (const property of ["--card-rotate-x", "--card-rotate-y", "--card-light-x", "--card-light-y", "--card-shadow-x", "--card-shadow-y"]) {
      surface.current?.style.removeProperty(property);
    }
  }
  useEffect(() => {
    const preference = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    motion.current = preference;
    preference.addEventListener("change", resetTilt);
    window.addEventListener("blur", resetTilt);
    return () => {
      preference.removeEventListener("change", resetTilt);
      window.removeEventListener("blur", resetTilt);
      window.cancelAnimationFrame(frame.current);
    };
  }, []);
  function followPointer(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "mouse" || event.buttons || !motion.current?.matches) {
      resetTilt();
      return;
    }
    pointer.current = { x: event.clientX, y: event.clientY };
    if (frame.current) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0;
      if (!button.current || !surface.current) return;
      // Measure the stationary hit area, never the already tilted surface.
      const bounds = button.current.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const x = Math.max(-1, Math.min(1, (pointer.current.x - bounds.left) / bounds.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (pointer.current.y - bounds.top) / bounds.height * 2 - 1));
      surface.current.style.setProperty("--card-rotate-x", `${(-y * 7).toFixed(2)}deg`);
      surface.current.style.setProperty("--card-rotate-y", `${(x * 7).toFixed(2)}deg`);
      surface.current.style.setProperty("--card-light-x", `${(50 - x * 40).toFixed(1)}%`);
      surface.current.style.setProperty("--card-light-y", `${(50 - y * 40).toFixed(1)}%`);
      surface.current.style.setProperty("--card-shadow-x", `${(-x * 10).toFixed(1)}px`);
      surface.current.style.setProperty("--card-shadow-y", `${(14 - y * 6).toFixed(1)}px`);
      surface.current.dataset.tilting = "true";
    });
  }
  return <button ref={button} type="button" data-model-id={modelId} data-category={category} className="model-card" title={label} aria-label={articulated ? `${label}，关节模型` : label} aria-disabled={disabled}
    onClick={() => { if (!disabled) onSelect(); }} onPointerEnter={followPointer} onPointerMove={followPointer}
    onPointerLeave={resetTilt} onPointerCancel={resetTilt} onPointerDown={resetTilt} onBlur={resetTilt}>
    <div ref={surface} className="model-card-surface">
      {articulated ? <span className="model-kind-badge" aria-hidden="true">
        <Waypoints size={18}/><span className="model-kind-tooltip">关节模型</span>
      </span> : null}
      {children}
    </div>
  </button>;
}

function Detail({ id, back, theme }: { id: string; back: () => void; theme: "light" | "dark" }) {
  const [detail, setDetail] = useState<ModelDetail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setDetail(null); setError("");
    void modelDetail(id, controller.signal).then(setDetail).catch(reason => {
      if (!controller.signal.aborted) setError(reason.message);
    });
    return () => controller.abort();
  }, [id]);
  return <section className="model-detail">
    <div className="model-detail-heading">
      <button type="button" className="model-icon-button" title="返回模型列表" aria-label="返回模型列表" onClick={back}><ArrowLeft size={20}/></button>
      <div><h2>{detail?.label || id}</h2><span>{sourceNames[detail?.source || ""] || "模型详情"}</span></div>
    </div>
    {error ? <div role="alert" className="model-error">{error}</div> : null}
    {!detail && !error ? <div className="model-empty" role="status">正在读取模型信息</div> : null}
    {detail ? <div className="model-detail-body">
      <div className="model-detail-view">
        {detail.available ? <Suspense fallback={<div className="model-empty">正在启动三维视图</div>}><ModelViewport assetId={id} theme={theme}/></Suspense>
          : <div className="model-empty">仅有索引，云端暂无模型文件</div>}
      </div>
      <aside className="model-metadata">
        <h3>模型信息</h3>
        <dl>
          <dt>来源</dt><dd>{detail.entry.source || sourceNames[detail.source]}</dd>
          <dt>类别 / 标签</dt><dd>{detail.category || "未标注"}</dd>
          {detail.classification ? <>
            <dt>细分类型</dt><dd>{detail.classification.subcategory}</dd>
            {Object.entries(detail.classification.attributes).map(([key, value]) => <div className="model-attribute" key={key}>
              <dt>{{ brand: "品牌", color: "颜色", pattern: "图案", material: "材质" }[key]}</dt><dd>{value}</dd>
            </div>)}
            {detail.classification.status === "needs_review" ? <><dt>待核对原因</dt><dd>{detail.classification.note}</dd></> : null}
          </> : null}
          <dt>结构</dt><dd>{detail.kind === "articulated" ? "关节模型" : "刚体模型"}</dd>
          <dt>资源大小</dt><dd>{formatBytes(detail.bytes)}</dd>
          <dt>模型 ID</dt><dd className="model-id">{id}</dd>
          <dt>源坐标包围盒 XYZ</dt><dd>{detail.entry.parameters?.geometry?.dimensions_m?.map(n => `${n.toFixed(3)} m`).join(" × ") || "未提供"}</dd>
          {detail.entry.parameters?.articulation?.movable_joint_count != null ? <><dt>活动关节</dt><dd>{detail.entry.parameters.articulation.movable_joint_count}</dd></> : null}
          <dt>使用许可</dt><dd>{detail.entry.license || "参见源文件"}</dd>
        </dl>
        {detail.entry.tags?.length ? <div className="model-tags">{detail.entry.tags.slice(0, 16).map(tag => <span key={tag}>{tag}</span>)}</div> : null}
        {detail.entry.validation?.source_defects?.length ? <div className="model-error"><strong>源模型存在缺陷</strong>{detail.entry.validation.source_defects.map((issue, i) => <p key={i}>{issue.rule}: {issue.reference || issue.joint}</p>)}</div> : null}
      </aside>
    </div> : null}
  </section>;
}

function LibraryBrowser({ category, active, onCategory, onModel, back }: {
  category: string | null; active: boolean; onCategory: (value: string) => void; onModel: (id: string) => void; back?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const showModels = category !== null || !!search.trim() || !!source;
  const [{ page, pageSize }, setPagination] = useState({ page: 1, pageSize: 36 });
  const [gridElement, setGridElement] = useState<HTMLDivElement | null>(null);
  const setPage = (value: number | ((page: number) => number)) => setPagination(current => ({
    ...current, page: typeof value === "function" ? value(current.page) : value,
  }));
  const [data, setData] = useState<ModelList | CategoryList | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const section = useRef<HTMLElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const position = useRef<{ elements: { element: Element; top: number; left: number }[]; focus: HTMLElement | null } | null>(null);
  function remember() {
    const elements = [];
    for (let element = section.current?.parentElement; element; element = element.parentElement) {
      elements.push({ element, top: element.scrollTop, left: element.scrollLeft });
    }
    position.current = { elements, focus: document.activeElement instanceof HTMLElement ? document.activeElement : null };
  }
  useLayoutEffect(() => {
    if (!active) return;
    if (position.current) {
      position.current.focus?.focus({ preventScroll: true });
      for (const { element, top, left } of position.current.elements) element.scrollTo({ top, left, behavior: "instant" });
    } else if (category !== null) section.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [active, category]);
  useLayoutEffect(() => {
    if (!toolbar.current || !results.current || !active) return;
    let frame = 0;
    function updateClipping() {
      frame = 0;
      if (!toolbar.current || !results.current) return;
      const heading = toolbar.current.getBoundingClientRect();
      const content = results.current.getBoundingClientRect();
      section.current?.style.setProperty("--model-toolbar-height", `${heading.height}px`);
      // Keep the toolbar transparent without drawing scrolled cards behind its text.
      results.current.style.setProperty("--model-results-clip", `${Math.max(0, heading.bottom - content.top)}px`);
    }
    function scheduleClipping() {
      if (!frame) frame = window.requestAnimationFrame(updateClipping);
    }
    const resize = new ResizeObserver(updateClipping);
    resize.observe(toolbar.current);
    resize.observe(results.current);
    window.addEventListener("scroll", scheduleClipping, { capture: true, passive: true });
    window.addEventListener("resize", scheduleClipping);
    updateClipping();
    return () => {
      resize.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleClipping, true);
      window.removeEventListener("resize", scheduleClipping);
    };
  }, [active]);
  useEffect(() => {
    if (!gridElement) return;
    const resize = new ResizeObserver(() => {
      if (!gridElement.isConnected || !gridElement.clientWidth) return;
      const columns = getComputedStyle(gridElement).gridTemplateColumns.split(" ").length;
      const nextSize = columns * Math.max(1, Math.floor(36 / columns));
      // Keep complete rows and preserve the current first item's page on resize.
      setPagination(current => current.pageSize === nextSize ? current : {
        pageSize: nextSize, page: Math.floor((current.page - 1) * current.pageSize / nextSize) + 1,
      });
    });
    resize.observe(gridElement);
    return () => resize.disconnect();
  }, [gridElement]);
  useEffect(() => {
    if (query === search) return;
    const timer = window.setTimeout(() => { setSearch(query); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [query, search]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setBusy(true); setError("");
    const params = new URLSearchParams({ q: search, source, page: String(page), page_size: String(pageSize) });
    if (category !== null) params.set("exact_category", category);
    const request = showModels ? listModels(params, controller.signal) : listCategories(params, controller.signal);
    void request
      .then(value => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, Math.ceil(value.total / pageSize));
        if (page > lastPage) setPage(lastPage);
        else setData(value);
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [search, source, category, page, pageSize, refresh, active, showModels]);
  const pages = Math.max(1, Math.ceil((data?.total || 0) / pageSize));
  const currentMode = data && ("sources" in data) === showModels;
  const returnToCategories = back || (showModels ? () => { setQuery(""); setSearch(""); setSource(""); setPage(1); } : undefined);
  return <section ref={section} hidden={!active} className="model-library" aria-label={showModels ? "模型列表" : "模型类别"}>
    <div ref={toolbar} className="model-library-toolbar">
      <div className="model-library-heading">
        <div>
          {returnToCategories ? <button type="button" className="model-icon-button" title="返回全部类别" aria-label="返回全部类别" onClick={returnToCategories}><ArrowLeft size={20}/></button> : null}
          <h2>{category === null ? <><Database size={22}/>云端模型</> : category || "未分类"}</h2>
          {category === null ? <span>{data ? `${data.stored.toLocaleString()} 个已入库 / ${data.indexed.toLocaleString()} 个索引` : "香港服务器"}</span> : null}
        </div>
        <button type="button" className="model-icon-button" title="刷新模型仓库" aria-label="刷新模型仓库" disabled={busy} onClick={() => setRefresh(n => n + 1)}><RefreshCw size={19} className={busy ? "model-spin" : ""}/></button>
      </div>
      <div className={`model-library-filters${showModels ? "" : " is-categories"}`}>
        <label className="model-search"><Search size={19}/><input type="search" value={query} aria-label="搜索模型" placeholder={category === null ? "搜索模型名称、ID 或类别" : "搜索当前类别的名称或模型 ID"} onChange={event => setQuery(event.target.value)}/></label>
        {showModels ? <AppSelect label="来源" constrainMenu value={source} placeholder="全部来源" options={[{ value: "", label: "全部来源" }, ...(data && "sources" in data ? data.sources : []).map(item => ({ value: item.source, label: `${sourceNames[item.source] || item.source} (${item.count})` }))]}
          onChange={value => { setSource(value); setPage(1); }}/> : null}
      </div>
    </div>
    <div ref={results} className="model-library-results">
    {error ? <div className="model-error" role="alert">{error}</div> : null}
    {!currentMode && !error ? <div className="model-empty" role="status">正在读取模型仓库</div> : null}
    {data && currentMode && !error ? <>
      <div className="model-result-count" role="status">{busy ? "正在更新" : `${data.total.toLocaleString()} 个${"sources" in data ? "模型" : "类别"}`}</div>
      <div className="model-grid" ref={setGridElement} aria-busy={busy || data.page !== page || data.page_size !== pageSize}>
        {data.items.map(item => "previews" in item ? <LibraryCard key={item.category} category={item.category} label={item.category || "未分类"} disabled={busy}
          onSelect={() => { remember(); onCategory(item.category); }}>
          <CategoryThumbnail key={`${item.category}:${refresh}`} category={item.category} initial={item.previews}/>
          <strong>{item.category || "未分类"}</strong>
          <div className="model-card-footer model-category-footer"><span>{item.count.toLocaleString()} 个模型</span><ArrowRight size={17}/></div>
        </LibraryCard> : <LibraryCard key={item.id} modelId={item.id} label={item.label} articulated={item.kind === "articulated"} disabled={busy} onSelect={() => { remember(); onModel(item.id); }}>
          <ModelThumbnail key={`${item.id}:${refresh}`} id={item.id} label={item.label} available={!!item.available}/>
          <strong>{item.label}</strong>
          <div className="model-card-footer"><span className={`model-card-source source-${item.source}`}>{sourceNames[item.source] || item.source}</span><span>{item.available ? formatBytes(item.bytes) : "仅索引"}</span><ArrowRight size={17}/></div>
        </LibraryCard>)}
      </div>
      {!data.items.length ? <div className="model-empty">{"sources" in data ? "没有匹配的模型" : "没有匹配的类别"}</div> : null}
      <div className="model-pagination">
        <button type="button" className="model-icon-button" title="上一页" aria-label="上一页" disabled={busy || page <= 1} onClick={() => setPage(n => n - 1)}><ChevronLeft size={20}/></button>
        <span>{page} / {pages}</span>
        <button type="button" className="model-icon-button" title="下一页" aria-label="下一页" disabled={busy || page >= pages} onClick={() => setPage(n => n + 1)}><ChevronRight size={20}/></button>
      </div>
    </> : null}
    </div>
  </section>;
}

export function ModelLibraryPanel({ theme }: { theme: "light" | "dark" }) {
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  return <>
    <LibraryBrowser category={null} active={category === null && !selected} onCategory={setCategory} onModel={setSelected}/>
    {category !== null ? <LibraryBrowser key={category} category={category} active={!selected} onCategory={setCategory} onModel={setSelected} back={() => setCategory(null)}/> : null}
    {selected ? <Detail id={selected} back={() => setSelected("")} theme={theme}/> : null}
  </>;
}
