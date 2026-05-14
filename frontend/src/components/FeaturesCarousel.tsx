import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

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
  const [itemsPerView, setItemsPerView] = useState(3);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle responsive items per view
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setItemsPerView(1);
      } else if (window.innerWidth < 1024) {
        setItemsPerView(2);
      } else {
        setItemsPerView(3);
      }
    };

    handleResize(); // Set initial value
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
      className="relative w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Carousel Container */}
      <div className="overflow-hidden">
        <motion.div
          ref={containerRef}
          className="flex gap-6"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {visibleSlides.map((item, idx) => {
            const Icon = item.icon;
            const widthClass = itemsPerView === 1 ? "w-full" : itemsPerView === 2 ? "w-1/2" : "w-1/3";
            return (
              <motion.div
                key={`${currentIndex}-${idx}`}
                className={`flex-shrink-0 ${widthClass}`}
                layout
                transition={{ duration: 0.5, ease: "easeInOut" }}
              >
                <motion.div
                  className="h-full rounded-2xl p-6 md:p-8 backdrop-blur-xl transition-all duration-300 cursor-pointer group"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderColor: item.accent + "30",
                  }}
                  whileHover={{
                    y: -12,
                    boxShadow: `0 20px 40px ${item.accent}20`,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Icon Badge */}
                  <motion.div
                    className="inline-flex p-3 rounded-xl mb-4 transition-all duration-300"
                    style={{
                      background: `${item.accent}15`,
                      border: `1px solid ${item.accent}30`,
                    }}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                  >
                    <Icon className="h-6 w-6" style={{ color: item.accent }} />
                  </motion.div>

                  {/* Tag */}
                  <span
                    className="inline-block text-xs font-semibold tracking-widest uppercase mb-3 px-2 py-1 rounded-full"
                    style={{
                      background: `${item.accent}15`,
                      color: item.accent,
                    }}
                  >
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
                  <motion.div
                    className="absolute bottom-0 left-0 h-1 rounded-tr-2xl"
                    style={{ background: item.accent }}
                    initial={{ width: 0 }}
                    whileHover={{ width: "100%" }}
                    transition={{ duration: 0.4 }}
                  />
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Navigation Dots */}
      <div className="flex justify-center gap-2 mt-8">
        {items.map((_, idx) => (
          <motion.button
            key={idx}
            onClick={() => goToSlide(idx)}
            className="h-2 rounded-full transition-all duration-300"
            animate={{
              width: currentIndex === idx ? 24 : 8,
              background: currentIndex === idx ? "#00A4EF" : "#E0E0E0",
            }}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.95 }}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>

      {/* Navigation Arrows (Desktop only) */}
      <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 left-0 right-0 justify-between px-4 pointer-events-none">
        <motion.button
          onClick={prevSlide}
          className="pointer-events-auto p-3 rounded-full bg-white/80 hover:bg-white text-[#1C1C1C] shadow-lg transition-all hover:scale-110 opacity-0 group-hover:opacity-100"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Previous slide"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </motion.button>

        <motion.button
          onClick={nextSlide}
          className="pointer-events-auto p-3 rounded-full bg-white/80 hover:bg-white text-[#1C1C1C] shadow-lg transition-all hover:scale-110 opacity-0 group-hover:opacity-100"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Next slide"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </motion.button>
      </div>

      {/* Pause indicator */}
      {isHovered && (
        <motion.div
          className="text-center text-xs text-[#1C1C1C60] mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          Auto-scroll paused
        </motion.div>
      )}
    </div>
  );
};

export default FeaturesCarousel;
