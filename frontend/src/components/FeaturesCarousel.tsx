import { useState, useEffect } from "react";
import { LucideIcon } from "lucide-react";

const accentClassMap: Record<string, string> = {
  "#00A4EF": "accent-blue",
  "#0FB881": "accent-green",
  "#FF6B35": "accent-orange",
};

const getItemsPerView = () => {
  if (typeof window === "undefined") return 3;
  if (window.innerWidth < 768) return 1;
  if (window.innerWidth < 1024) return 2;
  return 3;
};

interface CarouselItem {
  tag: string;
  headline: string;
  body: string;
  icon: LucideIcon;
  accent: string;
}

interface FeaturesCarouselProps {
  items: CarouselItem[];
}

const FeaturesCarousel = ({ items }: FeaturesCarouselProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(() => getItemsPerView());

  // Handle responsive items per view
  useEffect(() => {
    let animationFrameId: number | null = null;

    const handleResize = () => {
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        setItemsPerView(getItemsPerView());
      });
    };

    handleResize(); // Set initial value
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (isHovered) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000); // 5 seconds between auto-scroll

    return () => clearInterval(interval);
  }, [isHovered, items.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const getVisibleSlides = () => {
    const slides = [];

    for (let i = 0; i < itemsPerView; i++) {
      slides.push(items[(currentIndex + i) % items.length]);
    }
    return slides;
  };

  const visibleSlides = getVisibleSlides();

  return (
    <div
      className="relative w-full min-h-[320px]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Carousel Container */}
      <div className="overflow-hidden">
        <div className="flex gap-6">
          {visibleSlides.map((item, idx) => {
            const Icon = item.icon;
            const accentClass = accentClassMap[item.accent] || "accent-blue";
            const widthClass = itemsPerView === 1 ? "w-full" : itemsPerView === 2 ? "w-1/2" : "w-1/3";
            return (
              <div
                key={`${currentIndex}-${idx}`}
                className={`flex-shrink-0 ${widthClass}`}
              >
                <div
                  className={`relative h-full rounded-2xl p-6 md:p-8 backdrop-blur-xl transition-all duration-300 cursor-pointer group border border-white/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.05)_100%)] ${accentClass}`}
                >
                  {/* Icon Badge */}
                  <div className={`inline-flex p-3 rounded-xl mb-4 transition-all duration-300 accent-card ${accentClass}`}>
                    <Icon className="h-6 w-6 accent-icon" />
                  </div>

                  {/* Tag */}
                  <span className={`inline-block text-xs font-semibold tracking-widest uppercase mb-3 px-2 py-1 rounded-full accent-badge ${accentClass}`}>
                    {item.tag}
                  </span>

                  {/* Title */}
                  <h3 className="text-xl md:text-2xl font-bold text-[#0A0E27] mb-3 leading-tight">
                    {item.headline.replace(/\n/g, " ")}
                  </h3>

                  {/* Body */}
                  <p className="text-sm md:text-base text-[#1C1C1C80] leading-relaxed font-light">
                    {item.body}
                  </p>

                  {/* Hover Accent Line */}
                  <div className={`absolute bottom-0 left-0 h-1 rounded-tr-2xl accent-line ${accentClass}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Dots */}
      <div className="flex justify-center gap-2 mt-8">
        {items.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goToSlide(idx)}
            className={`h-2 rounded-full transition-all duration-300 ${currentIndex === idx ? "w-6 bg-[#00A4EF]" : "w-2 bg-[#E0E0E0]"}`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>

      <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 left-0 right-0 justify-between px-4 pointer-events-none">
        <button
          onClick={prevSlide}
          className="pointer-events-auto p-3 rounded-full bg-white/80 hover:bg-white text-[#1C1C1C] shadow-lg transition-all hover:scale-110 opacity-0 group-hover:opacity-100"
          aria-label="Previous slide"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={nextSlide}
          className="pointer-events-auto p-3 rounded-full bg-white/80 hover:bg-white text-[#1C1C1C] shadow-lg transition-all hover:scale-110 opacity-0 group-hover:opacity-100"
          aria-label="Next slide"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {isHovered && (
        <div className="text-center text-xs text-[#1C1C1C60] mt-2 opacity-100 transition-opacity duration-300">
          Auto-scroll paused
        </div>
      )}
    </div>
  );
};

export default FeaturesCarousel;
