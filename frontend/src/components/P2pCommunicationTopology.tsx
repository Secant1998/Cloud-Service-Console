import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type P2pTopologyEndpoint = {
  endpointId: string;
  requestedEndpointId?: string;
  nodeId?: string;
  requestedNodeId?: string;
  nodeType?: string;
  peerId?: string;
  role?: string;
  displayName?: string;
  status?: string;
  startedAt?: string;
  startedAtMs?: number;
  activeConnections?: string[];
  clock?: P2pTopologyClock;
};

type P2pTopologyClock = {
  offsetMs?: number | null;
  rttMs?: number | null;
  lastSyncAt?: string;
  status?: string;
};

type P2pTopologyConnection = {
  connectionId: string;
  sourceEndpointId: string;
  targetEndpointId: string;
  status?: string;
  createdAt?: string;
  connectedAt?: string;
  lastActivityAt?: string;
};

type P2pTopologyRoom = {
  room: string;
  startedAt?: string;
  startedAtMs?: number;
  endpoints: P2pTopologyEndpoint[];
  connections: P2pTopologyConnection[];
};

type P2pTopologyRoomsResponse = {
  rooms?: Array<{
    room?: string;
    startedAt?: string;
    startedAtMs?: number;
  }>;
};

type P2pTopologyRoomResponse = {
  endpoints?: P2pTopologyEndpoint[];
  connections?: P2pTopologyConnection[];
};

type P2pCommunicationTopologyProps = {
  signalBaseUrl: string;
  theme: "light" | "dark";
};

type TopologyTooltipConnection = {
  connectionId: string;
  counterpartLabel: string;
  direction: string;
  status: string;
};

type TopologyTooltip = {
  x: number;
  y: number;
  width?: number;
  title: string;
  note: string;
  roomId?: string;
  endpointId?: string;
  nodeId?: string;
  clock?: P2pTopologyClock;
  connections?: TopologyTooltipConnection[];
};

type TopologyNodeData = {
  title?: string;
  note?: string;
  roomId?: string;
  endpointId?: string;
  nodeId?: string;
  clock?: P2pTopologyClock;
  connections?: TopologyTooltipConnection[];
};

type FlowPulse = {
  mesh: THREE.Mesh;
  source: THREE.Vector3;
  target: THREE.Vector3;
  phase: number;
};

type TopologyRoomView = {
  cameraPosition: THREE.Vector3;
  lookAt: THREE.Vector3;
};

type TopologyBaseLinkVisual = {
  roomId: string;
  endpointId: string;
  line: THREE.Line;
  defaultOpacity: number;
};

type TopologyEndpointVisual = {
  roomId: string;
  endpointId: string;
  node: THREE.Mesh;
  nodeBaseRadius: number;
  hitTarget: THREE.Mesh;
  glow: THREE.Sprite;
  roleIcon?: THREE.Sprite;
  roleIconScale?: THREE.Vector3;
  defaultGlowScale: number;
  defaultEmissiveIntensity: number;
};

type TopologyConnectionVisual = {
  roomId: string;
  connectionId: string;
  sourceEndpointId: string;
  targetEndpointId: string;
  color: number;
  connected: boolean;
  defaultOpacity: number;
  lines: THREE.Line[];
  pulses: FlowPulse[];
};

type TopologyNodeAssociationVisual = {
  line: THREE.Line;
  pulse: THREE.Sprite;
  phase: number;
  defaultOpacity: number;
  defaultPulseScale: number;
};

type TopologyScreenRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type TopologyScreenCircle = {
  x: number;
  y: number;
  radius: number;
};

type TopologyRoleIconCandidate = {
  centerX: number;
  centerY: number;
  rect: TopologyScreenRect;
  order: number;
};

type TopologyRuntime = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  graph: THREE.Group;
  glowTexture: THREE.CanvasTexture;
  roleIconTextures: Map<string, THREE.CanvasTexture>;
  nodeMeshes: THREE.Mesh[];
  pulses: FlowPulse[];
  rings: THREE.Mesh[];
  roomGroups: Map<string, THREE.Group>;
  roomViews: Map<string, TopologyRoomView>;
  globalView: TopologyRoomView;
  globalFramePoints: THREE.Vector3[];
  baseLinkVisuals: TopologyBaseLinkVisual[];
  endpointVisuals: TopologyEndpointVisual[];
  connectionVisuals: TopologyConnectionVisual[];
  nodeAssociationVisuals: TopologyNodeAssociationVisual[];
  focusedRoom: string | null;
  selectedEndpointId: string | null;
  cameraPositionGoal: THREE.Vector3;
  lookAtCurrent: THREE.Vector3;
  lookAtGoal: THREE.Vector3;
  pointer: THREE.Vector2;
  frameId: number;
};

const TOPOLOGY_PALETTES = {
  light: {
    background: 0xf3f7fb,
    fog: 0xf3f7fb,
    fogDensity: 0.052,
    hemisphereSky: 0xffffff,
    hemisphereGround: 0xb8c6d6,
    hemisphereIntensity: 1.8,
    coreLight: 0x0284c7,
    coreLightIntensity: 3.8,
    gridCenter: 0x4f81ad,
    gridLine: 0xb4c6d8,
    gridOpacity: 0.48,
    star: 0x2563eb,
    starOpacity: 0.25,
    server: 0xffffff,
    serverEmissive: 0x0284c7,
    serverEmissiveIntensity: 1.45,
    serverGlow: 0x0ea5e9,
    glowOpacity: 0.34,
    ringOpacity: 0.3,
    nodeConnectedIntensity: 1.35,
    nodeIdleIntensity: 0.68,
    baseLineOpacity: 0.38,
    connectedLineOpacity: 0.76,
    pendingLineOpacity: 0.34,
    highlightLine: 0x0f3b5d,
    highlightPulse: 0x0f3b5d,
    roomColors: [0x059669, 0x2563eb, 0xdc2626, 0xd97706],
    roomColorCss: ["#059669", "#2563eb", "#dc2626", "#d97706"],
    additiveBlending: false,
  },
  dark: {
    background: 0x030914,
    fog: 0x030914,
    fogDensity: 0.07,
    hemisphereSky: 0x7dd3fc,
    hemisphereGround: 0x07101f,
    hemisphereIntensity: 1.4,
    coreLight: 0x67e8f9,
    coreLightIntensity: 7,
    gridCenter: 0x235a7a,
    gridLine: 0x102943,
    gridOpacity: 0.34,
    star: 0x78d9ff,
    starOpacity: 0.58,
    server: 0xe8fbff,
    serverEmissive: 0x22d3ee,
    serverEmissiveIntensity: 2.2,
    serverGlow: 0x67e8f9,
    glowOpacity: 0.72,
    ringOpacity: 0.4,
    nodeConnectedIntensity: 2.4,
    nodeIdleIntensity: 1.15,
    baseLineOpacity: 0.28,
    connectedLineOpacity: 0.88,
    pendingLineOpacity: 0.24,
    highlightLine: 0xeaffff,
    highlightPulse: 0xffffff,
    roomColors: [0x35e68a, 0x3b82f6, 0xff4d67, 0xffd43b],
    roomColorCss: ["#35e68a", "#3b82f6", "#ff4d67", "#ffd43b"],
    additiveBlending: true,
  },
} as const;
const POLL_INTERVAL_MS = 5000;
// The tilted perspective camera turns this world-space arc into roughly 120 degrees on screen.
const MAX_ROOM_ARC_ANGLE = THREE.MathUtils.degToRad(86);
const ROOM_ARC_GAP_ANGLE = THREE.MathUtils.degToRad(8);
const TOPOLOGY_CAMERA_FOV = 28;
const ROOM_FOCUS_FRAMING_SCALE = 1.04;
const ROOM_FOCUS_FRAME_PADDING = 0.38;
const GLOBAL_FRAMING_SCALE = 1.12;
const GLOBAL_FRAME_PADDING = 0.62;
const GLOBAL_MIN_CAMERA_DISTANCE = 2.6;
// Slightly denser UV spheres smooth the node silhouette without adding lights,
// sprites, or per-frame work to the topology scene.
const SERVER_SPHERE_SEGMENTS = 32;
const SERVER_SPHERE_RINGS = 24;
const ENDPOINT_SPHERE_SEGMENTS = 28;
const ENDPOINT_SPHERE_RINGS = 20;
const ROLE_ICON_URLS: Record<string, string> = {
  "robot-edge": new URL("../assets/p2p-topology/robot-edge.png", import.meta.url).href,
  compute: new URL("../assets/p2p-topology/compute.png", import.meta.url).href,
  "video-pusher": new URL("../assets/p2p-topology/video-pusher.png", import.meta.url).href,
  frontend: new URL("../assets/p2p-topology/frontend.png", import.meta.url).href,
  viewer: new URL("../assets/p2p-topology/viewer.png", import.meta.url).href,
};
const ROLE_ICON_ASPECT_RATIOS: Record<string, number> = {
  "robot-edge": 1,
  compute: 1,
  "video-pusher": 1,
  frontend: 1,
  viewer: 1.5,
};
function roleLabel(role = "") {
  return ({
    "video-pusher": "视频推流端",
    compute: "计算服务器",
    "robot-edge": "机械臂端侧",
    frontend: "前端",
    viewer: "观看端",
  } as Record<string, string>)[role] || "P2P V2 端";
}

