import { Workbox } from "workbox-window";

const status = document.getElementById("status")!;

if ("serviceWorker" in navigator) {
  const wb = new Workbox("/sw.js");

  wb.addEventListener("activated", (event) => {
    status.textContent = event.isUpdate
      ? "Service worker updated and activated."
      : "Service worker installed; offline ready.";
  });

  wb.addEventListener("waiting", () => {
    status.textContent = "New version waiting. Refresh to activate.";
  });

  wb.register().catch((err) => {
    status.textContent = `Registration failed: ${(err as Error).message}`;
  });
}
