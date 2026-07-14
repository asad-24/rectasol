"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ProjectGallery({ images, title }: { images: string[]; title: string }) {
  const galleryKey = `${title}:${images.join("|")}`;
  const [galleryState, setGalleryState] = useState({ key: galleryKey, activeIndex: 0, open: false });
  const activeIndex = galleryState.key === galleryKey ? galleryState.activeIndex : 0;
  const open = galleryState.key === galleryKey ? galleryState.open : false;
  const activeImage = images[activeIndex] ?? images[0];

  const setActiveIndex = (nextIndex: number | ((current: number) => number)) => {
    setGalleryState((current) => {
      const currentIndex = current.key === galleryKey ? current.activeIndex : 0;
      return {
        key: galleryKey,
        activeIndex: typeof nextIndex === "function" ? nextIndex(currentIndex) : nextIndex,
        open: current.key === galleryKey ? current.open : false,
      };
    });
  };

  const setOpen = (nextOpen: boolean) => {
    setGalleryState((current) => ({
      key: galleryKey,
      activeIndex: current.key === galleryKey ? current.activeIndex : 0,
      open: nextOpen,
    }));
  };

  const next = () => setActiveIndex((current) => (current + 1) % images.length);
  const previous = () => setActiveIndex((current) => (current - 1 + images.length) % images.length);

  if (!images.length) {
    return null;
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg border border-recta-ink/10 bg-recta-muted shadow-xl">
        <div className="relative aspect-[16/10]">
          <Image src={activeImage} alt={`${title} gallery image`} fill className="object-cover" sizes="100vw" priority />
        </div>
        <div className="absolute bottom-4 right-4 flex gap-2">
          <Button type="button" variant="light" size="icon" onClick={previous} aria-label="Previous image">
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" variant="light" size="icon" onClick={next} aria-label="Next image">
            <ChevronRight className="size-4" />
          </Button>
          <Button type="button" variant="light" size="icon" onClick={() => setOpen(true)} aria-label="Open gallery">
            <Expand className="size-4" />
          </Button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {images.map((image, index) => (
          <button
            key={`${image}-${index}`}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`relative aspect-[4/3] overflow-hidden rounded-md border ${index === activeIndex ? "border-recta-orange" : "border-recta-ink/10"}`}
          >
            <Image src={image} alt={`${title} thumbnail ${index + 1}`} fill className="object-cover" sizes="160px" />
          </button>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl bg-recta-ink p-3 text-white">
          <DialogTitle className="sr-only">{title} gallery</DialogTitle>
          <DialogDescription className="sr-only">Expanded project image gallery.</DialogDescription>
          <div className="relative aspect-[16/10] overflow-hidden rounded-md bg-black">
            <Image src={activeImage} alt={`${title} expanded gallery image`} fill className="object-contain" sizes="100vw" />
          </div>
          <div className="flex items-center justify-between px-2 pb-1 text-sm font-semibold text-white/62">
            <span>
              {activeIndex + 1} / {images.length}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="light" size="icon" onClick={previous} aria-label="Previous image">
                <ChevronLeft className="size-4" />
              </Button>
              <Button type="button" variant="light" size="icon" onClick={next} aria-label="Next image">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
