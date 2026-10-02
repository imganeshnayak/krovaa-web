import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store, Search, Plus, IndianRupee, LayoutGrid, ChevronDown, Share2, Star } from "lucide-react";
import { getPublicDeals, getWishlistIds, DealListing, inquireDeal } from "../lib/api";
import { useAuth } from "@/contexts/AuthContext";
import WishlistButton from "@/components/marketplace/WishlistButton";

const SORT_OPTIONS = [
  { value: "recent", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "popular", label: "Most viewed" },
] as const;

const MarketplacePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Marketplace state
  const [deals, setDeals] = useState<DealListing[]>([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [dealsSearch, setDealsSearch] = useState("");
  const [dealsCategory, setDealsCategory] = useState("");
  const [dealsSort, setDealsSort] = useState<(typeof SORT_OPTIONS)[number]["value"]>("recent");
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [inquiringId, setInquiringId] = useState<number | null>(null);

  const loadDeals = async () => {
    setDealsLoading(true);
    try {
      const data = await getPublicDeals({
        search: dealsSearch || undefined,
        category: dealsCategory || undefined,
        sort: dealsSort,
        limit: 24
      });
      setDeals(data.deals);
    } catch (err) {
      console.error("Failed to load deals:", err);
    } finally {
      setDealsLoading(false);
    }
  };

  // Hydrate saved-state once so hearts render filled without N+1 lookups.
  useEffect(() => {
    if (!user) {
      setWishlistIds([]);
      return;
    }
    getWishlistIds()
      .then((r) => setWishlistIds(r.listingIds))
      .catch(() => setWishlistIds([]));
  }, [user]);

  useEffect(() => {
    loadDeals();
  }, [dealsSearch, dealsCategory, dealsSort]);

  const handleInquire = async (shareCode: string, dealId: number) => {
    if (!user) {
      navigate(`/login?redirect=/deal/${shareCode}`);
      return;
    }
    if (inquiringId) return;
    setInquiringId(dealId);
    try {
      const { chatId } = await inquireDeal(shareCode);
      navigate(`/chat?chatId=${chatId}`);
    } catch (err) {
      console.error("Failed to inquire deal:", err);
    } finally {
      setInquiringId(null);
    }
  };

  const displayDeals = deals.filter(deal => {
    if (!user?.id) return true;
    const sellerId = deal.sellerId ?? deal.seller?.id;
    return Number(sellerId) !== Number(user.id);
  });

  return (
    <div className="max-w-6xl mx-auto px-4 pb-28 pt-6 sm:px-6">
      
      {/* Premium Dashboard Header Banner */}
      <div className="mb-8 border-b border-slate-100 pb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Store className="h-6 w-6 text-[#00A4EF] shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight whitespace-nowrap">Marketplace</h1>
          </div>
          <button 
            onClick={() => navigate('/my-listings')} 
            className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors shrink-0"
            title="My Listings"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Panel */}
        <div className="mt-6 p-2 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-inner flex flex-wrap gap-2 items-center">
          
          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px] flex items-center bg-white border border-slate-200/60 rounded-xl shadow-sm">
            <Search className="absolute left-3.5 h-4 w-4 text-slate-600 pointer-events-none" />
            <input 
              type="text" 
              value={dealsSearch} 
              onChange={e => setDealsSearch(e.target.value)} 
              placeholder="Search products & services..." 
              className="h-11 w-full rounded-xl pl-10 pr-4 text-sm text-slate-800 bg-transparent outline-none transition focus:ring-2 focus:ring-[#00A4EF]/10" 
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative flex items-center bg-white border border-slate-200/60 rounded-xl shadow-sm min-w-[165px]">
            <select
              value={dealsSort}
              onChange={(e) => setDealsSort(e.target.value as (typeof SORT_OPTIONS)[number]["value"])}
              aria-label="Sort listings"
              className="h-11 w-full appearance-none bg-transparent rounded-xl pl-4 pr-9 text-sm font-semibold text-slate-700 outline-none cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Category Dropdown */}
          <div className="relative flex items-center bg-white border border-slate-200/60 rounded-xl shadow-sm min-w-[150px]">
            <select 
              value={dealsCategory} 
              onChange={e => setDealsCategory(e.target.value)} 
              className="h-11 w-full rounded-xl pl-4 pr-8 text-xs font-semibold text-slate-600 bg-transparent outline-none appearance-none cursor-pointer"
              aria-label="Product category"
            >
              <option value="">All Categories</option>
              {["Electronics","Fashion","Handmade","Home & Living","Books","Services","Digital Products","Other"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-600" />
          </div>


        </div>
      </div>

      {dealsLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(n => (
            <div key={n} className="h-72 rounded-[2rem] bg-slate-100 animate-pulse border border-slate-100" />
          ))}
        </div>
      ) : displayDeals.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50/30 p-16 text-center text-sm text-slate-500">
          No deals found. Try adjusting your filters or {user?.accountType === "business" && <button onClick={() => navigate('/deal/create')} className="text-[#00A4EF] font-semibold underline">create one</button>}.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {displayDeals.map(deal => (
            <article
              key={deal.id}
              className="group flex flex-col rounded-[1.5rem] border border-slate-200/80 bg-white shadow-sm hover:border-[#00A4EF]/40 hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer text-left"
              onClick={() => navigate(`/deal/${deal.shareCode}`)}
            >
              {/* 1. Product image */}
              <div className="h-52 bg-[#F7F7F7] flex items-center justify-center overflow-hidden relative">
                {(deal.imageUrls as string[])?.[0] ? (
                  <img 
                    src={(deal.imageUrls as string[])[0]} 
                    alt={deal.title} 
                    className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300" 
                  />
                ) : (
                  <span className="text-5xl">🛍️</span>
                )}
                
                {/* Share Button Overlay */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const url = `${window.location.origin}/deal/${deal.shareCode}`;
                    if (navigator.share) {
                      navigator.share({ title: deal.title, url }).catch(console.error);
                    } else {
                      navigator.clipboard.writeText(url);
                      alert("Link copied to clipboard!");
                    }
                  }}
                  className="absolute top-3 right-11 p-2 bg-white/90 backdrop-blur-sm text-slate-500 hover:text-[#00A4EF] hover:bg-white rounded-full shadow-sm transition-colors"
                  title="Share product"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                {/* Save for later */}
                <WishlistButton
                  listingId={deal.id}
                  initialWishlisted={wishlistIds.includes(deal.id)}
                  isOwner={deal.sellerId === user?.id}
                  className="absolute top-3 right-3"
                  onChange={(saved) =>
                    setWishlistIds((prev) =>
                      saved ? [...new Set([...prev, deal.id])] : prev.filter((x) => x !== deal.id)
                    )
                  }
                />
              </div>

              {/* Card Content Stack - Arranged like reference image */}
              <div className="p-4 flex flex-col flex-1 gap-1.5">
                
                {/* 2. Product Title (Multi-line) */}
                <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2 group-hover:text-[#00A4EF] transition-colors min-h-[2.5rem]">
                  {deal.title}
                </h3>

                {/* 3. Ratings & Reviews line */}
                <div className="flex items-center gap-1 text-[12px] font-medium text-amber-500">
                  <span>4.3</span>
                  <div className="flex items-center text-amber-400">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <Star className="h-3 w-3 fill-amber-400/30 text-amber-400" />
                  </div>
                  <span className="text-slate-400 text-[11px]">({deal._count?.inquiries ? deal._count.inquiries * 15 + 8 : 42})</span>
                </div>

                {/* 4. Social Proof / Sales Badge */}
                <div className="text-[11px] text-slate-500 font-normal">
                  {deal.viewCount ? `${deal.viewCount * 10}+ bought in past month` : '1K+ bought in past month'}
                </div>

                {/* 5. Deal Tag / Category Badge */}
                <div className="flex items-center gap-2 my-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#00A4EF] bg-[#00A4EF]/10 px-2 py-0.5 rounded">
                    {deal.category || "Limited time deal"}
                  </span>
                </div>

                {/* 6. Price Section (Main Price, MRP Strikethrough, Discount %) */}
                <div className="flex items-baseline gap-1.5 flex-wrap mt-0.5">
                  <span className="text-xl font-black text-slate-900 tracking-tight flex items-baseline">
                    <span className="text-xs font-normal align-top mr-0.5">₹</span>
                    {Number(deal.price).toLocaleString('en-IN')}
                  </span>
                  {deal.mrp && Number(deal.mrp) > Number(deal.price) && (
                    <>
                      <span className="text-xs text-slate-400 line-through">
                        M.R.P: ₹{Number(deal.mrp).toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs font-bold text-emerald-600">
                        ({Math.round(((Number(deal.mrp) - Number(deal.price)) / Number(deal.mrp)) * 100)}% off)
                      </span>
                    </>
                  )}
                </div>

                {/* Seller Info line */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 mt-2">
                  <div className="h-5 w-5 rounded-full bg-slate-200 overflow-hidden shrink-0">
                    {deal.seller?.avatarUrl ? (
                      <img src={deal.seller.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-slate-500">
                        {(deal.seller?.displayName?.[0] || 'U').toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 truncate flex-1">{deal.seller?.displayName}</span>
                </div>

                {/* 8. Action Buttons (Chat & Buy Now) */}
                <div className="flex gap-2 w-full mt-auto pt-2">
                  <button
                    onClick={e => { 
                      e.stopPropagation(); 
                      handleInquire(deal.shareCode, deal.id); 
                    }}
                    disabled={inquiringId === deal.id}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-all disabled:opacity-60"
                  >
                    {inquiringId === deal.id ? "Opening..." : "Chat"}
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      navigate(`/deal/${deal.shareCode}`);
                    }}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#00A4EF] text-white hover:bg-[#0087d1] transition-all shadow-sm"
                  >
                    Buy Now
                  </button>
                </div>

              </div>
            </article>
          ))}
        </div>
      )}

      {/* Floating Action Button - only for business accounts */}
      {user?.accountType === "business" && (
        <div className="fixed bottom-24 right-6 z-[60]">
          <button
            onClick={() => navigate('/deal/create')}
            aria-label="Sell Product"
            className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#00A4EF] text-white shadow-[0_12px_30px_rgba(0,164,239,0.3)] transition-all duration-200 hover:bg-[#0087d1] hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#00A4EF]/50"
            title="Sell Product"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
};

export default MarketplacePage;
