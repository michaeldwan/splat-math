/** Drawn rather than typed, so they look the same whatever the font has. */
export const Times = () => (
  <svg className="times" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 5l14 14M19 5L5 19" />
  </svg>
);

export const Backspace = () => (
  <svg className="icon" viewBox="0 0 32 24" aria-hidden="true">
    <path d="M11 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H11l-8-9z" />
    <path d="M15 8.5l7 7M22 8.5l-7 7" />
  </svg>
);

export const Back = () => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 12H4.5M11 5.5L4.5 12l6.5 6.5" />
  </svg>
);

export const Gear = () => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2.2" />
    <circle cx="9" cy="17" r="2.2" />
  </svg>
);
