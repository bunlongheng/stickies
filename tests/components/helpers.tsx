// Shared setup + helpers for component tests (React Testing Library + jsdom).
//
// Every component test file MUST start with the docblock:
//     // @vitest-environment jsdom
// and import from this module so jest-dom matchers are registered and the DOM
// is cleaned between tests. The node-env API/lib tests never import this, so
// they stay on the lightweight node environment.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());

export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
