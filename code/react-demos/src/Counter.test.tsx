import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Counter } from "./Counter";
import { describe, expect, it } from "vitest";

describe("Counter", () => {
  it("the stale form increments by 1", async () => {
    const user = userEvent.setup();
    render(<Counter />);
    await user.click(screen.getByRole("button", { name: /\+2 \(stale\)/i }));
    expect(screen.getByText(/Count: 1/)).toBeInTheDocument();
  });

  it("the correct form increments by 2", async () => {
    const user = userEvent.setup();
    render(<Counter />);
    await user.click(screen.getByRole("button", { name: /\+2 \(correct\)/i }));
    expect(screen.getByText(/Count: 2/)).toBeInTheDocument();
  });
});
