import { Badge } from "@/components/ui/badge";

export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="relative overflow-hidden pt-32 mesh-bg">
      <div className="absolute inset-0 grid-paper opacity-50" aria-hidden="true" />
      <div className="container-page relative z-10 py-16 text-center sm:py-20">
        <Badge>{eyebrow}</Badge>
        <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-black leading-tight text-recta-ink sm:text-6xl">{title}</h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-recta-slate">{description}</p>
      </div>
    </section>
  );
}
