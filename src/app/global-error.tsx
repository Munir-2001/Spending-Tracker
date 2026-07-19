"use client";

import { useEffect } from "react";

/**
 * Root error boundary — replaces the whole document (including the root layout)
 * when an error escapes it, so it ships its own <html>/<body> with inline styles
 * (app CSS may not be available). Never renders the error detail.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error", error.digest);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0e0d0b",
          color: "#f6f1e7",
        }}
      >
        <div style={{ textAlign: "center", padding: "0 1.5rem", maxWidth: 420 }}>
          <h2 style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: "0.875rem", opacity: 0.7, margin: "0 0 1.25rem" }}>
            An unexpected error occurred. It&apos;s been logged — please try again.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1.1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#f6f1e7",
              color: "#0e0d0b",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
