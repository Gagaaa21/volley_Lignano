import type { Metadata } from "next";
import { LiveScoreClient } from "./LiveScoreClient";

export const metadata: Metadata = {
  title: "Live score",
};

export default function LiveScorePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <LiveScoreClient />
    </div>
  );
}
