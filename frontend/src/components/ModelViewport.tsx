import { useEffect, useRef, useState } from "react";
import { Expand, Link2, MousePointer2, MoveHorizontal, RotateCcw, Rotate3D, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { modelResource, modelView, type ViewPart } from "../api/modelLibrary";
import { createArticulation, type JointControl } from "./modelArticulation";
import { ModelJointIndicator } from "./modelJointIndicator";

function dispose(object: THREE.Object3D) {
  object.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
      material.dispose();
    }
  });
}

function mshGeometry(buffer: ArrayBuffer) {
  if (buffer.byteLength < 16) throw new Error("MSH 文件不完整");
  const header = new DataView(buffer);
  const [nv, nn, nt, nf] = [0, 4, 8, 12].map(offset => header.getInt32(offset, true));
  if ([nv, nn, nt, nf].some(n => n < 0 || n > 10000000) || !nv || !nf ||
    16 + 12 * (nv + nn + nf) + 8 * nt !== buffer.byteLength) throw new Error("MSH 网格数据无效");
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(buffer, 16, nv * 3), 3));
  if (nn === nv) geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(buffer, 16 + nv * 12, nn * 3), 3));
  if (nt === nv) geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(buffer, 16 + 12 * (nv + nn), nt * 2), 2));
  const indices = new Uint32Array(buffer, 16 + 12 * (nv + nn) + 8 * nt, nf * 3);
  if (indices.some(index => index >= nv)) throw new Error("MSH 索引越界");
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  if (nn !== nv) geometry.computeVertexNormals();
  return geometry;
}

type Theme = "light" | "dark";
const VIEW_PALETTES = {
  light: { background: 0xf3f7fb, grid: 0x849fb4, opacity: .55 },
  dark: { background: 0x030914, grid: 0x456c85, opacity: .65 },
};

type ViewportProps = { assetId: string; theme: Theme; thumbnail?: boolean;
  onThumbnail?: (result: { png?: string; error?: string }) => void };

function JointNumber({ value, min, max, disabled, id, onCommit }: { value: number; min?: number; max?: number;
  disabled: boolean; id: string; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(value.toFixed(1));
  useEffect(() => setDraft(value.toFixed(1)), [value]);
  return <input id={id} aria-label="关节数值" type="number" step="0.1" disabled={disabled} min={min} max={max}
    value={draft} onChange={event => setDraft(event.target.value)}
    onBlur={() => {
      if (draft.trim() && Number.isFinite(Number(draft))) {
        const next = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, Number(draft)));
        setDraft(next.toFixed(1)); onCommit(next);
      }
      else setDraft(value.toFixed(1));
    }} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}/>
}

