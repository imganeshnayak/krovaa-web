import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";

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

  // Prevent background scrolling when mobile menu is active
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const navigationLinks = [
    { label: "How it works", href: "#how" },
    { label: "Features", href: "#features" },
  ];

  return (
    <>
      <nav
        className={`sticky top-0 z-50 w-full border-b transition-all duration-300 h-20 flex items-center ${
          isScrolled
            ? "border-slate-200/80 backdrop-blur-3xl bg-white/80 shadow-sm"
            : "border-transparent backdrop-blur-md bg-white/40 shadow-none"
        }`}
      >
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 md:px-8">
          
          {/* Logo Brand Segment */}
          <Link 
            to="/" 
            className="flex items-center group shrink-0 transition-transform duration-200 active:scale-98"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="flex items-center gap-2">
              <Logo size="lg" theme="dark" className="origin-left" />
              <div className="hidden sm:block h-5 w-[2px] bg-gradient-to-b from-[#00A4EF] to-[#007BB5] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            {navigationLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="hover:text-[#00A4EF] transition-colors duration-200 relative py-1 after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-[#00A4EF] after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop Call to Actions (Visible layout on sm screens and up) */}
          <div className="hidden sm:flex items-center gap-3">
            <Link to="/login">
              <Button
                variant="ghost"
                className="text-slate-500 hover:text-slate-900 hover:bg-slate-50 text-sm transition-colors duration-200"
              >
                Sign In
              </Button>
            </Link>
            <Link to="/register">
              <Button
                className="text-white text-sm font-semibold transition-all hover:scale-[1.02] active:scale-98 hover:shadow-md bg-[#00A4EF] hover:bg-[#0097db] shadow-[0_4px_12px_rgba(0,164,239,0.15)]"
              >
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile Hamburguer Action Trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A4EF]/20"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Menu Overlays */}
      <div
        id="mobile-menu"
        className={`fixed inset-x-0 top-20 bottom-0 z-40 md:hidden bg-white border-t border-slate-100 transition-all duration-300 ease-in-out ${
          mobileMenuOpen 
            ? "opacity-100 translate-y-0 pointer-events-auto" 
            : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <div className="flex flex-col h-full px-6 py-8 justify-between overflow-y-auto">
          <div className="space-y-5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Navigation</p>
            <div className="grid gap-4">
              {navigationLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="block text-base font-semibold text-slate-600 hover:text-[#00A4EF] transition-colors py-2 border-b border-slate-50"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Render Mobile Sign-In / Get Started block layout on super narrow items (< 640px) */}
          <div className="sm:hidden space-y-3 pt-6 border-t border-slate-100">
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block w-full">
              <Button
                variant="outline"
                className="w-full text-slate-700 border-slate-200 h-11"
              >
                Sign In
              </Button>
            </Link>
            <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="block w-full">
              <Button
                className="w-full text-white h-11 font-semibold bg-[#00A4EF] hover:bg-[#0097db]"
              >
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;