function connectionStatusLabel(status = "") {
  return ({
    connected: "已连接",
    connecting: "连接中",
    waiting: "等待中",
    failed: "连接失败",
    disconnected: "已断开",
  } as Record<string, string>)[status] || status || "状态未知";
}

function clockValue(value: number | null | undefined, status: string | undefined, kind: "offset" | "rtt") {
  if (status === "stale") return "已过期";
  if (!Number.isFinite(value)) return "未同步";
  const number = Number(value);
  if (kind === "offset") {
    return `${number >= 0 ? "+" : ""}${number.toFixed(1)} ms`;
  }
  return `${number.toFixed(1)} ms`;
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,0.96)");
    gradient.addColorStop(0.16, "rgba(255,255,255,0.46)");
    gradient.addColorStop(0.48, "rgba(255,255,255,0.12)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createTintableIconTexture(url: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    context.globalCompositeOperation = "source-in";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = "source-over";
    texture.needsUpdate = true;
  };
  image.src = url;
  return texture;
}

function disposeGraph(group: THREE.Group) {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    materials.forEach((material) => material.dispose());
  });
  group.clear();
}

function makeLine(
  start: THREE.Vector3,
  end: THREE.Vector3,
  color: number,
  opacity: number,
  additiveBlending: boolean,
) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: additiveBlending ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
  });
  return new THREE.Line(geometry, material);
}

function makeDashedLine(start: THREE.Vector3, end: THREE.Vector3, color: number, opacity: number) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineDashedMaterial({
    color,
    transparent: true,
    opacity,
    dashSize: 0.11,
    gapSize: 0.075,
    depthWrite: false,
  });
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  line.renderOrder = 1;
  return line;
}

function makeGlow(
  texture: THREE.CanvasTexture,
  color: number,
  size: number,
  opacity: number,
  additiveBlending: boolean,
) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    blending: additiveBlending ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(size);
  return sprite;
}

function topologyRectIntersectsCircle(
  rect: TopologyScreenRect,
  circle: TopologyScreenCircle,
  padding = 0,
) {
  const closestX = Math.max(rect.left, Math.min(circle.x, rect.right));
  const closestY = Math.max(rect.top, Math.min(circle.y, rect.bottom));
  return Math.hypot(circle.x - closestX, circle.y - closestY) < circle.radius + padding;
}

function topologyRectsOverlap(first: TopologyScreenRect, second: TopologyScreenRect, gap = 0) {
  return (
    first.left < second.right + gap
    && first.right > second.left - gap
    && first.top < second.bottom + gap
    && first.bottom > second.top - gap
  );
}

function topologyRectOverflow(rect: TopologyScreenRect, width: number, height: number, inset: number) {
  return (
    Math.max(0, inset - rect.left)
    + Math.max(0, rect.right - (width - inset))
    + Math.max(0, inset - rect.top)
    + Math.max(0, rect.bottom - (height - inset))
  );
}

function calculateGlobalView(
  points: THREE.Vector3[],
  camera: THREE.PerspectiveCamera,
  lookAt: THREE.Vector3,
): TopologyRoomView {
  const cameraDirection = new THREE.Vector3(0, 5.4, 7.4).normalize();
  const screenRight = new THREE.Vector3()
    .crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0))
    .normalize();
  const screenUp = new THREE.Vector3().crossVectors(screenRight, cameraDirection).normalize();
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const tanVerticalFov = Math.tan(verticalFov / 2);
  const tanHorizontalFov = tanVerticalFov * Math.max(0.1, camera.aspect || 1);
  const framePoints = points.length ? points : [lookAt];
  const requiredDistance = framePoints.reduce((distance, point) => {
    const relative = point.clone().sub(lookAt);
    const projectedWidth = Math.abs(relative.dot(screenRight)) + GLOBAL_FRAME_PADDING;
    const projectedHeight = Math.abs(relative.dot(screenUp)) + GLOBAL_FRAME_PADDING;
    const depthOffset = relative.dot(cameraDirection);
    return Math.max(
      distance,
      depthOffset + projectedWidth / tanHorizontalFov,
      depthOffset + projectedHeight / tanVerticalFov,
    );
  }, GLOBAL_MIN_CAMERA_DISTANCE);
  const distance = Math.max(GLOBAL_MIN_CAMERA_DISTANCE, requiredDistance * GLOBAL_FRAMING_SCALE);
  return {
    lookAt: lookAt.clone(),
    cameraPosition: lookAt.clone().add(cameraDirection.multiplyScalar(distance)),
  };
}

