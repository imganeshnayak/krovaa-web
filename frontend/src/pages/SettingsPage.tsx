import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle2, Clock, LogOut, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { getVerificationStatus, getVerificationFee, applyForVerification, VerificationRequest, initiateVerificationPayment, verifyPayment } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useRazorpay } from "@/hooks/useRazorpay";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

const SettingsPage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { openCheckout } = useRazorpay();
    const [verificationRequest, setVerificationRequest] = useState<VerificationRequest | null>(null);
    const [verificationFee, setVerificationFee] = useState(0);
    const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [agreeToTerms, setAgreeToTerms] = useState(false);

    useEffect(() => {
        loadVerificationData();
    }, []);

    const loadVerificationData = async () => {
        try {
            const [status, feeData] = await Promise.all([
                getVerificationStatus(),
                getVerificationFee()
            ]);
            setVerificationRequest(status);
            setVerificationFee(feeData.fee);
        } catch (err) {
            console.error('Load verification data error:', err);
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const handleApplyForVerification = async () => {
        setIsApplying(true);
        try {
            // Initiate payment
            const paymentOrder = await initiateVerificationPayment();

            // Open Razorpay checkout
            openCheckout({
                orderId: paymentOrder.orderId,
                amount: paymentOrder.amount,
                currency: paymentOrder.currency,
                name: "Verification Payment",
                description: `Get verified badge for ₹${verificationFee}`,
                onSuccess: async (response) => {
                    // Verify payment with backend
                    try {
                        if (!paymentOrder.requestId) {
                            throw new Error("Verification request ID missing from payment initiation.");
                        }

                        await verifyPayment({
                            orderId: response.razorpay_order_id,
                            paymentId: response.razorpay_payment_id,
                            signature: response.razorpay_signature,
                            type: "verification",
                            entityId: paymentOrder.requestId,
                        });

                        toast({
                            title: "Payment Successful!",
                            description: "Your verification request has been submitted for review.",
                        });

                        setIsVerificationDialogOpen(false);
                        loadVerificationData();
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
            setIsApplying(false);
        }
    };

    const getVerificationStatusBadge = () => {
        if (!verificationRequest) return null;

        const statusConfig = {
            pending_payment: { icon: Clock, text: "Awaiting Payment", className: "bg-orange-500/10 text-orange-500" },
            pending: { icon: Clock, text: "Pending Review", className: "bg-yellow-500/10 text-yellow-500" },
            approved: { icon: CheckCircle2, text: "Approved", className: "bg-green-500/10 text-green-500" },
            rejected: { icon: XCircle, text: "Rejected", className: "bg-red-500/10 text-red-500" }
        };

        const config = statusConfig[verificationRequest.status as keyof typeof statusConfig];
        if (!config) return null;

        const Icon = config.icon;
        return (
            <Badge className={config.className}>
                <Icon className="h-3 w-3 mr-1" />
                {config.text}
            </Badge>
        );
    };

    return (
        <div className="min-h-screen bg-background pb-20">
            <div className="max-w-2xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-2xl font-bold">Settings</h1>
                </div>

                {/* Subscription Section */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            Subscription & Verification
                            {user?.verified && (
                                <img src="/verified-badge.svg" alt="Verified" className="h-8 w-8" title="Verified Account" />
                            )}
                        </CardTitle>
                        <CardDescription>
                            Manage your account verification status
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {user?.verified ? (
                            <div className="flex items-center gap-2 p-4 bg-green-500/10 rounded-lg">
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                <div>
                                    <p className="font-medium text-green-500">Account Verified</p>
                                    <p className="text-sm text-muted-foreground">Your account has a verified badge</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {verificationRequest ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">Verification Status:</span>
                                            {getVerificationStatusBadge()}
                                        </div>
                                        {verificationRequest.status === 'rejected' && verificationRequest.adminNote && (
                                            <div className="p-3 bg-red-500/10 rounded-lg">
                                                <p className="text-sm text-red-500 font-medium">Admin Note:</p>
                                                <p className="text-sm text-muted-foreground mt-1">{verificationRequest.adminNote}</p>
                                            </div>
                                        )}
                                        {verificationRequest.status === 'rejected' && (
                                            <Button
                                                onClick={() => setIsVerificationDialogOpen(true)}
                                                className="w-full"
                                            >
                                                Apply Again
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="p-4 bg-primary/10 rounded-lg">
                                            <p className="font-medium">Get Verified</p>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Stand out with a verified badge next to your name
                                            </p>
                                            <p className="text-sm font-medium mt-2">
                                                Verification Fee: ₹{verificationFee}
                                            </p>
                                        </div>
                                        <Button
                                            onClick={() => setIsVerificationDialogOpen(true)}
                                            className="w-full"
                                        >
                                            Apply for Verification
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Preferences Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Preferences</CardTitle>
                        <CardDescription>Manage your account settings and preferences</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="account">
                                <AccordionTrigger>Account</AccordionTrigger>
                                <AccordionContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium">Username</Label>
                                        <p className="text-sm text-muted-foreground">{user?.username}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium">Email</Label>
                                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium">Role</Label>
                                        <Badge variant="outline">{user?.role}</Badge>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="privacy">
                                <AccordionTrigger>Privacy</AccordionTrigger>
                                <AccordionContent className="space-y-4">
                                    <Button variant="outline" className="w-full" onClick={() => navigate('/blocked-users')}>
                                        Manage Blocked Users
                                    </Button>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="notifications">
                                <AccordionTrigger>Notifications</AccordionTrigger>
                                <AccordionContent className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="message-notifications">Message Notifications</Label>
                                            <p className="text-sm text-muted-foreground">Get notified for new messages</p>
                                        </div>
                                        <Switch id="message-notifications" defaultChecked />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="email-notifications">Email Notifications</Label>
                                            <p className="text-sm text-muted-foreground">Receive updates via email</p>
                                        </div>
                                        <Switch id="email-notifications" />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="about">
                                <AccordionTrigger>About</AccordionTrigger>
                                <AccordionContent className="space-y-3">
                                    <div>
                                        <Label className="text-sm font-medium">App Version</Label>
                                        <p className="text-sm text-muted-foreground">1.0.0</p>
                                    </div>
                                    <div className="flex flex-col gap-2.5">
                                        <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline relative z-10" onClick={(e) => e.stopPropagation()}>Terms of Service</Link>
                                        <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline relative z-10" onClick={(e) => e.stopPropagation()}>Privacy Policy</Link>
                                        <Link to="/refund" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline relative z-10" onClick={(e) => e.stopPropagation()}>Refund Policy</Link>
                                        <Link to="/cookie-policy" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline relative z-10" onClick={(e) => e.stopPropagation()}>Cookie Policy</Link>
                                        <a href="mailto:support@krovaa.com" className="text-sm text-blue-500 hover:underline relative z-10" onClick={(e) => e.stopPropagation()}>Contact Us</a>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                </Card>

                {/* Verification Application Dialog */}
                <Dialog open={isVerificationDialogOpen} onOpenChange={setIsVerificationDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Apply for Verification</DialogTitle>
                            <DialogDescription>
                                Get a verified badge to stand out and build trust with other users
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="p-4 bg-primary/10 rounded-lg">
                                <h4 className="font-medium mb-2">Benefits of Verification</h4>
                                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                                    <li>Verified badge displayed on your profile</li>
                                    <li>Increased trust and credibility</li>
                                    <li>Stand out in search results</li>
                                    <li>Priority support access</li>
                                </ul>
                            </div>
                            <div className="p-4 bg-muted rounded-lg">
                                <p className="text-sm font-medium">One-time verification fee</p>
                                <p className="text-2xl font-bold text-primary mt-1">₹{verificationFee}</p>
                            </div>

                            <div className="flex items-start space-x-2 mt-4">
                                <Checkbox 
                                    id="payment-terms" 
                                    checked={agreeToTerms} 
                                    onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <div className="text-sm font-medium leading-none text-muted-foreground">
                                        <Label htmlFor="payment-terms" className="cursor-pointer">I agree to the </Label>
                                        <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline relative z-10" onClick={(e) => e.stopPropagation()}>Terms & Conditions</Link>
                                        {", "}
                                        <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline relative z-10" onClick={(e) => e.stopPropagation()}>Privacy Policy</Link>
                                        {" and "}
                                        <Link to="/refund" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline relative z-10" onClick={(e) => e.stopPropagation()}>Refund Policy</Link>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    onClick={handleApplyForVerification}
                                    disabled={isApplying || !agreeToTerms}
                                    className="flex-1"
                                >
                                    {isApplying ? "Submitting..." : "Submit Application"}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsVerificationDialogOpen(false)}
                                    disabled={isApplying}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
                {/* Logout Section */}
                <Card className="mt-6 border-destructive/20 bg-destructive/5">
                    <CardContent className="pt-6">
                        <Button
                            variant="destructive"
                            className="w-full flex items-center justify-center gap-2"
                            onClick={handleLogout}
                        >
                            <LogOut className="h-4 w-4" />
                            Logout
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default SettingsPage;
