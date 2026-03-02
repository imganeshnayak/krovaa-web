import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getEscrowDeals, createEscrowDeal, releaseEscrowPayment, EscrowDeal, initiateEscrowPayment, verifyPayment, deleteEscrowDeal, getWalletBalance, getPlatformFee } from "@/lib/api";
import { socketService } from "@/lib/socket";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { useRazorpay } from "@/hooks/useRazorpay";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
}

const EscrowPage = () => {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { openCheckout } = useRazorpay();
  const [deals, setDeals] = useState<EscrowDeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [releasePercent, setReleasePercent] = useState("");
  const [releaseNote, setReleaseNote] = useState("");
  const [releaseByAmount, setReleaseByAmount] = useState(false);
  const [releaseAmount, setReleaseAmount] = useState("");
  const [selectedDeal, setSelectedDeal] = useState<number | null>(null);
  const [isReleasing, setIsReleasing] = useState(false);
  const [searchParams] = useSearchParams();
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  // New deal form
  const [isCreating, setIsCreating] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelingDealId, setCancelingDealId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const presetCancelReasons = [
    "Project no longer needed",
    "Vendor unresponsive",
    "Found alternative provider",
    "Payment issue / Wrong amount",
  ];
  const [newDeal, setNewDeal] = useState({
    chatId: "",
    vendorId: "",
    vendorUsername: "",
    title: "",
    description: "",
    terms: "",
    totalAmount: ""
  });
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [platformFeePercent, setPlatformFeePercent] = useState<number>(0.10); // Default 10%

  useEffect(() => {
    if (!user && !authLoading) {
      navigate("/login");
      return;
    }
    if (user) {
      loadDeals();
    }
  }, [user, authLoading, navigate]);

  // Handle query params for new escrow deal
  useEffect(() => {
    const chatId = searchParams.get("chatId");
    const vendorId = searchParams.get("vendorId");
    const vendorUsername = searchParams.get("vendorUsername");

    if (chatId && vendorId) {
      setNewDeal(prev => ({
        ...prev,
        chatId,
        vendorId,
        vendorUsername: vendorUsername || ""
      }));
    }
  }, [searchParams]);

  // Fetch platform fee settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getPlatformFee();
        if (data.platform_fee_percent) {
          setPlatformFeePercent(data.platform_fee_percent);
        }
      } catch (err) {
        console.error("Failed to fetch platform fee settings:", err);
      }
    };
    fetchSettings();
  }, []);

  // Listen for real-time escrow updates
  useEffect(() => {
    if (!user) return;

    const cleanup = socketService.onNewMessage(() => {
      loadDeals(); // Refresh deals when messages arrive (might contain escrow updates)
    });

    return cleanup;
  }, [user]);

  const loadDeals = async () => {
    try {
      const chatId = searchParams.get("chatId");
      const data = await getEscrowDeals(chatId || undefined);
      setDeals(data);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load escrow deals",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayForDeal = async (deal: EscrowDeal) => {
    if (isCreating) return;
    if (deal.paymentStatus === 'paid') {
      toast({
        title: "Already Paid",
        description: "Payment has already been completed for this deal.",
      });
      return;
    }

    setIsCreating(true);
    try {
      // Initiate payment
      const paymentOrder = await initiateEscrowPayment(deal.id);

      // Open Razorpay checkout
      openCheckout({
        orderId: paymentOrder.orderId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: "Escrow Payment",
        description: paymentOrder.title || deal.title,
        onSuccess: async (response) => {
          // Verify payment with backend
          try {
            await verifyPayment({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              type: "escrow",
              entityId: deal.id,
            });

            toast({
              title: "Payment Successful!",
              description: "Your escrow deal is now active.",
            });

            loadDeals();
          } catch (err) {
            toast({
              title: "Verification Failed",
              description: err instanceof Error ? err.message : "Failed to verify payment",
              variant: "destructive",
            });
          }
        },
        onFailure: (error) => {
          toast({
            title: "Payment Failed",
            description: error.message || "Payment could not be processed",
            variant: "destructive",
          });
        },
        userDetails: {
          name: user?.displayName,
          email: user?.email,
        },
        keyId: paymentOrder.key_id,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to initiate payment",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateDeal = async () => {
    if (isCreating) return;
    if (!newDeal.chatId || !newDeal.vendorId || !newDeal.title || !newDeal.totalAmount) {
      toast({
        title: "Missing fields",
        description: !newDeal.chatId || !newDeal.vendorId
          ? "Please create escrow deals from within a chat conversation."
          : "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const amount = parseFloat(newDeal.totalAmount);
    setIsCreating(true);
    try {
      // 1. Check wallet balance first
      const { balance } = await getWalletBalance();
      if (balance < amount) {
        toast({
          title: "Insufficient Balance",
          description: `You need ${formatCurrency(amount)} but have only ${formatCurrency(balance)}. Please add money to your wallet.`,
          variant: "destructive",
          action: (
            <Button variant="outline" size="sm" onClick={() => navigate("/wallet")}>
              Add Money
            </Button>
          )
        });
        return;
      }

      toast({
        title: "Creating deal...",
        description: "Funds will be deducted from your wallet."
      });

      const createdDeal = await createEscrowDeal({
        chatId: newDeal.chatId,
        vendorId: parseInt(newDeal.vendorId),
        title: newDeal.title,
        description: newDeal.description,
        terms: newDeal.terms,
        totalAmount: amount
      });

      toast({
        title: "Deal Active",
        description: "Escrow deal has been created and funded successfully."
      });

      setIsNewDealOpen(false);
      setNewDeal({ chatId: "", vendorId: "", vendorUsername: "", title: "", description: "", terms: "", totalAmount: "" });
      loadDeals();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create deal",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRelease = async (dealId: number) => {
    if (isReleasing) return;
    const deal = deals.find(d => d.id === dealId);
    if (!deal) {
      toast({ title: "Error", description: "Deal not found.", variant: "destructive" });
      return;
    }

    let pct: number | null = null;

    if (releaseByAmount) {
      const amt = parseFloat(releaseAmount);
      const platformFeeTx = deal.transactions.find(tx => tx.note === 'platform_fee');
      const feeAmount = platformFeeTx ? platformFeeTx.amount : 0;
      const netTotal = deal.totalAmount - feeAmount;

      const released = netTotal * (deal.releasedPercent / 100);
      const remaining = netTotal - released;
      if (isNaN(amt) || amt <= 0 || amt > remaining) {
        toast({ title: "Invalid amount", description: `Enter amount between 1 and ${formatCurrency(remaining)}`, variant: "destructive" });
        return;
      }
      pct = (amt / netTotal) * 100;
    } else {
      pct = parseFloat(releasePercent);
      if (!pct || pct < 1 || pct > 100) {
        toast({
          title: "Invalid percentage",
          description: "Enter a value between 1 and 100",
          variant: "destructive"
        });
        return;
      }
    }

    setIsReleasing(true);
    try {
      await releaseEscrowPayment(dealId, {
        percent: Number(pct.toFixed(6)),
        note: releaseNote || undefined
      });

      toast({
        title: "Payment released!",
        description: `${pct}% released successfully`
      });

      setReleasePercent("");
      setReleaseAmount("");
      setReleaseByAmount(false);
      setReleaseNote("");
      setSelectedDeal(null);
      loadDeals();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to release payment",
        variant: "destructive"
      });
    } finally {
      setIsReleasing(false);
    }
  };

  const openCancelDialog = (dealId: number) => {
    setCancelingDealId(dealId);
    setCancelReason("");
    setIsCancelDialogOpen(true);
  };

  const handleDeleteDeal = async (dealId: number, isPaid: boolean) => {
    const action = isPaid ? "Cancel & Refund" : "Delete";

    if (isPaid) {
      // Open UI dialog to collect mandatory reason
      openCancelDialog(dealId);
      return;
    }

    if (!confirm("Are you sure you want to delete this deal?")) {
      return;
    }

    setIsCreating(true);
    try {
      const result = await deleteEscrowDeal(dealId);
      toast({ title: "Success", description: result.message });
      loadDeals();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : `Failed to ${action.toLowerCase()} deal`,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const submitCancelRefund = async () => {
    if (!cancelingDealId) return;
    const reason = cancelReason.trim();
    if (!reason) {
      toast({ title: "Reason required", description: "Please enter a reason for the refund.", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const result = await deleteEscrowDeal(cancelingDealId, reason);
      toast({ title: "Success", description: result.message });
      setIsCancelDialogOpen(false);
      setCancelReason("");
      setCancelingDealId(null);
      loadDeals();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to cancel deal", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  if (authLoading || (isLoading && deals.length === 0)) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link to="/chat" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to chats
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-foreground">
              {searchParams.get("chatId") ? "Chat Escrow" : "Escrow Deals"}
            </h1>
            {searchParams.get("chatId") && (
              <button
                onClick={() => navigate("/escrow")}
                className="text-xs text-primary hover:underline w-fit"
              >
                Clear filter (View all deals)
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Dialog open={isNewDealOpen} onOpenChange={setIsNewDealOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" /> New Deal
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border sm:max-w-[425px] w-[95vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-card-foreground">Create Escrow Deal</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-card-foreground">Chat ID</Label>
                    <Input
                      className="mt-1.5 bg-secondary border-border"
                      placeholder="chat_123_456_..."
                      value={newDeal.chatId}
                      onChange={(e) => setNewDeal({ ...newDeal, chatId: e.target.value })}
                      readOnly
                      disabled
                      title="Chat ID is automatically set from the conversation"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Auto-populated from chat</p>
                  </div>
                  <div>
                    <Label className="text-card-foreground">Vendor</Label>
                    <Input
                      className="mt-1.5 bg-secondary border-border"
                      placeholder="Vendor username"
                      value={newDeal.vendorUsername || newDeal.vendorId}
                      readOnly
                      disabled
                      title="Vendor is automatically set from the conversation"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Auto-populated from chat</p>
                  </div>
                  <div>
                    <Label className="text-card-foreground">Title</Label>
                    <Input
                      className="mt-1.5 bg-secondary border-border"
                      placeholder="Project name"
                      value={newDeal.title}
                      onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-card-foreground">Description</Label>
                    <Textarea
                      className="mt-1.5 bg-secondary border-border"
                      placeholder="Project details..."
                      value={newDeal.description}
                      onChange={(e) => setNewDeal({ ...newDeal, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-card-foreground">Terms & Conditions</Label>
                    <Textarea
                      className="mt-1.5 bg-secondary border-border"
                      placeholder="E.g., Revision policy, delivery deadlines..."
                      value={newDeal.terms}
                      onChange={(e) => setNewDeal({ ...newDeal, terms: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-card-foreground">Total Amount (₹)</Label>
                    <Input
                      className="mt-1.5 bg-secondary border-border"
                      type="number"
                      placeholder="5000"
                      value={newDeal.totalAmount}
                      onChange={(e) => setNewDeal({ ...newDeal, totalAmount: e.target.value })}
                    />
                  </div>

                  {parseFloat(newDeal.totalAmount) > 0 && (
                    <div className="bg-secondary/50 rounded-lg p-4 space-y-3 border border-border/50">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Payment Summary</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Amount to be Deducted</span>
                          <span className="font-semibold">{formatCurrency(parseFloat(newDeal.totalAmount))}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground/80">
                          <span>Platform Fee ({(platformFeePercent * 100).toFixed(1)}%)</span>
                          <span>- {formatCurrency(parseFloat(newDeal.totalAmount) * platformFeePercent)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold pt-2 border-t border-border/50">
                          <span className="text-foreground">Vendor will receive (Net)</span>
                          <span className="text-primary">{formatCurrency(parseFloat(newDeal.totalAmount) * (1 - platformFeePercent))}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center italic">
                        * Platform fees are deducted upfront during deal creation.
                      </p>
                    </div>
                  )}

                  <Button className="w-full mt-2" onClick={handleCreateDeal} disabled={isCreating}>
                    {isCreating ? "Creating..." : "Create Deal"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        {/* Cancel / Refund Dialog */}
        <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
          <DialogContent className="bg-card border-border sm:max-w-[520px] w-[95vw]">
            <DialogHeader>
              <DialogTitle className="text-card-foreground">Cancel Deal & Request Refund</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Please tell us why you're cancelling this deal. This reason is required and will be included in the refund record.</p>

              <div className="grid grid-cols-2 gap-2">
                {presetCancelReasons.map((r) => (
                  <button
                    key={r}
                    onClick={() => setCancelReason(r)}
                    className={`px-3 py-2 text-sm rounded-md border ${cancelReason === r ? 'border-primary bg-primary/10' : 'border-border hover:bg-white/3'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div>
                <Label className="text-card-foreground">Reason (required)</Label>
                <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="mt-1 bg-secondary border-border" placeholder="Describe why you want a refund..." rows={4} />
                <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                  <span>{cancelReason.length} characters</span>
                  <span>Minimum required: 5</span>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <Button variant="secondary" onClick={() => { setIsCancelDialogOpen(false); setCancelReason(""); setCancelingDealId(null); }}>Cancel</Button>
                <Button onClick={submitCancelRefund} disabled={isCreating || cancelReason.trim().length < 5}>{isCreating ? 'Processing...' : 'Confirm Cancel & Refund'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg mb-6">
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "active"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
          >
            Active Deals
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "completed"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
          >
            Completed
          </button>
        </div>

        {deals.filter(d => activeTab === "active" ? (d.status === "active" || d.status === "pending_payment") : (d.status === "completed" || d.status === "cancelled")).length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="bg-secondary/30 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <IndianRupee className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-muted-foreground">No {activeTab} deals found.</p>
              {activeTab === "active" && (
                <Button variant="link" onClick={() => setIsNewDealOpen(true)} className="mt-2 text-primary">
                  Create your first deal
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="space-y-4">
              {deals
                .filter(d => activeTab === "active" ? (d.status === "active" || d.status === "pending_payment") : (d.status === "completed" || d.status === "cancelled"))
                .map((deal) => {
                  const isClient = deal.clientId === user?.id;
                  const otherParty = isClient ? deal.vendor : deal.client;
                  const platformFeeTx = deal.transactions.find(tx => tx.note === 'platform_fee');
                  const feeAmount = platformFeeTx ? platformFeeTx.amount : (deal.paymentStatus === 'paid' ? deal.totalAmount * platformFeePercent : 0);
                  const netTotal = deal.totalAmount - feeAmount;

                  const paymentTransactions = deal.transactions.filter(tx => tx.note !== 'platform_fee');
                  const releasedNet = paymentTransactions.reduce((sum, tx) => sum + tx.amount, 0);
                  const remainingNet = Math.max(0, netTotal - releasedNet);

                  return (
                    <Card key={deal.id} className="bg-card border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg text-card-foreground">{deal.title}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">{deal.description}</p>
                            {deal.terms && (
                              <div className="mt-2 p-2 bg-secondary/50 rounded-md border border-border/50">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Terms & Conditions:</p>
                                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{deal.terms}</p>
                              </div>
                            )}
                            <p className="text-sm text-muted-foreground mt-2">
                              {isClient ? "Vendor" : "Client"}: {otherParty.displayName}
                            </p>
                          </div>
                          <Badge className={
                            deal.status === "active" ? "bg-accent text-accent-foreground" :
                              deal.status === "completed" ? "bg-green-500 text-white" :
                                deal.status === "pending_payment" ? "bg-yellow-500 text-white" :
                                  deal.status === "cancelled" ? "bg-destructive/10 text-destructive border-destructive/20" :
                                    "bg-muted text-muted-foreground"
                          }>
                            {deal.status === "pending_payment" ? "Awaiting Payment" :
                              deal.status === "cancelled" ? "Cancelled/Refunded" :
                                deal.status}
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent>
                        {/* Amounts */}

                        <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Net Deal Amount</p>
                            <p className="text-lg font-bold text-foreground">{formatCurrency(netTotal)}</p>
                            {feeAmount > 0 && <p className="text-[9px] text-muted-foreground/60">(₹{deal.totalAmount} gross)</p>}
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Net Released</p>
                            <p className="text-lg font-bold text-primary">{formatCurrency(releasedNet)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Net Remaining</p>
                            <p className="text-lg font-bold text-coral">{formatCurrency(remainingNet)}</p>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="mb-4">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Payment Progress</span>
                            <span>{deal.releasedPercent.toFixed(1)}%</span>
                          </div>
                          <Progress value={deal.releasedPercent} className="h-3" />
                        </div>

                        {/* Transactions */}
                        {deal.transactions.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold text-card-foreground mb-2">Transaction History</h4>
                            <div className="space-y-2">
                              {deal.transactions.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2">
                                  <div>
                                    <p className="text-sm text-secondary-foreground">{tx.note || "Payment released"}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(tx.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-semibold text-primary">{formatCurrency(tx.amount)}</p>
                                    <p className="text-xs text-muted-foreground">{tx.percent}%</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Release button - only for client and active deals */}
                        {isClient && deal.status === "active" && deal.releasedPercent < 100 && (
                          <Dialog open={selectedDeal === deal.id} onOpenChange={(open) => !open && setSelectedDeal(null)}>
                            <DialogTrigger asChild>
                              <Button className="w-full" onClick={() => setSelectedDeal(deal.id)}>
                                Release Payment
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-card border-border sm:max-w-[425px] w-[95vw] max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="text-card-foreground">Release Payment</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Label className="text-card-foreground">Release Method</Label>
                                    <div className="ml-auto flex items-center gap-2">
                                      <button
                                        className={`px-3 py-1 rounded-md border ${!releaseByAmount ? 'border-primary bg-primary/10' : 'border-border'}`}
                                        onClick={() => { setReleaseByAmount(false); setReleaseAmount(""); }}
                                      >
                                        By %
                                      </button>
                                      <button
                                        className={`px-3 py-1 rounded-md border ${releaseByAmount ? 'border-primary bg-primary/10' : 'border-border'}`}
                                        onClick={() => { setReleaseByAmount(true); setReleasePercent(""); }}
                                      >
                                        By Amount
                                      </button>
                                    </div>
                                  </div>

                                  {!releaseByAmount ? (
                                    <div>
                                      <Label className="text-card-foreground">Percentage to Release</Label>
                                      <Input
                                        className="mt-1.5 bg-secondary border-border"
                                        type="number"
                                        min="1"
                                        max={100 - deal.releasedPercent}
                                        placeholder={`Max ${(100 - deal.releasedPercent).toFixed(1)}%`}
                                        value={releasePercent}
                                        onChange={(e) => setReleasePercent(e.target.value)}
                                      />
                                    </div>
                                  ) : (
                                    <div>
                                      <Label className="text-card-foreground">Amount to Release (₹)</Label>
                                      <Input
                                        className="mt-1.5 bg-secondary border-border"
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        max={netTotal * (1 - deal.releasedPercent / 100)}
                                        placeholder={`Max ${formatCurrency(netTotal * (1 - deal.releasedPercent / 100))}`}
                                        value={releaseAmount}
                                        onChange={(e) => setReleaseAmount(e.target.value)}
                                      />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <Label className="text-card-foreground">Note</Label>
                                  <Input
                                    className="mt-1.5 bg-secondary border-border"
                                    placeholder="Milestone completed..."
                                    value={releaseNote}
                                    onChange={(e) => setReleaseNote(e.target.value)}
                                  />
                                </div>
                                <Button className="w-full" onClick={() => handleRelease(deal.id)} disabled={isReleasing}>
                                  {isReleasing ? "Releasing..." : "Confirm Release"}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}

                        {/* Payment button - for pending_payment deals */}
                        {isClient && deal.status === "pending_payment" && deal.paymentStatus !== "paid" && (
                          <div className="flex gap-2">
                            <Button className="flex-1 bg-primary" onClick={() => handlePayForDeal(deal)} disabled={isCreating}>
                              {isCreating ? "Processing..." : "Complete Payment"}
                            </Button>
                            <Button variant="outline" className="border-coral text-coral hover:bg-coral/10" onClick={() => handleDeleteDeal(deal.id, false)} disabled={isCreating}>
                              Delete
                            </Button>
                          </div>
                        )}

                        {/* Cancel & Refund button - for active deals */}
                        {isClient && deal.status === "active" && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <Button
                              variant="ghost"
                              className="w-full text-muted-foreground hover:text-coral hover:bg-coral/10 text-xs"
                              onClick={() => handleDeleteDeal(deal.id, true)}
                              disabled={isCreating}
                            >
                              Cancel & Refund Remaining
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div >
  );
};

export default EscrowPage;
