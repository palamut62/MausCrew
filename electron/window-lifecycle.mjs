export function shouldHideWindowOnClose({ quitRequested, trayAvailable }) {
  return trayAvailable && !quitRequested;
}
