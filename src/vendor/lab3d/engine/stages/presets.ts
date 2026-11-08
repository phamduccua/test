import * as THREE from 'three';
import { DEFAULT_CAMERA_POS, DEFAULT_TARGET } from '../cameraRig';
import { createRoomEnvironment } from '../environment';
import { createLandscapeEnvironment } from './landscapeEnvironment';
import { createSkyEnvironment } from './skyEnvironment';
import { createLabStudioEnvironment } from './labStudioEnvironment';
import type { SharedEnvName, StageKind, StagePreset } from './types';

export const STAGE_PRESETS: Record<StageKind, StagePreset> = {
  lab: {
    kind: 'lab',
    createEnvironment: createRoomEnvironment,
    background: null,
    environmentIntensity: 1,
    camera: { fov: 45, position: DEFAULT_CAMERA_POS, target: DEFAULT_TARGET, near: 0.05, far: 200 },
  },
  globe: {
    kind: 'globe',
    createEnvironment: createSkyEnvironment,
    background: 0x03060d,
    environmentIntensity: 0.6,
    camera: { fov: 40, position: new THREE.Vector3(0, 1.1, 4.4), target: new THREE.Vector3(0, 0, 0), near: 0.01, far: 500 },
  },
  landscape: {
    kind: 'landscape',
    createEnvironment: createLandscapeEnvironment,
    background: 0x9fc0e0,
    environmentIntensity: 0.8,
    exposure: 0.6,
    camera: { fov: 50, position: new THREE.Vector3(0, 45, 120), target: new THREE.Vector3(0, 0, 0), near: 0.5, far: 6000 },
  },
};

export function stagePreset(kind: StageKind | undefined): StagePreset {
  return STAGE_PRESETS[kind ?? 'lab'] ?? STAGE_PRESETS.lab;
}

const SHARED_ENVIRONMENTS: Record<SharedEnvName, (renderer: THREE.WebGLRenderer) => THREE.Texture> = {
  'lab-studio': createLabStudioEnvironment,
};

/** Hàm dựng env map cho một kiểu sân khấu hoặc env phụ có tên. */
export function environmentFactory(key: StageKind | SharedEnvName): (renderer: THREE.WebGLRenderer) => THREE.Texture {
  return key in SHARED_ENVIRONMENTS ? SHARED_ENVIRONMENTS[key as SharedEnvName] : stagePreset(key as StageKind).createEnvironment;
}
