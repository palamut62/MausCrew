import assert from "node:assert/strict";
import test from "node:test";

import { shouldHideWindowOnClose } from "./window-lifecycle.mjs";

test("the window hides while the tray owns the app lifecycle", () => {
  assert.equal(shouldHideWindowOnClose({ quitRequested: false, trayAvailable: true }), true);
});

test("a tray quit or updater quit closes the window", () => {
  assert.equal(shouldHideWindowOnClose({ quitRequested: true, trayAvailable: true }), false);
});

test("closing still exits when a tray cannot be created", () => {
  assert.equal(shouldHideWindowOnClose({ quitRequested: false, trayAvailable: false }), false);
});
