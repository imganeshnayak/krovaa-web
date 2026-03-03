import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MessageSquare, Users, DollarSign, Shield, Search,
  Eye, Ban, AlertTriangle, ChevronRight, TrendingUp,
  Activity, UserCheck, Trash2, CheckCircle2, LogOut, Wallet, Bell, Send,
  IndianRupee, Settings, Loader2, Info, Percent, ExternalLink, ImageIcon, Film, X, Plus, RadioTower
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import AdminUserDetailDialog from "@/components/AdminUserDetailDialog";
import {
  getAdminStats,
  getAdminUsers,
  getAdminChats,
  getAdminEscrowDeals,
  getActivityLogs,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  getAdminReports,
  updateReportStatus,
  getVerificationRequests,
  approveVerificationRequest,
  rejectVerificationRequest,
  getAdminPayouts,
  updatePayoutStatus,
  broadcastNotification,
  getNotifications,
  getSystemSettings,
  updateSystemSettings,
  getUserTransactions,
  getAdminStaff,
  createAdminStaff,
  updateAdminStaffPermissions,
  deleteAdminStaff,
  Notification,
  VerificationRequest,
  AdminStats,
  AdminUser,
  AdminReport,
  PayoutRequest,
  AuthUser,
  Ad,
  getAdminAds,
  createAd,
  updateAd,
  deleteAd,
  pushAdNotification
} from "@/lib/api";

type AdminTab = "overview" | "users" | "chats" | "escrow" | "activity" | "reports" | "verifications" | "payouts" | "broadcast" | "settings" | "staff";