export function ModelViewport({ assetId, theme, thumbnail = false, onThumbnail }: ViewportProps) {
  const host = useRef<HTMLDivElement>(null);
  const themeRef = useRef(theme);
  const thumbnailCallback = useRef(onThumbnail);
  thumbnailCallback.current = onThumbnail;
  themeRef.current = theme;
  const updateTheme = useRef<((theme: Theme) => void) | null>(null);
  const action = useRef<{ fit: () => void; zoom: (factor: number) => void; rotate: () => boolean } | null>(null);
  const jointAction = useRef<{ select: (name: string | null) => void; set: (name: string, value: number) => void; reset: () => void } | null>(null);
  const [joints, setJoints] = useState<JointControl[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("正在加载模型");
  const [error, setError] = useState("");
  const [rotating, setRotating] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false, frame = 0;
    const abort = new AbortController();
    const urls: string[] = [];
    const objects: THREE.Object3D[] = [];
    const resourceCache = new Map<string, Promise<Blob>>();
    let renderer: THREE.WebGLRenderer;
    setError(""); setStatus("正在加载模型"); setRotating(false);
    setJoints([]); setSelected(null); setValues({});
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: thumbnail, preserveDrawingBuffer: true });
    } catch {
      setError("三维视图无法启动，请检查浏览器硬件加速。");
      setStatus("");
      thumbnailCallback.current?.({ error: "WebGL unavailable" });
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.setAttribute("aria-label", "模型三维视图");
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = thumbnail ? null : new THREE.Color();
    const fog = new THREE.FogExp2(0xffffff, .045);
    scene.fog = fog;
    const grid = new THREE.GridHelper(20, 40, 0xffffff, 0xffffff);
    // Short segments remain visible when the grid crosses the camera's near plane.
    const vertices = grid.geometry.getAttribute("position");
    const segments = new Float32Array(vertices.count * 40 * 3);
    const start = new THREE.Vector3(), end = new THREE.Vector3(), point = new THREE.Vector3();
    let offset = 0;
    for (let i = 0; i < vertices.count; i += 2) {
      start.fromBufferAttribute(vertices, i); end.fromBufferAttribute(vertices, i + 1);
      for (let step = 0; step < 40; step++) {
        point.lerpVectors(start, end, step / 40).toArray(segments, offset); offset += 3;
        point.lerpVectors(start, end, (step + 1) / 40).toArray(segments, offset); offset += 3;
      }
    }
    grid.geometry.setAttribute("position", new THREE.BufferAttribute(segments, 3));
    grid.geometry.deleteAttribute("color");
    grid.geometry.computeBoundingSphere();
    grid.material.vertexColors = false;
    grid.material.transparent = true;
    grid.material.depthWrite = false;
    grid.visible = false;
    scene.add(grid);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x85908e, 2.3));
    for (const [position, power] of [[new THREE.Vector3(3, 5, 4), 2.5], [new THREE.Vector3(-4, 2, -2), 1.2]] as const) {
      const light = new THREE.DirectionalLight(0xffffff, power);
      light.position.copy(position); scene.add(light);
    }
    const camera = new THREE.PerspectiveCamera(35, 1, .001, 1000);
    camera.position.set(2, 1.3, 2.2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enabled = !thumbnail;
    controls.enableDamping = false;
    controls.autoRotateSpeed = 1;
    const content = new THREE.Group();
    content.rotation.x = -Math.PI / 2;
    scene.add(content);
    let rig: ReturnType<typeof createArticulation> | undefined;
    let selectedJoint: JointControl | undefined;
    const highlighted = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    const axisHelper = new ModelJointIndicator();
    let radius = 1;
    scene.add(axisHelper);
    const render = () => {
      if (disposed) return;
      if (selectedJoint && rig) {
        axisHelper.update(selectedJoint, rig.origins.get(selectedJoint.child)!, rig.nodes.get(selectedJoint.child)!, radius, rig.value(selectedJoint.name));
      }
      renderer.render(scene, camera);
    };
    updateTheme.current = value => {
      const palette = VIEW_PALETTES[value];
      if (scene.background instanceof THREE.Color) scene.background.setHex(palette.background);
      fog.color.setHex(palette.background);
      grid.material.color.setHex(palette.grid);
      grid.material.opacity = palette.opacity;
      render();
    };
    updateTheme.current(themeRef.current);
    controls.addEventListener("change", render);
    let framingBounds: THREE.Box3 | undefined;
    const viewDirection = new THREE.Vector3(1.25, .8, 1.5);
    function fit() {
      const bounds = new THREE.Box3().setFromObject(content);
      if (framingBounds) bounds.union(framingBounds);
      if (bounds.isEmpty()) return;
      const center = bounds.getCenter(new THREE.Vector3());
      radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, .001);
      grid.position.set(center.x, bounds.min.y - radius * .015, center.z);
      grid.scale.setScalar(radius);
      grid.visible = !thumbnail;
      fog.density = .045 / radius;
      const halfFov = Math.min(THREE.MathUtils.degToRad(camera.fov / 2), Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
      camera.position.copy(center).add(viewDirection.clone().normalize().multiplyScalar(radius / Math.sin(halfFov) * 1.15));
      camera.near = radius / 1000; camera.far = radius * 100;
      camera.updateProjectionMatrix();
      controls.target.copy(center); controls.minDistance = radius * .05; controls.maxDistance = radius * 30;
      controls.update(); render();
    }
    const resize = new ResizeObserver(() => {
      const width = Math.max(1, element.clientWidth), height = Math.max(1, element.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix(); fit(); render();
    });
    resize.observe(element);
    function animate() {
      if (!disposed && controls.autoRotate) {
        controls.update(1 / 60); render(); frame = requestAnimationFrame(animate);
      }
    }
    action.current = {
      fit,
      zoom: factor => { camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target); controls.update(); render(); },
      rotate: () => { controls.autoRotate = !controls.autoRotate; cancelAnimationFrame(frame); if (controls.autoRotate) animate(); return controls.autoRotate; },
    };
    function clearHighlight() {
      for (const [mesh, original] of highlighted) {
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
        mesh.material = original;
      }
      highlighted.clear();
    }
    function syncValues() {
      if (!disposed && rig) setValues(Object.fromEntries(rig.joints.map(joint => [joint.name, rig!.value(joint.name)])));
      render();
    }
    function stopSpin() { controls.autoRotate = false; cancelAnimationFrame(frame); setRotating(false); }
    function selectJoint(name: string | null) {
      endDrag(); clearHighlight(); stopSpin();
      selectedJoint = rig?.joints.find(joint => joint.name === name);
      setSelected(selectedJoint?.name ?? null);
      axisHelper.visible = Boolean(selectedJoint);
      if (selectedJoint) rig?.nodes.get(selectedJoint.child)?.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        highlighted.set(child, child.material);
        const tinted = (Array.isArray(child.material) ? child.material : [child.material]).map(material => {
          const clone = material.clone();
          if ("color" in clone && clone.color instanceof THREE.Color) clone.color.lerp(new THREE.Color(0x16c6bb), .35);
          if ("emissive" in clone && clone.emissive instanceof THREE.Color) clone.emissive.setHex(0x075b50);
          return clone;
        });
        child.material = Array.isArray(child.material) ? tinted : tinted[0];
      });
      render();
    }
    jointAction.current = {
      select: selectJoint,
      set: (name, value) => { stopSpin(); rig?.setValue(name, value); syncValues(); },
      reset: () => { endDrag(); stopSpin(); rig?.reset(); syncValues(); },
    };
    const canvas = renderer.domElement;
    const raycaster = new THREE.Raycaster();
    let drag: { pointer: number; x: number; start: number; scale: number; name: string } | undefined;
    function hitSelected(event: PointerEvent) {
      const node = selectedJoint && rig?.nodes.get(selectedJoint.child);
      if (!node || selectedJoint?.reason || selectedJoint?.mimic) return false;
      const bounds = canvas.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1,
        1 - (event.clientY - bounds.top) / bounds.height * 2), camera);
      // Use the frontmost surface so hidden parts cannot steal camera gestures.
      const hit = raycaster.intersectObject(content, true)[0];
      for (let object = hit?.object; object; object = object.parent!) if (object === node) return true;
      return false;
    }
    function beginDrag(event: PointerEvent) {
      if (event.button !== 0 || !hitSelected(event) || !selectedJoint || !rig || drag) return;
      event.preventDefault(); event.stopImmediatePropagation(); stopSpin();
      controls.enabled = false;
      const span = selectedJoint.type === "prismatic" ? selectedJoint.max - selectedJoint.min : Math.PI * 2;
      drag = { pointer: event.pointerId, x: event.clientX, start: rig.value(selectedJoint.name),
        scale: span / Math.max(canvas.clientWidth, 1), name: selectedJoint.name };
      canvas.setPointerCapture(event.pointerId); canvas.style.cursor = "ew-resize";
    }
    function moveDrag(event: PointerEvent) {
      if (drag && drag.pointer === event.pointerId) {
        event.preventDefault(); event.stopImmediatePropagation();
        rig?.setValue(drag.name, drag.start + (event.clientX - drag.x) * drag.scale); syncValues();
      } else if (!drag) canvas.style.cursor = hitSelected(event) ? "ew-resize" : "";
    }
    function endDrag(event?: PointerEvent) {
      if (!drag || (event && event.pointerId !== drag.pointer)) return;
      const pointer = drag.pointer; drag = undefined;
      if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
      controls.enabled = !thumbnail; canvas.style.cursor = "";
      if (event) { event.preventDefault(); event.stopImmediatePropagation(); }
    }
    if (!thumbnail) {
      canvas.addEventListener("pointerdown", beginDrag, true);
      canvas.addEventListener("pointermove", moveDrag, true);
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(event, endDrag as EventListener, true);
    }
    const blob = (path: string) => {
      if (!resourceCache.has(path)) resourceCache.set(path, modelResource(assetId, path, abort.signal));
      return resourceCache.get(path)!;
    };
    const url = async (path: string) => {
      const data = await blob(path);
      if (disposed) throw new DOMException("Closed", "AbortError");
      const result = URL.createObjectURL(data); urls.push(result); return result;
    };

    async function loadPart(part: ViewPart) {
      const suffix = part.mesh.split(".").pop()?.toLowerCase();
      let object: THREE.Object3D;
      if (suffix === "obj") {
        const loader = new OBJLoader();
        if (part.materials.length) {
          const materialUrls = new Map<string, string>();
          let text = "";
          for (const mtl of part.materials) {
            text += `${await (await blob(mtl.file)).text()}\n`;
            for (const [name, path] of Object.entries(mtl.textures)) materialUrls.set(name, await url(path));
          }
          const manager = new THREE.LoadingManager();
          manager.setURLModifier(value => {
            const resolved = materialUrls.get(value);
            if (!resolved) throw new Error(`材质引用未解析：${value}`);
            return resolved;
          });
          const loaded = new Promise<void>((resolve, reject) => {
            manager.onLoad = resolve;
            manager.onError = value => reject(new Error(`材质加载失败：${value}`));
          });
          manager.itemStart("material-batch");
          const materialLoader = new MTLLoader(manager);
          materialLoader.setMaterialOptions({ side: THREE.DoubleSide });
          const materials = materialLoader.parse(text, "");
          materials.preload(); loader.setMaterials(materials);
          object = loader.parse(await (await blob(part.mesh)).text());
          objects.push(object);
          manager.itemEnd("material-batch");
          await loaded;
        } else {
          object = loader.parse(await (await blob(part.mesh)).text());
          objects.push(object);
        }
      } else if (suffix === "msh" || suffix === "stl") {
        const data = await (await blob(part.mesh)).arrayBuffer();
        const geometry = suffix === "msh" ? mshGeometry(data) : new STLLoader().parse(data);
        object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xc2c8c5, roughness: .65 }));
        objects.push(object);
      } else throw new Error(`当前三维视图不支持 ${suffix} 格式`);
      if (part.texture || (!part.materials.length && part.rgba)) {
        const map = part.texture ? await new THREE.TextureLoader().loadAsync(await url(part.texture)) : undefined;
        if (map) {
          map.colorSpace = THREE.SRGBColorSpace;
          // Compiled MuJoCo UVs differ from native OBJ/MTL UVs; follow the per-part contract.
          map.flipY = part.texture_flip_y ?? true;
          map.needsUpdate = true;
        }
        const rgba = part.rgba || [1, 1, 1, 1];
        object.traverse(child => {
          if (!(child instanceof THREE.Mesh)) return;
          for (const old of Array.isArray(child.material) ? child.material : [child.material]) old.dispose();
          child.material = new THREE.MeshStandardMaterial({ map, color: new THREE.Color(rgba[0], rgba[1], rgba[2]),
            opacity: rgba[3] ?? 1, transparent: (rgba[3] ?? 1) < 1, roughness: .72, metalness: 0, side: THREE.DoubleSide });
        });
      }
      const placed = new THREE.Group();
      object.traverse(child => {
        if (child instanceof THREE.Mesh) {
          // Fade only the reference grid, not the model's source materials.
          for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.fog = false;
        }
      });
      if (part.xyz) placed.position.fromArray(part.xyz);
      if (part.rpy) placed.rotation.set(part.rpy[0], part.rpy[1], part.rpy[2], "ZYX");
      if (part.scale) placed.scale.fromArray(part.scale);
      placed.add(object);
      if (disposed) { dispose(object); throw new DOMException("Closed", "AbortError"); }
      return placed;
    }

    async function load() {
      const manifest = await modelView(assetId, abort.signal);
      if (disposed) return;
      if (manifest.camera_direction) viewDirection.fromArray(manifest.camera_direction);
      rig = createArticulation(manifest, content);
      let next = 0, complete = 0;
      await Promise.all(Array.from({ length: Math.min(4, manifest.parts.length) }, async () => {
        while (next < manifest.parts.length && !disposed) {
          const part = manifest.parts[next++];
          const object = await loadPart(part);
          (part.node ? rig!.nodes.get(part.node)! : content).add(object);
          complete++;
          if (!disposed) setStatus(`正在加载模型 ${complete}/${manifest.parts.length}`);
        }
      }));
      if (!disposed) {
        if (!thumbnail) {
          rig.reset();
          // Reserve space for opened doors/drawers without moving the camera on each input.
          framingBounds = new THREE.Box3().setFromObject(content);
          for (const joint of rig.joints) {
            if (joint.reason || joint.mimic) continue;
            const positions = joint.type === "continuous" ? [Math.PI / 2, Math.PI, Math.PI * 1.5] :
              [joint.min, (joint.min + joint.max) / 2, joint.max];
            const initial = rig.value(joint.name);
            for (const value of positions) { rig.setValue(joint.name, value); framingBounds.expandByObject(content); }
            rig.setValue(joint.name, initial);
          }
          setJoints(rig.joints); syncValues();
        }
        fit(); setStatus("");
        if (thumbnail) thumbnailCallback.current?.({ png: renderer.domElement.toDataURL("image/png") });
      }
      if (manifest.warnings.length && !disposed) setError(manifest.warnings.join("；"));
    }
    void load().catch(reason => {
      if (!disposed) {
        abort.abort(); setError(reason instanceof Error ? reason.message : String(reason)); setStatus("");
        thumbnailCallback.current?.({ error: reason instanceof Error ? reason.message : String(reason) });
      }
    });
    return () => {
      disposed = true; abort.abort(); cancelAnimationFrame(frame); resize.disconnect(); action.current = null;
      jointAction.current = null; endDrag(); clearHighlight(); axisHelper.dispose();
      canvas.removeEventListener("pointerdown", beginDrag, true); canvas.removeEventListener("pointermove", moveDrag, true);
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.removeEventListener(event, endDrag as EventListener, true);
      updateTheme.current = null;
      grid.dispose();
      controls.dispose(); objects.forEach(dispose); renderer.dispose(); renderer.forceContextLoss();
      renderer.domElement.remove(); urls.forEach(value => URL.revokeObjectURL(value)); resourceCache.clear();
    };
  }, [assetId, retry, thumbnail]);

  useEffect(() => { updateTheme.current?.(theme); }, [theme]);

  const active = joints.find(joint => joint.name === selected);
  const factor = active?.type === "prismatic" ? 1000 : 180 / Math.PI;
  const unit = active?.type === "prismatic" ? "mm" : "°";
  const current = active ? (values[active.name] ?? 0) * factor : 0;
  const minimum = active ? Math.min(current, Number.isFinite(active.min) ? active.min * factor : -180) : 0;
  const maximum = active ? Math.max(current, Number.isFinite(active.max) ? active.max * factor : 180) : 0;
  const readonly = Boolean(active?.mimic || active?.reason);

  return <div className="model-viewport-shell">
    <div className="model-viewport-stage">
    <div className="model-viewport" ref={host} />
    {status && !error ? <div className="model-viewport-status" role="status">{status}</div> : null}
    {error ? <div className="model-viewport-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRetry(n => n + 1)}>重试</button></div> : null}
    {!thumbnail ? <div className="model-viewport-tools">
      <button type="button" title="恢复视角" aria-label="恢复视角" onClick={() => action.current?.fit()}><RotateCcw size={18}/></button>
      <button type="button" title="放大" aria-label="放大" onClick={() => action.current?.zoom(.8)}><ZoomIn size={18}/></button>
      <button type="button" title="缩小" aria-label="缩小" onClick={() => action.current?.zoom(1.25)}><ZoomOut size={18}/></button>
      <button type="button" title="自动旋转" aria-label="自动旋转" aria-pressed={rotating} onClick={() => setRotating(action.current?.rotate() || false)}><Rotate3D size={18}/></button>
      <button type="button" title="全屏" aria-label="全屏" onClick={() => { const target = host.current?.closest(".model-viewport-shell"); void (document.fullscreenElement ? document.exitFullscreen() : target?.requestFullscreen())?.catch(() => undefined); }}><Expand size={18}/></button>
    </div> : null}
    </div>
    {!thumbnail && joints.length > 0 ? <section className="model-joints" aria-label="模型关节">
      <div className="model-joints-heading"><strong>关节 <span>{joints.length}</span></strong>
        <div>
          <button type="button" title="取消关节选择" aria-label="取消关节选择" disabled={!active} onClick={() => jointAction.current?.select(null)}><MousePointer2 size={16}/></button>
          <button type="button" title="复位全部关节" aria-label="复位全部关节" onClick={() => jointAction.current?.reset()}><RotateCcw size={16}/></button>
        </div>
      </div>
      <div className="model-joint-list" aria-label="可用关节">
        {joints.map(joint => <button type="button" key={joint.name} data-joint={joint.name} aria-pressed={selected === joint.name}
          disabled={Boolean(joint.reason)} title={`${joint.name} · ${joint.reason || (joint.type === "prismatic" ? "滑动" : "转动")}${joint.mimic ? ` · 联动 ${joint.mimic.joint}` : ""}`}
          onClick={() => jointAction.current?.select(selected === joint.name ? null : joint.name)}>
          {joint.type === "prismatic" ? <MoveHorizontal size={16}/> : <RotateCw size={16}/>}
          <span>{joint.name}</span>{joint.mimic ? <Link2 size={13}/> : null}
        </button>)}
      </div>
      {active ? <div className="model-joint-control" data-selected-joint={active.name}>
        <div className="model-joint-value"><label htmlFor={`joint-value-${assetId}`}>{active.name}<small>{active.mimic ? `联动 ${active.mimic.joint}` : active.type === "prismatic" ? "位移" : "角度"}</small></label>
          <JointNumber key={active.name} id={`joint-value-${assetId}`} disabled={readonly}
            min={Number.isFinite(active.min) ? active.min * factor : undefined} max={Number.isFinite(active.max) ? active.max * factor : undefined}
            value={current} onCommit={value => jointAction.current?.set(active.name, value / factor)}/>
          <span>{unit}</span>
          <button type="button" title="复位选中关节" aria-label="复位选中关节" disabled={readonly} onClick={() => jointAction.current?.set(active.name, 0)}><RotateCcw size={16}/></button>
        </div>
        <div className="model-joint-range"><span>{minimum.toFixed(1)}{unit}</span><input type="range" aria-label="关节位置" min={minimum} max={maximum} step="any" value={current} disabled={readonly}
          onChange={event => jointAction.current?.set(active.name, Number(event.target.value) / factor)}/><span>{maximum.toFixed(1)}{unit}</span></div>
      </div> : null}
    </section> : null}
  </div>;
}
