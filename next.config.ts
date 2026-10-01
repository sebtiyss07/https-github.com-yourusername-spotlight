import type { NextConfig } from "next";

const config: NextConfig = {
  // "Big events" only ever listed Formula 1 weekends, which the F1 page shows.
  async redirects() {
    return [{ source: "/events", destination: "/leagues/formula-1", permanent: false }];
  },
};

export default config;
