import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Il manuale dello Scout legge dal disco le sue schermate, i font e lo stemma:
  // si dice a Next di portarli nella funzione che genera il PDF.
  outputFileTracingIncludes: {
    "/api/scout/manuale": ["src/assets/pdf/**/*", "src/assets/fonts/**/*"],
  },
};

export default nextConfig;
