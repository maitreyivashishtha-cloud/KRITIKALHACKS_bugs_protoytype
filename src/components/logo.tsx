/**
 * GharKart flower mark — six petal squares rotated 45° and arranged in a
 * hexagonal ring around a single centre square in a different colour, per
 * the team's logo concept. No straight rows: petals sit at 30°/90°/150°/
 * 210°/270°/330° so the mark reads as a blooming pixel flower.
 * Petals: blush #EAB0C8 · Centre: leaf #69D863.
 */
export function FlowerLogo({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const BOX = 80; // every box is identical, like the team spec
  const D = 95; // petal distance from the flower centre
  const C = 160; // viewBox centre

  // hexagonal ring: two petals on each diagonal + top + bottom
  const petals: [number, number][] = [
    [C, C - D], // top
    [C + D * Math.cos(Math.PI / 6), C - D * Math.sin(Math.PI / 6)], // top-right
    [C - D * Math.cos(Math.PI / 6), C - D * Math.sin(Math.PI / 6)], // top-left
    [C + D * Math.cos(Math.PI / 6), C + D * Math.sin(Math.PI / 6)], // bottom-right
    [C - D * Math.cos(Math.PI / 6), C + D * Math.sin(Math.PI / 6)], // bottom-left
    [C, C + D], // bottom
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 320 320"
      className={className}
      role="img"
      aria-label="GharKart flower logo"
    >
      {petals.map(([cx, cy]) => (
        <rect
          key={`${cx}-${cy}`}
          x={cx - BOX / 2}
          y={cy - BOX / 2}
          width={BOX}
          height={BOX}
          rx={12}
          fill="#EAB0C8"
          transform={`rotate(45 ${cx} ${cy})`}
        />
      ))}
      <rect x={C - BOX / 2} y={C - BOX / 2} width={BOX} height={BOX} rx={12} fill="#69D863" />
    </svg>
  );
}
