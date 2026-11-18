import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import * as THREE from 'three';

const require = createRequire(import.meta.url);
const source = await readFile(new URL('../src/components/modelArticulation.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const threeUrl = pathToFileURL(require.resolve('three').replace('three.cjs', 'three.module.js')).href;
const { createArticulation } = await import('data:text/javascript;base64,' + Buffer.from(compiled.replace('"three"', JSON.stringify(threeUrl))).toString('base64'));
const markerSource = await readFile(new URL('../src/components/modelJointIndicator.ts', import.meta.url), 'utf8');
const markerCode = ts.transpileModule(markerSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { ModelJointIndicator, movingPartCenter } = await import('data:text/javascript;base64,' + Buffer.from(markerCode.replace('"three"', JSON.stringify(threeUrl))).toString('base64'));
const node = (name, parent, xyz = [0, 0, 0], rpy = [0, 0, 0]) => ({ name, parent, xyz, rpy });
const hinge = (name, child, extra = {}) => ({ name, child, parent: 'base', type: 'revolute', axis: [0, 0, 1], lower: -Math.PI, upper: Math.PI, ...extra });
function close(actual, expected) { actual.forEach((n, i) => assert.ok(Math.abs(n - expected[i]) < 1e-8, `${actual} != ${expected}`)); }

test('joint origin rotation precedes local motion; nested slide follows hinge', () => {
  const root = new THREE.Group();
  const rig = createArticulation({ nodes: [node('base', null), node('door', 'base', [1, 2, 3], [0, Math.PI / 2, 0]), node('drawer', 'door', [1, 0, 0])],
    joints: [hinge('hinge', 'door'), hinge('slide', 'drawer', { type: 'prismatic', axis: [1, 0, 0], lower: 0, upper: .5 })] }, root);
  rig.reset(); rig.setValue('hinge', Math.PI / 2); rig.setValue('slide', .3);
  close(rig.nodes.get('door').getWorldPosition(new THREE.Vector3()).toArray(), [1, 2, 3]);
  close(rig.nodes.get('drawer').getWorldPosition(new THREE.Vector3()).toArray(), [1, 3.3, 3]);
  rig.setValue('slide', 100); assert.equal(rig.value('slide'), .5);
  rig.setValue('hinge', -100); assert.equal(rig.value('hinge'), -Math.PI);
  rig.setValue('hinge', NaN); assert.equal(rig.value('hinge'), -Math.PI);
  rig.reset(); assert.equal(rig.value('hinge'), 0); assert.equal(rig.value('slide'), 0);
});

test('negative/chained mimic bounds constrain driver without breaking coupling', () => {
  const rig = createArticulation({ nodes: ['base', 'a', 'b', 'c'].map(name => node(name, name === 'base' ? null : 'base')),
    joints: [hinge('a', 'a'), hinge('b', 'b', { lower: -.4, upper: .4, mimic: { joint: 'a', multiplier: -2, offset: .2 } }),
      hinge('c', 'c', { lower: 0, upper: .2, mimic: { joint: 'b', multiplier: 1, offset: .1 } })] }, new THREE.Group());
  rig.reset(); rig.setValue('a', 5);
  close([rig.value('a'), rig.value('b'), rig.value('c')], [.15, -.1, 0]);
  rig.setValue('b', 1); close([rig.value('b')], [-.1]);
  rig.setValue('a', -5); close([rig.value('a'), rig.value('b'), rig.value('c')], [.05, .1, .2]);
});

test('continuous joint, legacy rigid manifest and invalid joint fallback', () => {
  const rig = createArticulation({ nodes: [node('base', null), node('wheel', 'base')],
    joints: [hinge('wheel', 'wheel', { type: 'continuous', lower: null, upper: null })] }, new THREE.Group());
  rig.setValue('wheel', Math.PI * 5); assert.equal(rig.value('wheel'), Math.PI * 5);
  assert.equal(createArticulation({ nodes: [] }, new THREE.Group()).joints.length, 0);
  const bad = createArticulation({ nodes: [node('base', null)], joints: [hinge('bad', 'base', { disabled_reason: 'missing limits' })] }, new THREE.Group());
  bad.setValue('bad', 2); assert.equal(bad.value('bad'), 0);
});

test('slide marker follows offset geometry and native center of mass through parent rotation', () => {
  const root = new THREE.Group(); root.rotation.x = -Math.PI / 2;
  const rig = createArticulation({ nodes: [node('base', null), node('drawer', 'base', [1, 2, 3], [0, 0, Math.PI / 2])],
    joints: [hinge('slide', 'drawer', { type: 'prismatic', axis: [1, 0, 0], lower: 0, upper: 1 })] }, root);
  const part = rig.nodes.get('drawer'), mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1));
  mesh.position.set(2, 0, 0); part.add(mesh); rig.reset();
  const marker = new ModelJointIndicator(), slide = marker.children.find(object => object instanceof THREE.ArrowHelper);
  marker.update(rig.joints[0], rig.origins.get('drawer'), part, 2, 0);
  close(slide.position.toArray(), part.localToWorld(new THREE.Vector3(2, 0, 0)).toArray());
  const start = slide.position.clone(); rig.setValue('slide', .4);
  marker.update(rig.joints[0], rig.origins.get('drawer'), part, 2, .4);
  close(slide.position.clone().sub(start).toArray(), [0, 0, -.4]);
  part.userData.inertia = { center: [1, 0, 0], mass: 2 };
  close(movingPartCenter(part, new THREE.Box3().setFromObject(part)).toArray(), part.localToWorld(new THREE.Vector3(1, 0, 0)).toArray());
  marker.dispose(); mesh.geometry.dispose(); mesh.material.dispose();
});

test('rotation marker is an arc beyond the part on the transformed native axis', () => {
  const root = new THREE.Group(); root.rotation.x = -Math.PI / 2;
  const rig = createArticulation({ nodes: [node('base', null), node('door', 'base')], joints: [hinge('hinge', 'door', { axis: [0, 0, -1] })] }, root);
  const part = rig.nodes.get('door'), mesh = new THREE.Mesh(new THREE.BoxGeometry(1, .1, 2)); part.add(mesh); rig.reset();
  const marker = new ModelJointIndicator(); marker.update(rig.joints[0], rig.origins.get('door'), part, 2, 0);
  assert.equal(marker.children.find(object => object instanceof THREE.ArrowHelper).visible, false);
  const arc = marker.children.find(object => object.type === 'Group');
  assert.ok(arc.position.y > new THREE.Box3().setFromObject(part).max.y);
  close([arc.position.x, arc.position.z], [0, 0]);
  close(new THREE.Vector3(0, 0, 1).applyQuaternion(arc.quaternion).toArray(), [0, -1, 0]);
  assert.ok(arc.children.some(object => object.geometry.type === 'TorusGeometry'));
  marker.dispose(); mesh.geometry.dispose(); mesh.material.dispose();
});
