import { createRoot } from "react-dom/client";
import { onLCP, onINP, onCLS, onTTFB } from "web-vitals";
import { App } from "./App";

function logMetric(metric: { name: string; value: number; rating: string }) {
  console.log(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(1)} (${metric.rating})`);
}

onLCP(logMetric);
onINP(logMetric);
onCLS(logMetric);
onTTFB(logMetric);

createRoot(document.getElementById("root")!).render(<App />);
