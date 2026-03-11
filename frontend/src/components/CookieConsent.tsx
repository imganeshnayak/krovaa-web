import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Cookie, ShieldCheck, Info } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const CookieConsent = () => {
    const [isVisible, setIsVisible] = useState(false);
    const isMobile = useIsMobile();

    useEffect(() => {
        const consent = localStorage.getItem("cookie_consent") || sessionStorage.getItem("cookie_consent");
        if (!consent) {
            // Small delay for better UX entrance
            const timer = setTimeout(() => setIsVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAcceptAll = () => {
        localStorage.setItem("cookie_consent", "accepted_all");
        sessionStorage.setItem("cookie_consent", "accepted_all");
        setIsVisible(false);
    };

    const handleRejectNonEssential = () => {
        localStorage.setItem("cookie_consent", "rejected_non_essential");
        sessionStorage.setItem("cookie_consent", "rejected_non_essential");
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className={`fixed z-[100] ${isMobile ? "bottom-20 left-4 right-4" : "bottom-6 left-6 right-6 max-w-xl"} animate-in slide-in-from-bottom-5 duration-500`}>
            <div className="relative group overflow-hidden rounded-2xl border border-white/10 bg-gray-900/80 backdrop-blur-xl shadow-2xl p-5 md:p-6">
                {/* Glow effect */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/30 transition-colors" />

                <div className="flex flex-col gap-4 relative z-10">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <Cookie className="h-5 w-5 text-primary" />
                            </div>
                            <h3 className="font-bold text-lg text-white tracking-tight">Cookie Settings</h3>
                        </div>
                        <button
                            onClick={() => setIsVisible(false)}
                            className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <p className="text-sm text-white/70 leading-relaxed">
                        We use essential cookies to make <span className="text-white font-medium">Krovaa</span> work. With your permission, we'd also like to use optional cookies to improve your experience and analyze site traffic.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                        <Button
                            onClick={handleAcceptAll}
                            className="w-full sm:flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11 shadow-lg shadow-primary/20"
                        >
                            Accept All
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleRejectNonEssential}
                            className="w-full sm:flex-1 border-white/10 bg-white/5 hover:bg-white/10 text-white font-semibold h-11"
                        >
                            Essential Only
                        </Button>
                    </div>

                    <div className="flex items-center justify-center gap-4 pt-1">
                        <button
                            onClick={() => window.location.href = '/privacy'}
                            className="text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                            <ShieldCheck className="h-3 w-3" />
                            Privacy Policy
                        </button>
                        <span className="w-1 h-1 rounded-full bg-white/10" />
                        <button
                            onClick={() => window.location.href = '/settings'}
                            className="text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                            <Info className="h-3 w-3" />
                            Manage Prefs
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CookieConsent;
