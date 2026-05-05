import { Counter } from "./Counter";
import { SearchableList } from "./SearchableList";
import { VirtualList } from "./VirtualList";

export function App() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "1rem", maxWidth: 880, margin: "auto" }}>
      <h1>React demos</h1>
      <section>
        <h2>1. Updater form vs. stale closure</h2>
        <Counter />
      </section>
      <section>
        <h2>2. startTransition + filter</h2>
        <SearchableList />
      </section>
      <section>
        <h2>3. Virtualized 10k rows</h2>
        <VirtualList />
      </section>
    </main>
  );
}