export function P2pCommunicationTopology({ signalBaseUrl, theme }: P2pCommunicationTopologyProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<TopologyRuntime | null>(null);
  const [rooms, setRooms] = useState<P2pTopologyRoom[]>([]);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [tooltip, setTooltip] = useState<TopologyTooltip | null>(null);
  const [focusedRoom, setFocusedRoom] = useState<string | null>(null);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const tooltipPinnedRef = useRef(false);
  const roomsRef = useRef<P2pTopologyRoom[]>([]);
  const palette = TOPOLOGY_PALETTES[theme];

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    let disposed = false;
    let refreshing = false;
    const baseUrl = signalBaseUrl || "https://p2p.cityulive.com";

    const refresh = async () => {
      if (disposed || refreshing || document.hidden) {
        return;
      }
      refreshing = true;
      try {
        const roomsResponse = await fetch(new URL("/api/v2/rooms", baseUrl), { cache: "no-store" });
        if (!roomsResponse.ok) {
          throw new Error(`HTTP ${roomsResponse.status}`);
        }
        const roomPayload = (await roomsResponse.json()) as P2pTopologyRoomsResponse;
        const summaries = (roomPayload.rooms || [])
          .filter((room) => String(room.room || "").trim())
          .sort((a, b) =>
            Number(a.startedAtMs || Date.parse(a.startedAt || "") || 0)
              - Number(b.startedAtMs || Date.parse(b.startedAt || "") || 0)
              || String(a.room || "").localeCompare(String(b.room || "")),
          );
        const nextRooms = await Promise.all(
          summaries.map(async (summary) => {
            const roomId = String(summary.room || "");
            const response = await fetch(
              new URL(`/api/v2/rooms/${encodeURIComponent(roomId)}/endpoints`, baseUrl),
              { cache: "no-store" },
            );
            if (!response.ok) {
              throw new Error(`${roomId}: HTTP ${response.status}`);
            }
            const payload = (await response.json()) as P2pTopologyRoomResponse;
            return {
              room: roomId,
              startedAt: summary.startedAt,
              startedAtMs: summary.startedAtMs,
              endpoints: Array.isArray(payload.endpoints) ? payload.endpoints : [],
              connections: Array.isArray(payload.connections) ? payload.connections : [],
            };
          }),
        );
        if (!disposed) {
          roomsRef.current = nextRooms;
          setRooms(nextRooms);
          setError("");
          setUpdatedAt(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "拓扑读取失败");
        }
      } finally {
        refreshing = false;
      }
    };

    setRooms([]);
    setError("");
    setUpdatedAt("");
    void refresh();
    const timerId = window.setInterval(refresh, POLL_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      disposed = true;
      window.clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [signalBaseUrl]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.background);
    scene.fog = new THREE.FogExp2(palette.fog, palette.fogDensity);
    const camera = new THREE.PerspectiveCamera(TOPOLOGY_CAMERA_FOV, 1, 0.1, 50);
    const defaultCameraPosition = new THREE.Vector3(0, 7.7, 10.55);
    const defaultLookAt = new THREE.Vector3(0, -0.05, 0);
    camera.position.copy(defaultCameraPosition);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(
      palette.hemisphereSky,
      palette.hemisphereGround,
      palette.hemisphereIntensity,
    ));
    const coreLight = new THREE.PointLight(palette.coreLight, palette.coreLightIntensity, 12, 2);
    coreLight.position.set(0, 1.2, 0);
    scene.add(coreLight);

    const grid = new THREE.GridHelper(14, 32, palette.gridCenter, palette.gridLine);
    grid.position.y = -1.18;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = palette.gridOpacity;
    });
    scene.add(grid);

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(360);
    for (let index = 0; index < starPositions.length; index += 3) {
      const seed = index / 3 + 1;
      starPositions[index] = Math.sin(seed * 12.9898) * 6.8;
      starPositions[index + 1] = 0.4 + ((seed * 37) % 23) / 6;
      starPositions[index + 2] = Math.cos(seed * 8.731) * 6.2;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: palette.star,
        size: 0.026,
        transparent: true,
        opacity: palette.starOpacity,
        blending: palette.additiveBlending ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false,
      }),
    );
    scene.add(stars);

    const graph = new THREE.Group();
    scene.add(graph);
    const glowTexture = createGlowTexture();
    const roleIconTextures = new Map(
      Object.entries(ROLE_ICON_URLS).map(([role, url]) => [role, createTintableIconTexture(url)]),
    );
    const pointer = new THREE.Vector2();
    const runtime: TopologyRuntime = {
      scene,
      camera,
      renderer,
      graph,
      glowTexture,
      roleIconTextures,
      nodeMeshes: [],
      pulses: [],
      rings: [],
      roomGroups: new Map(),
      roomViews: new Map(),
      globalView: {
        cameraPosition: defaultCameraPosition.clone(),
        lookAt: defaultLookAt.clone(),
      },
      globalFramePoints: [],
      baseLinkVisuals: [],
      endpointVisuals: [],
      connectionVisuals: [],
      nodeAssociationVisuals: [],
      focusedRoom: null,
      selectedEndpointId: null,
      cameraPositionGoal: defaultCameraPosition.clone(),
      lookAtCurrent: defaultLookAt.clone(),
      lookAtGoal: defaultLookAt.clone(),
      pointer,
      frameId: 0,
    };
    runtimeRef.current = runtime;

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const hitTest = (event: PointerEvent | MouseEvent) => {
      const bounds = mount.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 2;
      pointer.y = ((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 2;
      pointerNdc.set(pointer.x, -pointer.y);
      raycaster.setFromCamera(pointerNdc, camera);
      const hit = raycaster.intersectObjects(runtime.nodeMeshes, false).find((candidate) => {
        const roomId = String(candidate.object.userData.roomId || "");
        return !runtime.focusedRoom || !roomId || roomId === runtime.focusedRoom;
      });
      return { bounds, hit };
    };
    const findPinnedTooltipPosition = (
      bounds: DOMRect,
      panelWidth: number,
      panelHeight: number,
      pointerX: number,
      pointerY: number,
    ) => {
      const edgeGap = 12;
      const topInset = 56;
      const bottomInset = 40;
      const maxX = Math.max(edgeGap, bounds.width - panelWidth - edgeGap);
      const maxY = Math.max(topInset, bounds.height - panelHeight - bottomInset);
      const middleY = Math.round((topInset + maxY) / 2);
      const candidates = [
        { x: edgeGap, y: topInset },
        { x: maxX, y: topInset },
        { x: edgeGap, y: middleY },
        { x: maxX, y: middleY },
        { x: edgeGap, y: maxY },
        { x: maxX, y: maxY },
      ].filter(
        (candidate, index, items) =>
          items.findIndex((item) => item.x === candidate.x && item.y === candidate.y) === index,
      );

      const placementCamera = camera.clone();
      placementCamera.position.copy(runtime.cameraPositionGoal);
      placementCamera.lookAt(runtime.lookAtGoal);
      placementCamera.updateProjectionMatrix();
      placementCamera.updateMatrixWorld(true);
      runtime.scene.updateMatrixWorld(true);
      const projectedNodes = runtime.nodeMeshes
        .filter((node) => {
          const nodeData = node.userData as TopologyNodeData;
          return !nodeData.roomId || !runtime.focusedRoom || nodeData.roomId === runtime.focusedRoom;
        })
        .map((node) => {
          const nodeData = node.userData as TopologyNodeData;
          const projected = node.getWorldPosition(new THREE.Vector3()).project(placementCamera);
          return {
            x: ((projected.x + 1) / 2) * bounds.width,
            y: ((1 - projected.y) / 2) * bounds.height,
            isServer: !nodeData.roomId,
          };
        })
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
      const serverPoint = projectedNodes.find((point) => point.isServer);
      const endpointPoints = projectedNodes.filter((point) => !point.isServer);
      const distanceToRect = (
        point: { x: number; y: number },
        rect: { left: number; top: number; right: number; bottom: number },
      ) => {
        const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
        const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
        return Math.hypot(dx, dy);
      };
      const scoreCandidate = (candidate: { x: number; y: number }) => {
        const rect = {
          left: candidate.x,
          top: candidate.y,
          right: candidate.x + panelWidth,
          bottom: candidate.y + panelHeight,
        };
        let score = 0;
        projectedNodes.forEach((point) => {
          const clearance = 42;
          const distance = distanceToRect(point, rect);
          const weight = point.isServer ? 3 : 1;
          if (distance === 0) {
            score += 12000 * weight;
          } else if (distance < clearance) {
            score += ((clearance - distance) / clearance) ** 2 * 2800 * weight;
          }
        });

        const pointerDistance = distanceToRect({ x: pointerX, y: pointerY }, rect);
        if (pointerDistance === 0) {
          score += 18000;
        } else if (pointerDistance < 48) {
          score += ((48 - pointerDistance) / 48) ** 2 * 4200;
        }

        if (serverPoint) {
          endpointPoints.forEach((endpoint) => {
            for (let step = 1; step < 10; step += 1) {
              const ratio = step / 10;
              const sample = {
                x: serverPoint.x + (endpoint.x - serverPoint.x) * ratio,
                y: serverPoint.y + (endpoint.y - serverPoint.y) * ratio,
              };
              const distance = distanceToRect(sample, rect);
              if (distance === 0) {
                score += 360;
              } else if (distance < 14) {
                score += ((14 - distance) / 14) ** 2 * 90;
              }
            }
          });
        }
        return score;
      };

      return candidates.reduce((best, candidate) =>
        scoreCandidate(candidate) < scoreCandidate(best) ? candidate : best,
      );
    };
    const showNodeTooltip = (
      event: PointerEvent,
      bounds: DOMRect,
      data: TopologyNodeData,
      showConnections: boolean,
    ) => {
      const panelWidth = showConnections
        ? Math.min(272, Math.max(148, Math.floor(bounds.width * 0.46)))
        : 210;
      const panelHeight = showConnections
        ? Math.min(340, Math.max(160, bounds.height - 68), 156 + (data.connections?.length || 1) * 50)
        : 66;
      const maxX = Math.max(12, bounds.width - panelWidth - 12);
      const maxY = Math.max(56, bounds.height - panelHeight - 12);
      const pointerX = event.clientX - bounds.left;
      const pointerY = event.clientY - bounds.top;
      const pinnedPosition = showConnections
        ? findPinnedTooltipPosition(bounds, panelWidth, panelHeight, pointerX, pointerY)
        : null;
      setTooltip({
        x: pinnedPosition?.x ?? Math.min(maxX, Math.max(12, pointerX + 12)),
        y: pinnedPosition?.y ?? Math.min(maxY, Math.max(56, pointerY + 12)),
        width: showConnections ? panelWidth : undefined,
        title: data.title || "P2P V2 端",
        note: data.note || "在线",
        roomId: data.roomId,
        endpointId: data.endpointId,
        nodeId: data.nodeId,
        clock: data.clock,
        connections: showConnections ? data.connections || [] : undefined,
      });
    };
    const handlePointerMove = (event: PointerEvent) => {
      const { bounds, hit } = hitTest(event);
      if (tooltipPinnedRef.current) {
        const data = hit?.object.userData as TopologyNodeData | undefined;
        mount.style.cursor = data?.roomId ? "pointer" : runtime.focusedRoom ? "zoom-out" : "crosshair";
        return;
      }
      if (!hit) {
        mount.style.cursor = runtime.focusedRoom ? "zoom-out" : "crosshair";
        setTooltip(null);
        return;
      }
      const data = hit.object.userData as TopologyNodeData;
      const showConnections = Boolean(
        runtime.focusedRoom
        && data.roomId === runtime.focusedRoom
        && data.endpointId
        && data.endpointId === runtime.selectedEndpointId,
      );
      mount.style.cursor = data.roomId ? "pointer" : runtime.focusedRoom ? "zoom-out" : "crosshair";
      showNodeTooltip(event, bounds, data, showConnections);
    };
    const handlePointerDown = (event: PointerEvent) => {
      const { bounds, hit } = hitTest(event);
      const data = hit?.object.userData as TopologyNodeData | undefined;
      const roomId = String(hit?.object.userData.roomId || "");
      const endpointId = String(hit?.object.userData.endpointId || "");
      const selectingEndpoint = Boolean(roomId && endpointId && runtime.focusedRoom === roomId);
      const closingEndpointSelection = Boolean(
        !hit && runtime.focusedRoom && runtime.selectedEndpointId,
      );
      tooltipPinnedRef.current = false;
      runtime.selectedEndpointId = selectingEndpoint ? endpointId : null;
      setFocusedRoom(closingEndpointSelection ? runtime.focusedRoom : roomId || null);
      setSelectedEndpointId(selectingEndpoint ? endpointId : null);
      setSelectedConnectionId(null);
      if (selectingEndpoint && data) {
        tooltipPinnedRef.current = true;
        showNodeTooltip(event, bounds, data, true);
      } else {
        setTooltip(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFocusedRoom(null);
        setSelectedEndpointId(null);
        setSelectedConnectionId(null);
        tooltipPinnedRef.current = false;
        setTooltip(null);
      }
    };
    const handlePointerLeave = () => {
      pointer.set(0, 0);
      mount.style.cursor = runtime.focusedRoom ? "zoom-out" : "crosshair";
      if (!tooltipPinnedRef.current) {
        setTooltip(null);
      }
    };

    const updateRoleIconLayout = () => {
      const activeRoomId = runtime.focusedRoom;
      if (!activeRoomId) {
        return;
      }

      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      const activeVisuals = runtime.endpointVisuals.filter(
        (visual) => visual.roomId === activeRoomId && visual.roleIcon && visual.roleIconScale,
      );
      if (!activeVisuals.length) {
        return;
      }

      camera.updateMatrixWorld(true);
      graph.updateMatrixWorld(true);
      const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
      const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
      const projectToScreen = (worldPoint: THREE.Vector3) => {
        const projected = worldPoint.clone().project(camera);
        return {
          x: ((projected.x + 1) / 2) * width,
          y: ((1 - projected.y) / 2) * height,
          z: projected.z,
        };
      };
      const projectedRadius = (worldPoint: THREE.Vector3, radius: number) => {
        const centerPoint = projectToScreen(worldPoint);
        const horizontalPoint = projectToScreen(worldPoint.clone().addScaledVector(cameraRight, radius));
        const verticalPoint = projectToScreen(worldPoint.clone().addScaledVector(cameraUp, radius));
        return Math.max(
          4,
          Math.abs(horizontalPoint.x - centerPoint.x),
          Math.abs(verticalPoint.y - centerPoint.y),
        );
      };

      const obstacles: TopologyScreenCircle[] = [];
      const server = runtime.nodeMeshes.find((node) => node.userData.kind === "server");
      if (server) {
        const serverPosition = server.getWorldPosition(new THREE.Vector3());
        const serverScale = server.getWorldScale(new THREE.Vector3());
        const serverRadius = 0.26 * Math.max(
          Math.abs(serverScale.x),
          Math.abs(serverScale.y),
          Math.abs(serverScale.z),
        );
        const projectedServer = projectToScreen(serverPosition);
        obstacles.push({
          x: projectedServer.x,
          y: projectedServer.y,
          radius: projectedRadius(serverPosition, serverRadius),
        });
      }

      const iconItems = activeVisuals.map((visual) => {
        const nodePosition = visual.node.getWorldPosition(new THREE.Vector3());
        const nodeScale = visual.node.getWorldScale(new THREE.Vector3());
        const nodeRadius = visual.nodeBaseRadius * Math.max(
          Math.abs(nodeScale.x),
          Math.abs(nodeScale.y),
          Math.abs(nodeScale.z),
        );
        const projectedNode = projectToScreen(nodePosition);
        obstacles.push({
          x: projectedNode.x,
          y: projectedNode.y,
          radius: projectedRadius(nodePosition, nodeRadius),
        });

        const icon = visual.roleIcon as THREE.Sprite;
        const iconScale = icon.getWorldScale(new THREE.Vector3());
        const halfWidthWorld = Math.abs(iconScale.x) / 2;
        const halfHeightWorld = Math.abs(iconScale.y) / 2;
        const projectedIconRight = projectToScreen(
          nodePosition.clone().addScaledVector(cameraRight, halfWidthWorld),
        );
        const projectedIconUp = projectToScreen(
          nodePosition.clone().addScaledVector(cameraUp, halfHeightWorld),
        );
        return {
          visual,
          nodePosition,
          nodeScreen: projectedNode,
          nodeRadius: projectedRadius(nodePosition, nodeRadius),
          halfWidth: Math.max(4, Math.abs(projectedIconRight.x - projectedNode.x)),
          halfHeight: Math.max(4, Math.abs(projectedIconUp.y - projectedNode.y)),
        };
      });

      const directions = [
        { x: 1, y: 1 },
        { x: 1, y: -1 },
        { x: -1, y: 1 },
        { x: -1, y: -1 },
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];
      const distanceScales = [1, 1.22, 1.5, 1.85, 2.25];
      const frameInset = Math.max(6, Math.min(12, Math.min(width, height) * 0.018));
      const nodeGap = Math.max(4, Math.min(8, Math.min(width, height) * 0.012));
      const iconGap = 3;

      const layoutItems = iconItems
        .map((item, index) => {
          const candidates: TopologyRoleIconCandidate[] = [];
          directions.forEach((direction, directionIndex) => {
            const length = Math.hypot(direction.x, direction.y) || 1;
            const unitX = direction.x / length;
            const unitY = direction.y / length;
            const support = Math.abs(unitX) * item.halfWidth + Math.abs(unitY) * item.halfHeight;
            const baseDistance = item.nodeRadius + support + nodeGap;
            distanceScales.forEach((distanceScale, distanceIndex) => {
              const centerX = item.nodeScreen.x + unitX * baseDistance * distanceScale;
              const centerY = item.nodeScreen.y + unitY * baseDistance * distanceScale;
              candidates.push({
                centerX,
                centerY,
                rect: {
                  left: centerX - item.halfWidth,
                  top: centerY - item.halfHeight,
                  right: centerX + item.halfWidth,
                  bottom: centerY + item.halfHeight,
                },
                order: directionIndex * distanceScales.length + distanceIndex,
              });
            });
          });
          const staticValidCount = candidates.filter((candidate) =>
            topologyRectOverflow(candidate.rect, width, height, frameInset) === 0
            && !obstacles.some((obstacle) => topologyRectIntersectsCircle(candidate.rect, obstacle, iconGap)),
          ).length;
          return { item, index, candidates, staticValidCount };
        })
        // Place the most constrained icons first so later icons do not consume
        // the only free position near an edge or a dense cluster of nodes.
        .sort((first, second) =>
          first.staticValidCount - second.staticValidCount || first.index - second.index,
        );

      const placedRects: TopologyScreenRect[] = [];
      layoutItems.forEach(({ item, candidates }) => {
        const isAvailable = (candidate: TopologyRoleIconCandidate) =>
          topologyRectOverflow(candidate.rect, width, height, frameInset) === 0
          && !obstacles.some((obstacle) => topologyRectIntersectsCircle(candidate.rect, obstacle, iconGap))
          && !placedRects.some((rect) => topologyRectsOverlap(candidate.rect, rect, iconGap));
        const selectedCandidate = candidates.find(isAvailable) || candidates.reduce((best, candidate) => {
          const scoreCandidate = (current: TopologyRoleIconCandidate) => {
            let score = current.order * 0.02;
            score += topologyRectOverflow(current.rect, width, height, frameInset) * 900;
            obstacles.forEach((obstacle) => {
              if (topologyRectIntersectsCircle(current.rect, obstacle, iconGap)) {
                score += 7000;
              }
            });
            placedRects.forEach((rect) => {
              if (topologyRectsOverlap(current.rect, rect, iconGap)) {
                const overlapWidth = Math.max(
                  0,
                  Math.min(current.rect.right, rect.right) - Math.max(current.rect.left, rect.left),
                );
                const overlapHeight = Math.max(
                  0,
                  Math.min(current.rect.bottom, rect.bottom) - Math.max(current.rect.top, rect.top),
                );
                score += 9000 + overlapWidth * overlapHeight * 12;
              }
            });
            return score;
          };
          return scoreCandidate(candidate) < scoreCandidate(best) ? candidate : best;
        });
        placedRects.push(selectedCandidate.rect);

        const targetNdc = new THREE.Vector3(
          (selectedCandidate.centerX / width) * 2 - 1,
          1 - (selectedCandidate.centerY / height) * 2,
          item.nodeScreen.z,
        );
        const targetWorld = targetNdc.unproject(camera);
        const parent = item.visual.roleIcon?.parent;
        if (parent && item.visual.roleIcon) {
          item.visual.roleIcon.position.copy(parent.worldToLocal(targetWorld));
        }
      });
    };

    mount.addEventListener("pointermove", handlePointerMove);
    mount.addEventListener("pointerdown", handlePointerDown);
    mount.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("keydown", handleKeyDown);

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      runtime.globalView = calculateGlobalView(runtime.globalFramePoints, camera, new THREE.Vector3(0, 0.1, 0));
      if (!runtime.focusedRoom) {
        runtime.cameraPositionGoal.copy(runtime.globalView.cameraPosition);
        runtime.lookAtGoal.copy(runtime.globalView.lookAt);
      }
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const clock = new THREE.Clock();
    const center = new THREE.Vector3(0, 0.1, 0);
    const desiredCameraPosition = new THREE.Vector3();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const focused = Boolean(runtime.focusedRoom);
      desiredCameraPosition.copy(runtime.cameraPositionGoal);
      desiredCameraPosition.x += pointer.x * (focused ? 0.08 : 0.52);
      desiredCameraPosition.y -= pointer.y * (focused ? 0.05 : 0.22);
      camera.position.lerp(desiredCameraPosition, focused ? 0.07 : 0.045);
      runtime.lookAtCurrent.lerp(runtime.lookAtGoal, focused ? 0.08 : 0.055);
      camera.lookAt(runtime.lookAtCurrent);
      graph.rotation.y = Math.sin(elapsed * 0.16) * 0.025;
      camera.updateMatrixWorld(true);
      graph.updateMatrixWorld(true);
      updateRoleIconLayout();
      runtime.pulses.forEach((pulse) => {
        const progress = (elapsed * 0.34 + pulse.phase) % 1;
        if (progress < 0.5) {
          pulse.mesh.position.lerpVectors(pulse.source, center, progress * 2);
        } else {
          pulse.mesh.position.lerpVectors(center, pulse.target, (progress - 0.5) * 2);
        }
        const size = 0.7 + Math.sin(progress * Math.PI) * 0.55;
        pulse.mesh.scale.setScalar(size);
      });
      runtime.nodeAssociationVisuals.forEach((visual) => {
        const breath = (Math.sin(elapsed * 2.35 + visual.phase * Math.PI * 2) + 1) / 2;
        (visual.line.material as THREE.LineDashedMaterial).opacity = visual.defaultOpacity * (0.48 + breath * 0.52);
        const pulseMaterial = visual.pulse.material as THREE.SpriteMaterial;
        pulseMaterial.opacity = 0.16 + breath * 0.58;
        visual.pulse.scale.setScalar(visual.defaultPulseScale * (0.72 + breath * 0.5));
      });
      runtime.rings.forEach((ring, index) => {
        const progress = (elapsed * 0.36 + index * 0.5) % 1;
        ring.scale.setScalar(0.72 + progress * 1.5);
        (ring.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * palette.ringOpacity;
      });
      renderer.render(scene, camera);
      runtime.frameId = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(runtime.frameId);
      tooltipPinnedRef.current = false;
      resizeObserver.disconnect();
      mount.removeEventListener("pointermove", handlePointerMove);
      mount.removeEventListener("pointerdown", handlePointerDown);
      mount.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("keydown", handleKeyDown);
      disposeGraph(graph);
      glowTexture.dispose();
      roleIconTextures.forEach((texture) => texture.dispose());
      starGeometry.dispose();
      (stars.material as THREE.Material).dispose();
      grid.geometry.dispose();
      gridMaterials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      runtimeRef.current = null;
    };
  }, [palette]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    disposeGraph(runtime.graph);
    runtime.nodeMeshes = [];
    runtime.pulses = [];
    runtime.rings = [];
    runtime.roomGroups.clear();
    runtime.roomViews.clear();
    runtime.globalFramePoints = [];
    runtime.baseLinkVisuals = [];
    runtime.endpointVisuals = [];
    runtime.connectionVisuals = [];
    runtime.nodeAssociationVisuals = [];

    const center = new THREE.Vector3(0, 0.1, 0);
    const server = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, SERVER_SPHERE_SEGMENTS, SERVER_SPHERE_RINGS),
      new THREE.MeshStandardMaterial({
        color: palette.server,
        emissive: palette.serverEmissive,
        emissiveIntensity: palette.serverEmissiveIntensity,
        roughness: 0.18,
        metalness: 0.32,
      }),
    );
    server.position.copy(center);
    server.userData = { title: "P2P V2 信令服务器", note: signalBaseUrl || "当前区域", kind: "server" };
    runtime.graph.add(server);
    runtime.nodeMeshes.push(server);
    const serverGlow = makeGlow(
      runtime.glowTexture,
      palette.serverGlow,
      1.65,
      palette.glowOpacity,
      palette.additiveBlending,
    );
    serverGlow.position.copy(center);
    runtime.graph.add(serverGlow);

    for (let index = 0; index < 2; index += 1) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.31, 0.34, 48),
        new THREE.MeshBasicMaterial({
          color: palette.serverGlow,
          transparent: true,
          opacity: palette.ringOpacity,
          side: THREE.DoubleSide,
          blending: palette.additiveBlending ? THREE.AdditiveBlending : THREE.NormalBlending,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(center);
      runtime.graph.add(ring);
      runtime.rings.push(ring);
    }

    const endpointPositions = new Map<string, THREE.Vector3>();
    const roomColors = new Map<string, number>();
    const globalFramePoints: THREE.Vector3[] = [center.clone()];
    const allocatedRoomAngle = Math.min(MAX_ROOM_ARC_ANGLE, (Math.PI * 2) / Math.max(1, rooms.length));
    const roomArcAngle = rooms.length > 1
      ? Math.max(0, allocatedRoomAngle - Math.min(ROOM_ARC_GAP_ANGLE, allocatedRoomAngle * 0.12))
      : allocatedRoomAngle;
    rooms.forEach((room, roomIndex) => {
      const color = palette.roomColors[roomIndex % palette.roomColors.length];
      roomColors.set(room.room, color);
      const roomGroup = new THREE.Group();
      roomGroup.userData = { roomId: room.room };
      runtime.graph.add(roomGroup);
      runtime.roomGroups.set(room.room, roomGroup);
      const roomPoints: THREE.Vector3[] = [];
      const sortedEndpoints = [...room.endpoints].sort((a, b) =>
        Number(a.startedAtMs || Date.parse(a.startedAt || "") || 0)
          - Number(b.startedAtMs || Date.parse(b.startedAt || "") || 0)
          || a.endpointId.localeCompare(b.endpointId),
      );
      // Keep endpoints belonging to one physical node adjacent so their association
      // line stays in the outside band instead of cutting through other node links.
      const endpointsByNode = new Map<string, P2pTopologyEndpoint[]>();
      sortedEndpoints.forEach((endpoint) => {
        const nodeId = String(endpoint.nodeId || "").trim();
        const groupKey = nodeId || `__endpoint__${endpoint.endpointId}`;
        const group = endpointsByNode.get(groupKey) || [];
        group.push(endpoint);
        endpointsByNode.set(groupKey, group);
      });
      const endpoints = [...endpointsByNode.values()].flat();
      const endpointById = new Map(endpoints.map((endpoint) => [endpoint.endpointId, endpoint]));
      const roomAngle = -Math.PI / 2 + (roomIndex / Math.max(1, rooms.length)) * Math.PI * 2;
      const endpointRadius = 3.55 + Math.min(0.45, Math.max(0, endpoints.length - 4) * 0.055);
      endpoints.forEach((endpoint, endpointIndex) => {
        const offset = endpoints.length > 1
          ? -roomArcAngle / 2 + (endpointIndex / (endpoints.length - 1)) * roomArcAngle
          : 0;
        const angle = roomAngle + offset;
        const position = new THREE.Vector3(
          Math.cos(angle) * endpointRadius,
          -0.35 + ((endpointIndex + roomIndex) % 3) * 0.34,
          Math.sin(angle) * endpointRadius * 0.78,
        );
        roomPoints.push(position);
        globalFramePoints.push(position);
        endpointPositions.set(`${room.room}::${endpoint.endpointId}`, position);
        const baseLine = makeLine(position, center, color, palette.baseLineOpacity, palette.additiveBlending);
        roomGroup.add(baseLine);
        runtime.baseLinkVisuals.push({
          roomId: room.room,
          endpointId: endpoint.endpointId,
          line: baseLine,
          defaultOpacity: palette.baseLineOpacity,
        });

        const connected = (endpoint.activeConnections || []).length > 0;
        const nodeMaterial = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: connected ? palette.nodeConnectedIntensity : palette.nodeIdleIntensity,
          roughness: 0.24,
          metalness: 0.18,
        });
        const node = new THREE.Mesh(
          new THREE.SphereGeometry(
            connected ? 0.15 : 0.11,
            ENDPOINT_SPHERE_SEGMENTS,
            ENDPOINT_SPHERE_RINGS,
          ),
          nodeMaterial,
        );
        node.position.copy(position);
        const endpointConnections = room.connections
          .filter(
            (connection) =>
              connection.sourceEndpointId === endpoint.endpointId || connection.targetEndpointId === endpoint.endpointId,
          )
          .map((connection) => {
            const isSource = connection.sourceEndpointId === endpoint.endpointId;
            const counterpartId = isSource ? connection.targetEndpointId : connection.sourceEndpointId;
            const counterpart = endpointById.get(counterpartId);
            return {
              connectionId: connection.connectionId,
              counterpartLabel: counterpart?.endpointId || counterpartId,
              direction: isSource ? "发送至" : "接收自",
              status: connectionStatusLabel(connection.status),
            };
          });
        const requestedEndpointId = String(endpoint.requestedEndpointId || "").trim();
        const assignmentNote = requestedEndpointId && requestedEndpointId !== endpoint.endpointId
          ? ` · 原始端口名 ${requestedEndpointId}`
          : "";
        const nodeData = {
          title: endpoint.endpointId,
          note: `${room.room} · ${roleLabel(endpoint.role)} · ${endpoint.status || "online"}${assignmentNote}`,
          roomId: room.room,
          endpointId: endpoint.endpointId,
          nodeId: endpoint.nodeId,
          clock: endpoint.clock,
          connections: endpointConnections,
        };
        node.userData = nodeData;
        roomGroup.add(node);
        const hitTarget = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 12, 8),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        );
        hitTarget.position.copy(position);
        hitTarget.userData = nodeData;
        roomGroup.add(hitTarget);
        runtime.nodeMeshes.push(hitTarget);
        const glow = makeGlow(
          runtime.glowTexture,
          color,
          connected ? 0.86 : 0.58,
          palette.glowOpacity,
          palette.additiveBlending,
        );
        glow.position.copy(position);
        roomGroup.add(glow);
        const endpointRole = String(endpoint.role || "");
        const roleIconTexture = runtime.roleIconTextures.get(endpointRole);
        let roleIcon: THREE.Sprite | undefined;
        let roleIconScale: THREE.Vector3 | undefined;
        if (roleIconTexture) {
          const iconColor = new THREE.Color(color).lerp(new THREE.Color(0xffffff), theme === "light" ? 0.18 : 0.24);
          roleIcon = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: roleIconTexture,
              color: iconColor,
              transparent: true,
              opacity: 0.9,
              alphaTest: 0.04,
              depthWrite: false,
            }),
          );
          // The animation loop moves the icon in screen space. Keeping it on the
          // node until the first layout pass avoids a visible jump from a stale
          // camera orientation when a room is opened.
          roleIcon.position.copy(position);
          const aspect = ROLE_ICON_ASPECT_RATIOS[endpointRole] || 1;
          const iconSize = 0.22;
          roleIconScale = new THREE.Vector3(iconSize, iconSize / aspect, 1);
          roleIcon.scale.copy(roleIconScale);
          roleIcon.visible = false;
          roleIcon.renderOrder = 4;
          roomGroup.add(roleIcon);
        }
        runtime.endpointVisuals.push({
          roomId: room.room,
          endpointId: endpoint.endpointId,
          node,
          nodeBaseRadius: connected ? 0.15 : 0.11,
          hitTarget,
          glow,
          roleIcon,
          roleIconScale,
          defaultGlowScale: glow.scale.x,
          defaultEmissiveIntensity: nodeMaterial.emissiveIntensity,
        });
      });

      endpointsByNode.forEach((nodeEndpoints, groupKey) => {
        if (groupKey.startsWith("__endpoint__") || nodeEndpoints.length < 2) {
          return;
        }
        nodeEndpoints.slice(1).forEach((endpoint, index) => {
          const source = endpointPositions.get(`${room.room}::${nodeEndpoints[index].endpointId}`);
          const target = endpointPositions.get(`${room.room}::${endpoint.endpointId}`);
          if (!source || !target) {
            return;
          }
          const defaultOpacity = theme === "light" ? 0.58 : 0.72;
          const line = makeDashedLine(source, target, color, defaultOpacity);
          roomGroup.add(line);
          const pulse = makeGlow(
            runtime.glowTexture,
            color,
            0.17,
            0.52,
            palette.additiveBlending,
          );
          pulse.position.copy(source).lerp(target, 0.5);
          pulse.renderOrder = 2;
          roomGroup.add(pulse);
          runtime.nodeAssociationVisuals.push({
            line,
            pulse,
            phase: runtime.nodeAssociationVisuals.length * 0.37,
            defaultOpacity,
            defaultPulseScale: pulse.scale.x,
          });
        });
      });

      if (roomPoints.length) {
        const framePoints = [center, ...roomPoints];
        const bounds = new THREE.Box3().setFromPoints(framePoints);
        const lookAt = bounds.getCenter(new THREE.Vector3());
        const cameraDirection = new THREE.Vector3(0, 5.4, 7.4).normalize();
        const screenRight = new THREE.Vector3()
          .crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0))
          .normalize();
        const screenUp = new THREE.Vector3().crossVectors(screenRight, cameraDirection).normalize();
        const verticalFov = THREE.MathUtils.degToRad(runtime.camera.fov);
        const tanVerticalFov = Math.tan(verticalFov / 2);
        const tanHorizontalFov = tanVerticalFov * Math.max(0.5, runtime.camera.aspect);
        const requiredDistance = framePoints.reduce((distance, point) => {
          const relative = point.clone().sub(lookAt);
          const projectedWidth = Math.abs(relative.dot(screenRight)) + ROOM_FOCUS_FRAME_PADDING;
          const projectedHeight = Math.abs(relative.dot(screenUp)) + ROOM_FOCUS_FRAME_PADDING;
          const depthOffset = relative.dot(cameraDirection);
          return Math.max(
            distance,
            depthOffset + projectedWidth / tanHorizontalFov,
            depthOffset + projectedHeight / tanVerticalFov,
          );
        }, 2.25);
        const distance = requiredDistance * ROOM_FOCUS_FRAMING_SCALE;
        runtime.roomViews.set(room.room, {
          lookAt,
          cameraPosition: lookAt.clone().add(cameraDirection.multiplyScalar(distance)),
        });
      }
    });

    runtime.globalFramePoints = globalFramePoints;
    runtime.globalView = calculateGlobalView(globalFramePoints, runtime.camera, center);

    rooms.forEach((room, roomIndex) => {
      const color = roomColors.get(room.room) || palette.roomColors[roomIndex % palette.roomColors.length];
      const roomGroup = runtime.roomGroups.get(room.room);
      if (!roomGroup) {
        return;
      }
      room.connections.forEach((connection) => {
        const source = endpointPositions.get(`${room.room}::${connection.sourceEndpointId}`);
        const target = endpointPositions.get(`${room.room}::${connection.targetEndpointId}`);
        if (!source || !target) {
          return;
        }
        const connected = connection.status === "connected";
        const defaultOpacity = connected ? palette.connectedLineOpacity : palette.pendingLineOpacity;
        const lines = [
          makeLine(source, center, color, defaultOpacity, palette.additiveBlending),
          makeLine(center, target, color, defaultOpacity, palette.additiveBlending),
        ];
        lines.forEach((line) => roomGroup.add(line));
        const connectionPulses: FlowPulse[] = [];
        if (connected) {
          for (let pulseIndex = 0; pulseIndex < 3; pulseIndex += 1) {
            const pulse = new THREE.Mesh(
              new THREE.SphereGeometry(0.075, 14, 10),
              new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.98,
                blending: palette.additiveBlending ? THREE.AdditiveBlending : THREE.NormalBlending,
                depthWrite: false,
              }),
            );
            pulse.position.copy(source);
            roomGroup.add(pulse);
            const flowPulse = { mesh: pulse, source, target, phase: pulseIndex / 3 };
            runtime.pulses.push(flowPulse);
            connectionPulses.push(flowPulse);
          }
        }
        runtime.connectionVisuals.push({
          roomId: room.room,
          connectionId: connection.connectionId,
          sourceEndpointId: connection.sourceEndpointId,
          targetEndpointId: connection.targetEndpointId,
          color,
          connected,
          defaultOpacity,
          lines,
          pulses: connectionPulses,
        });
      });
    });
  }, [palette, rooms, signalBaseUrl]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    if (focusedRoom && !runtime.roomViews.has(focusedRoom)) {
      tooltipPinnedRef.current = false;
      setTooltip(null);
      setFocusedRoom(null);
      setSelectedEndpointId(null);
      setSelectedConnectionId(null);
      return;
    }
    runtime.focusedRoom = focusedRoom;
    runtime.roomGroups.forEach((group, roomId) => {
      group.visible = !focusedRoom || roomId === focusedRoom;
    });
    const roomView = focusedRoom ? runtime.roomViews.get(focusedRoom) : undefined;
    runtime.cameraPositionGoal.copy(roomView?.cameraPosition || runtime.globalView.cameraPosition);
    runtime.lookAtGoal.copy(roomView?.lookAt || runtime.globalView.lookAt);
    if (mountRef.current) {
      mountRef.current.style.cursor = focusedRoom ? "zoom-out" : "crosshair";
    }
  }, [focusedRoom, rooms, theme]);

  useEffect(() => {
    if (!focusedRoom || !selectedEndpointId) {
      return;
    }
    const room = rooms.find((item) => item.room === focusedRoom);
    if (!room?.endpoints.some((endpoint) => endpoint.endpointId === selectedEndpointId)) {
      tooltipPinnedRef.current = false;
      setTooltip(null);
      setSelectedEndpointId(null);
      setSelectedConnectionId(null);
      return;
    }
    if (
      selectedConnectionId
      && !room.connections.some(
        (connection) =>
          connection.connectionId === selectedConnectionId
          && (connection.sourceEndpointId === selectedEndpointId || connection.targetEndpointId === selectedEndpointId),
      )
    ) {
      setSelectedConnectionId(null);
    }
  }, [focusedRoom, rooms, selectedConnectionId, selectedEndpointId]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    runtime.selectedEndpointId = selectedEndpointId;
    const endpointSelectionActive = Boolean(focusedRoom && selectedEndpointId);

    runtime.baseLinkVisuals.forEach((visual) => {
      const material = visual.line.material as THREE.LineBasicMaterial;
      material.opacity = endpointSelectionActive && visual.roomId === focusedRoom ? 0.055 : visual.defaultOpacity;
    });

    runtime.connectionVisuals.forEach((visual) => {
      const relatedToEndpoint = Boolean(
        endpointSelectionActive
        && visual.roomId === focusedRoom
        && (visual.sourceEndpointId === selectedEndpointId || visual.targetEndpointId === selectedEndpointId),
      );
      const selectedConnection = Boolean(relatedToEndpoint && selectedConnectionId === visual.connectionId);
      const highlighted = selectedConnectionId ? selectedConnection : relatedToEndpoint;
      let opacity = visual.defaultOpacity;
      if (endpointSelectionActive && visual.roomId === focusedRoom) {
        opacity = highlighted ? 1 : relatedToEndpoint ? 0.13 : 0.045;
      }
      visual.lines.forEach((line) => {
        const material = line.material as THREE.LineBasicMaterial;
        material.opacity = opacity;
        material.color.set(highlighted ? palette.highlightLine : visual.color);
      });
      visual.pulses.forEach((pulse) => {
        const material = pulse.mesh.material as THREE.MeshBasicMaterial;
        material.opacity = endpointSelectionActive
          ? highlighted ? 1 : relatedToEndpoint ? 0.12 : 0.035
          : 0.98;
        material.color.set(highlighted ? palette.highlightPulse : visual.color);
      });
    });

    runtime.endpointVisuals.forEach((visual) => {
      const roomFocused = Boolean(focusedRoom && visual.roomId === focusedRoom);
      const selected = Boolean(
        endpointSelectionActive && visual.roomId === focusedRoom && visual.endpointId === selectedEndpointId,
      );
      visual.node.scale.setScalar((roomFocused ? 1.12 : 1) * (selected ? 1.16 : 1));
      visual.hitTarget.scale.setScalar(roomFocused ? 1.34 : 1);
      visual.glow.scale.setScalar(visual.defaultGlowScale * (roomFocused ? 1.3 : 1) * (selected ? 1.45 : 1));
      if (visual.roleIcon && visual.roleIconScale) {
        visual.roleIcon.visible = roomFocused;
        visual.roleIcon.scale.copy(visual.roleIconScale).multiplyScalar(selected ? 1.08 : 1);
      }
      const material = visual.node.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = selected ? Math.max(3.8, visual.defaultEmissiveIntensity) : visual.defaultEmissiveIntensity;
    });
  }, [focusedRoom, palette, rooms, selectedConnectionId, selectedEndpointId]);

  const endpointCount = rooms.reduce((total, room) => total + room.endpoints.length, 0);
  const connectionCount = rooms.reduce(
    (total, room) => total + room.connections.filter((connection) => connection.status === "connected").length,
    0,
  );
  const focusedRoomIndex = focusedRoom ? rooms.findIndex((room) => room.room === focusedRoom) : -1;
  const focusedRoomData = focusedRoomIndex >= 0 ? rooms[focusedRoomIndex] : undefined;
  const displayedEndpointCount = focusedRoomData?.endpoints.length ?? endpointCount;
  const displayedConnectionCount = focusedRoomData
    ? focusedRoomData.connections.filter((connection) => connection.status === "connected").length
    : connectionCount;
  const legendRooms = focusedRoomData
    ? [{ room: focusedRoomData, colorIndex: focusedRoomIndex % palette.roomColorCss.length }]
    : rooms.slice(0, 4).map((room, index) => ({ room, colorIndex: index }));
  return (
    <div
      className={`panel summary-card p2p-topology-card${focusedRoom ? " focused" : ""}`}
      role="region"
      aria-label={focusedRoom ? `P2P V2 房间 ${focusedRoom} 通信状态拓扑图` : "P2P V2 通信状态拓扑图"}
    >
      <div className="p2p-topology-canvas" ref={mountRef} tabIndex={0} />
      <div className="p2p-topology-header">
        <div>
          <div className="p2p-topology-kicker">P2P V2 NETWORK</div>
          <div className="p2p-topology-title">
            通信状态
            {focusedRoom ? <span>{focusedRoom}</span> : null}
          </div>
        </div>
        <div className={`p2p-topology-status${error ? " error" : displayedConnectionCount > 0 ? " live" : ""}`}>
          <span aria-hidden="true" />
          {error ? "读取失败" : `${displayedEndpointCount} 端 · ${displayedConnectionCount} 链路`}
        </div>
      </div>
      <div className="p2p-topology-footer">
        <div className="p2p-topology-legend">
          {legendRooms.map(({ room, colorIndex }) => (
            <span key={room.room}>
              <i style={{ backgroundColor: palette.roomColorCss[colorIndex] }} />
              {room.room}
            </span>
          ))}
          {!rooms.length ? <span>等待 P2P V2 端接入</span> : null}
        </div>
        <span className="p2p-topology-updated">{error || (updatedAt ? `更新 ${updatedAt}` : "同步中")}</span>
      </div>
      {tooltip ? (
        <div
          className={`p2p-topology-tooltip${tooltip.connections ? " interactive" : ""}`}
          style={{ left: tooltip.x, top: tooltip.y, width: tooltip.width }}
        >
          <div className="p2p-topology-tooltip-header">
            <strong>{tooltip.title}</strong>
            <span>{tooltip.note}</span>
            <span className={`p2p-topology-node-id${tooltip.nodeId ? "" : " missing"}`}>
              <b>Node ID</b>
              {tooltip.nodeId || "旧端未上报"}
            </span>
          </div>
          {tooltip.connections ? (
            <div className="p2p-topology-clock" aria-label="服务器时间同步状态">
              <div>
                <span>服务器时间偏差</span>
                <strong>{clockValue(tooltip.clock?.offsetMs, tooltip.clock?.status, "offset")}</strong>
              </div>
              <div>
                <span>RTT</span>
                <strong>{clockValue(tooltip.clock?.rttMs, tooltip.clock?.status, "rtt")}</strong>
              </div>
            </div>
          ) : null}
          {tooltip.connections ? (
            <div className="p2p-topology-connection-list" aria-label={`${tooltip.title} 的链路`}>
              {tooltip.connections.map((connection) => (
                <button
                  key={connection.connectionId}
                  type="button"
                  className={selectedConnectionId === connection.connectionId ? "active" : ""}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    setSelectedEndpointId(tooltip.endpointId || null);
                    setSelectedConnectionId(connection.connectionId);
                  }}
                >
                  <span className="p2p-topology-connection-main">
                    <strong>{connection.direction} {connection.counterpartLabel}</strong>
                    <em>{connection.status}</em>
                  </span>
                  <small>{connection.connectionId}</small>
                </button>
              ))}
              {!tooltip.connections.length ? (
                <div className="p2p-topology-connection-empty">暂无关联链路</div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
