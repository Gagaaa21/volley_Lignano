import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Il manuale dello Scout legge dal disco le sue schermate, i font e lo stemma:
  // si dice a Next di portarli nelle funzioni che generano il PDF (quella per
  // lo staff e quella pubblica, da condividere).
  outputFileTracingIncludes: {
    "/api/scout/manuale": ["src/assets/pdf/**/*", "src/assets/fonts/**/*"],
    "/manuale-scout.pdf": ["src/assets/pdf/**/*", "src/assets/fonts/**/*"],
  },
};

export default nextConfig;
