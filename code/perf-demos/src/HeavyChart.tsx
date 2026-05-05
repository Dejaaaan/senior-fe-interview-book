// Pretend this file pulls in a heavy charting library.
// In a real app, this would be Chart.js, recharts, victory, etc.

const points = Array.from({ length: 200 }, (_, i) => ({
  x: i,
  y: Math.sin(i / 10) * 50 + 50 + Math.random() * 10,
}));

export default function HeavyChart() {
  return (
    <svg viewBox="0 0 200 100" style={{ width: "100%", border: "1px solid #ccc" }}>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        points={points.map((p) => `${p.x},${100 - p.y}`).join(" ")}
      />
    </svg>
  );
}
