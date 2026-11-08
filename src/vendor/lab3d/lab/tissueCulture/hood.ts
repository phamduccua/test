import type { Tracker } from '../types';
import { createBiosafetyCabinet, type BiosafetyCabinet, type BiosafetyCabinetOptions } from '../equipment/biosafetyCabinet';

/**
 * A-TU-CAY: tủ cấy vô trùng (laminar) – tên cũ, giữ cho sim đang dùng. Bản chuẩn: `createBiosafetyCabinet` (@lab/equipment/biosafetyCabinet),
 * có thêm kính chắn trượt, dải màu nhận diện, đèn UV chiếu sáng, vách tôn.
 */
export type LaminarHood = BiosafetyCabinet;

export function createLaminarHood(ctx: Tracker, o: BiosafetyCabinetOptions = {}): LaminarHood {
  return createBiosafetyCabinet(ctx, o);
}
