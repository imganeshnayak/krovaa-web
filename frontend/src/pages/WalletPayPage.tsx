import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getWalletRecipient, transferWalletBalance, WalletRecipient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const WalletPayPage = () => {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [recipient, setRecipient] = useState<WalletRecipient | null>(null);
  const [amount, setAmount] = useState("500");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Pay Wallet - Krovaa";
  }, []);

  useEffect(() => {
    const fetchRecipient = async () => {
      if (!shareId) {
        setError("Recipient share ID not provided.");
        setIsLoading(false);
        return;
      }

      try {
        const data = await getWalletRecipient(shareId);
        setRecipient(data);
      } catch (err: any) {
        console.error("Failed to load wallet recipient:", err);
        setError(err?.message || "Unable to load recipient.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecipient();
  }, [shareId]);

  const handleSubmit = async () => {
    if (!recipient || !shareId) {
      setError("Recipient details are missing.");
      return;
    }

    if (!user) {
      navigate(`/login`, { state: { from: `/wallet/pay/${shareId}` } });
      return;
    }

    if (user.id === recipient.id) {
      setError("You cannot pay yourself.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid payment amount.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await transferWalletBalance({ shareId, amount: parsedAmount, note });
      toast.success(`₹${parsedAmount.toFixed(2)} sent to ${recipient.displayName || recipient.username}.`);
      navigate("/wallet");
    } catch (err: any) {
      console.error("Wallet transfer failed:", err);
      setError(err?.message || "Payment failed. Please try again.");
      toast.error(err?.message || "Unable to complete the payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" asChild>
          <Link to="/wallet" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Wallet
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Send money to wallet</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-blue-500" /> Wallet Payment
          </CardTitle>
          <CardDescription>
            Use this page to make a direct wallet transfer to another Krovaa user.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading || authLoading ? (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-3" />
              Loading payment details...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : recipient ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border p-4 bg-secondary/50">
                <p className="text-sm text-muted-foreground">Paying</p>
                <p className="text-lg font-semibold">{recipient.displayName || recipient.username}</p>
                <p className="text-sm text-muted-foreground">Share ID: {recipient.shareId}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="rounded-full px-3 py-1 text-xs font-medium bg-green-100 text-green-700">Verified Recipient</span>
                  <span className="rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-700">Wallet ready</span>
                </div>
              </div>

              <div className="grid gap-4">
                <div>
                  <Label htmlFor="amount">Amount (INR)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="500"
                  />
                </div>
                <div>
                  <Label htmlFor="note">Note (optional)</Label>
                  <Input
                    id="note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="For your support or project payment"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  You must be logged in to complete the transfer. If you are not logged in, you will be redirected to the login page.
                </p>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Processing payment
                    </span>
                  ) : (
                    `Pay ₹${parseFloat(amount || "0") > 0 ? parseFloat(amount).toFixed(2) : "0.00"}`
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default WalletPayPage;
