import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, getImageGeneratorPricing, getWalletBalance, paySubscriptionWithWallet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Check, Sparkles, Zap, Rocket, Crown, ArrowLeft, Loader2 } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  monthlyEquivalent: number;
  features: string[];
  highlighted: boolean;
  icon: React.ReactNode;
}

const DEFAULT_PLANS: Plan[] = [
  {
    id: "free",
    name: "Starter",
    description: "Perfect for trying out AI image generation",
    monthlyPrice: 0,
    annualPrice: 0,
    monthlyEquivalent: 0,
    features: [
      "5 images per month",
      "Standard quality",
      "Basic styles",
      "Community support",
    ],
    highlighted: false,
    icon: <Sparkles className="h-6 w-6" />,
  },
  {
    id: "pro",
    name: "Pro",
    description: "For regular creators who need more",
    monthlyPrice: 299,
    annualPrice: 2390,
    monthlyEquivalent: 199,
    features: [
      "100 images per month",
      "High quality (1024x1024)",
      "All styles & aspect ratios",
      "Priority generation",
      "No watermarks",
      "Download history",
      "Email support",
    ],
    highlighted: true,
    icon: <Zap className="h-6 w-6" />,
  },
  {
    id: "enterprise",
    name: "Extra",
    description: "For power users and teams",
    monthlyPrice: 799,
    annualPrice: 6390,
    monthlyEquivalent: 533,
    features: [
      "Unlimited images",
      "Premium quality (2048x2048)",
      "All styles & aspect ratios",
      "Instant generation",
      "No watermarks",
      "API access",
      "Priority support",
      "Custom models",
    ],
    highlighted: false,
    icon: <Crown className="h-6 w-6" />,
  },
];

declare global {
  interface Window {
    Razorpay: any;
  }
}

const ImageGeneratorPricingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [pricingLoading, setPricingLoading] = useState(false);

  useEffect(() => {
    document.title = "Pricing - KrovAI Image Generator";
  }, []);

  useEffect(() => {
    loadPricing();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUserSubscription();
      loadWalletBalance();
    }
  }, [isAuthenticated]);

  const loadPricing = async () => {
    try {
      setPricingLoading(true);
      const data = await getImageGeneratorPricing();
      const updatedPlans = DEFAULT_PLANS.map((plan) => {
        const override = data.plans.find((item) => item.id === plan.id);
        if (!override) return plan;
        return {
          ...plan,
          name: override.name,
          monthlyPrice: override.monthlyPrice,
          annualPrice: override.annualPrice,
          monthlyEquivalent: override.monthlyEquivalent,
        };
      });
      setPlans(updatedPlans);
    } catch (error) {
      console.error("Failed to load pricing:", error);
    } finally {
      setPricingLoading(false);
    }
  };

  const fetchUserSubscription = async () => {
    try {
      const data = await apiFetch("/api/subscriptions/status");
      setUserSubscription(data);
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
    }
  };

  const loadWalletBalance = async () => {
    try {
      const data = await getWalletBalance();
      setWalletBalance(data.balance);
    } catch (error) {
      console.error("Failed to load wallet balance:", error);
    }
  };

  const handleSelectPlan = async (plan: Plan) => {
    if (plan.id === "free") {
      if (!isAuthenticated) {
        navigate("/login?redirect=/image-generator/pricing");
        return;
      }
      try {
        await apiFetch("/api/subscriptions/subscribe", {
          method: "POST",
          body: JSON.stringify({ planId: "free" }),
        });
        toast({ title: "Subscribed", description: "You now have the Starter plan!" });
        fetchUserSubscription();
      } catch (error) {
        toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to subscribe", variant: "destructive" });
      }
      return;
    }

    if (!isAuthenticated) {
      navigate("/login?redirect=/image-generator/pricing");
      return;
    }

    setSelectedPlan(plan);
    setShowPaymentDialog(true);
  };

  const processPayment = async () => {
    if (!selectedPlan) return;

    setLoadingPlan(selectedPlan.id);

    try {
      await paySubscriptionWithWallet(selectedPlan.id, false);
      toast({ title: "Success!", description: `You now have the ${selectedPlan.name} plan!` });
      setShowPaymentDialog(false);
      fetchUserSubscription();
      loadWalletBalance();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to pay with wallet", variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  const getCurrentPlanBadge = (planId: string) => {
    if (userSubscription?.planId === planId) {
      return <Badge className="bg-[#D946EF] hover:bg-[#D946EF]/90 text-white">Current Plan</Badge>;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#FDF4FF] text-[#1C1C1C] font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
        .font-sans { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}</style>

      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-[#D946EF]/10 blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-[#F97316]/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#D946EF]/5 to-[#F97316]/5 blur-[180px]" />
      </div>

      {/* Sticky Header */}
      <div className="sticky top-0 z-50 border-b border-white/20 backdrop-blur-xl bg-white/60">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/image-generator")}
            className="flex items-center gap-2 text-[#1C1C1C]/60 hover:text-[#1C1C1C] transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Generator
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#D946EF] to-[#E879F9] flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-[#1C1C1C]">KrovAI</span>
          </div>
          <Button
            variant="ghost"
            className="text-sm font-medium text-[#D946EF] hover:text-[#D946EF]/80 hover:bg-[#D946EF]/10"
            onClick={() => isAuthenticated ? navigate("/image-generator") : navigate("/login")}
          >
            {isAuthenticated ? "Go to Generator" : "Sign In"}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 border border-[#D946EF]/20 backdrop-blur-sm mb-6">
            <Sparkles className="h-4 w-4 text-[#D946EF]" />
            <span className="text-sm font-medium text-[#86198F]">AI Image Generation</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-[#1C1C1C] mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Choose Your Creative Power
          </h1>
          <p className="text-lg text-[#1C1C1C]/60 max-w-2xl mx-auto mb-8">
            Unlock the full potential of AI image generation. Start free, upgrade when you're ready.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-4 px-1 py-1 rounded-full bg-white/60 border border-[#D946EF]/20 backdrop-blur-sm">
            <span className="px-4 py-2 rounded-full bg-[#D946EF] text-white shadow-lg shadow-[#D946EF]/20 text-sm font-semibold">
              Monthly billing only
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative overflow-hidden transition-all duration-300 hover:scale-[1.02] ${
                plan.highlighted
                  ? "border-2 border-[#D946EF] bg-white/80 backdrop-blur-xl shadow-xl shadow-[#D946EF]/10"
                  : "border border-white/40 bg-white/60 backdrop-blur-xl hover:border-[#D946EF]/30"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D946EF] to-[#F97316]" />
              )}

              <CardHeader className="text-center pb-4">
                <div
                  className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                    plan.highlighted
                      ? "bg-gradient-to-br from-[#D946EF] to-[#E879F9] text-white shadow-lg shadow-[#D946EF]/20"
                      : "bg-[#FDF4FF] text-[#D946EF]"
                  }`}
                >
                  {plan.icon}
                </div>
                <CardTitle className="text-xl font-bold text-[#1C1C1C]">{plan.name}</CardTitle>
                <CardDescription className="text-[#1C1C1C]/50">{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="text-center">
                <div className="mb-6">
                  <span className="text-4xl font-bold text-[#1C1C1C]">
                    ₹{plan.monthlyPrice}
                  </span>
                  <span className="text-[#1C1C1C]/50">/month</span>
                </div>

                <div className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm text-[#1C1C1C]/70">
                      <div className="w-5 h-5 rounded-full bg-[#D946EF]/10 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3 w-3 text-[#D946EF]" />
                      </div>
                      {feature}
                    </div>
                  ))}
                </div>
              </CardContent>

              <CardFooter className="pt-4">
                <Button
                  className={`w-full rounded-xl font-semibold transition-all ${
                    plan.highlighted
                      ? "bg-gradient-to-r from-[#D946EF] to-[#F97316] hover:from-[#D946EF]/90 hover:to-[#F97316]/90 text-white shadow-lg shadow-[#D946EF]/20"
                      : "bg-[#1C1C1C] hover:bg-[#1C1C1C]/80 text-white"
                  }`}
                  onClick={() => handleSelectPlan(plan)}
                  disabled={loadingPlan !== null || userSubscription?.planId === plan.id}
                >
                  {loadingPlan === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : userSubscription?.planId === plan.id ? (
                    "Current Plan"
                  ) : (
                    plan.monthlyPrice === 0 ? "Get Started Free" : "Subscribe Now"
                  )}
                </Button>
                {getCurrentPlanBadge(plan.id)}
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Features Comparison */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center text-[#1C1C1C] mb-8">Why Choose Pro?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/40">
              <div className="w-12 h-12 rounded-xl bg-[#D946EF]/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-6 w-6 text-[#D946EF]" />
              </div>
              <h3 className="font-semibold text-[#1C1C1C] mb-2">20x More Images</h3>
              <p className="text-sm text-[#1C1C1C]/50">Generate up to 100 images per month vs just 5 on free</p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/40">
              <div className="w-12 h-12 rounded-xl bg-[#D946EF]/10 flex items-center justify-center mx-auto mb-4">
                <Rocket className="h-6 w-6 text-[#D946EF]" />
              </div>
              <h3 className="font-semibold text-[#1C1C1C] mb-2">Premium Quality</h3>
              <p className="text-sm text-[#1C1C1C]/50">Generate images at 1024x1024 resolution with all styles</p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/40">
              <div className="w-12 h-12 rounded-xl bg-[#D946EF]/10 flex items-center justify-center mx-auto mb-4">
                <Crown className="h-6 w-6 text-[#D946EF]" />
              </div>
              <h3 className="font-semibold text-[#1C1C1C] mb-2">No Watermarks</h3>
              <p className="text-sm text-[#1C1C1C]/50">Use your generated images commercially without restrictions</p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-[#1C1C1C] mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              {
                q: "Can I cancel anytime?",
                a: "Yes! You can cancel your subscription at any time. You'll continue to have access until your billing period ends.",
              },
              {
                q: "What payment methods do you accept?",
                a: "We accept all major credit/debit cards, UPI, and net banking through Razorpay.",
              },
              {
                q: "Can I upgrade or downgrade my plan?",
                a: "Absolutely! You can change your plan at any time. The price difference will be adjusted in your next billing cycle.",
              },
              {
                q: "Do unused images roll over?",
                a: "No, your monthly image allocation resets at the beginning of each billing period.",
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl bg-white/60 backdrop-blur-xl border border-white/40"
              >
                <h3 className="font-semibold text-[#1C1C1C] mb-2">{faq.q}</h3>
                <p className="text-sm text-[#1C1C1C]/50">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md bg-white border-[#E0E0E0] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#1C1C1C]">Subscribe to {selectedPlan?.name}</DialogTitle>
            <DialogDescription className="text-[#1C1C1C]/50">
              {selectedPlan && (
                <span>Monthly billing: ₹{selectedPlan.monthlyPrice}/month</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 rounded-xl bg-[#FDF4FF] border border-[#D946EF]/20">
              <div className="flex items-center gap-3 mb-3">
                <Sparkles className="h-5 w-5 text-[#D946EF]" />
                <span className="font-semibold text-[#1C1C1C]">{selectedPlan?.name} Plan</span>
              </div>
              <ul className="space-y-1.5 text-sm text-[#1C1C1C]/60">
                {selectedPlan?.features.slice(0, 4).map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-[#D946EF]" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {selectedPlan && (
              <div className="mt-4 rounded-xl border border-[#E0E0E0] bg-[#F8F0FF] p-4 text-sm">
                <p className="font-medium text-[#1C1C1C]">Wallet Balance</p>
                <p className="text-lg font-semibold text-[#1C1C1C]">₹{walletBalance.toLocaleString('en-IN')}</p>
                <p className="text-sm text-muted-foreground">
                  {walletBalance >= selectedPlan.monthlyPrice
                    ? "You have enough balance to pay with your wallet."
                    : `Add ₹${Math.max(0, selectedPlan.monthlyPrice - walletBalance).toLocaleString('en-IN')} to use wallet payment.`}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPaymentDialog(false)}
              className="border-[#E0E0E0] text-[#1C1C1C] hover:bg-[#F5F5F5]"
            >
              Cancel
            </Button>
            <Button
              onClick={processPayment}
              disabled={loadingPlan !== null}
              className="bg-gradient-to-r from-[#D946EF] to-[#F97316] hover:from-[#D946EF]/90 hover:to-[#F97316]/90 text-white"
            >
              {loadingPlan ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {selectedPlan?.monthlyPrice === 0 ? "Confirm" : "Pay with Wallet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageGeneratorPricingPage;