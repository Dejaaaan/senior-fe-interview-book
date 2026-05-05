import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

const rows = Array.from({ length: 10_000 }, (_, i) => `Row ${i + 1}`);

export function VirtualList() {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 8,
  });

  return (
    <div
      ref={parentRef}
      style={{ height: 400, overflow: "auto", border: "1px solid #ccc" }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((v) => (
          <div
            key={v.key}
            style={{
              position: "absolute",
              top: v.start,
              height: v.size,
              width: "100%",
              padding: "0 0.5rem",
              borderBottom: "1px solid #eee",
            }}
          >
            {rows[v.index]}
          </div>
        ))}
      </div>
    </div>
  );
}
