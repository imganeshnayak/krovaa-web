
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { themeColors } from "@/lib/themeColors";
import { useAuth } from "@/contexts/AuthContext";
import { getWalletBalance, getWalletTransactions, getPayoutRequests, WalletTransaction, PayoutRequest } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpRight, ArrowDownLeft, Wallet, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import RequestPayoutDialog from "@/components/chat/RequestPayoutDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Info, Plus, Share2, Send, QrCode } from "lucide-react";
import { initiateWalletTopup, verifyPayment } from "@/lib/api";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useRazorpay } from "@/hooks/useRazorpay";

declare global {
    interface Window {
        Razorpay: any;
    }
}

const WalletPage = () => {
    // Set page title
    useEffect(() => {
        document.title = "Wallet - Krovaa";
    }, []);
    const navigate = useNavigate();
    const { user } = useAuth();
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("transactions");
    const [isPayoutOpen, setIsPayoutOpen] = useState(false);
    const [filterType, setFilterType] = useState("all");
    const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
    const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false);
    const [addAmount, setAddAmount] = useState<string>("500");
    const [agreeToWalletTerms, setAgreeToWalletTerms] = useState(false);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const { openCheckout } = useRazorpay();
    const shareId = user?.shareId || user?.username || "";
    const walletShareLink = shareId ? `${window.location.origin}/wallet/pay/${encodeURIComponent(shareId)}` : "";

    const loadData = async (type = filterType) => {
        setIsLoading(true);
        try {
            const [balanceData, txData, payoutData] = await Promise.all([
                getWalletBalance(),
                getWalletTransactions(type),
                getPayoutRequests()
            ]);
            setBalance(balanceData.balance);
            setTransactions(txData);
            setPayoutRequests(payoutData);
        } catch (error) {
            console.error("Failed to load wallet data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData(filterType);
    }, [filterType]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Paid</Badge>;
            case 'pending':
                return <Badge variant="outline" className="text-yellow-500 border-yellow-500"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
            case 'processing':
                return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing</Badge>;
            case 'failed':
            case 'cancelled':
                return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const dealCounterparty = selectedTx?.deal && user
        ? (selectedTx.deal.client.id === user.id ? selectedTx.deal.vendor : selectedTx.deal.client)
        : null;

    return (
        <div className="container max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-20 md:pb-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Wallet className="h-8 w-8 text-[#00A4EF]" />
                    My Wallet
                </h1>
                <div className="flex items-center gap-2">

                    <Button
                        asChild
                        variant="outline"
                        className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl h-10 w-10 p-0 flex items-center justify-center"
                        aria-label="Share wallet QR"
                    >
                        <Link to={`/wallet/pay/${encodeURIComponent(shareId)}`}>
                            <Share2 className="h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Balance Card */}
            <Card className="bg-gradient-to-br from-[#00A4EF]/8 to-[#00A4EF]/3 border-gray-200/60 rounded-2xl shadow-sm overflow-hidden bg-white">
                <CardHeader className="p-6 md:p-8">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Available Balance</CardTitle>
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1.5">
                            <div className="text-4xl md:text-5xl font-black tracking-tight text-[#00A4EF]">
                                {formatCurrency(balance)}
                            </div>
                            <p className="text-xs text-slate-400 font-medium">
                                Minimum payout threshold: ₹500.00
                            </p>
                        </div>
                        <div className="flex flex-row gap-2.5 shrink-0">
                            <Button
                                variant="outline"
                                className="border-[#00A4EF]/30 text-[#00A4EF] hover:bg-[#00A4EF]/10 rounded-xl px-5 h-11 font-semibold transition-all duration-200 active:scale-[0.97]"
                                onClick={() => setIsAddMoneyOpen(true)}
                            >
                                <Plus className="w-4 h-4 mr-1.5 shrink-0" /> Add Money
                            </Button>
                            <Button
                                onClick={() => setIsPayoutOpen(true)}
                                disabled={balance < 500}
                                className="bg-[#00A4EF] hover:bg-[#00A4EF]/90 text-white rounded-xl px-5 h-11 font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-50"
                            >
                                Request Payout
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Add Money Dialog */}
            <Dialog open={isAddMoneyOpen} onOpenChange={setIsAddMoneyOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl border-slate-200/80 shadow-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-900">Add Money to Wallet</DialogTitle>
                        <CardDescription className="text-xs text-slate-400">Enter the amount you want to add to your Krovaa wallet.</CardDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-2">
                            <Label htmlFor="amount" className="text-xs font-semibold text-slate-600">Amount (₹)</Label>
                            <Input
                                id="amount"
                                type="number"
                                placeholder="500"
                                value={addAmount}
                                onChange={(e) => setAddAmount(e.target.value)}
                                min="1"
                                className="rounded-xl border-slate-200 focus-visible:ring-[#00A4EF]/20 h-11"
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {["500", "1000", "2000"].map((amt) => (
                                <Button
                                    key={amt}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setAddAmount(amt)}
                                    className={`rounded-xl transition-all duration-200 h-9 font-semibold ${addAmount === amt ? "border-[#00A4EF] bg-[#00A4EF]/5 text-[#00A4EF] font-bold" : "border-slate-200 text-slate-600"}`}
                                >
                                    ₹{amt}
                                </Button>
                            ))}
                        </div>

                        {parseFloat(addAmount) > 0 && (
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5 border border-slate-100/85 shadow-inner">
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span>Processing Fee (2%)</span>
                                    <span>{formatCurrency(parseFloat(addAmount) * 0.02)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span>GST on Fee (18%)</span>
                                    <span>{formatCurrency(parseFloat(addAmount) * 0.02 * 0.18)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-semibold pt-2.5 border-t border-slate-200/60">
                                    <span className="text-slate-800">Net Credited to Wallet</span>
                                    <span className="text-[#00A4EF]">{formatCurrency(parseFloat(addAmount) * (1 - 0.02 * 1.18))}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 italic text-center pt-1">
                                    * Payment transaction charges are deducted from the top-up amount.
                                </p>
                            </div>
                        )}

                        {isProcessingPayment && (
                            <div className="flex items-center gap-3 rounded-xl border border-[#00A4EF]/20 bg-[#00A4EF]/5 px-4 py-3 text-sm text-[#00A4EF] animate-pulse">
                                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                                <span>Loading secure payment gateway...</span>
                            </div>
                        )}

                        <div className="flex items-start space-x-2.5 p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100/80">
                            <Checkbox 
                                id="walletTerms" 
                                checked={agreeToWalletTerms} 
                                onCheckedChange={(checked) => setAgreeToWalletTerms(checked === true)}
                                className="mt-0.5 rounded"
                            />
                            <div className="grid gap-1.5 leading-none">
                                <div className="text-xs text-[#1C1C1C]/60 leading-normal">
                                    <Label htmlFor="walletTerms" className="cursor-pointer font-normal text-slate-500">
                                        I agree to the 
                                    </Label>
                                    <Link
                                        to="/terms"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#00A4EF] hover:underline font-semibold ml-1"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        Terms & Conditions
                                    </Link>
                                    {", "}
                                    <Link
                                        to="/privacy"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#00A4EF] hover:underline font-semibold"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        Privacy Policy
                                    </Link>
                                    {" and "}
                                    <Link
                                        to="/refund"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#00A4EF] hover:underline font-semibold"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        Refund Policy
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" className="rounded-xl h-10 px-4" onClick={() => setIsAddMoneyOpen(false)}>Cancel</Button>
                        <Button
                            onClick={async () => {
                                if (!agreeToWalletTerms) {
                                    toast.error("Please agree to the Terms and Conditions");
                                    return;
                                }
                                const amount = parseFloat(addAmount);
                                if (isNaN(amount) || amount < 1) {
                                    toast.error("Please enter a valid amount (min ₹1)");
                                    return;
                                }

                                setIsProcessingPayment(true);
                                try {
                                    const order = await initiateWalletTopup(amount);

                                    const opened = await openCheckout({
                                        orderId: order.orderId,
                                        amount: order.amount,
                                        currency: order.currency,
                                        name: "Krovaa Wallet",
                                        description: `Top-up ₹${amount}`,
                                        keyId: order.key_id,
                                        userDetails: {
                                            name: user?.displayName,
                                            email: user?.username + "@Krovaa.com",
                                        },
                                        onSuccess: async (response) => {
                                            try {
                                                const verification = await verifyPayment({
                                                    orderId: response.razorpay_order_id,
                                                    paymentId: response.razorpay_payment_id,
                                                    signature: response.razorpay_signature,
                                                    type: "wallet",
                                                    entityId: user?.id || 0
                                                });
                                                toast.success(`₹${(verification.amount || amount).toFixed(2)} added successfully!`);
                                                setIsAddMoneyOpen(false);
                                                setAgreeToWalletTerms(false);
                                                loadData();
                                            } catch (err) {
                                                console.error("Verification error:", err);
                                                toast.error("Payment verification failed. Please contact support.");
                                            }
                                        },
                                        onFailure: (error) => {
                                            console.error("Wallet payment failed:", error);
                                        },
                                    });

                                    if (opened) {
                                        setIsAddMoneyOpen(false);
                                    }
                                } catch (error) {
                                    console.error("Add money error:", error);
                                    toast.error("Failed to initiate payment.");
                                } finally {
                                    setIsProcessingPayment(false);
                                }
                            }}
                            className="bg-[#00A4EF] hover:bg-[#00A4EF]/90 text-white rounded-xl px-6 h-10 font-semibold transition-all duration-200 active:scale-[0.97]"
                            disabled={isProcessingPayment || !agreeToWalletTerms}
                        >
                            {isProcessingPayment ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Proceed to Pay
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>



            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="relative rounded-full bg-slate-200/50 p-1.5 flex w-full border border-slate-200/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),_inset_0_-1px_1px_rgba(0,0,0,0.02)]">
                    <button
                        type="button"
                        onClick={() => setActiveTab("transactions")}
                        className="relative z-10 w-1/2 rounded-full py-2.5 text-sm font-semibold transition-colors duration-200 text-center flex items-center justify-center gap-1.5 focus-visible:outline-none focus:outline-none"
                    >
                        {activeTab === "transactions" && (
                            <motion.div
                                layoutId="activeWalletTab"
                                className="absolute inset-0 bg-white rounded-full shadow-[0_2.5px_6px_rgba(0,0,0,0.08),_0_0.5px_1.5px_rgba(0,0,0,0.04)] border border-slate-200/60"
                                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                            />
                        )}
                        <span className={`relative z-20 transition-all duration-200 ${activeTab === "transactions" ? "text-slate-900 font-bold" : "text-slate-500 hover:text-slate-700"}`}>
                            Transactions
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("payouts")}
                        className="relative z-10 w-1/2 rounded-full py-2.5 text-sm font-semibold transition-colors duration-200 text-center flex items-center justify-center gap-1.5 focus-visible:outline-none focus:outline-none"
                    >
                        {activeTab === "payouts" && (
                            <motion.div
                                layoutId="activeWalletTab"
                                className="absolute inset-0 bg-white rounded-full shadow-[0_2.5px_6px_rgba(0,0,0,0.08),_0_0.5px_1.5px_rgba(0,0,0,0.04)] border border-slate-200/60"
                                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                            />
                        )}
                        <span className={`relative z-20 transition-all duration-200 ${activeTab === "payouts" ? "text-slate-900 font-bold" : "text-slate-500 hover:text-slate-700"}`}>
                            Payout Requests
                        </span>
                    </button>
                </div>

                {/* Transactions Tab */}
                <TabsContent value="transactions" className="mt-3">
                    <Card className="rounded-2xl border-slate-200/60 shadow-sm overflow-hidden bg-white">
                        <CardHeader className="pb-4 border-b border-slate-100/80">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-bold text-slate-800">Transaction History</CardTitle>
                                    <CardDescription className="text-xs text-slate-400">Recent activity in your wallet</CardDescription>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 gap-1.5 capitalize rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50">
                                            {filterType}
                                            <ChevronDown className="h-3.5 w-3.5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-white border-slate-200 shadow-lg rounded-xl">
                                        {["all", "sent", "received", "added"].map((t) => (
                                            <DropdownMenuItem
                                                key={t}
                                                className="capitalize cursor-pointer"
                                                onClick={() => setFilterType(t)}
                                            >
                                                {t}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <ScrollArea className="h-[400px] pr-4">
                                {transactions.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 text-sm">
                                        No transactions recorded yet.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {transactions.map((tx) => (
                                            <div
                                                key={tx.id}
                                                className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-100/60 transition-all cursor-pointer hover:shadow-sm active:scale-[0.99]"
                                                onClick={() => setSelectedTx(tx)}
                                            >
                                                <div className="flex items-start gap-3.5">
                                                    <div className={`p-2.5 rounded-xl shrink-0 ${tx.amount > 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' : 'bg-rose-50 text-rose-600 border border-rose-100/50'}`}>
                                                        {tx.amount > 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-slate-800 text-sm truncate">{tx.description}</p>
                                                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{formatDate(tx.createdAt)}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right flex items-center gap-3 shrink-0 ml-4">
                                                    <div>
                                                        <p className={`font-bold text-sm ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                            {formatCurrency(tx.balance)}
                                                        </p>
                                                    </div>
                                                    <Info className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Payouts Tab */}
                <TabsContent value="payouts" className="mt-3">
                    <Card className="rounded-2xl border-slate-200/60 shadow-sm overflow-hidden bg-white">
                        <CardHeader className="pb-4 border-b border-slate-100/80">
                            <CardTitle className="text-base font-bold text-slate-800">Payout Requests</CardTitle>
                            <CardDescription className="text-xs text-slate-400">Status of your withdrawal requests</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                            <ScrollArea className="h-[400px] pr-4">
                                {payoutRequests.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 text-sm">
                                        No payout requests recorded yet.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {payoutRequests.map((req) => (
                                            <div key={req.id} className="border border-slate-100 rounded-xl p-4.5 bg-slate-50/50 hover:bg-slate-50 transition-all">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="font-extrabold text-slate-800 text-lg tracking-tight">{formatCurrency(req.amount)}</span>
                                                        {getStatusBadge(req.status)}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-medium">{formatDate(req.requestedAt)}</span>
                                                </div>
                                                <div className="text-xs text-slate-500 space-y-1.5 bg-white border border-slate-100 rounded-xl p-3.5">
                                                    <p className="flex justify-between"><span className="text-slate-400 font-medium">Bank Details:</span> <span className="font-semibold text-slate-700">{req.bankAccount} ({req.ifscCode})</span></p>
                                                    <p className="flex justify-between"><span className="text-slate-400 font-medium">Account Name:</span> <span className="font-semibold text-slate-700">{req.accountName}</span></p>
                                                </div>
                                                {req.adminNote && (
                                                    <div className="mt-3.5 p-3.5 bg-amber-50/60 border border-amber-100/60 rounded-xl text-xs text-amber-800">
                                                        <span className="font-bold block mb-1">Admin Note:</span> {req.adminNote}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <RequestPayoutDialog
                open={isPayoutOpen}
                onOpenChange={setIsPayoutOpen}
                maxAmount={balance}
                onSuccess={() => loadData(filterType)}
            />

            {/* Transaction Detail Modal */}
            <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
                <DialogContent className="sm:max-w-md rounded-2xl border-slate-200/80 shadow-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800">Transaction Details</DialogTitle>
                    </DialogHeader>
                    {selectedTx && (
                        <div className="space-y-3.5 py-2">
                            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</span>
                                <Badge variant="outline" className="capitalize font-bold border-slate-200 text-slate-600 bg-slate-50/50">{selectedTx.type.replace('_', ' ')}</Badge>
                            </div>
                            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount</span>
                                <span className={`font-extrabold text-base ${selectedTx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {selectedTx.amount > 0 ? '+' : ''}{formatCurrency(selectedTx.amount)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Balance After</span>
                                <span className="font-bold text-slate-700">{formatCurrency(selectedTx.balance)}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</span>
                                <span className="text-xs font-medium text-slate-600">{formatDate(selectedTx.createdAt)}</span>
                            </div>
                            {selectedTx.reference && (
                                <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reference</span>
                                    <span className="text-xs font-mono bg-slate-50 border border-slate-100/80 px-2 py-0.5 rounded-lg text-slate-600">{selectedTx.reference}</span>
                                </div>
                            )}
                            {selectedTx.metadata && !selectedTx.deal && (
                                <>
                                    {selectedTx.metadata.otherDisplayName && (
                                        <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Other Party</span>
                                            <span className="text-xs font-bold text-slate-700">{selectedTx.metadata.otherDisplayName}</span>
                                        </div>
                                    )}
                                    {selectedTx.metadata.dealTitle && (
                                        <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Deal</span>
                                            <span className="text-xs font-bold text-[#00A4EF]">{selectedTx.metadata.dealTitle}</span>
                                        </div>
                                    )}
                                </>
                            )}
                            {selectedTx.deal && (
                                <>
                                    <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Deal</span>
                                        <span className="text-xs font-bold text-[#00A4EF]">{selectedTx.deal.title}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Deal Created</span>
                                        <span className="text-xs font-medium text-slate-600">{formatDate(selectedTx.deal.createdAt)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Deal Amount</span>
                                        <span className="text-xs font-bold text-slate-700">{formatCurrency(selectedTx.deal.totalAmount)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Deal Status</span>
                                        <Badge variant="outline" className="capitalize font-bold border-slate-200 text-slate-600 bg-slate-50/50">{selectedTx.deal.status}</Badge>
                                    </div>
                                    {dealCounterparty && (
                                        <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">With</span>
                                            <span className="text-xs font-bold text-slate-700">{dealCounterparty.displayName}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Chat ID</span>
                                        <span className="text-xs font-mono bg-slate-50 border border-slate-100/80 px-2 py-0.5 rounded-lg text-slate-600">{selectedTx.deal.chatId}</span>
                                    </div>
                                </>
                            )}
                            <div className="space-y-1.5 pt-1">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</span>
                                <p className="text-xs p-3.5 bg-slate-50 border border-slate-100/60 rounded-xl leading-relaxed text-slate-600">{selectedTx.description}</p>
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end pt-2">
                        <Button onClick={() => setSelectedTx(null)} className="rounded-xl h-10 px-6 font-semibold w-full sm:w-auto">Close</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
};

export default WalletPage;
