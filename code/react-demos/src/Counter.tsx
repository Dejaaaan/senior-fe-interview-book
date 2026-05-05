import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);

  function incTwiceStale() {
    setCount(count + 1);
    setCount(count + 1); // ❌ both reads see the same `count`
  }

  function incTwiceCorrect() {
    setCount((c) => c + 1);
    setCount((c) => c + 1); // ✅ each call sees the latest
  }

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={incTwiceStale}>+2 (stale)</button>{" "}
      <button onClick={incTwiceCorrect}>+2 (correct)</button>
    </div>
  );
}
