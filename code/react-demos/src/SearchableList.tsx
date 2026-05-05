import { useMemo, useState, useTransition } from "react";

const items = Array.from({ length: 20_000 }, (_, i) => ({ id: i, title: `Item ${i}` }));

export function SearchableList() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(items);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    setQuery(next);
    startTransition(() => {
      setResults(items.filter((i) => i.title.includes(next)));
    });
  }

  const visible = useMemo(() => results.slice(0, 50), [results]);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Filter 20k items"
        style={{ padding: "0.5rem", width: "100%" }}
      />
      <p>{isPending ? "Updating…" : `${results.length} matches`}</p>
      <ul>{visible.map((i) => <li key={i.id}>{i.title}</li>)}</ul>
    </div>
  );
}
