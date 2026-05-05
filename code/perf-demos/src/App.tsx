import { lazy, Suspense, useState } from "react";

const HeavyChart = lazy(() => import("./HeavyChart"));

export function App() {
  const [showChart, setShowChart] = useState(false);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "1rem", maxWidth: 720, margin: "auto" }}>
      <h1>Perf demos</h1>
      <p>Open the console to see Web Vitals as they fire.</p>

      <h2>Lazy-loaded chart (component-level splitting)</h2>
      {!showChart ? (
        <button onClick={() => setShowChart(true)}>Load chart</button>
      ) : (
        <Suspense fallback={<p>Loading chart bundle…</p>}>
          <HeavyChart />
        </Suspense>
      )}
    </main>
  );
}
