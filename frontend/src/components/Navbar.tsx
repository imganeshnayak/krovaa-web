import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import { motion, AnimatePresence } from "framer-motion";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <nav
        className={`sticky top-0 z-50 border-b transition-all duration-300 ${
          isScrolled
            ? "border-[#E0E0E0] backdrop-blur-3xl bg-white/70 shadow-lg"
            : "border-[#E0E0E0] backdrop-blur-md bg-white/80 shadow-none"
        } h-20 flex items-center`}
      >
        <div className="w-full flex items-center justify-between px-4 md:px-8">
          <Link to="/" className="flex items-center group shrink-0 hover:opacity-75 transition-opacity duration-200">
            <div className="flex items-center gap-1">
              <Logo size="lg" theme="dark" className="origin-left" />
              <div className="hidden sm:flex h-6 w-1 bg-gradient-to-b from-[#00A4EF] to-[#007BB5] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-8 text-sm font-medium text-[#1C1C1C60]">
            <a
              href="#how"
              className="hover:text-[#00A4EF] transition-colors duration-200 hover:font-semibold"
            >
              How it works
            </a>
            <a
              href="#features"
              className="hover:text-[#00A4EF] transition-colors duration-200 hover:font-semibold"
            >
              Features
            </a>
            <Link to="/communities" className="hover:text-[#00A4EF] transition-colors duration-200 hover:font-semibold">
              Communities
            </Link>
          </div>

          {/* Desktop Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            <Link to="/login">
              <Button
                variant="ghost"
                className="text-[#1C1C1C60] hover:text-[#1C1C1C] hover:bg-[#F5F5F5] text-sm transition-all duration-200"
              >
                Sign In
              </Button>
            </Link>
            <Link to="/register">
              <Button
                style={{
                  background: "#00A4EF",
                  boxShadow: "0 4px 12px rgba(0, 164, 239, 0.2)",
                }}
                className="text-white text-sm transition-all hover:scale-[1.02] hover:shadow-lg"
              >
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5 text-[#1C1C1C]" />
            ) : (
              <Menu className="h-5 w-5 text-[#1C1C1C]" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden border-b border-[#E0E0E0] bg-white/95 backdrop-blur-sm overflow-hidden"
          >
            <div className="px-4 py-6 space-y-4">
              <a
                href="#how"
                className="block text-sm font-medium text-[#1C1C1C60] hover:text-[#00A4EF] transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                How it works
              </a>
              <a
                href="#features"
                className="block text-sm font-medium text-[#1C1C1C60] hover:text-[#00A4EF] transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>

              <Link to="/communities" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-[#1C1C1C60] hover:text-[#00A4EF] transition-colors">
                Communities
              </Link>

              <div className="pt-4 border-t border-[#E0E0E0] space-y-3 flex sm:hidden flex-col">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant="ghost"
                    className="w-full text-[#1C1C1C60] hover:text-[#1C1C1C] hover:bg-[#F5F5F5] text-sm"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    style={{
                      background: "#00A4EF",
                      boxShadow: "0 4px 12px rgba(0, 164, 239, 0.2)",
                    }}
                    className="w-full text-white text-sm transition-all"
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
