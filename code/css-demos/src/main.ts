const html = document.documentElement;
const stored = localStorage.getItem("theme");
if (stored === "dark" || stored === "light") html.dataset["theme"] = stored;

document.querySelector<HTMLButtonElement>("#theme-toggle")?.addEventListener("click", () => {
  const next = html.dataset["theme"] === "dark" ? "light" : "dark";
  html.dataset["theme"] = next;
  localStorage.setItem("theme", next);
});
