/** Định dạng dữ liệu phân tử (thuần). Toạ độ theo Å. */
export interface MolAtom {
  el: string;
  x: number;
  y: number;
  z: number;
}

export type BondOrder = 1 | 2 | 3;

export interface MolBond {
  a: number;
  b: number;
  order: BondOrder;
}

export interface MoleculeData {
  id: string;
  /** Tên theo SGK (vd. "methane"). */
  name: string;
  /** Công thức hiển thị có chỉ số dưới (vd. "CH₄"). */
  formula: string;
  atoms: MolAtom[];
  bonds: MolBond[];
  /** Mô tả hình học (tiếng Việt), vd. "tứ diện đều". */
  shape?: string;
  /** Nguồn toạ độ (PubChem CID / dựng theo VSEPR). */
  source?: string;
}
