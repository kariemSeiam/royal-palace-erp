"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";

export function ProductGallery({
  name,
  images,
}: {
  name: string;
  images: string[];
}) {
  const gallery = useMemo(() => {
    const unique: string[] = [];
    for (const image of images) {
      if (typeof image === "string" && image.trim() && !unique.includes(image.trim())) {
        unique.push(image.trim());
      }
    }
    return unique;
  }, [images]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });

  const activeImage = gallery[activeIndex] || null;

  function goPrev() {
    setActiveIndex((prev) => (prev === 0 ? gallery.length - 1 : prev - 1));
  }

  function goNext() {
    setActiveIndex((prev) => (prev === gallery.length - 1 ? 0 : prev + 1));
  }

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    setZoomPosition({
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y)),
    });
  }

  useEffect(() => {
    if (!lightboxOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxOpen, gallery.length]);

  if (gallery.length === 0) {
    return (
      <div className="overflow-hidden rounded-[32px] bg-white shadow-soft">
        <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 text-slate-400">
          لا توجد صورة
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="overflow-hidden rounded-[32px] bg-white shadow-soft">
          <div
            className="group relative aspect-[4/3] overflow-hidden bg-slate-100"
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setZoomActive(true)}
            onMouseLeave={() => setZoomActive(false)}
          >
            <img
              src={activeImage || ""}
              alt={name}
              className={`h-full w-full object-cover transition duration-300 ${
                zoomActive ? "scale-[1.75]" : "scale-100"
              }`}
              style={{
                transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
              }}
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-royal-navy shadow">
                {activeIndex + 1} / {gallery.length}
              </span>

              <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-royal-navy shadow">
                <ZoomIn size={14} />
                تكبير
              </span>
            </div>

            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="absolute inset-0 z-[1]"
              aria-label="فتح الصورة بحجم أكبر"
            />

            {gallery.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute right-4 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-royal-navy shadow transition hover:bg-white"
                  aria-label="الصورة السابقة"
                >
                  <ChevronRight size={18} />
                </button>

                <button
                  type="button"
                  onClick={goNext}
                  className="absolute left-4 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-royal-navy shadow transition hover:bg-white"
                  aria-label="الصورة التالية"
                >
                  <ChevronLeft size={18} />
                </button>
              </>
            ) : null}
          </div>
        </div>

        {gallery.length > 1 ? (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
            {gallery.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                  index === activeIndex
                    ? "border-royal-gold ring-2 ring-royal-gold/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="aspect-square bg-slate-100">
                  <img
                    src={image}
                    alt={`${name} ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {lightboxOpen ? (
        <div className="fixed inset-0 z-[100] bg-black/90 p-4">
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-royal-navy shadow"
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>

          <div className="flex h-full items-center justify-center">
            <div className="relative w-full max-w-6xl">
              <div className="overflow-hidden rounded-[24px] bg-white/5">
                <img
                  src={activeImage || ""}
                  alt={name}
                  className="max-h-[85vh] w-full object-contain"
                />
              </div>

              {gallery.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    className="absolute right-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-royal-navy shadow"
                    aria-label="الصورة السابقة"
                  >
                    <ChevronRight size={20} />
                  </button>

                  <button
                    type="button"
                    onClick={goNext}
                    className="absolute left-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-royal-navy shadow"
                    aria-label="الصورة التالية"
                  >
                    <ChevronLeft size={20} />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
