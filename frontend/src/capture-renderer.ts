import * as THREE from "three";
import URDFLoader, { URDFRobot } from "urdf-loader";

type Arm = { joints: number[]; gripper: number; fault: boolean; enabled: boolean };
type Frame = { arms: Record<string, Arm | null>; cloud_ms: number; clock_status?: string; missing: boolean };
type RenderApi = {
  ready: boolean;
  error?: string;
  setup: (options: { width: number; height: number; sides: string[] }) => void;
  fit: (frames: Frame[]) => void;
  frame: (frame: Frame) => string;
};
declare global { interface Window { captureRenderer: RenderApi } }

const scene = new THREE.Scene();
scene.background = new THREE.Color("#101012");
scene.add(new THREE.HemisphereLight(0xeef6ff, 0x303238, 3));
const key = new THREE.DirectionalLight(0xffffff, 3.6);
key.position.set(2, 4, 3);
scene.add(key);
const rim = new THREE.DirectionalLight(0x70ddd0, 2);
rim.position.set(-2, 1, -1);
scene.add(rim);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 20);
camera.position.set(1.25, 0.88, 1.65);
camera.lookAt(0, 0.3, 0);
const output = document.createElement("canvas");
output.style.cssText = "display:block;width:100%;height:100%;object-fit:contain";
document.body.append(output);
const context = output.getContext("2d")!;
const robots = new Map<string, URDFRobot>();
let sides = ["left"];

const grid = new THREE.GridHelper(1.6, 16, 0x425651, 0x23272a);
grid.position.y = -0.006;
scene.add(grid);

function setup(options: { width: number; height: number; sides: string[] }) {
  sides = options.sides;
  output.width = options.width;
  output.height = options.height;
  renderer.setSize(options.width, options.height, false);
  camera.aspect = options.width / options.height;
  camera.updateProjectionMatrix();
  for (const [side, robot] of robots) {
    robot.position.set(sides.length > 1 ? (side === "left" ? -0.4 : 0.4) : 0, 0, 0);
  }
  camera.position.set(sides.length > 1 ? 1.8 : 1.25, 0.95, sides.length > 1 ? 2.25 : 1.65);
  camera.lookAt(0, 0.3, 0);
}

function pose(frame: Frame) {
  for (const [side, robot] of robots) {
    const arm = frame.arms[side];
    robot.visible = sides.includes(side) && Boolean(arm);
    if (!arm) continue;
    for (let joint = 1; joint <= 6; joint++) {
      robot.setJointValue(`joint${joint}`, THREE.MathUtils.degToRad(arm.joints[joint - 1]));
    }
    robot.setJointValue("joint7", arm.gripper);
    robot.setJointValue("joint8", -arm.gripper);
  }
  scene.updateMatrixWorld(true);
}

function fit(frames: Frame[]) {
  const bounds = new THREE.Box3();
  for (const frame of frames) {
    pose(frame);
    for (const robot of robots.values()) {
      if (robot.visible) bounds.union(new THREE.Box3().setFromObject(robot, true));
    }
  }
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = Math.max(0.18, bounds.getSize(new THREE.Vector3()).length() / 2);
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const limitingFov = Math.min(halfFov, Math.atan(Math.tan(halfFov) * camera.aspect));
  const distance = radius / Math.sin(limitingFov) * 1.25;
  camera.position.copy(center).add(new THREE.Vector3(1.25, .85, 1.65).normalize().multiplyScalar(distance));
  camera.lookAt(center);
}

function draw(frame: Frame) {
  pose(frame);
  renderer.render(scene, camera);
  context.drawImage(renderer.domElement, 0, 0);
  const scale = output.width / 660;
  context.font = `600 ${Math.round(15 * scale)}px sans-serif`;
  context.fillStyle = "#b9c9ce";
  context.fillText("PIPER / STATE REPLAY", 18 * scale, 25 * scale);
  context.font = `${Math.round(14 * scale)}px monospace`;
  let x = 18 * scale;
  for (const side of sides) {
    const arm = frame.arms[side];
    context.fillStyle = !arm ? "#edc564" : arm.fault ? "#f47a7a" : side === "left" ? "#77d9c7" : "#b1bef3";
    const label = `${side.toUpperCase()}  ${!arm ? "NO STATE" : arm.fault ? "FAULT" : arm.enabled ? "ENABLED" : "DISABLED"}`;
    context.fillText(label, x, output.height - 15 * scale);
    x += (output.width - 36 * scale) / sides.length;
  }
  if (frame.clock_status && frame.clock_status !== "good") {
    context.textAlign = "right";
    context.fillStyle = "#edc564";
    context.fillText("CLOCK UNCERTAIN", output.width - 18 * scale, 25 * scale);
    context.textAlign = "left";
  }
  return output.toDataURL("image/png").split(",")[1];
}

window.captureRenderer = { ready: false, setup, fit, frame: draw };
const manager = new THREE.LoadingManager();
manager.onError = (url) => { window.captureRenderer.error = `Model asset failed: ${url}`; };
const loader = new URDFLoader(manager);
loader.parseCollision = false;
let model: URDFRobot | null = null;
manager.onLoad = () => {
  if (!model || window.captureRenderer.error) return;
  for (const side of ["left", "right"]) {
    const robot = model.clone() as URDFRobot;
    robot.rotation.x = -Math.PI / 2;
    Object.values(robot.joints).forEach(joint => { joint.ignoreLimits = true; });
    robot.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.material = new THREE.MeshStandardMaterial({
        color: side === "left" ? 0xc2d4d0 : 0xc5cddd,
        metalness: 0.38, roughness: 0.42,
      });
    });
    robots.set(side, robot);
    scene.add(robot);
  }
  setup({ width: 660, height: 384, sides: ["left"] });
  window.captureRenderer.ready = true;
};
loader.load("/piper/piper_description.urdf", robot => { model = robot; }, undefined,
  error => { window.captureRenderer.error = String(error); });
