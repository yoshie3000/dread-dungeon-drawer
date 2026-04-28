export function generateDysonLines(size: number, density: number): string {
  const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const epsilon = 0.01;

  for (let i = 0; i < density; i++) {
    const baseX = Math.random() * size;
    const baseY = Math.random() * size;

    // Pick one of 4 main directions (0, 45, 90, 135 degrees)
    const family = Math.floor(Math.random() * 4);
    const angle = (family * Math.PI) / 4;
    
    const Dx = Math.cos(angle);
    const Dy = Math.sin(angle);
    
    // Perpendicular vector for parallel offset
    const Px_perp = -Dy;
    const Py_perp = Dx;

    const numLinesInCluster = Math.floor(Math.random() * 5) + 2; // 2 to 6 lines
    const spacing = 3.5; // pixel spacing between parallel lines

    for (let c = 0; c < numLinesInCluster; c++) {
      const offset = (c - numLinesInCluster / 2) * spacing;
      const Px = baseX + Px_perp * offset;
      const Py = baseY + Py_perp * offset;

      let t_pos = size * 1.5;
      let t_neg = -size * 1.5;

      // Test against all existing segments in 3x3 virtual grid
      for (const seg of segments) {
        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            const Ax = seg.x1 + ox * size;
            const Ay = seg.y1 + oy * size;
            const Bx = seg.x2 + ox * size;
            const By = seg.y2 + oy * size;

            const det = Dx * (By - Ay) - Dy * (Bx - Ax);
            if (Math.abs(det) < epsilon) continue; // Parallel

            const t = ((Ax - Px) * (By - Ay) - (Ay - Py) * (Bx - Ax)) / det;
            const u = ((Ax - Px) * Dy - (Ay - Py) * Dx) / det;

            if (u >= 0 && u <= 1) {
              if (t > epsilon && t < t_pos) t_pos = t;
              if (t < -epsilon && t > t_neg) t_neg = t;
            }
          }
        }
      }

      // Now we have the segment [t_neg, t_pos]
      // Find all t values where it crosses a cell boundary
      const t_cuts: number[] = [];
      t_cuts.push(t_neg);
      t_cuts.push(t_pos);

      // Crossings for X boundaries
      if (Math.abs(Dx) > epsilon) {
        const minK = Math.floor((Px + t_neg * Dx) / size) - 1;
        const maxK = Math.ceil((Px + t_pos * Dx) / size) + 1;
        for (let k = minK; k <= maxK; k++) {
          const t = (k * size - Px) / Dx;
          if (t > t_neg + epsilon && t < t_pos - epsilon) {
            t_cuts.push(t);
          }
        }
      }

      // Crossings for Y boundaries
      if (Math.abs(Dy) > epsilon) {
        const minK = Math.floor((Py + t_neg * Dy) / size) - 1;
        const maxK = Math.ceil((Py + t_pos * Dy) / size) + 1;
        for (let k = minK; k <= maxK; k++) {
          const t = (k * size - Py) / Dy;
          if (t > t_neg + epsilon && t < t_pos - epsilon) {
            t_cuts.push(t);
          }
        }
      }

      // Sort cuts
      t_cuts.sort((a, b) => a - b);

      // Fold each sub-segment into the main tile
      for (let j = 0; j < t_cuts.length - 1; j++) {
        const ts = t_cuts[j];
        const te = t_cuts[j + 1];
        if (te - ts < epsilon) continue;

        const t_mid = (ts + te) / 2;
        const P_mid_x = Px + t_mid * Dx;
        const P_mid_y = Py + t_mid * Dy;

        const cellX = Math.floor(P_mid_x / size);
        const cellY = Math.floor(P_mid_y / size);

        const offset_x = cellX * size;
        const offset_y = cellY * size;

        segments.push({
          x1: Px + ts * Dx - offset_x,
          y1: Py + ts * Dy - offset_y,
          x2: Px + te * Dx - offset_x,
          y2: Py + te * Dy - offset_y,
        });
      }
    }
  }

  // Generate SVG Path
  let pathStr = '';
  for (const seg of segments) {
    pathStr += `M ${seg.x1.toFixed(2)} ${seg.y1.toFixed(2)} L ${seg.x2.toFixed(2)} ${seg.y2.toFixed(2)} `;
  }

  return pathStr.trim();
}
