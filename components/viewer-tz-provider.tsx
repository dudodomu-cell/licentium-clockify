"use client";

import { createContext, useContext } from "react";

// Carries the viewer's timezone down to all client components inside a tree
// (rooted in app/layout.tsx). Server pages read the cookie via
// getViewerTz() directly; this context is for the client side.

const ViewerTzContext = createContext<string>("Europe/Kyiv");

export function ViewerTzProvider({
  tz,
  children,
}: {
  tz: string;
  children: React.ReactNode;
}) {
  return (
    <ViewerTzContext.Provider value={tz}>{children}</ViewerTzContext.Provider>
  );
}

export function useViewerTz(): string {
  return useContext(ViewerTzContext);
}
