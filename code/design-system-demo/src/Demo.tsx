import { useMachine } from "@xstate/react";
import { useEffect } from "react";
import { Button } from "./Button";
import { uploadMachine } from "./UploadMachine";

export function Demo() {
  const [snapshot, send] = useMachine(uploadMachine);

  useEffect(() => {
    if (!snapshot.matches("uploading")) return;
    let progress = snapshot.context.progress;
    const interval = setInterval(() => {
      progress += 20;
      if (progress >= 100) {
        clearInterval(interval);
        // Fail roughly half the time, succeed otherwise.
        if (Math.random() < 0.5) {
          send({ type: "DONE", url: "https://example.com/files/demo.pdf" });
        } else {
          send({ type: "FAIL", error: "Upload failed (network)" });
        }
      } else {
        send({ type: "PROGRESS", progress });
      }
    }, 250);
    return () => clearInterval(interval);
  }, [snapshot, send]);

  return (
    <main style={{ maxWidth: 480, marginInline: "auto" }}>
      <h1>Design system + XState demo</h1>

      {snapshot.matches("idle") && (
        <Button
          variant="primary"
          onClick={() => send({ type: "PICK", file: new File([], "demo.pdf") })}
        >
          Pick a file
        </Button>
      )}

      {snapshot.matches("uploading") && (
        <p>Uploading: {snapshot.context.progress}%</p>
      )}

      {snapshot.matches("success") && (
        <>
          <p>Uploaded! <a href={snapshot.context.url ?? "#"}>Open</a></p>
          <Button variant="secondary" onClick={() => send({ type: "RESET" })}>
            Upload another
          </Button>
        </>
      )}

      {snapshot.matches("error") && (
        <>
          <p role="alert">{snapshot.context.error}</p>
          {snapshot.can({ type: "RETRY" }) && (
            <Button variant="primary" onClick={() => send({ type: "RETRY" })}>
              Retry ({3 - snapshot.context.retries} left)
            </Button>
          )}{" "}
          <Button variant="ghost" onClick={() => send({ type: "RESET" })}>
            Cancel
          </Button>
        </>
      )}
    </main>
  );
}
