import Image from "next/image";
import { Badge } from "@/components/ui/badge";

export function ProjectCover({
  image,
  title,
  category,
  status,
}: {
  image: string;
  title: string;
  category: string;
  status: string;
}) {
  return (
    <div className="relative h-full min-h-64 overflow-hidden rounded-lg bg-recta-muted">
      <Image src={image} alt={title} fill className="object-cover" sizes="(min-width: 1024px) 50vw, 100vw" />
      <div className="absolute inset-0 bg-gradient-to-t from-recta-ink/70 via-transparent to-transparent" />
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
        <Badge className="bg-white/90">{category}</Badge>
        <Badge className="bg-white/90">{status}</Badge>
      </div>
    </div>
  );
}
