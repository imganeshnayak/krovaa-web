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
  verifyPayment, shipEscrowDeal, apiFetch,
  confirmRelease, submitDealReview, cancelEscrowDeal, EscrowDeal, getCurrentUser,
  getDealShippingAddress, OrderAddress,
  requestEscrowReturn, shipEscrowReturn, receiveEscrowReturn, uploadDealImage
} from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import { useAuth } from "@/contexts/AuthContext";
import { useRazorpay } from "@/hooks/useRazorpay";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";
import { AddressSelectionUI } from "@/components/AddressSelectionUI";
import { setEscrowShippingAddress } from "@/lib/api";

export default function DealTransactionPage() {
  const { escrowDealId } = useParams<{ escrowDealId: string }>();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { openCheckout } = useRazorpay();

  const [deal, setDeal] = useState<EscrowDeal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [copiedId, setCopiedId] = useState(false);
  const [buyerAddress, setBuyerAddress] = useState<OrderAddress | null>(null);

  // Shipping Form State
  const [shippingWeight, setShippingWeight] = useState("1.0");
  const [packLength, setPackLength] = useState("15");
  const [packWidth, setPackWidth] = useState("15");
  const [packHeight, setPackHeight] = useState("10");

  // Review Form State
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);

  // Return Flow State
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnVideo, setReturnVideo] = useState<File | null>(null);

  const [showReturnShipModal, setShowReturnShipModal] = useState(false);
  const [returnTrackingId, setReturnTrackingId] = useState("");

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

  // Load buyer shipping address for seller view
  useEffect(() => {
    if (!escrowDealId || !deal) return;
    if (deal.deliveryType === 'shipping') {
      getDealShippingAddress(parseInt(escrowDealId))
        .then(addr => setBuyerAddress(addr))
        .catch(() => { }); // non-blocking
    }
  }, [escrowDealId, deal?.deliveryType]);

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
      await refreshUser();
      fetchWallet();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wallet payment failed.");
    } finally {
      setIsActioning(false);
    }
  };

  const handleAddressSelected = async (address: OrderAddress) => {
    if (!deal) return;
    setIsActioning(true);
    try {
      await setEscrowShippingAddress(deal.id, address.id);
      toast.success("Delivery address updated. Shipping fee calculated.");
      await fetchDealData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update address.");
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
        description: `Secure Payment for: ${deal.title}`,
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
            await refreshUser();
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

    if (!shippingWeight || !packLength || !packWidth || !packHeight) {
      toast.error("Please fill all package parameters.");
      return;
    }

    const formattedDimensions = `${packLength}x${packWidth}x${packHeight}`;

    setIsActioning(true);
    try {
      const updated = await shipEscrowDeal(deal.id, {
        weight: parseFloat(shippingWeight),
        dimensions: formattedDimensions,
        pickupAddress: "Primary Profile Address",
      });
      setDeal(updated);
      toast.success("Package marked as shipped! Tracking details generated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save shipping info.");
    } finally {
      setIsActioning(false);
    }
  };

  const handleDownloadManifest = async () => {
    if (!deal) return;
    setIsActioning(true);
    try {
      const data = await apiFetch(`/api/escrow/${deal.id}/manifest`) as { manifestUrl?: string };
      if (data && data.manifestUrl) {
        window.open(data.manifestUrl, '_blank');
      } else {
        toast.error('Failed to get manifest URL.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to download manifest.');
    } finally {
      setIsActioning(false);
    }
  };

  const handleSimulateDelivery = async () => {
    if (!deal || !deal.trackingId) return;
    setIsActioning(true);
    try {
      const rootUrl = API_BASE_URL.replace(/\/api$/, "");
      await apiFetch(`${rootUrl}/webhooks/shiprocket`, {
        method: "POST",
        body: JSON.stringify({
          awb: deal.trackingId,
          current_status: "delivered",
          courier_name: "Dummy Express"
        })
      });
      toast.success("Delivery simulated! Page will refresh.");
      fetchDealData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to simulate delivery.");
    } finally {
      setIsActioning(false);
    }
  };


  const handleConfirmRelease = async () => {
    if (!deal) return;
    setIsActioning(true);
    try {
      // Automatically submit the rating & review first if selected
      const role = user?.id === deal.clientId ? "buyer" : "seller";
      try {
        await submitDealReview(deal.id, {
          rating,
          comment: comment.trim(),
          role,
        });
      } catch (reviewErr) {
        console.error("Non-blocking rating submit error:", reviewErr);
      }

      const updated = await confirmRelease(deal.id);
      setDeal(updated);
      toast.success("Delivery confirmed and review submitted successfully!");
      await refreshUser();
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

  const handleCancelDeal = async () => {
    if (!deal) return;
    if (!confirm("Are you sure you want to cancel this order? This action cannot be undone.")) return;

    setIsActioning(true);
    try {
      const updated = await cancelEscrowDeal(deal.id);
      setDeal(updated);
      toast.success("Order cancelled successfully.");
      await refreshUser();
      fetchWallet();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel order.");
    } finally {
      setIsActioning(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deal || !returnReason.trim() || !returnVideo) {
      toast.error("Please provide a reason and upload a video showing the issue.");
      return;
    }

    setIsActioning(true);
    try {
      // 1. Upload video
      const res = await uploadDealImage(returnVideo);
      // 2. Submit return request
      await requestEscrowReturn(deal.id, {
        reason: returnReason.trim(),
        videoUrl: res.imageUrl
      });
      toast.success("Return requested successfully. Awaiting admin approval.");
      setShowReturnModal(false);
      fetchDealData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit return request.");
    } finally {
      setIsActioning(false);
    }
  };

  const handleReturnShip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deal || !returnTrackingId.trim()) return;

    setIsActioning(true);
    try {
      await shipEscrowReturn(deal.id, returnTrackingId.trim());
      toast.success("Return shipment confirmed!");
      setShowReturnShipModal(false);
      fetchDealData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save return tracking ID.");
    } finally {
      setIsActioning(false);
    }
  };

  const handleReturnReceive = async () => {
    if (!deal) return;
    if (!confirm("Are you sure you have received the returned item? This will allow the refund to proceed.")) return;

    setIsActioning(true);
    try {
      await receiveEscrowReturn(deal.id);
      toast.success("Return received successfully. The refund will be processed by the admin.");
      fetchDealData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to confirm return receipt.");
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

  const isBuyer = Number(user?.id) === deal.clientId;
  const isSeller = Number(user?.id) === deal.vendorId;

  // Use the platform fee actually recorded when the client paid, so a change to
  // the configured rate never changes what an existing deal shows.
  const recordedPlatformFee = (deal.transactions || [])
    .filter((tx) => tx.note === "platform_fee")
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const platformFee = recordedPlatformFee;
  const platformFeePercent =
    deal.totalAmount > 0 ? (platformFee / deal.totalAmount) * 100 : 0;
  const netSellerReceived = Math.max(0, deal.totalAmount - platformFee);
  // Amount actually released to the seller so far, for accurate status copy.
  const amountReleasedToVendor = (deal.transactions || [])
    .filter((tx) => tx.note !== "platform_fee")
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  // Determine current active workflow step
  let currentStep = 1;
  let stepTitle = "Inquiry";

  if (deal.status === "pending_payment") {
    currentStep = 3;
    stepTitle = "Deposit Payment";
  } else if (deal.status === "active" && !deal.trackingId) {
    currentStep = 4;
    stepTitle = "Prepare Shipment";
  } else if (deal.status === "active" && deal.trackingId) {
    // ✅ Fixed: any trackingId set = step 5+ (covers pickup_scheduled, in_transit, out_for_delivery)
    if (deal.shippingStatus === "out_for_delivery") {
      currentStep = 5;
      stepTitle = "Out for Delivery";
    } else if (deal.shippingStatus === "delivered") {
      currentStep = 6;
      stepTitle = "Delivered";
    } else {
      currentStep = 5;
      stepTitle = "In Transit";
    }
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
            <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">SECURE PAYMENT DEAL</span>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const uncancelableStatuses = ['pickup_scheduled', 'in_transit', 'out_for_delivery', 'delivered', 'rto'];
              const isCancellable = (deal.status === 'pending_payment' || deal.status === 'active') &&
                (!deal.shippingStatus || !uncancelableStatuses.includes(deal.shippingStatus));
              return isCancellable ? (
                <button
                  onClick={handleCancelDeal}
                  disabled={isActioning}
                  className="h-8 px-3 rounded-lg flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-500 font-bold text-xs transition-colors"
                >
                  Cancel
                </button>
              ) : null;
            })()}
            <button
              onClick={fetchDealData}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title="Refresh status"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
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
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isCompleted
                      ? "bg-emerald-500 text-white shadow-sm"
                      : isActive
                        ? "bg-[#00A4EF] text-white ring-4 ring-sky-100 dark:ring-sky-950"
                        : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
                    }`}>
                    {isCompleted ? <Check className="h-4 w-4" /> : s.num}
                  </div>
                  <span className={`text-xs font-bold transition-colors ${isActive ? "text-[#00A4EF] dark:text-sky-400" : isCompleted ? "text-slate-800 dark:text-slate-300" : "text-slate-400 dark:text-slate-600"
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
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Secure Payment Deposit</h3>
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
                    {(() => {
                      const shippingMatch = deal.description?.match(/Includes ₹(\d+(?:\.\d+)?) shipping fee/i);
                      const shippingFee = shippingMatch ? Number(shippingMatch[1]) : 0;
                      const baseItemPrice = deal.totalAmount - shippingFee;

                      return (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Item Price</span>
                            <span className="font-semibold text-slate-900 dark:text-white">₹{baseItemPrice.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Secure Payment Protection Fee</span>
                            <span className="font-semibold text-emerald-600">FREE</span>
                          </div>
                          {shippingFee > 0 && (
                            <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5 mt-2.5">
                              <span className="text-slate-500">Shipping Fee</span>
                              <span className="font-semibold text-slate-900 dark:text-white">₹{shippingFee.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                          <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 flex justify-between font-bold text-base">
                            <span className="text-slate-900 dark:text-white font-extrabold">Total Amount</span>
                            <span className="text-[#00A4EF] dark:text-sky-400">₹{deal.totalAmount.toLocaleString('en-IN')}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {deal.deliveryType === 'shipping' && (
                    <div className="pt-2">
                      <AddressSelectionUI
                        dealId={deal.id}
                        onAddressSelected={handleAddressSelected}
                        selectedAddressId={deal.shippingAddressId}
                      />
                    </div>
                  )}

                  <div className="space-y-2.5 pt-2">
                    <Button
                      onClick={handleRazorpayPayment}
                      disabled={isActioning || (deal.deliveryType === 'shipping' && !deal.shippingAddressId)}
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

                  {/* ✅ Show buyer delivery address to seller */}
                  {buyerAddress && (
                    <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30 rounded-xl p-3 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-1">📦 Deliver To (Buyer)</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{buyerAddress.fullName}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{buyerAddress.addressLine1}</p>
                      {buyerAddress.landmark && <p className="text-xs text-slate-500">Near: {buyerAddress.landmark}</p>}
                      <p className="text-xs text-slate-600 dark:text-slate-400">{buyerAddress.city}, {buyerAddress.state} — {buyerAddress.pincode}</p>
                      <p className="text-xs text-slate-500">{buyerAddress.phoneNumber}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="weight" className="text-xs font-bold">Package Weight (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder="e.g. 1.5"
                      value={shippingWeight}
                      onChange={(e) => setShippingWeight(e.target.value)}
                      className="w-full h-10 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Package Size (L x W x H in cm)</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        placeholder="L"
                        value={packLength}
                        onChange={(e) => setPackLength(e.target.value)}
                        className="w-full h-10 bg-white dark:bg-slate-900 text-center text-sm"
                      />
                      <Input
                        type="number"
                        placeholder="W"
                        value={packWidth}
                        onChange={(e) => setPackWidth(e.target.value)}
                        className="w-full h-10 bg-white dark:bg-slate-900 text-center text-sm"
                      />
                      <Input
                        type="number"
                        placeholder="H"
                        value={packHeight}
                        onChange={(e) => setPackHeight(e.target.value)}
                        className="w-full h-10 bg-white dark:bg-slate-900 text-center text-sm"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <p className="text-xs text-slate-500 italic text-center">
                      Package will be picked up from your primary business location configured in your profile.
                    </p>
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
                          <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 z-10 ${e.status === 'delivered' ? 'bg-emerald-500 text-white' : 'bg-[#00A4EF] text-white'
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
                  <div className="pt-2 space-y-3">
                    <div className="bg-amber-50 dark:bg-amber-950/20 border-2 border-dashed border-amber-300 dark:border-amber-900/50 rounded-2xl p-4 text-amber-950 dark:text-amber-100 shadow-sm">
                      <p className="text-sm font-extrabold flex items-center gap-1.5 mb-2 uppercase tracking-wide text-amber-950 dark:text-amber-200">
                        ⚠️ Important Shipping Instructions
                      </p>
                      <ul className="text-xs space-y-2 list-disc pl-4 font-black leading-relaxed">
                        <li>PRINT the downloaded Shipping Label.</li>
                        <li>PASTE the printed label flat and secure on top of your package.</li>
                        <li>DO NOT cover or wrap tape directly over the AWB Barcode/QR code.</li>
                        <li>HAND OVER the package to the courier executive when they arrive.</li>
                      </ul>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={() => window.open(deal.shippingLabelUrl, '_blank')}
                        variant="outline"
                        className="w-full h-11 border-[#00A4EF]/30 text-[#00A4EF] bg-sky-50/70 hover:bg-sky-100 font-extrabold gap-2 text-xs rounded-xl shadow-sm"
                      >
                        <FileText className="h-4 w-4" />
                        Download Label
                      </Button>
                      <Button
                        onClick={handleDownloadManifest}
                        disabled={isActioning}
                        variant="outline"
                        className="w-full h-11 border-indigo-200 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100/70 font-extrabold gap-2 text-xs rounded-xl shadow-sm"
                      >
                        <FileText className="h-4 w-4" />
                        {isActioning ? "Generating..." : "Download Manifest"}
                      </Button>
                    </div>
                  </div>
                )}

                {deal.trackingId?.includes('DUMMY') && deal.shippingStatus !== 'delivered' && (
                  <div className="pt-2">
                    <Button
                      onClick={handleSimulateDelivery}
                      disabled={isActioning}
                      className="w-full h-10 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-bold gap-2 text-xs rounded-xl"
                    >
                      <Truck className="h-4 w-4 animate-bounce" />
                      Simulate Delivery (Dev Only)
                    </Button>
                  </div>
                )}


                {/* Buyer Confirm Receipt & Return CTA */}
                {deal.shippingStatus === "delivered" && isBuyer && (
                  <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {/* Integrated Rating/Review Card */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-center">
                        Rate your experience with {deal.vendor.displayName || deal.vendor.username}
                      </p>

                      <div className="flex flex-col items-center gap-1">
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
                                className="p-1 focus:outline-none transition-transform hover:scale-110"
                              >
                                <Star
                                  className={`h-7 w-7 transition-colors ${isLit ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-700"
                                    }`}
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="delivered-review" className="text-[10px] font-bold text-slate-500 uppercase">Review Comment (Optional)</Label>
                        <Textarea
                          id="delivered-review"
                          placeholder="Share details of your experience with this transaction..."
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          className="rounded-xl min-h-[60px] text-xs"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleConfirmRelease}
                      disabled={isActioning}
                      className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold gap-2 text-sm shadow-md shadow-emerald-100 dark:shadow-none"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isActioning ? "Releasing funds..." : "Confirm Delivery & Submit Review"}
                    </Button>
                    {(new Date().getTime() - new Date(deal.updatedAt).getTime()) <= 3 * 24 * 60 * 60 * 1000 && (
                      <Button
                        onClick={() => setShowReturnModal(true)}
                        variant="outline"
                        className="w-full h-12 rounded-xl border-slate-200 hover:bg-slate-50 font-bold text-slate-600 text-sm"
                      >
                        <ShieldAlert className="h-4 w-4 mr-1" />
                        Request Return / Refund
                      </Button>
                    )}
                  </div>
                )}

                {/* Return Status UI */}
                {["return_requested", "return_approved", "return_rejected", "return_shipped", "return_received", "refunded"].includes(deal.shippingStatus || "") && (
                  <div className="mt-4 p-4 border border-rose-200 bg-rose-50 dark:bg-rose-950/20 rounded-xl space-y-3">
                    <h4 className="text-sm font-bold text-rose-700 dark:text-rose-400">Return Status</h4>
                    <p className="text-xs text-rose-600/80 dark:text-rose-400/80 capitalize">
                      Current State: <span className="font-bold">{deal.shippingStatus?.replace(/_/g, " ")}</span>
                    </p>

                    {deal.shippingStatus === "return_approved" && isBuyer && (
                      <div className="space-y-2.5 pt-1">
                        <p className="text-[11px] text-rose-600/80 leading-relaxed">
                          Your return has been approved! An automated return shipping label has been generated. Please download and print the label, paste it securely on your package, and hand it to the courier executive.
                        </p>
                        {deal.shippingLabelUrl && (
                          <Button
                            onClick={() => window.open(deal.shippingLabelUrl, '_blank')}
                            className="w-full h-10 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <FileText className="h-4 w-4" />
                            Download Return Label
                          </Button>
                        )}
                        <p className="text-[10px] text-slate-400 italic">
                          * A return shipping fee of ₹150 will be deducted from your final refund amount.
                        </p>
                      </div>
                    )}
                    {deal.shippingStatus === "return_shipped" && isSeller && (
                      <Button onClick={handleReturnReceive} className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg mt-2">
                        Confirm Return Received
                      </Button>
                    )}
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
                            className={`h-8 w-8 transition-colors ${isLit ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-700"
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
                  Thank you for completing the transaction and submitting your review. The secure payment cycle is now complete.
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
                  {isSeller && platformFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        Platform Service Fee ({platformFeePercent.toFixed(2).replace(/\.?0+$/, "")}%)
                      </span>
                      <span className="font-bold text-rose-500">-₹{platformFee.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {isSeller && (
                    <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2 font-bold">
                      <span className="text-slate-800 dark:text-slate-200">Net Amount Deposited</span>
                      <span className="font-extrabold text-emerald-600">₹{netSellerReceived.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {isSeller && deal.releasedPercent > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Released to you ({deal.releasedPercent}%)</span>
                      <span className="font-bold text-emerald-600">₹{amountReleasedToVendor.toLocaleString('en-IN')}</span>
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
                  Secure Pay ID: ESC-{deal.id}
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

      {/* Return Modals */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-xl font-bold mb-2">Request Return</h3>
            <p className="text-sm text-slate-500 mb-2">Please provide a reason and upload video proof.</p>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-xl p-3 mb-4 text-xs text-amber-800 dark:text-amber-300 font-medium">
              ⚠️ <strong>Important Return Rule:</strong> Returns are only processed when you provide a complete, continuous <strong>unboxing video</strong> of the product <strong>without any cuts or edits</strong>.
            </div>

            <form onSubmit={handleReturnSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Reason for Return</Label>
                <Textarea
                  required
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Item arrived damaged, does not match description..."
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">Video Proof (Required)</Label>
                <Input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => setReturnVideo(e.target.files?.[0] || null)}
                  required
                  className="file:bg-sky-50 file:text-sky-700 file:border-0 file:mr-4 file:px-4 file:py-2 file:rounded-lg"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowReturnModal(false)} className="flex-1 rounded-xl">Cancel</Button>
                <Button type="submit" disabled={isActioning} className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold">
                  {isActioning ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReturnShipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-xl font-bold mb-2">Return Tracking</h3>
            <p className="text-sm text-slate-500 mb-4">Your return has been approved. Please ship the item back and enter the tracking ID below.</p>

            <form onSubmit={handleReturnShip} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Tracking ID / Waybill</Label>
                <Input
                  required
                  value={returnTrackingId}
                  onChange={(e) => setReturnTrackingId(e.target.value)}
                  placeholder="e.g. AWB123456789"
                  className="rounded-xl"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowReturnShipModal(false)} className="flex-1 rounded-xl">Cancel</Button>
                <Button type="submit" disabled={isActioning} className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold">
                  {isActioning ? "Saving..." : "Save Tracking"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
