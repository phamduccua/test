/**
 * Thư viện toạ độ phân tử (Å). Dựng bằng z-matrix theo độ dài liên kết/góc thực nghiệm
 * (NIST CCCBDB, khớp hình học PubChem 3D): đúng tứ diện, phẳng, thẳng, góc gãy.
 */
import type { MoleculeData } from './types';
import { centered, fromZMatrix, type ZRow } from './zmatrix';
import { labText } from '../../text';

function mol(id: string, name: string, formula: string, shape: string, source: string, rows: ZRow[]): MoleculeData {
  const { atoms, bonds } = fromZMatrix(rows);
  return { id, name, formula, shape, source, atoms: centered(atoms), bonds };
}

const diatomic = (id: string, name: string, f: string, a: string, b: string, r: number, order: 1 | 2 | 3 = 1) =>
  mol(id, name, f, labText('t_052c15112389'), labText('t_ed91c51f90c3'), [{ el: a }, { el: b, to: 0, r, order }]);

const TET = 109.471;

export const MOLECULES: Record<string, MoleculeData> = {
  H2: diatomic('H2', 'hydrogen', 'H₂', 'H', 'H', 0.741),
  O2: diatomic('O2', 'oxygen', 'O₂', 'O', 'O', 1.208, 2),
  N2: diatomic('N2', 'nitrogen', 'N₂', 'N', 'N', 1.098, 3),
  HCl: diatomic('HCl', 'hydrogen chloride', 'HCl', 'H', 'Cl', 1.275),
  Cl2: diatomic('Cl2', 'chlorine', 'Cl₂', 'Cl', 'Cl', 1.988),
  H2O: mol('H2O', 'water', 'H₂O', labText('t_7c9483495a1a'), 'PubChem CID 962', [
    { el: 'O' }, { el: 'H', to: 0, r: 0.958 }, { el: 'H', to: 0, r: 0.958, at: 1, angle: 104.5 },
  ]),
  CO2: mol('CO2', 'carbon dioxide', 'CO₂', labText('t_0ed07d7edee8'), 'PubChem CID 280', [
    { el: 'C' }, { el: 'O', to: 0, r: 1.16, order: 2 }, { el: 'O', to: 0, r: 1.16, at: 1, angle: 180, order: 2 },
  ]),
  NH3: mol('NH3', 'ammonia', 'NH₃', labText('t_8c36d7cbc9f1'), 'PubChem CID 222', [
    { el: 'N' }, { el: 'H', to: 0, r: 1.012 }, { el: 'H', to: 0, r: 1.012, at: 1, angle: 106.7 },
    { el: 'H', to: 0, r: 1.012, at: 1, angle: 106.7, dt: 2, dih: 113.8 },
  ]),
  CH4: mol('CH4', 'methane', 'CH₄', labText('t_3c0ec359e80d'), 'PubChem CID 297', [
    { el: 'C' }, { el: 'H', to: 0, r: 1.087 }, { el: 'H', to: 0, r: 1.087, at: 1, angle: TET },
    { el: 'H', to: 0, r: 1.087, at: 1, angle: TET, dt: 2, dih: 120 },
    { el: 'H', to: 0, r: 1.087, at: 1, angle: TET, dt: 2, dih: -120 },
  ]),
  C2H4: mol('C2H4', 'ethene', 'C₂H₄', labText('t_4fea188cb730'), 'PubChem CID 6325', [
    { el: 'C' }, { el: 'C', to: 0, r: 1.339, order: 2 },
    { el: 'H', to: 0, r: 1.087, at: 1, angle: 121.3 }, { el: 'H', to: 0, r: 1.087, at: 1, angle: 121.3, dt: 2, dih: 180 },
    { el: 'H', to: 1, r: 1.087, at: 0, angle: 121.3, dt: 2, dih: 0 }, { el: 'H', to: 1, r: 1.087, at: 0, angle: 121.3, dt: 2, dih: 180 },
  ]),
  C2H2: mol('C2H2', 'ethyne', 'C₂H₂', labText('t_0ed07d7edee8'), 'PubChem CID 6326', [
    { el: 'C' }, { el: 'C', to: 0, r: 1.203, order: 3 },
    { el: 'H', to: 0, r: 1.063, at: 1, angle: 180 }, { el: 'H', to: 1, r: 1.063, at: 0, angle: 180 },
  ]),
  C2H5OH: mol('C2H5OH', 'ethanol', 'C₂H₅OH', labText('t_7f78a3249abf'), 'PubChem CID 702', [
    { el: 'C' }, { el: 'C', to: 0, r: 1.512 }, { el: 'O', to: 1, r: 1.431, at: 0, angle: 107.8 },
    { el: 'H', to: 2, r: 0.971, at: 1, angle: 108.9, dt: 0, dih: 180 },
    { el: 'H', to: 1, r: 1.094, at: 0, angle: 110.4, dt: 2, dih: 119.5 }, { el: 'H', to: 1, r: 1.094, at: 0, angle: 110.4, dt: 2, dih: -119.5 },
    { el: 'H', to: 0, r: 1.093, at: 1, angle: 110.5, dt: 2, dih: 180 }, { el: 'H', to: 0, r: 1.093, at: 1, angle: 110.5, dt: 2, dih: 60 },
    { el: 'H', to: 0, r: 1.093, at: 1, angle: 110.5, dt: 2, dih: -60 },
  ]),
  CH3COOH: mol('CH3COOH', 'ethanoic acid', 'CH₃COOH', labText('t_26aa24805522'), 'PubChem CID 176', [
    { el: 'C' }, { el: 'C', to: 0, r: 1.501 }, { el: 'O', to: 1, r: 1.214, at: 0, angle: 126.1, order: 2 },
    { el: 'O', to: 1, r: 1.364, at: 0, angle: 111.4, dt: 2, dih: 180 },
    { el: 'H', to: 3, r: 0.97, at: 1, angle: 106.5, dt: 2, dih: 0 },
    { el: 'H', to: 0, r: 1.09, at: 1, angle: 109.5, dt: 2, dih: 0 }, { el: 'H', to: 0, r: 1.09, at: 1, angle: 109.5, dt: 2, dih: 120 },
    { el: 'H', to: 0, r: 1.09, at: 1, angle: 109.5, dt: 2, dih: -120 },
  ]),
  H2O2: mol('H2O2', 'hydrogen peroxide', 'H₂O₂', labText('t_17fb782aaec4'), 'PubChem CID 784', [
    { el: 'O' }, { el: 'O', to: 0, r: 1.475 }, { el: 'H', to: 0, r: 0.95, at: 1, angle: 94.8 },
    { el: 'H', to: 1, r: 0.95, at: 0, angle: 94.8, dt: 2, dih: 111.5 },
  ]),
  SO4: mol('SO4', 'sulfate', 'SO₄²⁻', labText('t_908d64cb57cd'), labText('t_fed8d171bbde'), [
    { el: 'S' }, { el: 'O', to: 0, r: 1.49 }, { el: 'O', to: 0, r: 1.49, at: 1, angle: TET },
    { el: 'O', to: 0, r: 1.49, at: 1, angle: TET, dt: 2, dih: 120 },
    { el: 'O', to: 0, r: 1.49, at: 1, angle: TET, dt: 2, dih: -120 },
  ]),
  S2O3: mol('S2O3', 'thiosulfate', 'S₂O₃²⁻', labText('t_4533b13fe400'), labText('t_8990d50df1c5'), [
    { el: 'S' }, { el: 'S', to: 0, r: 2.01 }, { el: 'O', to: 0, r: 1.47, at: 1, angle: TET },
    { el: 'O', to: 0, r: 1.47, at: 1, angle: TET, dt: 2, dih: 120 },
    { el: 'O', to: 0, r: 1.47, at: 1, angle: TET, dt: 2, dih: -120 },
  ]),
  SO2: mol('SO2', 'sulfur dioxide', 'SO₂', labText('t_baef5b52b601'), 'PubChem CID 1119', [
    { el: 'S' }, { el: 'O', to: 0, r: 1.432, order: 2 }, { el: 'O', to: 0, r: 1.432, at: 1, angle: 119.3, order: 2 },
  ]),
};

export function getMolecule(id: string): MoleculeData {
  const m = MOLECULES[id];
  if (!m) throw new Error(`${labText('t_4d1cd2745f93')}${id}`);
  return m;
}
