import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    User, Mail, Calendar, Shield, Activity, Wallet,
    Handshake, Star, AlertTriangle, Ban, CheckCircle2,
    Globe, Phone, Clock, CreditCard, TrendingUp, ExternalLink,
    Image as ImageIcon, LayoutGrid
} from "lucide-react";
import { getAdminUserFullDetails, FullUserDetails } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AdminUserDetailDialogProps {
    userId: number | null;
    isOpen: boolean;
    onClose: () => void;
}

type TabType = "overview" | "wallet" | "escrow" | "activity" | "moderation";

const AdminUserDetailDialog = ({ userId, isOpen, onClose }: AdminUserDetailDialogProps) => {
    const { toast } = useToast();
    const [details, setDetails] = useState<FullUserDetails | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>("overview");
    const [shareChatId, setShareChatId] = useState<string>("");
    const [shareReceiverId, setShareReceiverId] = useState<string>("");
    const [shareCaption, setShareCaption] = useState<string>("");
    const [isSharingImage, setIsSharingImage] = useState(false);

    useEffect(() => {
        if (isOpen && userId) {
            loadDetails();
        } else {
            setDetails(null);
            setActiveTab("overview");
        }
    }, [isOpen, userId]);

    const loadDetails = async () => {
        if (!userId) return;
        setIsLoading(true);
        try {
            const data = await getAdminUserFullDetails(userId);
            setDetails(data);
        } catch (err) {
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Failed to load user details",
                variant: "destructive",
            });
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
        }).format(amount);
    };

    const reportsReceived = (details as any)?.reportsReceived ?? (details as any)?.reportReceived ?? [];
    const ratingsReceived = (details as any)?.ratingReceived ?? (details as any)?.ratingsReceived ?? [];



    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden bg-card border-border">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                        <User className="h-6 w-6 text-primary" />
                        User Detailed Profile
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                ) : details ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Header Info */}
                        <div className="p-6 border-b border-border bg-secondary/20">
                            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                                <Avatar className="h-20 w-20 border-2 border-primary/20">
                                    <AvatarImage src={details.avatarUrl} />
                                    <AvatarFallback className="text-2xl">
                                        {details.displayName?.[0] || details.username[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-bold text-card-foreground">
                                            {details.displayName || details.username}
                                        </h2>
                                        <Badge variant={details.role === "admin" ? "default" : "secondary"}>
                                            {details.role}
                                        </Badge>
                                        <Badge className={details.status === "active" ? "bg-green-500/10 text-green-500 border-green-500/20" : ""} variant={details.status === "active" ? "secondary" : "destructive"}>
                                            {details.status}
                                        </Badge>
                                        {details.verified && (
                                            <CheckCircle2 className="h-5 w-5 text-blue-500" fill="currentColor" />
                                        )}
                                    </div>
                                    <p className="text-muted-foreground flex items-center gap-2">
                                        <User className="h-4 w-4" /> @{details.username}
                                    </p>
                                    <p className="text-muted-foreground flex items-center gap-2">
                                        <Mail className="h-4 w-4" /> {details.email}
                                    </p>
                                </div>
                                <div className="text-right space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                                        Wallet Balance
                                    </p>
                                    <p className="text-2xl font-black text-primary">
                                        {formatCurrency(details.walletBalance)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-border bg-card sticky top-0 z-10">
                            {(["overview", "wallet", "escrow", "activity", "moderation"] as TabType[]).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === tab
                                        ? "border-primary text-primary bg-primary/5"
                                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                        }`}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <ScrollArea className="flex-1 p-6">
                            {activeTab === "overview" && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-6">
                                        <section className="space-y-3">
                                            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                                <User className="h-4 w-4" /> Personal Information
                                            </h3>
                                            <div className="bg-secondary/30 rounded-lg p-4 space-y-3 border border-border/50 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Bio:</span>
                                                    <span className="text-card-foreground text-right">{details.bio || "No bio set"}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">City/Pincode:</span>
                                                    <span className="text-card-foreground">
                                                        {details.city || "N/A"} {details.pincode ? `, ${details.pincode}` : ""}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Phone:</span>
                                                    <span className="text-card-foreground flex items-center gap-1">
                                                        <Phone className="h-3 w-3" /> {details.phoneNumber || "Not provided"}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Registered:</span>
                                                    <span className="text-card-foreground flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" /> {new Date(details.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Telegram ID:</span>
                                                    <span className="text-card-foreground">
                                                        {details.telegramId ? `@${details.telegramId}` : "Not linked"}
                                                    </span>
                                                </div>
                                            </div>
                                        </section>

                                        <section className="space-y-3">
                                            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                                <Globe className="h-4 w-4" /> Social Links
                                            </h3>
                                            <div className="bg-secondary/30 rounded-lg p-4 space-y-2 border border-border/50">
                                                {details.socialLinks && details.socialLinks.length > 0 ? (
                                                    details.socialLinks.map((link, idx) => (
                                                        <a
                                                            key={idx}
                                                            href={link.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center justify-between text-sm text-primary hover:underline p-1"
                                                        >
                                                            <span>{link.platform}</span>
                                                            <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    ))
                                                ) : (
                                                    <p className="text-sm text-muted-foreground italic text-center py-2">No links found</p>
                                                )}
                                            </div>
                                        </section>
                                    </div>

                                    <div className="space-y-6">
                                        <section className="space-y-3">
                                            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                                <TrendingUp className="h-4 w-4" /> Platform Stats
                                            </h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                {[
                                                    { label: "Client Deals", value: details.clientDeals.length, icon: Handshake },
                                                    { label: "Vendor Deals", value: details.vendorDeals.length, icon: Handshake },
                                                    { label: "Ratings Received", value: ratingsReceived.length, icon: Star },
                                                    { label: "Payouts Requested", value: details.payoutRequests.length, icon: CreditCard },
                                                ].map((stat, idx) => (
                                                    <div key={idx} className="bg-card border border-border p-3 rounded-lg text-center shadow-sm">
                                                        <stat.icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground opacity-50" />
                                                        <p className="text-xl font-bold">{stat.value}</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase">{stat.label}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>

                                        <section className="space-y-3">
                                            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                                <Shield className="h-4 w-4" /> Verification Status
                                            </h3>
                                            <div className="bg-secondary/30 rounded-lg p-4 border border-border/50 text-sm">
                                                {details.verificationRequests.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {details.verificationRequests.slice(0, 2).map((req, idx) => (
                                                            <div key={idx} className="flex justify-between items-center border-b border-border/30 last:border-0 pb-2">
                                                                <div>
                                                                    <p className="font-medium">Request #{req.id}</p>
                                                                    <p className="text-[10px] text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</p>
                                                                </div>
                                                                <Badge className={req.status === "approved" ? "bg-green-500/10 text-green-500 border-green-500/20" : ""} variant={req.status === "approved" ? "secondary" : req.status === "pending" ? "outline" : "destructive"}>
                                                                    {req.status}
                                                                </Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-muted-foreground italic text-center py-2">No verification history</p>
                                                )}
                                            </div>
                                        </section>
                                    </div>
                                </div>
                            )}

                            {activeTab === "wallet" && (
                                <div className="space-y-6">
                                    <div className="flex gap-4">
                                        <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl flex-1 text-center">
                                            <p className="text-xs text-primary/80 uppercase font-bold">Current Balance</p>
                                            <p className="text-2xl font-black">{formatCurrency(details.walletBalance)}</p>
                                        </div>
                                        <div className="bg-secondary/30 border border-border p-4 rounded-xl flex-1 text-center">
                                            <p className="text-xs text-muted-foreground uppercase font-bold">Total Transactions</p>
                                            <p className="text-2xl font-black">{details.walletTransactions.length}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Recent Transactions</h3>
                                        <div className="border border-border rounded-lg overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-secondary/50 text-muted-foreground">
                                                    <tr>
                                                        <th className="text-left px-4 py-2 font-medium">Type</th>
                                                        <th className="text-left px-4 py-2 font-medium">Description</th>
                                                        <th className="text-right px-4 py-2 font-medium">Amount</th>
                                                        <th className="text-right px-4 py-2 font-medium">Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {details.walletTransactions.map((tx) => (
                                                        <tr key={tx.id} className="hover:bg-secondary/20 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <Badge variant={tx.type === 'credit' || tx.type === 'escrow_release' ? 'secondary' : 'destructive'} className={cn("capitalize", tx.type === 'credit' || tx.type === 'escrow_release' ? "bg-green-500/10 text-green-500 border-green-500/20" : "")}>
                                                                    {tx.type.replace('_', ' ')}
                                                                </Badge>
                                                            </td>
                                                            <td className="px-4 py-3 max-w-[300px] truncate" title={tx.description}>
                                                                {tx.description}
                                                            </td>
                                                            <td className={`px-4 py-3 text-right font-bold ${tx.amount > 0 ? "text-green-500" : "text-red-500"}`}>
                                                                {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount)}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                                                                {new Date(tx.createdAt).toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {details.walletTransactions.length === 0 && (
                                                        <tr><td colSpan={4} className="text-center py-8 text-muted-foreground italic">No wallet activity recorded</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === "escrow" && (
                                <div className="space-y-8">
                                    {/* Client Deals */}
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                                            <Handshake className="h-4 w-4" /> Client Deals (Buying)
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {details.clientDeals.map((deal) => (
                                                <div key={deal.id} className="bg-secondary/20 border border-border p-4 rounded-xl space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-bold text-card-foreground">{deal.title}</p>
                                                            <p className="text-xs text-muted-foreground">Vendor: {deal.vendor.displayName} (@{deal.vendor.username})</p>
                                                        </div>
                                                        <Badge className={deal.status === 'completed' ? "bg-green-500/10 text-green-500 border-green-500/20" : ""} variant={deal.status === 'completed' ? 'secondary' : deal.status === 'active' ? 'default' : 'outline'}>
                                                            {deal.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex justify-between items-end">
                                                        <div>
                                                            <p className="text-[10px] text-muted-foreground uppercase">Value</p>
                                                            <p className="text-lg font-black">{formatCurrency(deal.totalAmount)}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-muted-foreground uppercase">Released</p>
                                                            <p className="text-sm font-bold text-primary">{deal.releasedPercent}%</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {details.clientDeals.length === 0 && (
                                                <p className="col-span-2 text-center py-4 text-muted-foreground italic border border-dashed rounded-lg">No deals as client</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Vendor Deals */}
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-bold flex items-center gap-2 text-amber-500">
                                            <Handshake className="h-4 w-4" /> Vendor Deals (Selling)
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {details.vendorDeals.map((deal) => (
                                                <div key={deal.id} className="bg-secondary/20 border border-border p-4 rounded-xl space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-bold text-card-foreground">{deal.title}</p>
                                                            <p className="text-xs text-muted-foreground">Client: {deal.client.displayName} (@{deal.client.username})</p>
                                                        </div>
                                                        <Badge className={deal.status === 'completed' ? "bg-green-500/10 text-green-500 border-green-500/20" : ""} variant={deal.status === 'completed' ? 'secondary' : deal.status === 'active' ? 'default' : 'outline'}>
                                                            {deal.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex justify-between items-end">
                                                        <div>
                                                            <p className="text-[10px] text-muted-foreground uppercase">Value</p>
                                                            <p className="text-lg font-black">{formatCurrency(deal.totalAmount)}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-muted-foreground uppercase">Earned</p>
                                                            <p className="text-sm font-bold text-amber-500">{deal.releasedPercent}%</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {details.vendorDeals.length === 0 && (
                                                <p className="col-span-2 text-center py-4 text-muted-foreground italic border border-dashed rounded-lg">No deals as vendor</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === "activity" && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4" /> Activity History</h3>
                                    <div className="space-y-2">
                                        {details.activities.map((log) => (
                                            <div key={log.id} className="bg-secondary/20 p-3 rounded-lg flex items-center gap-4 text-sm border border-border/50">
                                                <div className="bg-card p-2 rounded-full border border-border">
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-card-foreground font-medium">{log.action}</p>
                                                    <p className="text-muted-foreground text-xs">{log.details}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleDateString()}</p>
                                                    <p className="text-[10px] text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {details.activities.length === 0 && (
                                            <p className="text-center py-12 text-muted-foreground italic">No activities found</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === "moderation" && (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <section className="space-y-3">
                                            <h3 className="text-sm font-bold flex items-center gap-2 text-destructive">
                                                <AlertTriangle className="h-4 w-4" /> Reports Received
                                            </h3>
                                            <div className="space-y-2">
                                                {reportsReceived.map((report: any) => (
                                                    <div key={report.id} className="bg-red-500/5 border border-red-500/20 p-3 rounded-lg text-xs">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <p className="font-bold">By: {report.reporter.displayName}</p>
                                                            <Badge variant="outline" className="text-[10px]">{report.status}</Badge>
                                                        </div>
                                                        <p className="italic mb-1">"{report.reason}"</p>
                                                        <p className="text-muted-foreground">{new Date(report.createdAt).toLocaleDateString()}</p>
                                                    </div>
                                                ))}
                                                {reportsReceived.length === 0 && <p className="text-center text-muted-foreground text-xs italic py-2 border border-dashed rounded bg-secondary/10">Zero reports received</p>}
                                            </div>
                                        </section>

                                        <section className="space-y-3">
                                            <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                                                <Star className="h-4 w-4" /> Ratings Received
                                            </h3>
                                            <div className="space-y-2">
                                                {ratingsReceived.map((rating: any) => (
                                                    <div key={rating.id} className="bg-secondary/20 p-3 rounded-lg text-xs border border-border/50">
                                                        <div className="flex justify-between mb-1">
                                                            <p className="font-bold">{rating.reviewer.displayName}</p>
                                                            <div className="flex items-center text-amber-500 font-black">
                                                                {rating.rating} <Star className="h-3 w-3 ml-0.5 fill-current" />
                                                            </div>
                                                        </div>
                                                        <p>{rating.comment}</p>
                                                    </div>
                                                ))}
                                                {ratingsReceived.length === 0 && <p className="text-center text-muted-foreground text-xs italic py-2 border border-dashed rounded bg-secondary/10">No ratings yet</p>}
                                            </div>
                                        </section>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <section className="space-y-3">
                                            <h3 className="text-sm font-bold flex items-center gap-2 text-card-foreground">
                                                <Ban className="h-4 w-4" /> Blocked List
                                            </h3>
                                            <div className="bg-secondary/10 rounded-lg p-4 border border-border/50">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Users this user blocked:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {details.blockedUsers.map((b) => (
                                                        <Badge key={b.id} variant="secondary" className="px-2 py-1">@{b.blocked.username}</Badge>
                                                    ))}
                                                    {details.blockedUsers.length === 0 && <p className="text-xs text-muted-foreground italic">Clean blocked list</p>}
                                                </div>

                                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-3 mt-4">Users who blocked this user:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {details.blockedBy.map((b) => (
                                                        <Badge key={b.id} variant="destructive" className="px-2 py-1 bg-red-500/10 text-red-500 border-red-500/20">@{b.blocker.username}</Badge>
                                                    ))}
                                                    {details.blockedBy.length === 0 && <p className="text-xs text-muted-foreground italic">Not blocked by anyone</p>}
                                                </div>
                                            </div>
                                        </section>

                                        <section className="space-y-3">
                                            <h3 className="text-sm font-bold flex items-center gap-2 text-muted-foreground">
                                                <Activity className="h-4 w-4" /> Recent Payouts
                                            </h3>
                                            <div className="space-y-2">
                                                {details.payoutRequests.slice(0, 5).map((p) => (
                                                    <div key={p.id} className="bg-card border border-border p-3 rounded-lg text-xs flex justify-between items-center shadow-sm">
                                                        <div>
                                                            <p className="font-bold">{formatCurrency(p.amount)}</p>
                                                            <p className="text-muted-foreground uppercase text-[10px]">{p.paymentMethod}</p>
                                                        </div>
                                                        <Badge className={p.status === 'completed' ? "bg-green-500/10 text-green-500 border-green-500/20" : ""} variant={p.status === 'completed' ? 'secondary' : p.status === 'pending' ? 'outline' : 'destructive'}>
                                                            {p.status}
                                                        </Badge>
                                                    </div>
                                                ))}
                                                {details.payoutRequests.length === 0 && <p className="text-center text-muted-foreground text-xs italic py-4 border border-dashed rounded bg-secondary/10">No payout attempts</p>}
                                            </div>
                                        </section>
                                    </div>
                                </div>
                            )}


                        </ScrollArea>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
};

export default AdminUserDetailDialog;
