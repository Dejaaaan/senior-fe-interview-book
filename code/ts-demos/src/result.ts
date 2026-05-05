// Discriminated union + exhaustive narrowing.
// Run: pnpm --filter ts-demos demo:result

export type Result<T, E = Error> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: E };

export function render<T>(r: Result<T>): string {
  switch (r.status) {
    case "idle":
      return "Click to load";
    case "loading":
      return "Loading...";
    case "success":
      return `Loaded: ${JSON.stringify(r.data)}`;
    case "error":
      return `Error: ${r.error.message}`;
    default: {
      const _exhaustive: never = r;
      throw new Error(`Unhandled state: ${String(_exhaustive)}`);
    }
  }
}

const examples: Result<{ name: string }>[] = [
  { status: "idle" },
  { status: "loading" },
  { status: "success", data: { name: "Ada" } },
  { status: "error", error: new Error("network down") },
];

for (const r of examples) {
  console.log(render(r));
}
