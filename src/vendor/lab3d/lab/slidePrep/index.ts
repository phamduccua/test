/**
 * Làm tiêu bản + kính hiển vi bằng tay (Sinh 10: TN-061-01, TN-061-02, TN-119-01, TN-119-02; rút từ TN-062-01 / TN-071-01 / TN-109-01):
 * nhỏ giọt lên lam, đậy lamen nghiêng 45° rồi hạ từ từ, hơ cố định qua lửa, xịt rửa bằng bình rửa, lấy nét / đổi vật kính.
 * Mỗi helper chỉ gói cử chỉ + hình; trạng thái tiêu bản, bước quy trình, âm do sim nối qua hook.
 */
export { bottleDropper, createSlideDropper, type DropperKit, type SlideDropperOptions, type SlideDropTarget } from './slideDropper';
export { coverHinge, coverPose, createCoverSlipLowering, type CoverSlipLowering, type CoverSlipOptions } from './coverSlip';
export { createFlamePass, type FlamePass, type FlamePassOptions } from './flamePass';
export { createWashSquirt, type WashSquirt, type WashSquirtOptions } from './washSquirt';
export { createFocusModel, type FocusHooks, type FocusKnob, type FocusModel, type FocusSpec } from './focusModel';
export { findScopeParts, type ScopeParts } from './scopeParts';
export { createScopeControls, type ScopeControls, type ScopeControlsOptions } from './scopeControls';
export { createScopeDock, type ScopeDock, type ScopeDockOptions } from './scopeDock';
export { createSlidePrepSfx, slidePrepLoops, SLIDE_PREP_PRELOAD, type SlidePrepSfx } from './sfx';
export { createLoopTool, type LoopTool, type LoopToolOptions } from './loopTool';
export { createLampTap, type LampTap, type LampTapOptions } from './lampTap';
export { createSwabTool, type SwabSpot, type SwabTool, type SwabToolOptions } from './swabTool';
export { createSlideScope, SCOPE_DOF, SCOPE_WD, type SlideScope, type SlideScopeOptions } from './slideScope';
