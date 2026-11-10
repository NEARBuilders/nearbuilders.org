// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

afterEach(cleanup);

describe("Tooltip", () => {
  it("mounts without an explicit TooltipProvider", () => {
    const { container } = render(
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button">Trigger</button>
        </TooltipTrigger>
        <TooltipContent>Helpful text</TooltipContent>
      </Tooltip>,
    );

    expect(container.textContent).toContain("Trigger");
  });
});
