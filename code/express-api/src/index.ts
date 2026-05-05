import { buildApp } from "./server.js";

const port = Number(process.env["PORT"] ?? 3000);
buildApp().listen(port, () => console.log(`express-api listening on :${port}`));
