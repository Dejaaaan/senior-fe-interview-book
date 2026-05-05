import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// NestJS relies on `emitDecoratorMetadata` so that its dependency-injection
// container can read constructor parameter types (`TasksService` etc.) at
// runtime via `reflect-metadata`. Vitest's default esbuild transformer does
// not emit that metadata, so DI silently breaks: providers come back as
// `undefined` and any controller method that touches an injected service
// throws `Cannot read properties of undefined`.
//
// SWC, configured here through `unplugin-swc`, is the same compiler the
// `@nestjs/cli` uses out of the box for dev/build, so swapping vitest onto
// SWC keeps test-time and build-time semantics identical without dragging
// in `ts-jest` or a custom Babel pipeline.
export default defineConfig({
  test: {
    globals: false,
    include: ["src/**/*.{test,spec}.ts"],
  },
  plugins: [
    swc.vite({
      module: { type: "es6" },
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: "es2022",
      },
    }),
  ],
});