const AdminDashboard = () => {
  const { toast } = useToast();
  const { user, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [escrowDeals, setEscrowDeals] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastType, setBroadcastType] = useState<"info" | "warning" | "success" | "alert">("info");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastColor, setBroadcastColor] = useState("#4f46e5");
  const [sentNotifications, setSentNotifications] = useState<Notification[]>([]);
  const [systemSettings, setSystemSettings] = useState<Record<string, string>>({
    verification_fee: "109",
    platform_fee_percent: "0.10"
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Record<number, boolean>>({});
  const [userTransactions, setUserTransactions] = useState<Record<number, any>>({});
  const [isLoadingTransactions, setIsLoadingTransactions] = useState<Record<number, boolean>>({});
  const [detailUserId, setDetailUserId] = useState<number | null>(null);
  const [expandedEscrowDeals, setExpandedEscrowDeals] = useState<Record<number, boolean>>({});
  const [staffList, setStaffList] = useState<AuthUser[]>([]);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [newStaffUsername, setNewStaffUsername] = useState("");
  const [newStaffDisplayName, setNewStaffDisplayName] = useState("");
  const [selectedStaffPermissions, setSelectedStaffPermissions] = useState<string[]>([]);
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");

  // --- Ads State ---
  const [broadcastSubTab, setBroadcastSubTab] = useState<"notifications" | "ads">("notifications");
  const [ads, setAds] = useState<Ad[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(false);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [adForm, setAdForm] = useState({ title: "", description: "", ctaText: "More Details", externalUrl: "", type: "text" as "text" | "image" | "video", targetProfessions: [] as string[] });
  const [adFile, setAdFile] = useState<File | null>(null);
  const [adFilePreview, setAdFilePreview] = useState<string | null>(null);
  const [isSavingAd, setIsSavingAd] = useState(false);

  const adminPermissions = [
    { id: "users", label: "Users Management" },
    { id: "chats", label: "Chat Monitoring" },
    { id: "escrow", label: "Escrow Oversight" },
    { id: "verifications", label: "Verification Approval" },
    { id: "payouts", label: "Payout Processing" },
    { id: "reports", label: "Reports & Moderation" },
    { id: "activity", label: "Activity Logs" },
    { id: "broadcast", label: "Broadcast Notifications" },
    { id: "settings", label: "System Settings" },
    { id: "staff", label: "Staff Management" }
  ];

  useEffect(() => {
    if (!user && !authLoading) {
      navigate("/login");
      return;
    }
    if (user && user.role !== "admin" && user.role !== "staff") {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access the admin panel",
        variant: "destructive"
      });
      navigate("/chat");
      return;
    }
    if (user) {
      if (user.role === 'staff' && activeTab === 'overview') {
        setActiveTab('staff');
      }
      loadData();
    }
  }, [user, authLoading, navigate]);

  // Load broadcast history when broadcast tab is opened
  useEffect(() => {
    if (activeTab === "broadcast" && user) {
      getNotifications().then(setSentNotifications).catch(() => { });
    }
  }, [activeTab, user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const statsData = await getAdminStats();
      setStats(statsData);

      if (activeTab === "users") {
        const usersData = await getAdminUsers({ search: searchQuery, status: statusFilter === "all" ? "" : statusFilter });
        // Filter out staff accounts as they are shown in the staff tab
        setUsers(usersData.users.filter((u: AdminUser) => u.role !== 'staff'));
      } else if (activeTab === "chats") {
        const chatsData = await getAdminChats();
        setChats(chatsData.chats);
      } else if (activeTab === "escrow") {
        const escrowData = await getAdminEscrowDeals({ status: statusFilter === "all" ? "" : statusFilter });
        setEscrowDeals(escrowData.deals);
      } else if (activeTab === "activity") {
        const activityData = await getActivityLogs({ limit: 50 });
        setActivities(activityData.activities);
      } else if (activeTab === "reports") {
        const reportsData = await getAdminReports();
        setReports(reportsData.reports);
      } else if (activeTab === "verifications") {
        const verificationsData = await getVerificationRequests(statusFilter === "all" ? "" : statusFilter);
        setVerificationRequests(verificationsData);
      } else if (activeTab === "payouts") {
        const payoutsData = await getAdminPayouts(1, 20, statusFilter === "all" ? "" : statusFilter);
        setPayouts(payoutsData.payouts);
      } else if (activeTab === "settings") {
        const settingsData = await getSystemSettings();
        setSystemSettings(prev => ({ ...prev, ...settingsData }));
      } else if (activeTab === "staff") {
        const staffData = await getAdminStaff();
        setStaffList(staffData);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [activeTab, searchQuery, statusFilter]);

  const handleUpdateStatus = async (userId: number, status: string) => {
    try {
      await updateUserStatus(userId, status);
      toast({ title: "Success", description: `User status updated to ${status}` });
      loadData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update status",
        variant: "destructive"
      });
    }
  };

  const handleUpdateRole = async (userId: number, role: string) => {
    try {
      await updateUserRole(userId, role);
      toast({ title: "Success", description: `User role updated to ${role}` });
      loadData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update role",
        variant: "destructive"
      });
    }
  };

  const handleDeleteUser = (u: AdminUser) => {
    setUserToDelete(u);
    setDeleteConfirmationInput("");
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteStaff = (s: AuthUser) => {
    // Cast to AdminUser specifically for the deletion dialog
    setUserToDelete({
      id: s.id,
      username: s.username,
      email: s.email,
      displayName: s.displayName,
      role: 'staff',
      status: s.status || 'active',
      createdAt: '',
      _count: { sentMessages: 0, clientDeals: 0, vendorDeals: 0 }
    });
    setDeleteConfirmationInput("");
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    if (deleteConfirmationInput.toUpperCase() !== "DELETE") {
      toast({
        title: "Error",
        description: "Please type DELETE to confirm deletion",
        variant: "destructive"
      });
      return;
    }

    try {
      if (userToDelete.role === 'staff') {
        await deleteAdminStaff(userToDelete.id);
      } else {
        await deleteUser(userToDelete.id);
      }
      toast({ title: "Success", description: `${userToDelete.role === 'staff' ? 'Staff' : 'User'} deleted successfully` });
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      loadData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete account",
        variant: "destructive"
      });
    }
  };

  const handleUpdateReportStatus = async (reportId: number, status: string) => {
    try {
      await updateReportStatus(reportId, status);
      toast({ title: "Report Updated", description: `Report status changed to ${status}.` });
      loadData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update report",
        variant: "destructive"
      });
    }
  };

  const handleApproveVerification = async (requestId: number) => {
    try {
      await approveVerificationRequest(requestId);
      toast({ title: "Verification Approved", description: "User has been verified successfully." });
      loadData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to approve verification",
        variant: "destructive"
      });
    }
  };

  const handleRejectVerification = async (requestId: number) => {
    const adminNote = prompt("Enter reason for rejection (optional):");
    try {
      await rejectVerificationRequest(requestId, adminNote || undefined);
      toast({ title: "Verification Rejected", description: "Request has been rejected." });
      loadData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to reject verification",
        variant: "destructive"
      });
    }
  };

  const toggleUserExpansion = async (userId: number) => {
    const isExpanded = !!expandedUsers[userId];
    setExpandedUsers(prev => ({ ...prev, [userId]: !isExpanded }));

    if (!isExpanded && !userTransactions[userId]) {
      setIsLoadingTransactions(prev => ({ ...prev, [userId]: true }));
      try {
        const transactions = await getUserTransactions(userId);
        setUserTransactions(prev => ({ ...prev, [userId]: transactions }));
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to load user transactions",
          variant: "destructive"
        });
      } finally {
        setIsLoadingTransactions(prev => ({ ...prev, [userId]: false }));
      }
    }
  };

  const handleUpdatePayoutStatus = async (payoutId: number, status: string) => {
    const adminNote = status === 'processing' || status === 'completed'
      ? prompt("Enter transaction reference/note (optional):")
      : (status === 'cancelled' ? prompt("Enter cancellation reason:") : undefined);

    if (status === 'cancelled' && !adminNote) return;

    try {
      await updatePayoutStatus(payoutId, {
        status,
        adminNote: adminNote || undefined
      });
      toast({ title: "Payout Updated", description: `Payout marked as ${status}` });
      loadData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update payout",
        variant: "destructive"
      });
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await updateSystemSettings(systemSettings);
      toast({ title: "Settings Saved", description: "Global configuration updated successfully." });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCreateStaff = async () => {
    if (!newStaffEmail || !newStaffPassword || !newStaffUsername) {
      toast({ title: "Missing Fields", description: "Email, password, and username are required.", variant: "destructive" });
      return;
    }

    try {
      await createAdminStaff({
        email: newStaffEmail,
        password: newStaffPassword,
        username: newStaffUsername,
        displayName: newStaffDisplayName,
        permissions: selectedStaffPermissions
      });
      toast({ title: "Success", description: "Staff account created successfully." });
      setIsStaffModalOpen(false);
      setNewStaffEmail("");
      setNewStaffPassword("");
      setNewStaffUsername("");
      setNewStaffDisplayName("");
      setSelectedStaffPermissions([]);
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create staff", variant: "destructive" });
    }
  };

  const handleUpdateStaffPermissions = async (staffId: number, permissions: string[]) => {
    try {
      await updateAdminStaffPermissions(staffId, permissions);
      toast({ title: "Updated", description: "Staff permissions successfully updated." });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update permissions", variant: "destructive" });
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: TrendingUp },
    { id: "users" as const, label: "Users", icon: Users, count: stats?.totalUsers, permission: "users" },
    { id: "chats" as const, label: "Chats", icon: MessageSquare, count: stats?.totalChats, permission: "chats" },
    { id: "escrow" as const, label: "Escrow", icon: IndianRupee, count: stats?.totalEscrowDeals, permission: "escrow" },
    { id: "verifications" as const, label: "Verifications", icon: CheckCircle2, count: stats?.pendingVerifications, permission: "verifications" },
    { id: "payouts" as const, label: "Payouts", icon: Wallet, count: stats?.pendingPayouts, permission: "payouts" },
    { id: "reports" as const, label: "Reports", icon: AlertTriangle, count: stats?.pendingReports, permission: "reports" },
    { id: "activity" as const, label: "Activity", icon: Activity, permission: "activity" },
    { id: "broadcast" as const, label: "Broadcast", icon: Bell, permission: "broadcast" },
    { id: "settings" as const, label: "Settings", icon: Settings, permission: "settings" },
    { id: "staff" as const, label: "Staff", icon: UserCheck, permission: "staff" },
  ].filter(tab => {
    if (!user) return false;
    if (user.role === "admin") return true;
    if (user.role === "staff") return true; // Show all but restrict clicking
    return false;
  });

  const handleTabClick = (tabId: AdminTab, permission?: string) => {
    if (user?.role === "staff" && tabId !== "overview" && permission && !user.permissions?.includes(permission)) {
      toast({
        title: "Permission Denied",
        description: "Please contact administrator to access this feature.",
        variant: "destructive"
      });
      return;
    }
    setActiveTab(tabId);
  };

  if (isLoading && !stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="hidden md:flex flex-col w-64 border-r border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-8">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold text-card-foreground">Admin Panel</span>
        </div>
        <nav className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id, tab.permission)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : (user?.role === 'staff' && tab.permission && !user.permissions?.includes(tab.permission))
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "text-muted-foreground hover:bg-secondary"
                }`}
            >
              <tab.icon className="h-4 w-4" />
              <span className="flex-1 text-left">{tab.label}</span>
              {tab.count !== undefined && (
                <Badge
                  variant={(['verifications', 'payouts', 'reports'].includes(tab.id) && tab.count > 0) ? "destructive" : "secondary"}
                  className="text-[10px] h-4 px-1.5 min-w-[16px] flex justify-center items-center"
                >
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-2">
          {user?.role !== 'staff' && (
            <Link to="/chat">
              <Button variant="outline" size="sm" className="w-full">Back to App</Button>
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex z-10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id, tab.permission)}
            className={`flex-1 flex flex-col items-center py-3 text-[10px] relative ${activeTab === tab.id ? "text-primary" : (user?.role === 'staff' && tab.permission && !user.permissions?.includes(tab.permission)) ? "opacity-40" : "text-muted-foreground"
              }`}
          >
            <div className="relative">
              <tab.icon className="h-5 w-5 mb-1" />
              {tab.count !== undefined && tab.count > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[8px] text-white">
                  {tab.count > 99 ? '99+' : tab.count}
                </span>
              )}
            </div>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-foreground capitalize">{activeTab}</h1>
            {activeTab !== "overview" && (
              <div className="flex gap-2">
                {(activeTab === "users" || activeTab === "escrow" || activeTab === "verifications" || activeTab === "payouts") && (
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {activeTab === "verifications" ? (
                        <>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          {activeTab === "escrow" && <SelectItem value="completed">Completed</SelectItem>}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                )}
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 bg-secondary border-border"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <ScrollArea className="h-[calc(100vh-140px)]">
            {activeTab === "overview" && stats && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-card-foreground">{stats.totalUsers}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        <UserCheck className="inline h-3 w-3 mr-1" />
                        {stats.activeUsers} active
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Messages</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-card-foreground">{stats.totalMessages}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Across {stats.totalChats} chats
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Escrow Deals</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-card-foreground">{stats.totalEscrowDeals}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats.activeEscrowDeals} active
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-card-foreground">
                        ₹{stats.totalEscrowValue.toLocaleString('en-IN')}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        In escrow
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card className="bg-card border-border border-l-4 border-l-amber-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                        Pending Payouts
                        <Wallet className="h-4 w-4 text-amber-500" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-card-foreground">{stats.pendingPayouts}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Requires processing
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border border-l-4 border-l-blue-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                        Pending Verifications
                        <CheckCircle2 className="h-4 w-4 text-blue-500" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-card-foreground">{stats.pendingVerifications}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Awaiting review
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border border-l-4 border-l-destructive">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                        Pending Reports
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-card-foreground">{stats.pendingReports}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Need moderator attention
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-card-foreground">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{stats.recentActivity} actions in the last 24 hours</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "users" && (
              <div className="space-y-3">
                {users.map((user) => (
                  <Card key={user.id} className="bg-card border-border">
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatarUrl} />
                          <AvatarFallback>{user.displayName?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-card-foreground">{user.displayName}</p>
                          <div className="flex gap-2 items-center text-xs text-muted-foreground">
                            <span>@{user.username}<span>•</span></span>
                            <span>{user._count.sentMessages} messages</span>
                            <span>•</span>
                            <span>{user._count.clientDeals + user._count.vendorDeals} deals</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Select
                          value={user.role}
                          onValueChange={(role) => handleUpdateRole(user.id, role)}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="client">Client</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          value={user.status}
                          onValueChange={(status) => handleUpdateStatus(user.id, status)}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                            <SelectItem value="banned">Banned</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 text-primary border-primary/20 hover:bg-primary/10"
                          onClick={() => setDetailUserId(user.id)}
                          title="View Full Details"
                        >
                          <Info className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleUserExpansion(user.id)}
                          className={expandedUsers[user.id] ? "bg-secondary" : ""}
                        >
                          <ChevronRight className={cn("h-4 w-4 transition-transform", expandedUsers[user.id] && "rotate-90")} />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteUser(user)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                    {expandedUsers[user.id] && (
                      <CardContent className="pt-0 pb-4 px-6 border-t border-border/50">
                        <div className="mt-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                          {isLoadingTransactions[user.id] ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-6 w-6 text-primary animate-spin" />
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Escrow Deals */}
                              <div className="space-y-3">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                  <Shield className="h-3 w-3" />
                                  Escrow History
                                </h4>
                                {userTransactions[user.id]?.escrowDeals?.length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic pl-5">No deals found</p>
                                ) : (
                                  <div className="space-y-2">
                                    {userTransactions[user.id]?.escrowDeals?.map((deal: any) => (
                                      <div key={deal.id} className="bg-secondary/30 rounded-lg p-2.5 border border-border/50 flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-xs font-bold truncate">{deal.title}</p>
                                          <p className="text-[10px] text-muted-foreground">
                                            {deal.clientId === user.id ? `Client → ${deal.vendor.displayName}` : `${deal.client.displayName} → Vendor`}
                                          </p>
                                        </div>
                                        <div className="text-right ml-4">
                                          <p className="text-xs font-black text-primary">₹{deal.totalAmount.toLocaleString('en-IN')}</p>
                                          <Badge className="text-[8px] h-3.5 px-1 bg-primary/20 text-primary border-none">
                                            {deal.status}
                                          </Badge>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Payouts and Transactions */}
                              <div className="space-y-3">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                  <Wallet className="h-3 w-3" />
                                  Payouts & Wallet
                                </h4>
                                {userTransactions[user.id]?.payoutRequests?.length === 0 && userTransactions[user.id]?.walletTransactions?.length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic pl-5">No financial activity</p>
                                ) : (
                                  <div className="space-y-2">
                                    {/* Recent Payouts */}
                                    {userTransactions[user.id]?.payoutRequests?.slice(0, 3).map((p: any) => (
                                      <div key={p.id} className="bg-secondary/30 rounded-lg p-2.5 border border-border/50 flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-xs font-bold">Payout Request</p>
                                          <p className="text-[10px] text-muted-foreground">{new Date(p.requestedAt).toLocaleDateString()}</p>
                                        </div>
                                        <div className="text-right ml-4">
                                          <p className="text-xs font-black text-amber-500">₹{p.amount.toLocaleString('en-IN')}</p>
                                          <Badge className={`text-[8px] h-3.5 px-1 border-none ${p.status === 'completed' ? 'bg-green-500/20 text-green-500' : 'bg-amber-500/20 text-amber-500'}`}>
                                            {p.status}
                                          </Badge>
                                        </div>
                                      </div>
                                    ))}
                                    {/* Recent wallet txs if no payouts or more details needed */}
                                    {userTransactions[user.id]?.walletTransactions?.slice(0, 3).map((t: any) => (
                                      <div key={t.id} className="bg-secondary/30 rounded-lg p-2.5 border border-border/50 flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-xs font-bold truncate">{t.description}</p>
                                          <p className="text-[10px] text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</p>
                                        </div>
                                        <div className="text-right ml-4">
                                          <p className={`text-xs font-black ${t.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {t.amount >= 0 ? '+' : ''}₹{Math.abs(t.amount).toLocaleString('en-IN')}
                                          </p>
                                          <p className="text-[8px] text-muted-foreground font-mono">Balance: ₹{t.balance.toLocaleString('en-IN')}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Reviews & Feedback */}
                          {!isLoadingTransactions[user.id] && (
                            <div className="pt-4 border-t border-border/50">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-3">
                                <MessageSquare className="h-3 w-3" />
                                Reviews & Feedback
                              </h4>
                              {userTransactions[user.id]?.ratingsReceived?.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic pl-5">No reviews received yet</p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {userTransactions[user.id]?.ratingsReceived?.map((r: any) => (
                                    <div key={r.id} className="bg-secondary/20 rounded-lg p-3 border border-border/30">
                                      <div className="flex justify-between items-start mb-1">
                                        <p className="text-[10px] font-bold">from {r.reviewer.displayName}</p>
                                        <div className="flex gap-0.5">
                                          {[...Array(5)].map((_, i) => (
                                            <span key={i} className={`h-2 w-2 rounded-full ${i < r.rating ? 'bg-amber-400' : 'bg-muted'}`} />
                                          ))}
                                        </div>
                                      </div>
                                      <p className="text-xs text-card-foreground italic">"{r.comment}"</p>
                                      <p className="text-[8px] text-muted-foreground mt-2">{new Date(r.createdAt).toLocaleDateString()}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "chats" && (
              <div className="space-y-3">
                {chats.map((chat) => (
                  <Card key={chat.chatId} className="bg-card border-border overflow-hidden">
                    <CardContent className="p-4 grid grid-cols-[auto_1fr_auto] items-center gap-4">
                      <div className="flex -space-x-3 overflow-hidden shrink-0">
                        {chat.participants.map((p: any) => (
                          <Avatar key={p.id} className="h-10 w-10 border-2 border-card shadow-sm">
                            <AvatarImage src={p.avatarUrl} />
                            <AvatarFallback className="bg-muted text-card-foreground text-xs">
                              {p.displayName?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>

                      <div className="min-w-0 flex flex-col gap-1">
                        <p className="font-semibold text-card-foreground text-sm truncate leading-tight">
                          {chat.participants.map((p: any) => p.displayName).join(" & ")}
                        </p>
                        <p className="text-[12px] text-muted-foreground truncate opacity-80 leading-tight">
                          {chat.lastMessage || `${chat.messageCount} messages`}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0 min-w-[60px]">
                        {chat.lastMessageAt && (
                          <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap opacity-70">
                            {(() => {
                              const d = new Date(chat.lastMessageAt);
                              let h = d.getHours();
                              const m = d.getMinutes();
                              const ap = h >= 12 ? 'PM' : 'AM';
                              h = h % 12 || 12;
                              return `${h}:${m < 10 ? '0' + m : m} ${ap}`;
                            })()}
                          </span>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => navigate(`/admin/chats/${chat.chatId}`)}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "escrow" && (
              <div className="space-y-3">
                {escrowDeals.map((deal) => (
                  <Card key={deal.id} className="bg-card border-border overflow-hidden">
                    <CardContent className="p-0">
                      <div
                        className="p-4 cursor-pointer hover:bg-secondary/20 transition-colors"
                        onClick={() => setExpandedEscrowDeals(prev => ({ ...prev, [deal.id]: !prev[deal.id] }))}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Shield className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-bold text-card-foreground leading-tight">{deal.title}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-0.5">
                                {deal.client.displayName} (@{deal.client.username}) <span className="text-primary mx-1">→</span> {deal.vendor.displayName} (@{deal.vendor.username})
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge className={cn(
                              "text-[10px] px-2 py-0.5 border-none font-bold uppercase tracking-tighter",
                              deal.status === "active" ? "bg-accent/20 text-accent" :
                                deal.status === "completed" ? "bg-green-500/20 text-green-500" :
                                  "bg-muted text-muted-foreground"
                            )}>
                              {deal.status}
                            </Badge>
                            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedEscrowDeals[deal.id] && "rotate-90")} />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-muted-foreground uppercase tracking-widest text-[9px]">Progress</span>
                            <span className="text-primary">{deal.releasedPercent.toFixed(1)}% Released</span>
                          </div>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden border border-border/30">
                            <div
                              className="h-full bg-primary rounded-full transition-all shadow-[0_0_10px_rgba(var(--primary),0.3)]"
                              style={{ width: `${deal.releasedPercent}%` }}
                            />
                          </div>
                          <div className="flex justify-between items-end pt-1">
                            <div className="flex gap-4">
                              <div className="flex flex-col">
                                <span className="text-[9px] text-muted-foreground uppercase tracking-tighter font-black">Escrow Value</span>
                                <span className="text-sm font-black text-card-foreground">₹{deal.totalAmount.toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[9px] text-muted-foreground uppercase tracking-tighter font-black">Paid by Client</span>
                                <span className="text-sm font-black text-muted-foreground opacity-80">₹{deal.paidAmount?.toLocaleString('en-IN') || deal.totalAmount.toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-muted-foreground opacity-60 font-mono">ID: #{deal.id}</span>
                          </div>
                        </div>
                      </div>

                      {expandedEscrowDeals[deal.id] && (
                        <div className="p-4 bg-secondary/10 border-t border-border/50 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                  <Info className="h-3 w-3" /> Description
                                </h4>
                                <p className="text-xs text-card-foreground/90 leading-relaxed bg-background/40 p-3 rounded-lg border border-border/30 italic">
                                  {deal.description || "No description provided"}
                                </p>
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                  <Shield className="h-3 w-3" /> Terms & Conditions
                                </h4>
                                <p className="text-xs text-card-foreground/90 leading-relaxed bg-background/40 p-3 rounded-lg border border-border/30">
                                  {deal.terms || "No specific terms"}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                  <TrendingUp className="h-3 w-3" /> Payment History
                                </h4>
                                <div className="space-y-2">
                                  {deal.transactions && deal.transactions.length > 0 ? (
                                    deal.transactions.map((tx: any) => (
                                      <div key={tx.id} className="bg-background/40 rounded-lg p-2.5 border border-border/30 flex justify-between items-center group hover:border-primary/30 transition-colors">
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <Badge className="text-[8px] h-3.5 px-1 bg-green-500/10 text-green-500 border-none">{tx.percent}%</Badge>
                                            <span className="text-[10px] font-black text-card-foreground">₹{tx.amount.toLocaleString('en-IN')}</span>
                                          </div>
                                          <p className="text-[9px] text-muted-foreground mt-0.5 truncate max-w-[150px]">{tx.note || "Milestone release"}</p>
                                        </div>
                                        <span className="text-[9px] text-muted-foreground opacity-60 font-mono">{new Date(tx.createdAt).toLocaleDateString()}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-[10px] text-muted-foreground italic bg-background/40 p-3 rounded-lg border border-border/30 text-center">No funds released yet</p>
                                  )}
                                </div>
                              </div>

                              <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="text-muted-foreground uppercase font-black tracking-tighter">Creation Date</span>
                                  <span className="text-card-foreground font-bold">{new Date(deal.createdAt).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] mt-2">
                                  <span className="text-muted-foreground uppercase font-black tracking-tighter">Razorpay ID</span>
                                  <span className="text-card-foreground font-mono truncate ml-4 max-w-[120px]">{deal.razorpayPaymentId || "Wallet Payment"}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] mt-2">
                                  <span className="text-muted-foreground uppercase font-black tracking-tighter">Payment Status</span>
                                  <Badge className="text-[8px] h-3.5 px-1 bg-blue-500/10 text-blue-500 border-none uppercase">{deal.paymentStatus || 'processing'}</Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "activity" && (
              <div className="space-y-2">
                {activities.map((activity) => (
                  <Card key={activity.id} className="bg-card border-border">
                    <CardContent className="py-3 flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={activity.user.avatarUrl} />
                        <AvatarFallback>{activity.user.displayName?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm text-card-foreground">
                          <span className="font-medium">{activity.user.displayName}</span> {activity.action}
                        </p>
                        {activity.details && (
                          <p className="text-xs text-muted-foreground">{activity.details}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(activity.createdAt).toLocaleTimeString()}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "reports" && (
              <div className="space-y-3">
                {reports.length === 0 ? (
                  <div className="text-center py-10">
                    <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No reports found.</p>
                  </div>
                ) : (
                  reports.map((report) => (
                    <Card key={report.id} className="bg-card border-border">
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-destructive/10 rounded-full">
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            </div>
                            <div>
                              <p className="font-medium text-card-foreground">
                                Reported: {report.reported.displayName} (@{report.reported.username})
                              </p>
                              <p className="text-xs text-muted-foreground">
                                By: {report.reporter.displayName} (@{report.reporter.username})
                              </p>
                            </div>
                          </div>
                          <Badge variant={report.status === "pending" ? "destructive" : "secondary"}>
                            {report.status}
                          </Badge>
                        </div>
                        <div className="bg-secondary/50 p-3 rounded-md mb-4">
                          <p className="text-sm text-card-foreground italic">"{report.reason}"</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Reported on {new Date(report.createdAt).toLocaleDateString()}
                          </span>
                          <div className="flex gap-2">
                            {report.status === "pending" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => handleUpdateReportStatus(report.id, "resolved")}
                                >
                                  Resolve
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-muted-foreground"
                                  onClick={() => handleUpdateReportStatus(report.id, "dismissed")}
                                >
                                  Dismiss
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {activeTab === "verifications" && (
              <div className="space-y-3">
                {verificationRequests.length === 0 ? (
                  <div className="text-center py-10">
                    <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No verification requests found.</p>
                  </div>
                ) : (
                  verificationRequests.map((request) => (
                    <Card key={request.id} className="bg-card border-border">
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={request.user?.avatarUrl} />
                              <AvatarFallback>{request.user?.displayName?.[0] || '?'}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-card-foreground">
                                {request.user?.displayName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                @{request.user?.username} • {request.user?.email}
                              </p>
                            </div>
                          </div>
                          <Badge
                            className={
                              request.status === "pending" ? "bg-yellow-500/10 text-yellow-500" :
                                request.status === "approved" ? "bg-green-500/10 text-green-500" :
                                  "bg-red-500/10 text-red-500"
                            }
                          >
                            {request.status}
                          </Badge>
                        </div>
                        <div className="bg-secondary/50 p-3 rounded-md mb-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Payment Amount:</span>
                            <span className="font-medium text-card-foreground">₹{request.paymentAmount}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Submitted:</span>
                            <span className="text-card-foreground">
                              {new Date(request.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {request.adminNote && (
                          <div className="p-3 bg-red-500/10 rounded-md mb-4">
                            <p className="text-sm font-medium text-red-500">Admin Note:</p>
                            <p className="text-sm text-muted-foreground mt-1">{request.adminNote}</p>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Request ID: #{request.id}
                          </span>
                          <div className="flex gap-2">
                            {request.status === "pending" && (
                              <>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => handleApproveVerification(request.id)}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => handleRejectVerification(request.id)}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {activeTab === "payouts" && (
              <div className="space-y-4">
                <div className="flex gap-4 mb-6">
                  <Card className="flex-1 bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats?.pendingPayouts || 0}</div>
                    </CardContent>
                  </Card>
                  <Card className="flex-1 bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Payouts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">₹{(stats?.totalPayoutValue || 0).toLocaleString()}</div>
                    </CardContent>
                  </Card>
                </div>

                {payouts.length === 0 ? (
                  <div className="text-center py-12 bg-card rounded-lg border border-border">
                    <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <h3 className="text-lg font-medium text-foreground">No Payout Requests</h3>
                    <p className="text-muted-foreground">There are no payout requests to show.</p>
                  </div>
                ) : (
                  payouts.map((payout) => (
                    <Card key={payout.id} className="bg-card border-border">
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xl font-bold text-primary">₹{payout.amount.toLocaleString()}</span>
                              <Badge variant={
                                payout.status === 'completed' ? 'default' :
                                  payout.status === 'pending' ? 'secondary' :
                                    payout.status === 'failed' || payout.status === 'cancelled' ? 'destructive' : 'outline'
                              } className={payout.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20' : ''}>
                                {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>Requested by <b>{payout.user?.displayName}</b> (@{payout.user?.username})</span>
                              <span>•</span>
                              <span className="text-primary/80">{payout.user?.phoneNumber || "No phone"}</span>
                              <span>•</span>
                              <span>{new Date(payout.requestedAt).toLocaleDateString()}</span>
                            </div>
                            <div className="mt-2 p-3 bg-secondary/30 rounded-md text-sm">
                              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                <span className="text-muted-foreground">Payment Method:</span>
                                <Badge variant="outline" className="w-fit uppercase">
                                  {payout.paymentMethod || 'bank'}
                                </Badge>

                                {payout.paymentMethod === 'upi' ? (
                                  <>
                                    <span className="text-muted-foreground">UPI ID:</span>
                                    <span className="font-mono">{payout.upiVpa}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-muted-foreground">Bank Account:</span>
                                    <span className="font-mono">{payout.bankAccount}</span>
                                    <span className="text-muted-foreground">IFSC:</span>
                                    <span className="font-mono">{payout.ifscCode}</span>
                                  </>
                                )}

                                <span className="text-muted-foreground">Account Name:</span>
                                <span className="font-medium">{payout.accountName}</span>

                                <span className="text-muted-foreground font-semibold">User Details:</span>
                                <div className="flex flex-col">
                                  <span className="font-medium">{payout.user?.displayName}</span>
                                  <span className="text-xs text-muted-foreground">@{payout.user?.username}</span>
                                  <span className="text-xs text-muted-foreground">{payout.user?.email}</span>
                                  <span className="text-xs text-primary/80">{payout.user?.phoneNumber || "No registered phone"}</span>
                                  <span className="text-sm font-bold text-coral mt-1">
                                    Current Wallet Balance: ₹{(payout.user?.walletBalance || 0).toLocaleString('en-IN')}
                                  </span>
                                </div>

                                {payout.adminNote && (
                                  <>
                                    <span className="text-muted-foreground font-semibold">Contact Provided:</span>
                                    <span className="text-blue-500 font-bold bg-blue-500/5 p-1 rounded">{payout.adminNote}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 min-w-[140px] justify-center">
                            {payout.status === 'pending' && (
                              <>
                                <Button size="sm" onClick={() => handleUpdatePayoutStatus(payout.id, 'processing')}>
                                  Mark Processing
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleUpdatePayoutStatus(payout.id, 'cancelled')}>
                                  Cancel & Refund
                                </Button>
                              </>
                            )}
                            {payout.status === 'processing' && (
                              <>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleUpdatePayoutStatus(payout.id, 'completed')}>
                                  Mark Completed
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleUpdatePayoutStatus(payout.id, 'failed')}>
                                  Mark Failed
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
            {activeTab === "broadcast" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Bell className="h-5 w-5 text-primary" />
                      Broadcast &amp; Ads
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Send notifications or manage targeted chat ads</p>
                  </div>
                </div>

                {/* Sub-tabs */}
                <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
                  <button
                    onClick={() => setBroadcastSubTab("notifications")}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${broadcastSubTab === "notifications" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Notifications
                  </button>
                  <button
                    onClick={() => {
                      setBroadcastSubTab("ads");
                      if (ads.length === 0) {
                        setIsLoadingAds(true);
                        getAdminAds().then(setAds).finally(() => setIsLoadingAds(false));
                      }
                    }}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${broadcastSubTab === "ads" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Chat Ads
                  </button>
                </div>

                {/* ── Notifications sub-tab ── */}
                {broadcastSubTab === "notifications" && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Send Form */}
                    <Card className="lg:col-span-1 h-fit">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" /> New Broadcast</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <label className="text-sm font-medium mb-1 block">Type</label>
                          <div className="flex gap-2 flex-wrap">
                            {(["info", "warning", "success", "alert"] as const).map(t => (
                              <button
                                key={t}
                                onClick={() => setBroadcastType(t)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${broadcastType === t
                                  ? t === "info" ? "bg-blue-500/20 border-blue-500 text-blue-400"
                                    : t === "warning" ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                                      : t === "success" ? "bg-green-500/20 border-green-500 text-green-400"
                                        : "bg-red-500/20 border-red-500 text-red-400"
                                  : "border-border text-muted-foreground hover:border-primary/50"
                                  }`}
                              >
                                {t === "info" ? "🔵" : t === "warning" ? "🟡" : t === "success" ? "🟢" : "🔴"}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Theme Color</label>
                          <div className="flex gap-2 flex-wrap">
                            {[
                              { name: "Indigo", hex: "#4f46e5" },
                              { name: "Emerald", hex: "#10b981" },
                              { name: "Amber", hex: "#f59e0b" },
                              { name: "Rose", hex: "#f43f5e" },
                              { name: "Violet", hex: "#8b5cf6" },
                              { name: "Cyan", hex: "#06b6d4" },
                              { name: "Slate", hex: "#475569" },
                            ].map(c => (
                              <button
                                key={c.hex}
                                type="button"
                                onClick={() => setBroadcastColor(c.hex)}
                                className={`h-8 w-8 rounded-full border-2 transition-all hover:scale-110 ${broadcastColor === c.hex ? "border-white ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-transparent"}`}
                                style={{ backgroundColor: c.hex }}
                                title={c.name}
                              />
                            ))}
                            <div className="relative flex items-center gap-2 ml-2">
                              <Input
                                type="color"
                                value={broadcastColor}
                                onChange={(e) => setBroadcastColor(e.target.value)}
                                className="h-8 w-8 p-0 border-none bg-transparent cursor-pointer overflow-hidden rounded-full shadow-sm"
                              />
                              <span className="text-[10px] font-mono text-muted-foreground uppercase">{broadcastColor}</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">Title</label>
                          <Input
                            placeholder="e.g. System Maintenance"
                            value={broadcastTitle}
                            onChange={e => setBroadcastTitle(e.target.value)}
                            maxLength={100}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">Message</label>
                          <Textarea
                            placeholder="Write your message..."
                            value={broadcastMessage}
                            onChange={e => setBroadcastMessage(e.target.value)}
                            rows={4}
                            maxLength={500}
                          />
                          <p className="text-xs text-muted-foreground mt-1 text-right">{broadcastMessage.length}/500</p>
                        </div>
                        <Button
                          className="w-full"
                          disabled={!broadcastTitle.trim() || !broadcastMessage.trim() || isBroadcasting}
                          onClick={async () => {
                            setIsBroadcasting(true);
                            try {
                              await broadcastNotification({
                                title: broadcastTitle.trim(),
                                message: broadcastMessage.trim(),
                                type: broadcastType,
                                color: broadcastColor
                              });
                              toast({ title: "📢 Broadcast Sent!", description: `All users have been notified.` });
                              setBroadcastTitle("");
                              setBroadcastMessage("");
                              // Refresh history
                              const notifs = await getNotifications();
                              setSentNotifications(notifs);
                            } catch (err) {
                              toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to send", variant: "destructive" });
                            } finally {
                              setIsBroadcasting(false);
                            }
                          }}
                        >
                          {isBroadcasting ? "Sending..." : "📢 Send Broadcast"}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* History */}
                    <div className="lg:col-span-2">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                          <Activity className="h-4 w-4" /> Broadcast History
                        </h3>
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={async () => { const n = await getNotifications(); setSentNotifications(n); }}
                        >Refresh</button>
                      </div>
                      {sentNotifications.length === 0 ? (
                        <div className="text-center py-12 bg-card rounded-lg border border-border">
                          <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          No broadcasts sent yet
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {sentNotifications.map(n => (
                            <Card key={n.id} className="p-4 bg-card border-border">
                              <div className="flex items-start gap-3">
                                <span
                                  className="h-6 w-6 rounded-full shrink-0 mt-0.5 border border-white/20 shadow-sm"
                                  style={{ backgroundColor: n.color || (n.type === 'info' ? '#3b82f6' : n.type === 'warning' ? '#f59e0b' : n.type === 'success' ? '#10b981' : '#ef4444') }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start">
                                    <p className="font-semibold text-card-foreground">{n.title}</p>
                                    <span className="text-[10px] text-muted-foreground">
                                      {new Date(n.createdAt).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                                  <p className="text-[10px] text-muted-foreground mt-2 border-t border-border pt-2">
                                    Sent by Admin ID: {n.sentBy}
                                  </p>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )} {/* end notifications sub-tab */}

                {/* ── Chat Ads sub-tab ── */}
                {broadcastSubTab === "ads" && (
                  <div className="space-y-5">
                    {/* Stats Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Total Ads", value: ads.length },
                        { label: "Active", value: ads.filter(a => a.status === "active").length },
                        { label: "Total Impressions", value: ads.reduce((s, a) => s + (a.impressions || 0), 0) },
                        { label: "Total Clicks", value: ads.reduce((s, a) => s + (a.clickCount || 0), 0) },
                      ].map(s => (
                        <Card key={s.label} className="bg-card/50 border-border/50">
                          <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">{s.label}</p>
                            <p className="text-2xl font-bold">{s.value}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Header with Create button */}
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-muted-foreground">All Ads ({ads.length})</h3>
                      <Button size="sm" onClick={() => {
                        setEditingAd(null);
                        setAdForm({ title: "", description: "", ctaText: "More Details", externalUrl: "", type: "text", targetProfessions: [] });
                        setAdFile(null); setAdFilePreview(null);
                        setIsAdModalOpen(true);
                      }}>
                        <Plus className="h-4 w-4 mr-1.5" /> Create Ad
                      </Button>
                    </div>

                    {/* Ads Table */}
                    {isLoadingAds ? (
                      <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : ads.length === 0 ? (
                      <div className="text-center py-12 border border-border rounded-lg bg-card/30">
                        <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-20" />
                        <p className="text-muted-foreground text-sm">No ads yet. Create your first ad to get started.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {ads.map(ad => (
                          <Card key={ad.id} className="bg-card/50 border-border/50">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-4">
                                {(ad.imageUrl || ad.videoUrl) && (
                                  <div className="w-20 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                    {ad.imageUrl ? (
                                      <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center"><Film className="h-6 w-6 text-muted-foreground" /></div>
                                    )}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="font-semibold text-sm">{ad.title}</p>
                                      {ad.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ad.description}</p>}
                                      {ad.externalUrl && (
                                        <a href={ad.externalUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary flex items-center gap-1 mt-0.5 hover:underline">
                                          <ExternalLink className="h-3 w-3" />{ad.externalUrl}
                                        </a>
                                      )}
                                    </div>
                                    <div className="flex gap-1.5 flex-shrink-0">
                                      <Badge variant={ad.status === "active" ? "default" : "secondary"} className="text-[10px]">{ad.status}</Badge>
                                      <Badge variant="outline" className="text-[10px] capitalize">{ad.type}</Badge>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 mt-2">
                                    <span className="text-[11px] text-muted-foreground">👁 {ad.impressions} impressions</span>
                                    <span className="text-[11px] text-muted-foreground">🖱 {ad.clickCount || 0} clicks</span>
                                    <span className="text-[11px] text-muted-foreground">CTR: {ad.ctr || "0.0"}%</span>
                                    {(ad.targetProfessions?.length > 0) && (
                                      <span className="text-[11px] text-muted-foreground">🎯 {ad.targetProfessions.join(", ")}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
                                    onClick={async () => {
                                      try {
                                        const res = await pushAdNotification(ad.id);
                                        toast({
                                          title: "🚀 Ad Pushed!",
                                          description: `Notified ${res.notifiedCount} users targeted as ${ad.targetProfessions.length > 0 ? ad.targetProfessions.join(", ") : "All Users"}.`
                                        });
                                      } catch (err) {
                                        toast({ title: "Push Failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
                                      }
                                    }}
                                  >
                                    <RadioTower className="h-3.5 w-3.5 mr-1" />
                                    Push
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => {
                                    setEditingAd(ad);
                                    setAdForm({
                                      title: ad.title,
                                      description: ad.description || "",
                                      ctaText: ad.ctaText || "More Details",
                                      externalUrl: ad.externalUrl || "",
                                      type: ad.type,
                                      targetProfessions: ad.targetProfessions || []
                                    });
                                    setAdFile(null);
                                    setAdFilePreview(ad.imageUrl || ad.videoUrl || null);
                                    setIsAdModalOpen(true);
                                  }}>Edit</Button>
                                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-destructive hover:text-destructive" onClick={async () => {
                                    if (!confirm("Delete this ad?")) return;
                                    await deleteAd(ad.id);
                                    setAds(prev => prev.filter(a => a.id !== ad.id));
                                    toast({ title: "Ad deleted" });
                                  }}>Delete</Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {activeTab === "settings" && (
              <div className="space-y-6">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Platform Settings</h2>
                  <p className="text-muted-foreground text-sm flex items-center gap-2">
                    <Activity className="h-3 w-3" /> Manage global configurations and transaction fees
                  </p>
                </div>

                <div className="grid gap-6 max-w-2xl">
                  <Card className="bg-card/50 border-border/50 backdrop-blur-md shadow-xl overflow-hidden rounded-2xl border">
                    <CardHeader className="bg-secondary/20 border-b border-border/50 py-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-bold">Verification System</CardTitle>
                          <p className="text-xs text-muted-foreground">Configure verification badge costs</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="text-sm font-semibold text-foreground/80 block uppercase tracking-wider">Verification Fee (INR)</label>
                          <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <IndianRupee className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            </div>
                            <Input
                              type="number"
                              className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 rounded-xl transition-all"
                              value={systemSettings.verification_fee}
                              onChange={(e) => setSystemSettings(prev => ({ ...prev, verification_fee: e.target.value }))}
                              placeholder="e.g. 109"
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground italic">One-time fee for blue verification badge.</p>
                        </div>

                        <div className="space-y-3">
                          <label className="text-sm font-semibold text-foreground/80 block uppercase tracking-wider">Platform Fee (%)</label>
                          <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Percent className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            </div>
                            <Input
                              type="number"
                              step="0.1"
                              className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 rounded-xl transition-all"
                              value={parseFloat(systemSettings.platform_fee_percent || "0") * 100}
                              onChange={(e) => {
                                const inputVal = e.target.value;
                                if (inputVal === "") {
                                  setSystemSettings(prev => ({ ...prev, platform_fee_percent: "0" }));
                                  return;
                                }
                                const val = parseFloat(inputVal) / 100;
                                if (!isNaN(val)) {
                                  setSystemSettings(prev => ({ ...prev, platform_fee_percent: val.toString() }));
                                }
                              }}
                              placeholder="e.g. 10"
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground italic">Percentage deducted from vendor payouts.</p>
                        </div>
                      </div>

                      <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                        <div className="flex gap-2">
                          <span className="text-primary mt-0.5 font-bold">💡</span>
                          <p className="text-xs text-primary/80 leading-relaxed italic">
                            These settings control the global economy of the platform. Verification fee is fixed amount, while Platform fee is percentage-based.
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={handleSaveSettings}
                        className="w-full h-11 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all font-semibold"
                        disabled={isSavingSettings}
                      >
                        {isSavingSettings ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving Settings...
                          </>
                        ) : (
                          "Update Settings"
                        )
                        }
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === "staff" && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Staff Management</h2>
                    <p className="text-muted-foreground text-sm flex items-center gap-2">
                      <UserCheck className="h-3 w-3" /> Create and manage staff accounts with granular permissions
                    </p>
                  </div>
                  <Button onClick={() => { setIsStaffModalOpen(true); setEditingStaffId(null); }} className="shadow-lg shadow-primary/20">
                    <UserCheck className="mr-2 h-4 w-4" /> Create Staff Account
                  </Button>
                </div>

                <div className="grid gap-4">
                  {staffList.length === 0 ? (
                    <Card className="bg-card/50 border-border/50 p-12 text-center">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <h3 className="text-lg font-medium">No staff accounts found</h3>
                      <p className="text-muted-foreground">Start by creating your first staff member.</p>
                    </Card>
                  ) : (
                    staffList.map((staff) => (
                      <Card key={staff.id} className="bg-card/50 border-border/50 hover:border-primary/30 transition-all overflow-hidden">
                        <div className="flex flex-col md:flex-row items-center p-4 gap-4">
                          <Avatar className="h-12 w-12 border-2 border-primary/20">
                            <AvatarImage src={staff.avatarUrl} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold">
                              {staff.username ? staff.username.substring(0, 2).toUpperCase() : "??"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 text-center md:text-left min-w-0">
                            <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
                              <h3 className="font-bold text-lg leading-none">{staff.displayName || staff.username}</h3>
                              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-mono text-[10px] uppercase">
                                @{staff.username}
                              </Badge>
                              {staff.status !== 'active' && (
                                <Badge variant="destructive" className="text-[10px] h-5">{staff.status}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 truncate">{staff.email}</p>
                            <div className="flex flex-wrap gap-1 mt-2 justify-center md:justify-start">
                              {staff.permissions && staff.permissions.length > 0 ? (
                                staff.permissions.map(p => (
                                  <Badge key={p} variant="secondary" className="text-[9px] px-1.5 py-0 bg-secondary/30 text-secondary-foreground border-none">
                                    {adminPermissions.find(ap => ap.id === p)?.label || p}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">No permissions assigned</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingStaffId(staff.id);
                                setSelectedStaffPermissions(staff.permissions || []);
                                setIsStaffModalOpen(true);
                              }}
                              className="h-8 text-xs"
                            >
                              Manage Permissions
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => handleDeleteStaff(staff)}
                              className="h-8 w-8"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </div >

      <AdminUserDetailDialog
        userId={detailUserId}
        isOpen={!!detailUserId}
        onClose={() => setDetailUserId(null)}
      />

      {/* ── Create / Edit Ad Dialog ── */}
      <Dialog open={isAdModalOpen} onOpenChange={setIsAdModalOpen}>
        <DialogContent className="sm:max-w-[560px] bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          <div className="p-6 space-y-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                {editingAd ? "Edit Ad" : "Create New Ad"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Create a targeted ad that appears in user chats.
              </DialogDescription>
            </DialogHeader>

            {/* Professional Templates */}
            {!editingAd && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Templates</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "🚀 New Product Launch", title: "Exciting New Product!", description: "We've launched something amazing. Be the first to check it out!", cta: "Discover Now" },
                    { label: "🎯 Services Promo", title: "Professional Services", description: "Expert services tailored to your needs. Quality guaranteed.", cta: "Get Started" },
                    { label: "💼 We're Hiring", title: "Join Our Team!", description: "We're looking for talented professionals. Apply today.", cta: "View Openings" },
                    { label: "🎉 Special Event", title: "Don't Miss Out!", description: "An exclusive event you won't want to miss. Reserve your spot now.", cta: "Learn More" },
                  ].map(t => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setAdForm(prev => ({ ...prev, title: t.title, description: t.description, ctaText: t.cta }))}
                      className="text-left p-2.5 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 hover:border-primary/30 transition-all text-xs text-muted-foreground"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ad Type */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ad Type</p>
              <div className="flex gap-2">
                {(["text", "image", "video"] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAdForm(prev => ({ ...prev, type: t }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${adForm.type === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                  >
                    {t === "text" && <Bell className="h-3 w-3" />}
                    {t === "image" && <ImageIcon className="h-3 w-3" />}
                    {t === "video" && <Film className="h-3 w-3" />}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Title *</label>
              <Input placeholder="Ad headline" value={adForm.title} onChange={e => setAdForm(p => ({ ...p, title: e.target.value }))} />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Description</label>
              <Textarea placeholder="Short ad description..." rows={2} value={adForm.description} onChange={e => setAdForm(p => ({ ...p, description: e.target.value }))} />
            </div>

            {/* External Link */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">External Link (URL)</label>
              <div className="relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-9" placeholder="https://yourwebsite.com/landing-page" value={adForm.externalUrl} onChange={e => setAdForm(p => ({ ...p, externalUrl: e.target.value }))} />
              </div>
            </div>

            {/* CTA Text */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Button Text</label>
              <Input placeholder="More Details" value={adForm.ctaText} onChange={e => setAdForm(p => ({ ...p, ctaText: e.target.value }))} />
            </div>

            {/* Media Upload */}
            {(adForm.type === "image" || adForm.type === "video") && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  {adForm.type === "image" ? "Image / Poster" : "Video"}
                </label>
                <div
                  className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/40 transition-colors relative"
                  onClick={() => document.getElementById("ad-file-input")?.click()}
                >
                  {adFilePreview ? (
                    <div className="relative">
                      {adForm.type === "image" || (adFilePreview && !adFilePreview.includes(".mp4") && !adFilePreview.includes(".webm")) ? (
                        <img src={adFilePreview} alt="preview" className="max-h-36 mx-auto rounded-lg object-cover" />
                      ) : (
                        <video src={adFilePreview} className="max-h-36 mx-auto rounded-lg" muted />
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setAdFile(null); setAdFilePreview(null); }}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="py-4">
                      {adForm.type === "image" ? <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" /> : <Film className="h-8 w-8 mx-auto text-muted-foreground mb-2" />}
                      <p className="text-sm text-muted-foreground">Click to upload {adForm.type === "image" ? "an image" : "a video"}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Max 50MB</p>
                    </div>
                  )}
                  <input
                    id="ad-file-input"
                    type="file"
                    accept={adForm.type === "image" ? "image/*" : "video/*"}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setAdFile(file);
                      setAdFilePreview(URL.createObjectURL(file));
                    }}
                  />
                </div>
              </div>
            )}

            {/* Target Audience */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Target Audience</label>
              <p className="text-[11px] text-muted-foreground mb-2">Select professions to target (leave empty to show to everyone)</p>
              <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {[
                  "Software Developer", "UI/UX Designer", "Graphic Designer", "Web Developer",
                  "Data Scientist", "AI / ML Engineer", "Cybersecurity Analyst", "DevOps Engineer",
                  "Product Manager", "Digital Marketer", "Content Creator", "Video Editor",
                  "Photographer", "Videographer", "Artist / Illustrator", "Musician",
                  "Civil Engineer", "Mechanical Engineer", "Electrical Engineer", "Architect",
                  "Doctor", "Nurse", "Pharmacist", "Lawyer", "Chartered Accountant",
                  "Teacher / Educator", "Writer / Author", "Entrepreneur", "Consultant", "Other"
                ].map(prof => (
                  <label key={prof} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer py-1 px-2 rounded hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={adForm.targetProfessions.includes(prof)}
                      onCheckedChange={(checked) => {
                        setAdForm(p => ({
                          ...p,
                          targetProfessions: checked
                            ? [...p.targetProfessions, prof]
                            : p.targetProfessions.filter(x => x !== prof)
                        }));
                      }}
                    />
                    {prof}
                  </label>
                ))}
              </div>
              {adForm.targetProfessions.length > 0 && (
                <p className="text-[11px] text-primary mt-1">🎯 Targeting: {adForm.targetProfessions.join(", ")}</p>
              )}
            </div>
          </div>

          <DialogFooter className="bg-secondary/20 p-4 border-t border-border/50 flex sm:justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsAdModalOpen(false)}>Cancel</Button>
            <Button
              disabled={!adForm.title.trim() || isSavingAd}
              onClick={async () => {
                setIsSavingAd(true);
                try {
                  const fd = new FormData();
                  fd.append("title", adForm.title.trim());
                  if (adForm.description) fd.append("description", adForm.description.trim());
                  if (adForm.ctaText) fd.append("ctaText", adForm.ctaText.trim());
                  if (adForm.externalUrl) fd.append("externalUrl", adForm.externalUrl.trim());
                  fd.append("type", adForm.type);
                  fd.append("targetProfessions", JSON.stringify(adForm.targetProfessions));
                  if (adFile) fd.append("file", adFile);

                  if (editingAd) {
                    const updated = await updateAd(editingAd.id, fd);
                    setAds(prev => prev.map(a => a.id === editingAd.id ? { ...updated, clickCount: a.clickCount, ctr: a.ctr } : a));
                    toast({ title: "Ad updated!" });
                  } else {
                    const newAd = await createAd(fd);
                    setAds(prev => [{ ...newAd, clickCount: 0, ctr: "0.0" }, ...prev]);
                    toast({ title: "Ad created!" });
                  }
                  setIsAdModalOpen(false);
                } catch (err) {
                  toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
                } finally {
                  setIsSavingAd(false);
                }
              }}
            >
              {isSavingAd ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : editingAd ? "Save Changes" : "Create Ad"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStaffModalOpen} onOpenChange={setIsStaffModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-3xl p-0 overflow-hidden">
          <div className="p-6">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <UserCheck className="h-6 w-6 text-primary" />
                {editingStaffId ? "Manage Permissions" : "Create Staff Account"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingStaffId
                  ? "Update administrative access for this staff member."
                  : "Set up a new administrative account for your team."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {!editingStaffId && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Username</label>
                    <Input
                      placeholder="john_staff"
                      value={newStaffUsername}
                      onChange={e => setNewStaffUsername(e.target.value)}
                      className="bg-background/50 border-border/50 focus:border-primary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Display Name</label>
                    <Input
                      placeholder="John Doe"
                      value={newStaffDisplayName}
                      onChange={e => setNewStaffDisplayName(e.target.value)}
                      className="bg-background/50 border-border/50 focus:border-primary/50"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Email Address</label>
                    <Input
                      placeholder="staff@krovaa.com"
                      value={newStaffEmail}
                      onChange={e => setNewStaffEmail(e.target.value)}
                      className="bg-background/50 border-border/50 focus:border-primary/50"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Password</label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={newStaffPassword}
                      onChange={e => setNewStaffPassword(e.target.value)}
                      className="bg-background/50 border-border/50 focus:border-primary/50"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Assign Permissions</label>
                <div className="grid grid-cols-2 gap-3 bg-secondary/10 p-4 rounded-2xl border border-border/40">
                  {adminPermissions.map((permission) => (
                    <div key={permission.id} className="flex items-center space-x-2 group">
                      <Checkbox
                        id={`perm-${permission.id}`}
                        checked={selectedStaffPermissions.includes(permission.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedStaffPermissions([...selectedStaffPermissions, permission.id]);
                          } else {
                            setSelectedStaffPermissions(selectedStaffPermissions.filter(p => p !== permission.id));
                          }
                        }}
                        className="border-border/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <label
                        htmlFor={`perm-${permission.id}`}
                        className="text-sm font-medium leading-none cursor-pointer group-hover:text-primary transition-colors"
                      >
                        {permission.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-secondary/20 p-4 border-t border-border/50 flex sm:justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsStaffModalOpen(false)}>Cancel</Button>
            {editingStaffId ? (
              <Button onClick={() => {
                handleUpdateStaffPermissions(editingStaffId, selectedStaffPermissions);
                setIsStaffModalOpen(false);
              }}>
                Save Changes
              </Button>
            ) : (
              <Button onClick={handleCreateStaff}>
                Create Account
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[450px] bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-3xl p-0 overflow-hidden">
          <div className="p-6">
            <DialogHeader className="mb-6">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <Trash2 className="h-6 w-6 text-destructive" />
              </div>
              <DialogTitle className="text-2xl font-bold">Delete User Account</DialogTitle>
              <DialogDescription className="text-muted-foreground pt-2">
                This action is <b>irreversible</b>. It will permanently delete the account for <span className="text-foreground font-bold">{userToDelete?.displayName}</span> (@{userToDelete?.username}) and all associated data including messages, escrow deals, and wallet history.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-xl">
                <p className="text-xs text-destructive font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Warning: All financial history and active deals will be deleted.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
                  Type <span className="text-destructive">DELETE</span> to confirm
                </label>
                <Input
                  placeholder="Type DELETE here..."
                  value={deleteConfirmationInput}
                  onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                  className="bg-background/50 border-border/50 focus:border-destructive/50 h-11"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="bg-secondary/20 p-4 border-t border-border/50 flex sm:justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmationInput.toUpperCase() !== "DELETE"}
              onClick={confirmDeleteUser}
              className="px-6"
            >
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
};

export default AdminDashboard;
