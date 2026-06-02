import { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requestPayout } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, Smartphone } from "lucide-react";

interface RequestPayoutDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    maxAmount: number;
    onSuccess: () => void;
}

const RequestPayoutDialog = ({ open, onOpenChange, maxAmount, onSuccess }: RequestPayoutDialogProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<"bank" | "upi">("bank");
    const [amount, setAmount] = useState("");
    const [accountName, setAccountName] = useState("");

    // Bank details
    const [bankAccount, setBankAccount] = useState("");
    const [ifscCode, setIfscCode] = useState("");

    // UPI details
    const [upiVpa, setUpiVpa] = useState("");

    // Contact details
    const [phoneNumber, setPhoneNumber] = useState("");
    const [email, setEmail] = useState("");

    const validateForm = () => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount < 500) {
            toast({
                title: "Invalid Amount",
                description: "Minimum payout amount is ₹500",
                variant: "destructive",
            });
            return false;
        }

        if (numAmount > maxAmount) {
            toast({
                title: "Insufficient Balance",
                description: "You cannot withdraw more than your wallet balance",
                variant: "destructive",
            });
            return false;
        }

        if (!accountName.trim()) {
            toast({
                title: "Missing Details",
                description: "Please enter account holder name",
                variant: "destructive",
            });
            return false;
        }

        if (paymentMethod === "bank") {
            if (!bankAccount.trim() || !ifscCode.trim()) {
                toast({
                    title: "Missing Details",
                    description: "Please fill in all bank account details",
                    variant: "destructive",
                });
                return false;
            }
        }

        if (!phoneNumber.trim() || phoneNumber.length < 10) {
            toast({
                title: "Invalid Phone Number",
                description: "Please enter a valid phone number for admin contact",
                variant: "destructive",
            });
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsLoading(true);
        try {
            await requestPayout({
                amount: parseFloat(amount),
                paymentMethod,
                bankAccount: paymentMethod === "bank" ? bankAccount : undefined,
                ifscCode: paymentMethod === "bank" ? ifscCode : undefined,
                accountName,
                upiVpa: paymentMethod === "upi" ? upiVpa : undefined,
                phoneNumber,
                email: email || undefined
            });

            toast({
                title: "Payout Requested",
                description: `Your payout request via ${paymentMethod === "bank" ? "Bank Transfer" : "UPI"} has been submitted for approval.`,
            });

            onOpenChange(false);
            onSuccess();

            // Reset form
            setAmount("");
            setBankAccount("");
            setIfscCode("");
            setAccountName("");
            setUpiVpa("");
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to request payout",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-2xl border-slate-200/80 shadow-2xl p-6">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-slate-800">Request Payout</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="amount" className="text-xs font-semibold text-slate-600">Amount (₹)</Label>
                        <Input
                            id="amount"
                            type="number"
                            placeholder="Enter amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            min="500"
                            max={maxAmount}
                            required
                            className="rounded-xl border-slate-200 focus-visible:ring-[#00A4EF]/20 h-11"
                        />
                        <p className="text-[11px] text-slate-400 font-medium pl-0.5">
                            Available: ₹{maxAmount.toLocaleString('en-IN')} | Minimum payout: ₹500
                        </p>
                    </div>

                    <Tabs value={paymentMethod} onValueChange={(val) => setPaymentMethod(val as "bank" | "upi")}>
                        <div className="relative rounded-full bg-slate-200/50 p-1.5 flex w-full border border-slate-200/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),_inset_0_-1px_1px_rgba(0,0,0,0.02)]">
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("bank")}
                                className="relative z-10 w-1/2 rounded-full py-2.5 text-sm font-semibold transition-colors duration-200 text-center flex items-center justify-center gap-1.5 focus-visible:outline-none focus:outline-none"
                            >
                                {paymentMethod === "bank" && (
                                    <motion.div
                                        layoutId="activePayoutMethodTab"
                                        className="absolute inset-0 bg-white rounded-full shadow-[0_2.5px_6px_rgba(0,0,0,0.08),_0_0.5px_1.5px_rgba(0,0,0,0.04)] border border-slate-200/60"
                                        transition={{ type: "spring", stiffness: 350, damping: 28 }}
                                    />
                                )}
                                <CreditCard className={`relative z-20 h-4 w-4 shrink-0 transition-colors duration-200 ${paymentMethod === "bank" ? "text-slate-900" : "text-slate-500"}`} />
                                <span className={`relative z-20 transition-all duration-200 ${paymentMethod === "bank" ? "text-slate-900 font-bold" : "text-slate-500 hover:text-slate-700"}`}>
                                    Bank Account
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("upi")}
                                className="relative z-10 w-1/2 rounded-full py-2.5 text-sm font-semibold transition-colors duration-200 text-center flex items-center justify-center gap-1.5 focus-visible:outline-none focus:outline-none"
                            >
                                {paymentMethod === "upi" && (
                                    <motion.div
                                        layoutId="activePayoutMethodTab"
                                        className="absolute inset-0 bg-white rounded-full shadow-[0_2.5px_6px_rgba(0,0,0,0.08),_0_0.5px_1.5px_rgba(0,0,0,0.04)] border border-slate-200/60"
                                        transition={{ type: "spring", stiffness: 350, damping: 28 }}
                                    />
                                )}
                                <Smartphone className={`relative z-20 h-4 w-4 shrink-0 transition-colors duration-200 ${paymentMethod === "upi" ? "text-slate-900" : "text-slate-500"}`} />
                                <span className={`relative z-20 transition-all duration-200 ${paymentMethod === "upi" ? "text-slate-900 font-bold" : "text-slate-500 hover:text-slate-700"}`}>
                                    UPI
                                </span>
                            </button>
                        </div>

                        <TabsContent value="bank" className="space-y-3 mt-4">
                            <div className="space-y-2">
                                <Label htmlFor="accountName" className="text-xs font-semibold text-slate-600">Account Holder Name</Label>
                                <Input
                                    id="accountName"
                                    placeholder="e.g. John Doe"
                                    value={accountName}
                                    onChange={(e) => setAccountName(e.target.value)}
                                    required
                                    className="rounded-xl border-slate-200 focus-visible:ring-[#00A4EF]/20 h-11"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="bankAccount" className="text-xs font-semibold text-slate-600">Bank Account Number</Label>
                                <Input
                                    id="bankAccount"
                                    placeholder="e.g. 1234567890"
                                    value={bankAccount}
                                    onChange={(e) => setBankAccount(e.target.value)}
                                    required={paymentMethod === "bank"}
                                    className="rounded-xl border-slate-200 focus-visible:ring-[#00A4EF]/20 h-11"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="ifscCode" className="text-xs font-semibold text-slate-600">IFSC Code</Label>
                                <Input
                                    id="ifscCode"
                                    placeholder="e.g. HDFC0001234"
                                    value={ifscCode}
                                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                                    required={paymentMethod === "bank"}
                                    className="rounded-xl border-slate-200 focus-visible:ring-[#00A4EF]/20 h-11"
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="upi" className="space-y-3 mt-4">
                            <div className="space-y-2">
                                <Label htmlFor="accountNameUpi" className="text-xs font-semibold text-slate-600">Account Holder Name</Label>
                                <Input
                                    id="accountNameUpi"
                                    placeholder="e.g. John Doe"
                                    value={accountName}
                                    onChange={(e) => setAccountName(e.target.value)}
                                    required
                                    className="rounded-xl border-slate-200 focus-visible:ring-[#00A4EF]/20 h-11"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="upiVpa" className="text-xs font-semibold text-slate-600">UPI ID</Label>
                                <Input
                                    id="upiVpa"
                                    placeholder="e.g. 9876543210@paytm"
                                    value={upiVpa}
                                    onChange={(e) => setUpiVpa(e.target.value.toLowerCase())}
                                    required={paymentMethod === "upi"}
                                    className="rounded-xl border-slate-200 focus-visible:ring-[#00A4EF]/20 h-11"
                                />
                                <p className="text-[10px] text-slate-400 font-medium pl-0.5">
                                    Enter your UPI ID (e.g., user@paytm, 1234567890@oksbi)
                                </p>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="border-t border-slate-100 pt-4 mt-2 space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="phoneNumber" className="text-xs font-semibold text-slate-600">Phone Number (Required for Admin Contact)</Label>
                            <Input
                                id="phoneNumber"
                                type="tel"
                                placeholder="e.g. 9876543210"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                required
                                className="rounded-xl border-slate-200 focus-visible:ring-[#00A4EF]/20 h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contactEmail" className="text-xs font-semibold text-slate-600">Contact Email (Optional)</Label>
                            <Input
                                id="contactEmail"
                                type="email"
                                placeholder="e.g. john@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="rounded-xl border-slate-200 focus-visible:ring-[#00A4EF]/20 h-11"
                            />
                        </div>
                    </div>

                    <DialogFooter className="pt-3 gap-2">
                        <Button type="button" variant="outline" className="rounded-xl px-5 h-10" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading} className="bg-[#00A4EF] hover:bg-[#00A4EF]/90 text-white rounded-xl px-6 h-10 font-semibold transition-all duration-200 active:scale-[0.97]">
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />}
                            Submit Request
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default RequestPayoutDialog;
