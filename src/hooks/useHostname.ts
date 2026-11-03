"use client";

import { useEffect, useState } from "react";

export function useHostname() {
  const [hostname, setHostname] = useState<string | null>(null);
  useEffect(() => setHostname(window.location.hostname), []);
  return hostname;
}
