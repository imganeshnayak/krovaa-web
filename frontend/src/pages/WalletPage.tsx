
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
import { Info, Plus } from "lucide-react";
import { initiateWalletTopup, verifyPayment } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

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
    const { user } = useAuth();
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPayoutOpen, setIsPayoutOpen] = useState(false);
    const [filterType, setFilterType] = useState("all");
    const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
    const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false);
    const [addAmount, setAddAmount] = useState<string>("500");
    const [agreeToWalletTerms, setAgreeToWalletTerms] = useState(false);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

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
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <Wallet className="h-8 w-8 text-[#00A4EF]" />
                My Wallet
            </h1>

            {/* Balance Card */}
            <Card className="bg-gradient-to-br from-[#00A4EF]/10 to-[#00A4EF]/5 border-[#00A4EF]/20">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-[#1C1C1C]/60">Available Balance</CardTitle>
                    <div className="flex items-end justify-between">
                        <div className="space-y-1">
                            <span className="text-4xl font-bold text-[#00A4EF]">
                                {formatCurrency(balance)}
                            </span>
                            <p className="text-xs text-muted-foreground">
                                Minimum payout amount: ₹500.00
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                                variant="outline"
                                className="border-[#00A4EF] text-[#00A4EF] hover:bg-[#00A4EF]/10"
                                onClick={() => setIsAddMoneyOpen(true)}
                            >
                                <Plus className="w-4 h-4 mr-1" /> Add Money
                            </Button>
                            <Button
                                onClick={() => setIsPayoutOpen(true)}
                                disabled={balance < 500}
                                className="bg-[#00A4EF] hover:bg-[#00A4EF]/90 text-white"
                            >
                                Request Payout
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Add Money Dialog */}
            <Dialog open={isAddMoneyOpen} onOpenChange={setIsAddMoneyOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Money to Wallet</DialogTitle>
                        <CardDescription>Enter the amount you want to add to your Krovaa wallet.</CardDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount (₹)</Label>
                            <Input
                                id="amount"
                                type="number"
                                placeholder="500"
                                value={addAmount}
                                onChange={(e) => setAddAmount(e.target.value)}
                                min="1"
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {["500", "1000", "2000"].map((amt) => (
                                <Button
                                    key={amt}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setAddAmount(amt)}
                                    className={addAmount === amt ? "border-[#00A4EF] bg-[#00A4EF]/5" : ""}
                                >
                                    ₹{amt}
                                </Button>
                            ))}
                        </div>

                        {parseFloat(addAmount) > 0 && (
                            <div className="bg-secondary/30 rounded-lg p-3 space-y-2 border border-border/50">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Processing Fee (2%)</span>
                                    <span>{formatCurrency(parseFloat(addAmount) * 0.02)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>GST on Fee (18%)</span>
                                    <span>{formatCurrency(parseFloat(addAmount) * 0.02 * 0.18)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-semibold pt-1 border-t border-[#E0E0E0]/50">
                                    <span className="text-[#1C1C1C]">Net Credited to Wallet</span>
                                    <span className="text-[#00A4EF]">{formatCurrency(parseFloat(addAmount) * (1 - 0.02 * 1.18))}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground italic text-center pt-1">
                                    * Payment transaction charges are deducted from the top-up amount.
                                </p>
                            </div>
                        )}

                        <div className="flex items-start space-x-2 p-3 bg-secondary/20 rounded-lg">
                            <Checkbox 
                                id="walletTerms" 
                                checked={agreeToWalletTerms} 
                                onCheckedChange={(checked) => setAgreeToWalletTerms(checked === true)}
                                className="mt-0.5"
                            />
                            <div className="grid gap-1.5 leading-none">
                                <Label
                                    htmlFor="walletTerms"
                                    className="text-xs text-[#1C1C1C]/60 cursor-pointer leading-normal"
                                >
                                    I agree to the <Link to="/terms" target="_blank" className="text-[#00A4EF] hover:underline">Terms & Conditions</Link>, <Link to="/privacy" target="_blank" className="text-[#00A4EF] hover:underline">Privacy Policy</Link> and <Link to="/refund" target="_blank" className="text-[#00A4EF] hover:underline">Refund Policy</Link>
                                </Label>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setIsAddMoneyOpen(false)}>Cancel</Button>
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

                                    const options = {
                                        key: order.key_id,
                                        amount: order.amount,
                                        currency: order.currency,
                                        name: "Krovaa Wallet",
                                        description: `Top-up ₹${amount}`,
                                        order_id: order.orderId,
                                        handler: async function (response: any) {
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
                                        prefill: {
                                            name: user?.displayName,
                                            email: user?.username + "@Krovaa.com", // Fallback email
                                        },
                                        theme: { color: themeColors.blue.primary }
                                    };

                                    const rzp = new window.Razorpay(options);
                                    rzp.open();
                                } catch (error) {
                                    console.error("Add money error:", error);
                                    toast.error("Failed to initiate payment.");
                                } finally {
                                    setIsProcessingPayment(false);
                                }
                            }}
                            disabled={isProcessingPayment || !agreeToWalletTerms}
                        >
                            {isProcessingPayment ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Proceed to Pay
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Tabs defaultValue="transactions" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                    <TabsTrigger value="payouts">Payout Requests</TabsTrigger>
                </TabsList>

                {/* Transactions Tab */}
                <TabsContent value="transactions">
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Transaction History</CardTitle>
                                    <CardDescription>Recent activity in your wallet</CardDescription>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 gap-1 capitalize">
                                            {filterType}
                                            <ChevronDown className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {["all", "sent", "received", "added"].map((t) => (
                                            <DropdownMenuItem
                                                key={t}
                                                className="capitalize"
                                                onClick={() => setFilterType(t)}
                                            >
                                                {t}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px] pr-4">
                                {transactions.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No transactions yet
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {transactions.map((tx) => (
                                            <div
                                                key={tx.id}
                                                className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors cursor-pointer"
                                                onClick={() => setSelectedTx(tx)}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`p-2 rounded-full ${tx.amount > 0 ? 'bg-green-100/50 text-green-600' : 'bg-red-100/50 text-red-600'}`}>
                                                        {tx.amount > 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm line-clamp-1">{tx.description}</p>
                                                        <p className="text-[10px] text-muted-foreground">{formatDate(tx.createdAt)}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right flex items-center gap-3">
                                                    <div>
                                                        <p className={`font-bold text-sm ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {formatCurrency(tx.balance)}
                                                        </p>
                                                    </div>
                                                    <Info className="h-3 w-3 text-muted-foreground" />
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
                <TabsContent value="payouts">
                    <Card>
                        <CardHeader>
                            <CardTitle>Payout Requests</CardTitle>
                            <CardDescription>Status of your withdrawal requests</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px] pr-4">
                                {payoutRequests.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No payout requests yet
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {payoutRequests.map((req) => (
                                            <div key={req.id} className="border rounded-lg p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-lg">{formatCurrency(req.amount)}</span>
                                                        {getStatusBadge(req.status)}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">{formatDate(req.requestedAt)}</span>
                                                </div>
                                                <div className="text-sm text-muted-foreground mb-2">
                                                    <p>Bank: {req.bankAccount} ({req.ifscCode})</p>
                                                    <p>Name: {req.accountName}</p>
                                                </div>
                                                {req.adminNote && (
                                                    <div className="mt-2 p-2 bg-secondary/30 rounded text-xs">
                                                        <span className="font-semibold">Admin Note:</span> {req.adminNote}
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
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Transaction Details</DialogTitle>
                    </DialogHeader>
                    {selectedTx && (
                        <div className="space-y-4 py-2">
                            <div className="flex justify-between items-center pb-2 border-b">
                                <span className="text-sm text-muted-foreground">Type</span>
                                <Badge variant="outline" className="capitalize">{selectedTx.type.replace('_', ' ')}</Badge>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b">
                                <span className="text-sm text-muted-foreground">Amount</span>
                                <span className={`font-bold ${selectedTx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {selectedTx.amount > 0 ? '+' : ''}{formatCurrency(selectedTx.amount)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b">
                                <span className="text-sm text-muted-foreground">Balance After</span>
                                <span className="font-medium">{formatCurrency(selectedTx.balance)}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b">
                                <span className="text-sm text-muted-foreground">Date</span>
                                <span className="text-sm">{formatDate(selectedTx.createdAt)}</span>
                            </div>
                            {selectedTx.reference && (
                                <div className="flex justify-between items-center pb-2 border-b">
                                    <span className="text-sm text-muted-foreground">Reference</span>
                                    <span className="text-xs font-mono bg-secondary px-1 rounded">{selectedTx.reference}</span>
                                </div>
                            )}
                            {selectedTx.metadata && !selectedTx.deal && (
                                <>
                                    {selectedTx.metadata.otherDisplayName && (
                                        <div className="flex justify-between items-center pb-2 border-b">
                                            <span className="text-sm text-muted-foreground">Other Party</span>
                                            <span className="text-sm font-medium">{selectedTx.metadata.otherDisplayName}</span>
                                        </div>
                                    )}
                                    {selectedTx.metadata.dealTitle && (
                                        <div className="flex justify-between items-center pb-2 border-b">
                                            <span className="text-sm text-muted-foreground">Deal</span>
                                            <span className="text-sm font-medium">{selectedTx.metadata.dealTitle}</span>
                                        </div>
                                    )}
                                </>
                            )}
                            {selectedTx.deal && (
                                <>
                                    <div className="flex justify-between items-center pb-2 border-b">
                                        <span className="text-sm text-muted-foreground">Deal</span>
                                        <span className="text-sm font-medium">{selectedTx.deal.title}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b">
                                        <span className="text-sm text-muted-foreground">Deal Created</span>
                                        <span className="text-sm">{formatDate(selectedTx.deal.createdAt)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b">
                                        <span className="text-sm text-muted-foreground">Deal Amount</span>
                                        <span className="text-sm font-medium">{formatCurrency(selectedTx.deal.totalAmount)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b">
                                        <span className="text-sm text-muted-foreground">Deal Status</span>
                                        <Badge variant="outline" className="capitalize">{selectedTx.deal.status}</Badge>
                                    </div>
                                    {dealCounterparty && (
                                        <div className="flex justify-between items-center pb-2 border-b">
                                            <span className="text-sm text-muted-foreground">With</span>
                                            <span className="text-sm font-medium">{dealCounterparty.displayName}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pb-2 border-b">
                                        <span className="text-sm text-muted-foreground">Chat ID</span>
                                        <span className="text-xs font-mono bg-secondary px-1 rounded">{selectedTx.deal.chatId}</span>
                                    </div>
                                </>
                            )}
                            <div className="space-y-1">
                                <span className="text-sm text-muted-foreground">Description</span>
                                <p className="text-sm p-3 bg-secondary/30 rounded-lg">{selectedTx.description}</p>
                            </div>
                        </div>
                    )}
                    <Button onClick={() => setSelectedTx(null)}>Close</Button>
                </DialogContent>
            </Dialog>
        </div >
    );
};

export default WalletPage;
