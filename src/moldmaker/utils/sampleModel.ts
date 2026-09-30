// Sirpam 3D Labs Mold — built-in demo: a small mushroom (stem + cap).
// The cap overhangs the stem, which shows off the undercut heatmap and why
// the split height matters.
import * as THREE from 'three';

// Half-profile (radius, height) in mm, spun around the vertical axis.
const MUSHROOM: Array<[number, number]> = [
  [0, 0], [5, 0],            // flat base
  [5, 10],                   // stem
  [12, 10], [12, 15],        // cap underside (undercut) and rim
  [10, 17], [6, 19], [0, 20] // domed top
];

export function createSampleModel(): { geometry: THREE.BufferGeometry; fileName: string } {
  const geometry = new THREE.LatheGeometry(MUSHROOM.map(([r, h]) => new THREE.Vector2(r, h)), 48);
  geometry.center();
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
  return { geometry, fileName: 'sample-mushroom.stl' };
}
