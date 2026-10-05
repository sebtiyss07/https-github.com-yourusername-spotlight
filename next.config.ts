import type { NextConfig } from "next";

const config: NextConfig = {
  async redirects() {
    return [
      // The site's home is www.spotlightkt.com; the old Vercel address forwards there.
      {
        source: "/:path*",
        has: [{ type: "host", value: "spotlight-steel.vercel.app" }],
        destination: "https://www.spotlightkt.com/:path*",
        permanent: true,
      },
      // The Europa League isn't covered any more.
      { source: "/leagues/europa-league", destination: "/", permanent: false },
      // "Big events" only ever listed Formula 1 weekends, which the F1 page shows.
      { source: "/events", destination: "/leagues/formula-1", permanent: false },
    ];
  },
};

export default config;
