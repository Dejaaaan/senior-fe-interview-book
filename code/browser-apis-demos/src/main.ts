import { openDB } from "idb";

// IndexedDB
const db = await openDB("app", 1, {
  upgrade(db) {
    db.createObjectStore("drafts", { keyPath: "id" });
  },
});

const draftsList = document.querySelector<HTMLUListElement>("#drafts")!;

async function refreshDrafts() {
  draftsList.innerHTML = "";
  for (const draft of (await db.getAll("drafts")) as { id: string; text: string }[]) {
    const li = document.createElement("li");
    li.textContent = draft.text;
    draftsList.appendChild(li);
  }
}

document.querySelector<HTMLButtonElement>("#save")!.addEventListener("click", async () => {
  const input = document.querySelector<HTMLInputElement>("#draft")!;
  if (!input.value) return;
  await db.put("drafts", { id: crypto.randomUUID(), text: input.value });
  input.value = "";
  await refreshDrafts();
});

await refreshDrafts();

// BroadcastChannel
const channel = new BroadcastChannel("demo");
const msg = document.querySelector<HTMLParagraphElement>("#msg")!;
channel.addEventListener("message", (e) => {
  msg.textContent = `Received at ${new Date().toLocaleTimeString()}: ${String(e.data)}`;
});
document.querySelector<HTMLButtonElement>("#ping")!.addEventListener("click", () => {
  channel.postMessage("hello from another tab");
});

// IntersectionObserver "load more"
const list = document.querySelector<HTMLUListElement>("#list")!;
const sentinel = document.querySelector<HTMLDivElement>("#sentinel")!;
let page = 0;

function appendPage() {
  for (let i = 0; i < 10; i++) {
    const li = document.createElement("li");
    li.className = "item";
    li.textContent = `Item ${page * 10 + i + 1}`;
    list.appendChild(li);
  }
  page++;
}

appendPage();

const io = new IntersectionObserver(
  (entries) => {
    if (entries[0]?.isIntersecting) appendPage();
  },
  { rootMargin: "200px" },
);
io.observe(sentinel);
