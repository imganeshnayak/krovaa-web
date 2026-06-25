import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ShieldCheck, Truck, Package, Laptop, MapPin, Star, CheckCircle, Share2, Copy, Check, MessageCircle, IndianRupee, Clock, Tag } from "lucide-react";
import { getPublicDeal, inquireDeal, DealListing, acceptDeal } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const DELIVERY_ICONS: Record<string, React.ReactNode> = {
  shipping: <Truck className="h-4 w-4" />,
  digital: <Laptop className="h-4 w-4" />,
  pickup: <MapPin className="h-4 w-4" />,
};

const DELIVERY_LABELS: Record<string, string> = {
  shipping: "Shipping",
  digital: "Digital Delivery",
  pickup: "Pickup",
};

const formatPrice = (price: number) =>
  `₹${price.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export default function DealPublicPage() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [deal, setDeal] = useState<DealListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInquiring, setIsInquiring] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    if (!shareCode) return;
    setIsLoading(true);
    getPublicDeal(shareCode)
      .then(setDeal)
      .catch(err => setError(err?.message || "Deal not found."))
      .finally(() => setIsLoading(false));
  }, [shareCode]);

  // Set page title and OG meta for social preview
  useEffect(() => {
    if (!deal) return;
    document.title = `${deal.title} — Buy on Krovaa`;
    const setMeta = (name: string, content: string, prop = false) => {
      const attr = prop ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    const pageUrl = window.location.href;
    const img = (deal.imageUrls as string[])?.[0] || "";
    setMeta("description", deal.description.slice(0, 160));
    setMeta("og:title", `${deal.title} — ${formatPrice(deal.price)}`, true);
    setMeta("og:description", deal.description.slice(0, 200), true);
    setMeta("og:url", pageUrl, true);
    setMeta("og:type", "product", true);
    if (img) setMeta("og:image", img, true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", `${deal.title} — ${formatPrice(deal.price)}`);
    setMeta("twitter:description", deal.description.slice(0, 200));
    return () => { document.title = "Krovaa"; };
  }, [deal]);

  const handleChatToBuy = async () => {
    if (!deal || !shareCode) return;
    if (!user) {
      navigate(`/login?redirect=/deal/${shareCode}`);
      return;
    }
    if (user.id === deal.sellerId) {
      toast.info("This is your own deal listing.");
      return;
    }
    setIsInquiring(true);
    try {
      const { chatId } = await inquireDeal(shareCode);
      navigate(`/chat?chatId=${chatId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start chat.");
    } finally {
      setIsInquiring(false);
    }
  };

  const handleAcceptDeal = async () => {
    if (!deal || !shareCode) return;
    if (!user) {
      navigate(`/login?redirect=/deal/${shareCode}`);
      return;
    }
    if (user.id === deal.sellerId) {
      toast.info("This is your own deal listing.");
      return;
    }
    setIsAccepting(true);
    try {
      const escrowDeal = await acceptDeal(shareCode);
      toast.success("Deal accepted! Redirecting to secure transaction checkout.");
      navigate(`/deal/transaction/${escrowDeal.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept deal.");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-16 pb-28 flex flex-col items-center gap-4">
        <div className="h-64 w-full bg-slate-100 rounded-3xl animate-pulse" />
        <div className="w-full space-y-3">
          <div className="h-7 bg-slate-100 rounded-xl animate-pulse w-3/4" />
          <div className="h-5 bg-slate-100 rounded-xl animate-pulse w-1/3" />
          <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-20 pb-28 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Deal Not Found</h1>
        <p className="text-sm text-slate-500 mb-6">{error || "This deal link may have expired or been removed."}</p>
        <Button onClick={() => navigate("/explore")} className="bg-slate-900 text-white">
          Browse Marketplace
        </Button>
      </div>
    );
  }

  const images = (deal.imageUrls as string[]) || [];
  const isSeller = user?.id === deal.sellerId;

  return (
    <div className="max-w-xl mx-auto px-4 pt-4 pb-48">
      {/* Image section */}
      {images.length > 0 ? (
        <div className="space-y-2 mb-5">
          <div className="relative rounded-3xl overflow-hidden bg-slate-100 aspect-[4/3]">
            <img
              src={images[selectedImage]}
              alt={deal.title}
              className="w-full h-full object-cover"
            />
            {deal.status === "sold" && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white font-black text-2xl tracking-wide rotate-[-15deg] border-4 border-white px-5 py-2 rounded-xl">SOLD</span>
              </div>
            )}
            <button
              onClick={handleShare}
              className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/90 backdrop-blur-sm shadow flex items-center justify-center hover:bg-white transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Share2 className="h-4 w-4 text-slate-600" />}
            </button>
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`shrink-0 h-14 w-14 rounded-xl overflow-hidden border-2 transition-all ${
                    selectedImage === i ? "border-violet-500" : "border-transparent"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-5 h-48 rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center relative">
          <span className="text-6xl">🛍️</span>
          <button
            onClick={handleShare}
            className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/90 backdrop-blur-sm shadow flex items-center justify-center hover:bg-white transition-colors"
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Share2 className="h-4 w-4 text-slate-600" />}
          </button>
        </div>
      )}

      {/* Deal Info */}
      <div className="space-y-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight flex-1">{deal.title}</h1>
            {deal.status === "sold" && (
              <span className="shrink-0 text-[10px] font-black uppercase text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">Sold</span>
            )}
            {deal.status === "paused" && (
              <span className="shrink-0 text-[10px] font-black uppercase text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">Paused</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-2">
            <IndianRupee className="h-5 w-5 text-violet-600" />
            <span className="text-2xl font-black text-violet-700">{formatPrice(deal.price)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {/* Delivery badge */}
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
              {DELIVERY_ICONS[deal.deliveryType] || <Truck className="h-4 w-4" />}
              {DELIVERY_LABELS[deal.deliveryType] || deal.deliveryType}
              {deal.deliveryType === "shipping" && deal.deliveryDays && ` · ${deal.deliveryDays} days`}
            </span>
            {deal.category && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                <Tag className="h-3.5 w-3.5" /> {deal.category}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">
              <Clock className="h-3.5 w-3.5" /> Listed {formatDate(deal.createdAt)}
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="bg-slate-50 rounded-2xl p-4">
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{deal.description}</p>
        </div>

        {/* Seller card */}
        <div className="border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-full overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 shrink-0 cursor-pointer"
            onClick={() => navigate(`/${encodeURIComponent(deal.seller.username)}`)}
          >
            {deal.seller.avatarUrl ? (
              <img src={deal.seller.avatarUrl} alt={deal.seller.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold text-base">
                {(deal.seller.displayName?.[0] || "U").toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p
                className="text-sm font-bold text-slate-900 truncate cursor-pointer hover:text-violet-600 transition-colors"
                onClick={() => navigate(`/${encodeURIComponent(deal.seller.username)}`)}
              >
                {deal.seller.displayName}
              </p>
              {deal.seller.verified && (
                <CheckCircle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 truncate">@{deal.seller.username}</p>
            {deal.seller.businessName && (
              <p className="text-[11px] text-violet-600 font-semibold">{deal.seller.businessName}</p>
            )}
          </div>
          <Star className="h-4 w-4 text-amber-400 shrink-0" />
        </div>

        {/* Escrow trust badge */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-800 font-medium">
            Transactions on Krovaa are protected by <strong>Secure Escrow</strong> — your money is only released after you confirm delivery.
          </p>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className={`fixed left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 z-40 ${user ? 'bottom-16' : 'bottom-0'}`}>
        <div className="max-w-xl mx-auto">
          {isSeller ? (
            <Button
              onClick={() => navigate("/my-listings")}
              className="w-full h-13 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-lg"
            >
              Manage Your Deal →
            </Button>
          ) : deal.status !== "active" ? (
            <Button disabled className="w-full h-13 text-sm font-bold rounded-2xl">
              {deal.status === "sold" ? "This deal has been sold" : "This deal is currently paused"}
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2.5">
                <Button
                  onClick={handleChatToBuy}
                  disabled={isInquiring || isAccepting}
                  variant="outline"
                  className="h-13 px-4 font-bold border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl gap-2 shrink-0"
                  title="Chat with Seller"
                >
                  <MessageCircle className="h-5 w-5" />
                </Button>
                <Button
                  onClick={handleAcceptDeal}
                  disabled={isInquiring || isAccepting}
                  className="flex-1 h-13 text-sm font-extrabold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-2xl shadow-lg shadow-violet-200 gap-2"
                >
                  <ShieldCheck className="h-5 w-5" />
                  {isAccepting ? "Accepting..." : "Accept Deal & Buy"}
                </Button>
              </div>
              <p className="text-center text-[10px] text-slate-400">
                🔒 Secured by Krovaa Escrow · No payment until you confirm receipt
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
