import type { Metadata } from "next";
import { PageIntro } from "@/components/sections/PageIntro";
import { CaseStudiesExplorer } from "@/components/sections/CaseStudiesExplorer";
import { FinalCTA } from "@/components/sections/FinalCTA";

export const metadata: Metadata = {
  title: "Case Studies",
  description: "RectaSol case-study patterns for AI operations, advisory platforms, and investment experiences.",
};

export default function CaseStudiesPage() {
  return (
    <>
      <PageIntro
        eyebrow="Case Studies"
        title="Project patterns RectaSol can adapt into stronger systems"
        description="A compact portfolio view showing how AI, service platforms, real-estate experiences, dashboards, and lead workflows can become clearer digital products."
      />
      <CaseStudiesExplorer />
      <FinalCTA />
    </>
  );
}
