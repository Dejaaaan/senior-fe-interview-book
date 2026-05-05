import { setup, assign } from "xstate";

export const uploadMachine = setup({
  types: {} as {
    context: {
      progress: number;
      url: string | null;
      error: string | null;
      retries: number;
    };
    events:
      | { type: "PICK"; file: File }
      | { type: "PROGRESS"; progress: number }
      | { type: "DONE"; url: string }
      | { type: "FAIL"; error: string }
      | { type: "RETRY" }
      | { type: "RESET" };
  },
  guards: {
    canRetry: ({ context }) => context.retries < 3,
  },
}).createMachine({
  id: "upload",
  initial: "idle",
  context: { progress: 0, url: null, error: null, retries: 0 },
  states: {
    idle: { on: { PICK: "uploading" } },
    uploading: {
      on: {
        PROGRESS: {
          actions: assign({ progress: ({ event }) => event.progress }),
        },
        DONE: {
          target: "success",
          actions: assign({ url: ({ event }) => event.url }),
        },
        FAIL: {
          target: "error",
          actions: assign({
            error: ({ event }) => event.error,
            retries: ({ context }) => context.retries + 1,
          }),
        },
      },
    },
    error: {
      on: {
        RETRY: { target: "uploading", guard: "canRetry" },
        RESET: {
          target: "idle",
          actions: assign({ progress: 0, url: null, error: null, retries: 0 }),
        },
      },
    },
    success: {
      on: {
        RESET: {
          target: "idle",
          actions: assign({ progress: 0, url: null, error: null, retries: 0 }),
        },
      },
    },
  },
});
