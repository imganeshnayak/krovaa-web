import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ShieldCheck, ArrowLeft, Truck, Package, Clock, CreditCard, 
  Wallet, Copy, Check, Star, RefreshCw, CheckCircle2, 
  ChevronRight, AlertCircle, Sparkles, Box, MapPin, 
  CheckSquare, ArrowRight, ShieldAlert, Award
} from "lucide-react";
import { 
  getEscrowDeal, payEscrowWithWallet, initiateEscrowPayment, 
  verifyPayment, shipEscrowDeal, 
  confirmRelease, submitDealReview, EscrowDeal, getCurrentUser
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRazorpay } from "@/hooks/useRazorpay";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";

export default function DealTransactionPage() {
  const { escrowDealId } = useParams<{ escrowDealId: string }>();
  const navigate = useNavigate();
  const { user, reloadUser } = useAuth();
  const { openCheckout } = useRazorpay();

  const [deal, setDeal] = useState<EscrowDeal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [copiedId, setCopiedId] = useState(false);

  // Shipping Form State
  const [shippingWeight, setShippingWeight] = useState("1.0");
  const [shippingDimensions, setShippingDimensions] = useState("Small (15x15x10 cm)");
  const [pickupAddress, setPickupAddress] = useState("");

  // Review Form State
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);

  const fetchDealData = useCallback(async () => {
    if (!escrowDealId) return;
    try {
      const data = await getEscrowDeal(parseInt(escrowDealId));
      setDeal(data);
    } catch (err) {
      toast.error("Failed to load transaction details.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [escrowDealId]);

  const fetchWallet = useCallback(async () => {
    try {
      const freshUser = await getCurrentUser();
      setWalletBalance(freshUser.walletBalance || 0);
    } catch (err) {
      console.error("Failed to fetch wallet:", err);
    }
  }, []);

  useEffect(() => {
    fetchDealData();
    fetchWallet();

    // Auto-refresh deal status every 5 seconds to feel live
    const interval = setInterval(fetchDealData, 5000);
    return () => clearInterval(interval);
  }, [fetchDealData, fetchWallet]);

  const copyTrackingId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(true);
      toast.success("Tracking ID copied!");
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

  const handleWalletPayment = async () => {
    if (!deal) return;
    setIsActioning(true);
    try {
      const updated = await payEscrowWithWallet(deal.id);
      setDeal(updated);
      toast.success("Payment completed successfully from wallet!");
      await reloadUser();
      fetchWallet();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wallet payment failed.");
    } finally {
      setIsActioning(false);
    }
  };

  const handleRazorpayPayment = async () => {
    if (!deal) return;
    setIsActioning(true);
    try {
      const paymentOrder = await initiateEscrowPayment(deal.id);
      openCheckout({
        orderId: paymentOrder.orderId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: "Escrow Deposit",
        description: `Secure Escrow for: ${deal.title}`,
        onSuccess: async (response) => {
          setIsActioning(true);
          try {
            await verifyPayment({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              type: "escrow",
              entityId: deal.id,
            });
            toast.success("Payment verified! Escrow is now active.");
            fetchDealData();
            await reloadUser();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Verification failed.");
          } finally {
            setIsActioning(false);
          }
        },
        onFailure: (error) => {
          toast.error(error.message || "Razorpay payment cancelled.");
          setIsActioning(false);
        },
        userDetails: {
          name: user?.displayName,
          email: user?.email,
        },
        keyId: paymentOrder.key_id,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Razorpay payment initiation failed.");
      setIsActioning(false);
    }
  };

  const handleShipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deal) return;
    if (!pickupAddress.trim()) {
      toast.error("Please enter a pickup address.");
      return;
    }
    setIsActioning(true);
    try {
      const updated = await shipEscrowDeal(deal.id, {
        weight: parseFloat(shippingWeight),
        dimensions: shippingDimensions,
        pickupAddress: pickupAddress.trim(),
      });
      setDeal(updated);
      toast.success("Package marked as shipped! Tracking details generated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save shipping info.");
    } finally {
      setIsActioning(false);
    }
  };


  const handleConfirmRelease = async () => {
    if (!deal) return;
    setIsActioning(true);
    try {
      const updated = await confirmRelease(deal.id);
      setDeal(updated);
      toast.success("Delivery confirmed! Escrow funds released to seller's wallet.");
      await reloadUser();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to release funds.");
    } finally {
      setIsActioning(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deal) return;
    setIsActioning(true);
    const role = user?.id === deal.clientId ? "buyer" : "seller";
    try {
      await submitDealReview(deal.id, {
        rating,
        comment: comment.trim(),
        role,
      });
      toast.success("Thank you for your rating!");
      fetchDealData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit review.");
    } finally {
      setIsActioning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
        <RefreshCw className="h-8 w-8 animate-spin text-[#00A4EF]" />
        <p className="text-sm font-medium text-slate-500">Loading secure transaction...</p>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-20 pb-28 text-center">
        <ShieldAlert className="h-16 w-16 text-rose-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Transaction Not Found</h1>
        <p className="text-sm text-slate-500 mb-6">This transaction could not be located or you are not a participant.</p>
        <Button onClick={() => navigate("/chat")} className="bg-slate-900 text-white rounded-2xl">
          Back to Chat
        </Button>
      </div>
    );
  }

  const isBuyer = user?.id === deal.clientId;
  const isSeller = user?.id === deal.vendorId;
  const platformFee = deal.totalAmount * 0.10; // Mock platform fee representation
  const netSellerReceived = deal.totalAmount - platformFee;

  // Determine current active workflow step
  let currentStep = 1;
  let stepTitle = "Inquiry";

  if (deal.status === "pending_payment") {
    currentStep = 3;
    stepTitle = "Deposit Payment";
  } else if (deal.status === "active" && !deal.trackingId) {
    currentStep = 4;
    stepTitle = "Prepare Shipment";
  } else if (deal.status === "active" && deal.shippingStatus === "in_transit") {
    currentStep = 5;
    stepTitle = "In Transit";
  } else if (deal.status === "active" && deal.shippingStatus === "delivered") {
    currentStep = 6;
    stepTitle = "Delivered";
  } else if (deal.status === "completed") {
    currentStep = 7;
    stepTitle = "Review & Complete";
  }

  // Stepper steps config
  const steps = [
    { num: 1, label: "Inquire" },
    { num: 2, label: "Accepted" },
    { num: 3, label: "Secure Pay" },
    { num: 4, label: "Ship" },
    { num: 5, label: "Transit" },
    { num: 6, label: "Delivered" },
    { num: 7, label: "Complete" },
  ];

  // Ratings calculation
  const hasUserRated = deal.ratings?.some(r => r.reviewerId === user?.id);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <button 
            onClick={() => navigate(`/chat?chatId=${deal.chatId}`)}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Chat</span>
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">SECURE ESCROW DEAL</span>
          </div>
          <button 
            onClick={fetchDealData} 
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            title="Refresh status"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-6 space-y-6">
        {/* Deal Overview Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-[#00A4EF] dark:text-sky-400 shrink-0">
              <Box className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white truncate">{deal.title}</h2>
              <p className="text-xs text-slate-500 truncate">
                Seller: {deal.vendor.displayName} (@{deal.vendor.username})
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between md:justify-end gap-5 border-t md:border-t-0 border-slate-100 dark:border-slate-800 pt-3.5 md:pt-0">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Escrow Value</p>
              <p className="text-xl font-black text-[#00A4EF] dark:text-sky-400">₹{deal.totalAmount.toLocaleString('en-IN')}</p>
            </div>
            <Badge className="bg-sky-50 text-[#00A4EF] border border-sky-100 hover:bg-sky-50 rounded-xl px-3 py-1 font-bold text-xs uppercase dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/50">
              {stepTitle}
            </Badge>
          </div>
        </div>

        {/* Dynamic Stepper progress bar */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex justify-between items-center overflow-x-auto gap-4 pb-2 scrollbar-none">
            {steps.map((s, idx) => {
              const isCompleted = idx + 1 < currentStep;
              const isActive = idx + 1 === currentStep;
              return (
                <div key={s.num} className="flex items-center gap-2 shrink-0">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCompleted 
                      ? "bg-emerald-500 text-white shadow-sm" 
                      : isActive 
                        ? "bg-[#00A4EF] text-white ring-4 ring-sky-100 dark:ring-sky-950" 
                        : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
                  }`}>
                    {isCompleted ? <Check className="h-4 w-4" /> : s.num}
                  </div>
                  <span className={`text-xs font-bold transition-colors ${
                    isActive ? "text-[#00A4EF] dark:text-sky-400" : isCompleted ? "text-slate-800 dark:text-slate-300" : "text-slate-400 dark:text-slate-600"
                  }`}>{s.label}</span>
                  {idx < steps.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-800 ml-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* MAIN PANEL CONTENT */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          
          {/* STEP 3: PAYMENT SUBMISSION */}
          {deal.status === "pending_payment" && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="text-center max-w-md mx-auto space-y-2.5">
                <div className="h-14 w-14 rounded-full bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center text-[#00A4EF] dark:text-sky-400 mx-auto">
                  <CreditCard className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Secure Escrow Deposit</h3>
                <p className="text-sm text-slate-500">
                  {isBuyer 
                    ? "Funds will be held securely in Krovaa Escrow. Payment is only released to the seller after you receive and confirm the package." 
                    : "Awaiting payment from the buyer. You will be notified immediately once funds are locked in escrow so you can ship the product safely."
                  }
                </p>
              </div>

              {isBuyer && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 max-w-md mx-auto">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Payment Breakdown</h4>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Item Price</span>
                      <span className="font-semibold text-slate-900 dark:text-white">₹{deal.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Secure Escrow Protection Fee</span>
                      <span className="font-semibold text-emerald-600">FREE</span>
                    </div>
                    {deal.description?.match(/Includes ₹(\d+(?:\.\d+)?) shipping fee/i) && (
                      <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5 mt-2.5">
                        <span className="text-slate-500">Shipping Fee</span>
                        <span className="font-semibold text-slate-900 dark:text-white">₹{Number(deal.description.match(/Includes ₹(\d+(?:\.\d+)?) shipping fee/i)?.[1] || 0).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 flex justify-between font-bold text-base">
                      <span className="text-slate-900 dark:text-white font-extrabold">Total Amount</span>
                      <span className="text-[#00A4EF] dark:text-sky-400">₹{deal.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    <Button 
                      onClick={handleRazorpayPayment}
                      disabled={isActioning}
                      className="w-full h-12 rounded-xl bg-[#00A4EF] hover:bg-[#0087d1] text-white font-bold gap-2 text-sm shadow-md shadow-sky-200 dark:shadow-none"
                    >
                      <CreditCard className="h-4 w-4" />
                      Pay via Razorpay / Cards / UPI
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: PREPARE SHIPMENT */}
          {deal.status === "active" && !deal.trackingId && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="text-center max-w-md mx-auto space-y-2.5">
                <div className="h-14 w-14 rounded-full bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center text-[#00A4EF] dark:text-sky-400 mx-auto">
                  <Package className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Prepare Shipment</h3>
                <p className="text-sm text-slate-500">
                  {isSeller 
                    ? "Payment is secured in escrow! Please enter the package parameters to generate the shipping tracking ID and dispatch the order." 
                    : "Payment verified successfully. Awaiting shipment dispatch from the seller. You will receive tracking details as soon as it's registered."
                  }
                </p>
              </div>

              {isSeller && (
                <form onSubmit={handleShipSubmit} className="max-w-md mx-auto space-y-4 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Package Dimensions</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="weight" className="text-xs font-bold">Package Weight (kg)</Label>
                    <select 
                      id="weight" 
                      value={shippingWeight} 
                      onChange={(e) => setShippingWeight(e.target.value)}
                      className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="0.5">Lightweight (Up to 0.5 kg)</option>
                      <option value="1.0">Medium (Up to 1.0 kg)</option>
                      <option value="2.0">Standard (Up to 2.0 kg)</option>
                      <option value="5.0">Heavy (Up to 5.0 kg)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dimensions" className="text-xs font-bold">Package Size (Dimensions)</Label>
                    <select 
                      id="dimensions" 
                      value={shippingDimensions} 
                      onChange={(e) => setShippingDimensions(e.target.value)}
                      className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#00A4EF]"
                    >
                      <option value="Small (15x15x10 cm)">Small Envelope/Box (15x15x10 cm)</option>
                      <option value="Medium (30x30x20 cm)">Medium Package (30x30x20 cm)</option>
                      <option value="Large (50x50x40 cm)">Large Box (50x50x40 cm)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pickup" className="text-xs font-bold">Pickup Address</Label>
                    <Textarea 
                      id="pickup" 
                      placeholder="Enter the full address where the courier will pick up the package"
                      value={pickupAddress} 
                      onChange={(e) => setPickupAddress(e.target.value)}
                      className="rounded-xl min-h-[80px]"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isActioning}
                    className="w-full h-12 rounded-xl bg-[#00A4EF] hover:bg-[#0087d1] text-white font-bold gap-2 text-sm mt-3"
                  >
                    <Truck className="h-4 w-4" />
                    {isActioning ? "Generating..." : "Generate Label & Ship"}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* STEP 5: TRACKING & DELIVERED */}
          {deal.status === "active" && deal.trackingId && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="text-center max-w-md mx-auto space-y-2">
                <div className="h-14 w-14 rounded-full bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center text-[#00A4EF] dark:text-sky-400 mx-auto">
                  <Truck className="h-6 w-6 animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {deal.shippingStatus === "delivered" ? "Package Delivered!" : "Order In Transit"}
                </h3>
                <p className="text-sm text-slate-500">
                  {deal.shippingStatus === "delivered" 
                    ? (isBuyer 
                        ? "The courier has marked your order as delivered. Please verify the shipment and release funds below." 
                        : "The package has been delivered successfully. Funds will be released as soon as the buyer confirms delivery."
                      )
                    : (isBuyer 
                        ? "Your package is currently in transit. Use the timeline below to track shipment status." 
                        : "Your package is dispatched. You can monitor the progress with the tracking events."
                      )
                  }
                </p>
              </div>

              {/* Courier tracking details card */}
              <div className="max-w-md mx-auto border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Tracking ID</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{deal.trackingId}</span>
                      <button 
                        onClick={() => copyTrackingId(deal.trackingId || "")}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Courier Partner</span>
                    <p className="text-sm font-bold text-[#00A4EF] dark:text-sky-400 mt-0.5">Krovaa Courier Express</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Weight:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 ml-1">{deal.shippingWeight} kg</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Dimensions:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 ml-1 truncate max-w-[120px] inline-block align-bottom">{deal.shippingDimensions}</span>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-4 pt-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status History</h4>
                  <div className="space-y-4">
                    {Array.isArray(deal.shippingEvents) && (deal.shippingEvents as any[]).map((e, idx) => (
                      <div key={idx} className="flex gap-3 text-xs items-start">
                        <div className="relative flex flex-col items-center">
                          <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 z-10 ${
                            e.status === 'delivered' ? 'bg-emerald-500 text-white' : 'bg-[#00A4EF] text-white'
                          }`}>
                            {e.status === 'delivered' ? <Check className="h-3 w-3" /> : <Box className="h-2.5 w-2.5" />}
                          </div>
                          {idx < (deal.shippingEvents as any[]).length - 1 && (
                            <div className="w-0.5 bg-slate-200 dark:bg-slate-800 absolute top-5 bottom-[-16px]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-200">{e.title}</p>
                          <p className="text-slate-500 text-[11px] mt-0.5">{e.description}</p>
                          <p className="text-slate-400 text-[10px] mt-0.5">{new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(e.timestamp).toLocaleDateString([], { day: 'numeric', month: 'short' })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {isSeller && deal.shippingLabelUrl && (
                  <div className="pt-2">
                    <Button 
                      onClick={() => window.open(deal.shippingLabelUrl, '_blank')}
                      variant="outline"
                      className="w-full h-10 border-sky-200 text-[#00A4EF] bg-sky-50 hover:bg-sky-100 font-bold gap-2 text-xs"
                    >
                      <FileText className="h-4 w-4" />
                      Download Shipping Label
                    </Button>
                  </div>
                )}


                {/* Buyer Confirm Receipt CTA */}
                {deal.shippingStatus === "delivered" && isBuyer && (
                  <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <Button 
                      onClick={handleConfirmRelease}
                      disabled={isActioning}
                      className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold gap-2 text-sm shadow-md shadow-emerald-100 dark:shadow-none"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isActioning ? "Releasing funds..." : "Confirm Delivery & Release Funds"}
                    </Button>
                    <Button 
                      onClick={() => navigate(`/chat?chatId=${deal.chatId}`)}
                      variant="outline"
                      className="w-full h-12 rounded-xl border-slate-200 hover:bg-slate-50 font-bold text-slate-600 text-sm"
                    >
                      Report Issue / Dispute
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 6: REVIEW / RATE (STATUS = COMPLETED BUT NOT YET RATED BY CURRENT USER) */}
          {deal.status === "completed" && !hasUserRated && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="text-center max-w-md mx-auto space-y-2">
                <div className="h-14 w-14 rounded-full bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center text-[#00A4EF] dark:text-sky-400 mx-auto">
                  <Star className="h-6 w-6 text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Rate the Transaction</h3>
                <p className="text-sm text-slate-500">
                  The deal is completed! Please rate your experience with {isBuyer ? deal.vendor.displayName : deal.client.displayName} to complete the loop.
                </p>
              </div>

              <form onSubmit={handleReviewSubmit} className="max-w-md mx-auto border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col items-center gap-2 py-2">
                  <Label className="text-xs font-bold text-slate-400 uppercase">Your Rating</Label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isLit = hoverRating ? star <= hoverRating : star <= rating;
                      return (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 focus:outline-none transition-transform hover:scale-125"
                        >
                          <Star 
                            className={`h-8 w-8 transition-colors ${
                              isLit ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-700"
                            }`} 
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="review" className="text-xs font-bold text-slate-700 dark:text-slate-300">Comment (Optional)</Label>
                  <Textarea
                    id="review"
                    placeholder="Share details of your experience with the product or service..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="rounded-xl min-h-[80px]"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={isActioning}
                  className="w-full h-11 bg-[#00A4EF] hover:bg-[#0087d1] text-white rounded-xl font-bold text-sm transition-all"
                >
                  {isActioning ? "Submitting..." : "Submit Review & Finish"}
                </Button>
              </form>
            </div>
          )}

          {/* STEP 7: COMPLETED (FULLY CLOSED AND REVIEWED) */}
          {deal.status === "completed" && hasUserRated && (
            <div className="p-6 md:p-8 space-y-6 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div className="h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-500 mx-auto">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Deal Fully Completed!</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Thank you for completing the transaction and submitting your review. The secure escrow cycle is now complete.
                </p>
              </div>

              {/* Receipt Summary block */}
              <div className="max-w-md mx-auto border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 text-left bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 text-xs font-extrabold text-slate-400 uppercase tracking-wide">
                  <Sparkles className="h-4 w-4 text-[#00A4EF]" />
                  <span>TRANSACTION RECEIPT</span>
                </div>
                
                <div className="space-y-2.5 text-xs border-b border-slate-100 dark:border-slate-800 pb-3.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Deal Title</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{deal.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Price</span>
                    <span className="font-black text-[#00A4EF]">₹{deal.totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                  {isSeller && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Platform Service Fee (10%)</span>
                      <span className="font-bold text-rose-500">-₹{platformFee.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {isSeller && (
                    <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2 font-bold">
                      <span className="text-slate-800 dark:text-slate-200">Net Amount Deposited</span>
                      <span className="font-extrabold text-emerald-600">₹{netSellerReceived.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-400 font-semibold uppercase">
                  <div>
                    <span>Buyer</span>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 normal-case mt-0.5">{deal.client.displayName}</p>
                  </div>
                  <div>
                    <span>Seller</span>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 normal-case mt-0.5">{deal.vendor.displayName}</p>
                  </div>
                </div>

                <div className="text-[10px] text-center text-slate-400 pt-1">
                  Secure Escrow ID: ESC-{deal.id}
                </div>
              </div>

              <div className="max-w-md mx-auto pt-2">
                <Button 
                  onClick={() => navigate(`/chat?chatId=${deal.chatId}`)}
                  className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
                >
                  Back to Chat
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
