import { StrictMode, useLayoutEffect, useRef } from "react";
import { App } from "./App";
import { fx } from "./fx/ink";

export function Game() {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!root.current) return;
    fx.mount(root.current);
    // Words drawn on the canvas need the font loaded before they first appear.
    void document.fonts.load('64px "Bagel Fat One"');
    return () => fx.unmount();
  }, []);

  return (
    <div id="root" ref={root}>
      <StrictMode>
        <App />
      </StrictMode>
    </div>
  );
}
