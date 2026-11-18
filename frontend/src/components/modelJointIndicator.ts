import * as THREE from "three";
import type { JointControl } from "./modelArticulation";

export function movingPartCenter(part: THREE.Object3D, bounds: THREE.Box3) {
  const center = new THREE.Vector3();
  let mass = 0;
  part.traverse(object => {
    const inertia = object.userData.inertia as { center: number[]; mass: number } | undefined;
    if (!inertia) return;
    center.addScaledVector(object.localToWorld(new THREE.Vector3().fromArray(inertia.center)), inertia.mass);
    mass += inertia.mass;
  });
  return mass > 0 ? center.divideScalar(mass) : bounds.isEmpty() ? part.getWorldPosition(center) : bounds.getCenter(center);
}

export class ModelJointIndicator extends THREE.Group {
  private slide = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, 0x14b8a6);
  private rotationMarker = new THREE.Group();
  private material = new THREE.MeshBasicMaterial({ color: 0x14b8a6, side: THREE.DoubleSide, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
  private arc = new THREE.Mesh(new THREE.TorusGeometry(1, .035, 8, 64, Math.PI * 1.5), this.material);
  private head = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(.28, -1, 0), new THREE.Vector3(-.10, -.82, 0), new THREE.Vector3(-.10, -1.18, 0),
  ]), this.material);
  private anchor = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), this.material);
  private extension = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineDashedMaterial({ color: 0x14b8a6, transparent: true, opacity: .65, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));

  constructor() {
    super();
    this.visible = false;
    // A flat tip in the arc plane stays arrow-shaped when viewed along its tangent.
    this.rotationMarker.add(this.arc, this.head);
    this.add(this.slide, this.rotationMarker, this.extension, this.anchor);
    this.traverse(object => { object.renderOrder = 10; });
    for (const object of [this.slide.line, this.slide.cone]) {
      const material = object.material as THREE.LineBasicMaterial | THREE.MeshBasicMaterial;
      material.depthTest = false; material.depthWrite = false; material.fog = false; material.toneMapped = false;
    }
  }

  update(joint: JointControl, origin: THREE.Group, part: THREE.Group, radius: number, value: number) {
    origin.updateWorldMatrix(true, true);
    const pivot = origin.getWorldPosition(new THREE.Vector3());
    const orientation = origin.getWorldQuaternion(new THREE.Quaternion());
    const localAxis = new THREE.Vector3().fromArray(joint.axis).normalize();
    const axis = localAxis.clone().applyQuaternion(orientation);
    const bounds = new THREE.Box3().setFromObject(part);
    const sliding = joint.type === "prismatic";
    this.slide.visible = this.anchor.visible = sliding;
    this.rotationMarker.visible = this.extension.visible = !sliding;
    if (sliding) {
      this.slide.position.copy(movingPartCenter(part, bounds));
      this.slide.setDirection(axis);
      this.slide.setLength(radius * .3, radius * .065, radius * .032);
      this.anchor.position.copy(this.slide.position);
      this.anchor.scale.setScalar(radius * .011);
      return;
    }
    // Put the arc beyond the moving part along its axis, preferring the upper end.
    const outward = axis.clone().multiplyScalar(axis.y < -.2 ? -1 : 1);
    let distance = 0;
    if (!bounds.isEmpty()) for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        distance = Math.max(distance, new THREE.Vector3(x, y, z).sub(pivot).dot(outward));
      }
    }
    this.rotationMarker.position.copy(pivot).addScaledVector(outward, distance + radius * .09);
    this.rotationMarker.quaternion.copy(orientation)
      .multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), localAxis))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), value));
    this.rotationMarker.scale.setScalar(radius * .12);
    const positions = this.extension.geometry.getAttribute("position") as THREE.BufferAttribute;
    positions.setXYZ(0, pivot.x, pivot.y, pivot.z);
    positions.setXYZ(1, this.rotationMarker.position.x, this.rotationMarker.position.y, this.rotationMarker.position.z);
    positions.needsUpdate = true;
    this.extension.geometry.computeBoundingSphere();
    this.extension.computeLineDistances();
    this.extension.material.dashSize = radius * .025;
    this.extension.material.gapSize = radius * .018;
  }

  dispose() {
    this.slide.dispose(); this.arc.geometry.dispose(); this.head.geometry.dispose(); this.anchor.geometry.dispose();
    this.extension.geometry.dispose(); this.extension.material.dispose(); this.material.dispose();
  }
}
