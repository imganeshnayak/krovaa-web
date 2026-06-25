import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store, Search, Plus, IndianRupee, LayoutGrid, ChevronDown } from "lucide-react";
import { getPublicDeals, DealListing, inquireDeal } from "../lib/api";
import { useAuth } from "@/contexts/AuthContext";

const MarketplacePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Marketplace state
  const [deals, setDeals] = useState<DealListing[]>([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [dealsSearch, setDealsSearch] = useState("");
  const [dealsCategory, setDealsCategory] = useState("");
  const [dealsDelivery, setDealsDelivery] = useState("");
  const [inquiringId, setInquiringId] = useState<number | null>(null);

  const loadDeals = async () => {
    setDealsLoading(true);
    try {
      const data = await getPublicDeals({
        search: dealsSearch || undefined,
        category: dealsCategory || undefined,
        deliveryType: dealsDelivery || undefined,
        limit: 24
      });
      setDeals(data.deals);
    } catch (err) {
      console.error("Failed to load deals:", err);
    } finally {
      setDealsLoading(false);
    }
  };

  useEffect(() => {
    loadDeals();
  }, [dealsSearch, dealsCategory, dealsDelivery]);

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

          {/* Delivery Type Dropdown */}
          <div className="relative flex items-center bg-white border border-slate-200/60 rounded-xl shadow-sm min-w-[130px]">
            <select 
              value={dealsDelivery} 
              onChange={e => setDealsDelivery(e.target.value)} 
              className="h-11 w-full rounded-xl pl-4 pr-8 text-xs font-semibold text-slate-600 bg-transparent outline-none appearance-none cursor-pointer"
              aria-label="Delivery type"
            >
              <option value="">All Delivery</option>
              <option value="shipping">🚚 Shipping</option>
              <option value="digital">💻 Digital</option>
              <option value="pickup">📍 Pickup</option>
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
      ) : deals.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50/30 p-16 text-center text-sm text-slate-500">
          No deals found. Try adjusting your filters or {user?.accountType === "business" && <button onClick={() => navigate('/deal/create')} className="text-violet-600 font-semibold underline">create one</button>}.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map(deal => (
            <article
              key={deal.id}
              className="group flex flex-col rounded-[2rem] border border-slate-200/80 bg-white shadow-sm hover:border-[#00A4EF]/40 hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer"
              onClick={() => navigate(`/deal/${deal.shareCode}`)}
            >
              {/* Product image */}
              <div className="h-48 bg-gradient-to-br from-slate-50 to-blue-50/50 flex items-center justify-center overflow-hidden relative">
                {(deal.imageUrls as string[])?.[0] ? (
                  <img 
                    src={(deal.imageUrls as string[])[0]} 
                    alt={deal.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                  />
                ) : (
                  <span className="text-4xl">🛍️</span>
                )}
                {deal.category && (
                  <span className="absolute top-3 left-3 text-[9px] font-bold uppercase tracking-wider text-[#00A4EF] bg-[#00A4EF]/10 border border-[#00A4EF]/25 px-2.5 py-0.5 rounded-full">
                    {deal.category}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-5 flex flex-col flex-1 gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight line-clamp-1 group-hover:text-[#00A4EF] transition-colors">
                    {deal.title}
                  </h3>
                  <div className="flex items-center gap-1 mt-1">
                    <IndianRupee className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-base font-black text-slate-800">
                      {Number(deal.price).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Seller */}
                <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-100">
                  <div className="h-6 w-6 rounded-full bg-slate-200 overflow-hidden shrink-0">
                    {deal.seller?.avatarUrl ? (
                      <img src={deal.seller.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-500">
                        {(deal.seller?.displayName?.[0] || 'U').toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 truncate flex-1">{deal.seller?.displayName}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {deal.deliveryType === 'shipping' ? '🚚' : deal.deliveryType === 'digital' ? '💻' : '📍'}
                  </span>
                </div>

                {/* CTA */}
                <button
                  onClick={e => { 
                    e.stopPropagation(); 
                    handleInquire(deal.shareCode, deal.id); 
                  }}
                  disabled={inquiringId === deal.id}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#00A4EF] text-white hover:bg-[#0087d1] transition-all disabled:opacity-60 shadow-sm shadow-[#00A4EF]/10"
                >
                  {inquiringId === deal.id ? "Opening..." : "Chat to Buy"}
                </button>
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
