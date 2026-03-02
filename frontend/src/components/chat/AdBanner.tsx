import { useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { Ad, recordAdClick } from "@/lib/api";

interface AdBannerProps {
    ad: Ad;
    onDismiss: () => void;
}

const AdBanner = ({ ad, onDismiss }: AdBannerProps) => {
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return null;

    const handleDismiss = () => {
        setDismissed(true);
        onDismiss();
    };

    const handleMoreDetails = async () => {
        try {
            await recordAdClick(ad.id);
        } catch {
            // silently fail analytics
        }
        if (ad.externalUrl) {
            window.open(ad.externalUrl, "_blank", "noopener,noreferrer");
        }
    };

    return (
        <div
            className="mx-3 my-2 rounded-xl overflow-hidden border border-border/60 bg-card/80 backdrop-blur-sm shadow-md"
            style={{ animation: "adFadeIn 0.4s ease-out" }}
        >
            {/* Sponsored label */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-muted/30">
                <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/60">Sponsored</span>
                <button
                    onClick={handleDismiss}
                    className="text-muted-foreground/40 hover:text-muted-foreground transition-colors p-0.5 rounded"
                    title="Dismiss"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>

            {/* Image */}
            {ad.imageUrl && (
                <div className="relative overflow-hidden" style={{ maxHeight: "180px" }}>
                    <img
                        src={ad.imageUrl}
                        alt={ad.title}
                        className="w-full object-cover"
                        style={{ maxHeight: "180px" }}
                    />
                </div>
            )}

            {/* Video */}
            {ad.videoUrl && (
                <div className="relative overflow-hidden bg-black" style={{ maxHeight: "200px" }}>
                    <video
                        src={ad.videoUrl}
                        className="w-full object-contain"
                        style={{ maxHeight: "200px" }}
                        autoPlay
                        muted
                        loop
                        playsInline
                    />
                </div>
            )}

            {/* Content */}
            <div className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">{ad.title}</p>
                    {ad.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{ad.description}</p>
                    )}
                </div>

                <button
                    onClick={handleMoreDetails}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 active:scale-95 transition-all"
                >
                    {ad.ctaText || "More Details"}
                    {ad.externalUrl && <ExternalLink className="w-3 h-3" />}
                </button>
            </div>

            <style>{`
        @keyframes adFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
};

export default AdBanner;
