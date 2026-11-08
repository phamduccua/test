/** Bàn tay & đồ để bàn (kit dùng chung, không phụ thuộc sim): bàn tay/găng, đồng hồ, đồng hồ đếm giờ, lịch, dây cáp/ống mềm, bút, nhãn dán, sổ ghi chép. */
export { createHand, type Hand, type HandOptions, type HandAnchor, type HandPose, type ThumbMode } from './hand';
export { GLOVE_COLORS, SKIN_TONE, type GloveKind } from './handMaterial';
export { createClock, type LabClock, type ClockOptions } from './clock';
export { createDeskTimer, hms, type DeskTimer, type DeskTimerOptions } from './timer';
export { createDeskCalendar, type DeskCalendar, type DeskCalendarOptions, type CalendarState } from './calendar';
export { createCable, sagPoints, type Cable, type CableKind, type CableOptions } from './cable';
export { createPen, type Pen, type PenOptions } from './pen';
export { createSticker, type Sticker, type StickerOptions } from './sticker';
export { createLabNotebook, type LabNotebook, type LabNotebookOptions } from './notebook';
