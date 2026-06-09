import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { 
  ArrowLeft, 
  BadgeCheck, 
  Copy, 
  ExternalLink, 
  Loader2, 
  MapPin, 
  Wallet, 
  AlertTriangle, 
  CheckCircle2,
  Clock,
  RefreshCw,
  QrCode,
  ShieldAlert,
  KeyRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { WalletRecipient, getWalletRecipient, getSecureReceiveLink, transferWalletBalance, getWalletBalance } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const LARGE_TRANSFER_THRESHOLD = 10000;

const WalletPayPage = () => {
  const { shareId = "" } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const expires = searchParams.get("expires") || "";
  const token = searchParams.get("token") || "";

  const { user } = useAuth();
  
  const isSelf = useMemo(() => {
    if (!user) return false;
    return shareId === user.shareId || shareId === user.username;
  }, [user, shareId]);

  const [recipient, setRecipient] = useState<WalletRecipient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [transferResult, setTransferResult] = useState<{
    amount: number;
    senderBalance: number;
    recipientBalance: number;
  } | null>(null);

  // 3-step wizard states
  const [step, setStep] = useState(1);
  const [senderBalance, setSenderBalance] = useState<number | null>(null);

  // States for receive link and timer
  const [password, setPassword] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [receiveLinkData, setReceiveLinkData] = useState<{
    shareId: string;
    expires: number;
    token: string;
    shareUrl: string;
  } | null>(null);
  const [isLoadingLink, setIsLoadingLink] = useState(false);

  const fetchReceiveLink = async () => {
    setIsLoadingLink(true);
    try {
      const data = await getSecureReceiveLink();
      setReceiveLinkData(data);
      setCurrentTime(Date.now());
    } catch (err) {
      toast.error("Failed to generate secure receive link.");
    } finally {
      setIsLoadingLink(false);
    }
  };

  useEffect(() => {
    if (isSelf) {
      fetchReceiveLink();
    }
  }, [isSelf]);

  useEffect(() => {
    if (!isSelf && user) {
      getWalletBalance()
        .then((data) => setSenderBalance(data.balance))
        .catch(console.error);
    }
  }, [isSelf, user]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const expiryTime = useMemo(() => {
    if (isSelf) {
      return receiveLinkData?.expires || 0;
    }
    const parsed = parseInt(expires);
    return isNaN(parsed) ? 0 : parsed;
  }, [isSelf, receiveLinkData, expires]);

  const remainingSeconds = useMemo(() => {
    if (!expiryTime) return 0;
    return Math.max(0, Math.floor((expiryTime - currentTime) / 1000));
  }, [expiryTime, currentTime]);

  const isLinkExpired = useMemo(() => {
    if (!expiryTime) return false;
    return currentTime > expiryTime;
  }, [expiryTime, currentTime]);

  useEffect(() => {
    const loadRecipient = async () => {
      if (isSelf) {
        setIsLoading(false);
        return;
      }
      if (!shareId) {
        setError("Invalid wallet share link.");
        setIsLoading(false);
        return;
      }

      try {
        const data = await getWalletRecipient(shareId, expires, token);
        setRecipient(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load wallet recipient.");
      } finally {
        setIsLoading(false);
      }
    };

    loadRecipient();
  }, [shareId, expires, token, isSelf]);

  const copyPaymentLink = async () => {
    if (!receiveLinkData) return;
    const url = window.location.origin + receiveLinkData.shareUrl;
    await navigator.clipboard.writeText(url);
    toast.success("Secure payment link copied to clipboard!");
  };

  const parsedAmount = useMemo(() => {
    const val = parseFloat(amount);
    return isNaN(val) ? 0 : val;
  }, [amount]);

  const isLargeTransfer = parsedAmount >= LARGE_TRANSFER_THRESHOLD;
  const canTransfer = parsedAmount > 0 && recipient && !isTransferring && !isLinkExpired;

  const handleTransferClick = () => {
    if (!canTransfer) return;
    setShowConfirm(true);
  };

  const executeTransfer = async () => {
    if (!recipient || !canTransfer) return;
    if (!password) {
      toast.error("Please enter your password to authorize the transfer.");
      return;
    }

    setIsTransferring(true);

    try {
      const result = await transferWalletBalance({
        shareId: recipient.shareId || recipient.username,
        amount: parsedAmount,
        note: note.trim() || undefined,
        password,
        expires,
        token
      });

      setTransferResult({
        amount: result.amount,
        senderBalance: result.senderBalance,
        recipientBalance: result.recipientBalance,
      });
      setTransferSuccess(true);
      setShowConfirm(false);
      setPassword("");
      toast.success(`₹${parsedAmount.toFixed(2)} sent successfully!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transfer failed";
      toast.error(msg);
    } finally {
      setIsTransferring(false);
    }
  };

  // Transfer success screen
  if (transferSuccess && transferResult) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-white px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <Card className="overflow-hidden border-slate-200 shadow-sm rounded-3xl">
            <CardContent className="space-y-6 p-6 sm:p-8 text-center">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100 shadow-sm">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-950">Transfer Successful</h1>
                <p className="mt-2 text-sm text-slate-500">
                  You sent <span className="font-semibold text-emerald-600">₹{transferResult.amount.toFixed(2)}</span> to{" "}
                  <span className="font-semibold text-slate-800">{recipient?.displayName || recipient?.username}</span>
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-2 max-w-md mx-auto">
                <div className="flex justify-between">
                  <span className="text-slate-500">Your balance</span>
                  <span className="font-semibold text-slate-800">₹{transferResult.senderBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{recipient?.displayName}'s balance</span>
                  <span className="font-semibold text-slate-800">₹{transferResult.recipientBalance.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row justify-center max-w-md mx-auto pt-2">
                <Button asChild className="bg-sky-600 text-white hover:bg-sky-700 rounded-xl flex-1 h-11 font-semibold">
                  <Link to="/wallet">View Wallet</Link>
                </Button>
                <Button variant="outline" className="rounded-xl flex-1 h-11" onClick={() => { setTransferSuccess(false); setAmount(""); setNote(""); }}>
                  Send Another
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Self-pay Receive Payments dashboard
  if (isSelf) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-white px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-md space-y-6">
          <button
            type="button"
            onClick={() => navigate("/wallet")}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Wallet
          </button>

          <Card className="overflow-hidden border-slate-200 shadow-xl rounded-3xl bg-white">
            <div className="bg-sky-600 px-6 py-8 text-center text-white space-y-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                <QrCode className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Receive Payments</h1>
              <p className="text-sky-100 text-xs max-w-xs mx-auto">
                Share this secure QR code or link to receive funds directly into your Krovaa wallet.
              </p>
            </div>

            <CardContent className="p-6 sm:p-8 space-y-6 text-center">
              {/* Recipient Profile Card */}
              <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-left">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-slate-100 shrink-0">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-base font-bold text-slate-500">
                      {(user?.displayName || user?.username || "U").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-semibold text-slate-900 truncate">{user?.displayName || user?.username}</h2>
                    {user?.verified && <BadgeCheck className="h-4 w-4 text-sky-600 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 truncate">@{user?.username}</p>
                </div>
              </div>

              {/* QR Code Container */}
              <div className="relative mx-auto flex flex-col items-center justify-center p-4 border border-slate-100 rounded-3xl bg-slate-50 max-w-[240px]">
                {isLoadingLink ? (
                  <div className="flex h-[200px] w-[200px] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
                  </div>
                ) : receiveLinkData ? (
                  <div className="relative">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + receiveLinkData.shareUrl)}`}
                      alt="Wallet Payment QR"
                      className={`h-[200px] w-[200px] transition-all duration-300 rounded-2xl border border-white shadow-sm ${isLinkExpired ? "blur-md opacity-40 select-none pointer-events-none" : ""}`}
                    />
                    {isLinkExpired && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-slate-900/5 backdrop-blur-[1px] rounded-2xl">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600 shadow-sm mb-1.5">
                          <ShieldAlert className="h-5 w-5" />
                        </div>
                        <p className="text-[11px] font-bold text-slate-800">QR Code Expired</p>
                        <p className="text-[9px] text-slate-500">Please generate a new one</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-[200px] w-[200px] items-center justify-center text-xs text-slate-400">
                    Failed to load QR code.
                  </div>
                )}
              </div>

              {/* Expiry Countdown Timer */}
              {receiveLinkData && !isLoadingLink && (
                <div className="flex flex-col items-center justify-center space-y-1">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm border ${
                    isLinkExpired 
                      ? "bg-rose-50 text-rose-700 border-rose-100" 
                      : remainingSeconds < 60 
                        ? "bg-amber-50 text-amber-700 border-amber-100 animate-pulse" 
                        : "bg-emerald-50 text-emerald-700 border-emerald-100"
                  }`}>
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {isLinkExpired 
                        ? "Expired" 
                        : `Expires in ${Math.floor(remainingSeconds / 60)}:${(remainingSeconds % 60).toString().padStart(2, "0")}`
                      }
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Valid for 10 minutes only for secure transactions.
                  </p>
                </div>
              )}

              {/* Share & Refresh Actions */}
              <div className="space-y-3 pt-2">
                <Button
                  onClick={copyPaymentLink}
                  disabled={!receiveLinkData || isLinkExpired || isLoadingLink}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white rounded-xl h-11 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <Copy className="h-4 w-4" />
                  Copy secure link
                </Button>
                
                <Button
                  variant="outline"
                  onClick={fetchReceiveLink}
                  disabled={isLoadingLink}
                  className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl h-11 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingLink ? "animate-spin" : ""}`} />
                  {isLinkExpired ? "Generate New QR Code" : "Refresh Code"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Link Expired screen for payer
  if (!isSelf && isLinkExpired) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-white px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-md space-y-6">
          <button
            type="button"
            onClick={() => navigate("/wallet")}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Wallet
          </button>

          <Card className="overflow-hidden border-slate-200 shadow-xl rounded-3xl bg-white p-6 sm:p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600 border border-amber-100 shadow-sm">
                <ShieldAlert className="h-8 w-8" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">Payment Session Expired</h1>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                This secure payment link has expired due to its 10-minute validity window. Expiring payment links help keep your transactions safe.
              </p>
            </div>

            <div className="rounded-2xl bg-amber-50/50 border border-amber-100/50 p-4 text-xs text-amber-800 leading-relaxed text-left space-y-1">
              <span className="font-bold block">What should I do?</span>
              <p>Please ask the recipient to generate and share a new secure QR code or payment link from their Krovaa wallet.</p>
            </div>

            <div className="pt-2">
              <Button asChild className="w-full bg-sky-600 hover:bg-sky-700 text-white rounded-xl h-11 font-semibold">
                <Link to="/wallet">Go to Wallet</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Normal pay screen (payer)
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-white px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <button
          type="button"
          onClick={() => {
            if (step > 1) {
              setStep(step - 1);
            } else {
              navigate(-1);
            }
          }}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {step > 1 ? "Back to Step " + (step - 1) : "Back"}
        </button>

        <Card className="overflow-hidden border-slate-200 shadow-sm rounded-3xl">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Wallet share</p>
                <h1 className="text-2xl font-bold text-slate-950">Send money to a Krovaa wallet</h1>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                Loading recipient details...
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                {error}
              </div>
            ) : recipient ? (
              <div className="space-y-6">
                {/* Step Progress Bar */}
                <div className="flex items-center justify-between px-2 mb-6">
                  {[
                    { id: 1, label: "Verify" },
                    { id: 2, label: "Amount" },
                    { id: 3, label: "Confirm" }
                  ].map((s) => (
                    <div key={s.id} className="flex items-center flex-1 last:flex-none">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                          step === s.id 
                            ? "bg-sky-600 text-white ring-4 ring-sky-500/20" 
                            : step > s.id 
                              ? "bg-emerald-500 text-white" 
                              : "bg-slate-100 text-slate-400"
                        }`}>
                          {step > s.id ? "✓" : s.id}
                        </div>
                        <span className={`text-xs font-semibold hidden sm:inline ${
                          step === s.id ? "text-slate-900 font-bold" : "text-slate-400"
                        }`}>
                          {s.label}
                        </span>
                      </div>
                      {s.id < 3 && (
                        <div className={`flex-1 h-0.5 mx-4 transition-all duration-500 min-w-[30px] ${
                          step > s.id ? "bg-emerald-500" : "bg-slate-100"
                        }`} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Secure countdown banner */}
                {expiryTime > 0 && remainingSeconds > 0 && (
                  <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border text-sm font-semibold transition-all ${
                    remainingSeconds < 60
                      ? "bg-rose-50 text-rose-700 border-rose-100 animate-pulse"
                      : "bg-slate-50 text-slate-600 border-slate-100"
                  }`}>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="h-4 w-4 text-slate-400" />
                      Secure session time remaining:
                    </span>
                    <span className="font-mono text-sm">
                      {Math.floor(remainingSeconds / 60)}:{(remainingSeconds % 60).toString().padStart(2, "0")}
                    </span>
                  </div>
                )}

                {/* STEP 1: RECIPIENT VERIFICATION */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="text-center space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Recipient Details</p>
                      <div className="flex flex-col items-center justify-center p-6 rounded-3xl border border-slate-200 bg-slate-50/50 max-w-sm mx-auto">
                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 shadow-sm mb-4">
                          {recipient.avatarUrl ? (
                            <img src={recipient.avatarUrl} alt={recipient.displayName} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-2xl font-bold text-slate-500">
                              {(recipient.displayName || recipient.username || "U").slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 justify-center">
                          <h2 className="text-xl font-bold text-slate-900">{recipient.displayName || recipient.username}</h2>
                          {recipient.verified && <BadgeCheck className="h-5 w-5 text-sky-600" />}
                        </div>
                        <p className="text-sm text-slate-500">@{recipient.username}</p>
                      </div>
                    </div>

                    <div className="flex justify-center pt-2">
                      <Button
                        onClick={() => setStep(2)}
                        className="w-full max-w-sm bg-sky-600 text-white hover:bg-sky-700 rounded-xl h-11 font-semibold transition-all duration-200 active:scale-[0.97]"
                      >
                        Continue to Payment
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 2: AMOUNT & NOTE */}
                {step === 2 && (
                  <div className="space-y-5">
                    {senderBalance !== null && (
                      <div className="text-right text-xs text-slate-500 font-medium">
                        Your Available Balance: <span className="font-bold text-slate-800">₹{senderBalance.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="amount" className="text-xs font-semibold text-slate-600">Amount (₹)</Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        min="1"
                        step="0.01"
                        className="rounded-xl border-slate-200 focus-visible:ring-sky-500/20 h-11 text-lg font-semibold"
                        disabled={isTransferring}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {["100", "500", "1000"].map((amt) => (
                        <Button
                          key={amt}
                          variant="outline"
                          size="sm"
                          onClick={() => setAmount(amt)}
                          className={`rounded-xl transition-all duration-200 h-9 font-semibold ${amount === amt ? "border-sky-500 bg-sky-50 text-sky-600 font-bold" : "border-slate-200 text-slate-600"}`}
                          disabled={isTransferring}
                        >
                          ₹{amt}
                        </Button>
                      ))}
                    </div>

                    {senderBalance !== null && parsedAmount > senderBalance && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                        Insufficient balance. You need ₹{(parsedAmount - senderBalance).toFixed(2)} more.
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="note" className="text-xs font-semibold text-slate-600">Note (optional)</Label>
                      <Input
                        id="note"
                        type="text"
                        placeholder="What's this for?"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={200}
                        className="rounded-xl border-slate-200 focus-visible:ring-sky-500/20 h-11"
                        disabled={isTransferring}
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => setStep(1)}
                        className="rounded-xl flex-1 h-11"
                        disabled={isTransferring}
                      >
                        Back
                      </Button>
                      <Button
                        onClick={() => setStep(3)}
                        disabled={parsedAmount <= 0 || (senderBalance !== null && parsedAmount > senderBalance)}
                        className="bg-sky-600 text-white hover:bg-sky-700 rounded-xl flex-1 h-11 font-semibold transition-all duration-200 active:scale-[0.97]"
                      >
                        Review Payment
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 3: SUMMARY & PASSWORD */}
                {step === 3 && (
                  <div className="space-y-5">
                    <div className="rounded-3xl border border-sky-100 bg-sky-50/30 p-5 space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-sky-800">Transfer Summary</h3>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-slate-100 shrink-0">
                          {recipient.avatarUrl ? (
                            <img src={recipient.avatarUrl} alt={recipient.displayName} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-sm font-bold text-slate-500">
                              {(recipient.displayName || recipient.username || "U").slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-sm text-slate-900 truncate">{recipient.displayName || recipient.username}</span>
                            {recipient.verified && <BadgeCheck className="h-4 w-4 text-sky-600 shrink-0" />}
                          </div>
                          <span className="text-xs text-slate-500 block">@{recipient.username}</span>
                        </div>
                      </div>

                      <div className="border-t border-sky-100/50 pt-3 flex justify-between items-baseline">
                        <span className="text-xs text-slate-500">Amount to send:</span>
                        <span className="text-xl font-black text-sky-700">₹{parsedAmount.toFixed(2)}</span>
                      </div>

                      {note.trim() && (
                        <div className="border-t border-sky-100/50 pt-3 space-y-1">
                          <span className="text-xs text-slate-500 font-semibold block">Note:</span>
                          <p className="text-xs text-slate-700 italic font-medium">"{note}"</p>
                        </div>
                      )}
                    </div>

                    {isLargeTransfer && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-start gap-2.5">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Attention:</span> This is a large transfer. Please verify the recipient details carefully. This transaction cannot be undone.
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-xs font-semibold text-slate-600">
                        Enter account password to authorize
                      </Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="Account password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="rounded-xl border-slate-200 focus-visible:ring-sky-500/20 h-11"
                        disabled={isTransferring}
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => { setStep(2); setPassword(""); }}
                        className="rounded-xl flex-1 h-11"
                        disabled={isTransferring}
                      >
                        Back
                      </Button>
                      <Button
                        onClick={executeTransfer}
                        disabled={isTransferring || !password}
                        className="bg-sky-600 text-white hover:bg-sky-700 rounded-xl flex-1 h-11 font-semibold transition-all duration-200 active:scale-[0.97]"
                      >
                        {isTransferring ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          "Confirm & Send"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WalletPayPage;
