import * as THREE from "three";
import type { ModelView, ViewJoint } from "../api/modelLibrary";

export type JointControl = ViewJoint & { min: number; max: number; reason?: string };

export function createArticulation(manifest: ModelView, content: THREE.Group) {
  const nodes = new Map<string, THREE.Group>();
  const origins = new Map<string, THREE.Group>();
  for (const node of manifest.nodes) {
    const origin = new THREE.Group(), motion = new THREE.Group();
    origin.position.fromArray(node.xyz);
    origin.rotation.set(node.rpy[0], node.rpy[1], node.rpy[2], "ZYX");
    origin.add(motion);
    if (node.center_of_mass && node.mass && node.mass > 0) {
      motion.userData.inertia = { center: node.center_of_mass, mass: node.mass };
    }
    origins.set(node.name, origin); nodes.set(node.name, motion);
  }
  for (const node of manifest.nodes) (node.parent ? nodes.get(node.parent)! : content).add(origins.get(node.name)!);

  const joints: JointControl[] = (manifest.joints || []).map(joint => ({
    ...joint, min: joint.lower ?? -Infinity, max: joint.upper ?? Infinity, reason: joint.disabled_reason,
  }));
  const byName = new Map(joints.map(joint => [joint.name, joint]));
  const values = new Map<string, number>();
  // Intersect a driver's range with every dependent limit; preserve the exact mimic relation.
  for (const joint of joints) {
    if (!joint.mimic || joint.reason) continue;
    let current = joint, multiplier = 1, offset = 0;
    const seen = new Set([joint.name]);
    while (current.mimic) {
      offset += multiplier * current.mimic.offset;
      multiplier *= current.mimic.multiplier;
      const parent = byName.get(current.mimic.joint);
      if (!parent || seen.has(parent.name) || parent.reason) { joint.reason = "关节联动不可用"; break; }
      seen.add(parent.name); current = parent;
    }
    if (joint.reason) continue;
    if (multiplier === 0) {
      if (offset < joint.min || offset > joint.max) current.reason = "联动关节范围冲突";
    } else {
      const bounds = [(joint.min - offset) / multiplier, (joint.max - offset) / multiplier].sort((a, b) => a - b);
      current.min = Math.max(current.min, bounds[0]); current.max = Math.min(current.max, bounds[1]);
      if (current.min > current.max) current.reason = "联动关节范围冲突";
    }
  }
  function value(name: string): number { return values.get(name) ?? 0; }
  function apply() {
    const resolved = new Set<string>();
    function update(joint: JointControl) {
      if (resolved.has(joint.name)) return;
      resolved.add(joint.name);
      if (joint.reason) return;
      if (joint.mimic) {
        const source = byName.get(joint.mimic.joint)!;
        update(source);
        if (source.reason) return;
        values.set(joint.name, value(source.name) * joint.mimic.multiplier + joint.mimic.offset);
      }
      const motion = nodes.get(joint.child);
      if (!motion) return;
      const axis = new THREE.Vector3().fromArray(joint.axis).normalize();
      motion.position.set(0, 0, 0); motion.quaternion.identity();
      if (joint.type === "prismatic") motion.position.copy(axis).multiplyScalar(value(joint.name));
      else motion.quaternion.setFromAxisAngle(axis, value(joint.name));
    }
    joints.forEach(update);
    content.updateWorldMatrix(true, true);
  }
  function setValue(name: string, requested: number) {
    const joint = byName.get(name);
    if (!joint || joint.reason || joint.mimic || !Number.isFinite(requested)) return;
    values.set(name, THREE.MathUtils.clamp(requested, joint.min, joint.max)); apply();
  }
  function reset() {
    for (const joint of joints) values.set(joint.name, joint.reason ? 0 : THREE.MathUtils.clamp(0, joint.min, joint.max));
    apply();
  }
  return { nodes, origins, joints, value, setValue, reset };
}
