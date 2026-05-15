import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X, CheckCheck, Info, AlertTriangle, CheckCircle, AlertCircle, Trash2 } from "lucide-react";
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, Notification } from "@/lib/api";
import { toast } from "sonner";
import { io as socketIO } from "socket.io-client";
import { useAuth } from "@/contexts/AuthContext";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

const typeConfig = {
    info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "Info" },
    warning: { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", label: "Warning" },
    success: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", label: "Success" },
    alert: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", label: "Alert" },
};

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    // Load notifications on mount
    useEffect(() => {
        if (!token) return;
        getNotifications()
            .then(data => {
                // Filter out notifications sent by the current user (e.g. self-broadcasts)
                const filtered = data.filter(n => n.sentById !== user?.id);
                setNotifications(filtered);
            })
            .catch((err) => console.error("Failed to load notifications:", err));
    }, [token, user]);
    // Socket.IO: listen for real-time broadcasts
    useEffect(() => {
        if (!token || !user) return;

        const socket = socketIO(API_URL, { auth: { token } });

        socket.on("connect", () => {
            socket.emit("join", { userId: user.id, chatId: "global" });
        });

        socket.on("admin:notification", (notification: Notification) => {
            // Ignore if the sender is the current user
            if (notification.sentById === user.id) return;

            setNotifications(prev => [notification, ...prev]);

            // Show toast based on type
            const cfg = typeConfig[notification.type] || typeConfig.info;
            const toastFn = notification.type === "alert" ? toast.error
                : notification.type === "warning" ? toast.warning
                    : notification.type === "success" ? toast.success
                        : toast.info;

            toastFn(`📢 ${notification.title}`, {
                description: notification.message,
                duration: 6000,
            });
        });

        return () => { socket.disconnect(); };
    }, [token, user]);

    const handleMarkRead = async (id: number) => {
        try {
            await markNotificationRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (err) {
            console.error("Failed to mark notification as read:", err);
        }
    };

    const handleNotificationClick = async (n: Notification) => {
        if (!n.isRead) {
            await handleMarkRead(n.id);
        }

        // Handle redirection based on metadata
        if (n.metadata) {
            const meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata;

            if (meta.type === 'escrow') {
                navigate(`/escrow?id=${meta.dealId}${meta.chatId ? `&chatId=${meta.chatId}` : ''}`);
            } else if (meta.type === 'wallet') {
                navigate('/wallet');
            } else if (meta.type === 'chat' || meta.chatId) {
                navigate(`/chat?id=${meta.chatId}`);
            }
        }

        setOpen(false); // Close dialog
    };

    const handleMarkAllRead = async () => {
        try {
            await markAllNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (err) {
            console.error("Failed to mark all notifications as read:", err);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            // Optimistic update
            const originalList = [...notifications];
            setNotifications(prev => prev.filter(n => n.id !== id));

            try {
                await deleteNotification(id);
            } catch (err: any) {
                // Revert on error
                setNotifications(originalList);
                console.error("Failed to delete notification:", err);
                toast.error("Could not delete notification", {
                    description: "System notifications cannot be deleted."
                });
            }
        } catch (err) {
            console.error("Notification delete error:", err);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Notifications"
                >
                    <Bell className="w-5 h-5 text-white/80" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                    )}
                </button>
            </DialogTrigger>

            <DialogContent
                className="w-[calc(100vw-32px)] sm:w-[450px] p-0 gap-0 rounded-2xl border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300"
            >
                {/* Header */}
                <DialogHeader className="px-6 py-4 border-b border-white/10 text-left">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="bg-purple-500/20 p-2 rounded-lg">
                                <Bell className="w-4 h-4 text-purple-400" />
                            </div>
                            <DialogTitle className="text-lg font-bold text-white">Notifications</DialogTitle>
                            {unreadCount > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-black rounded-full px-2 py-0.5 shadow-lg shadow-red-500/20 animate-pulse">
                                    {unreadCount} NEW
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mr-6">
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    className="text-[10px] font-black uppercase tracking-wider text-purple-400 hover:text-purple-300 flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-purple-500/10 transition-all border border-purple-500/20"
                                >
                                    <CheckCheck className="w-3 h-3" />
                                    Mark All Read
                                </button>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                {/* List */}
                <div className="max-h-[60dvh] sm:max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-white/40">
                            <div className="bg-white/5 p-6 rounded-full mb-4">
                                <Bell className="w-12 h-12 opacity-20" />
                            </div>
                            <p className="text-sm font-medium">All caught up!</p>
                            <p className="text-xs opacity-50">No new notifications to show.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {notifications.map(n => {
                                const cfg = typeConfig[n.type] || typeConfig.info;
                                const Icon = cfg.icon;
                                return (
                                    <div
                                        key={n.id}
                                        className={`w-full text-left px-6 py-5 hover:bg-white/[0.03] transition-all flex gap-4 group relative ${!n.isRead ? "bg-white/[0.05]" : ""}`}
                                    >
                                        <button
                                            onClick={() => handleMarkRead(n.id)}
                                            className="flex-shrink-0"
                                        >
                                            <div className={`w-10 h-10 rounded-xl ${cfg.bg} ${cfg.border} border flex items-center justify-center shadow-inner`}>
                                                <Icon className={`w-5 h-5 ${cfg.color}`} />
                                            </div>
                                        </button>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleNotificationClick(n)}>
                                            <div className="flex items-start justify-between gap-3">
                                                <p className={`text-sm font-bold leading-tight ${n.isRead ? "text-white/60" : "text-white"}`}>
                                                    {n.title}
                                                </p>
                                                {!n.isRead && (
                                                    <span className="flex-shrink-0 w-2 h-2 bg-purple-400 rounded-full mt-1 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                                                )}
                                            </div>
                                            <p className={`text-xs mt-1 leading-relaxed line-clamp-2 ${n.isRead ? "text-white/40" : "text-white/70"}`}>
                                                {n.message}
                                            </p>
                                            <p className="text-[10px] font-mono font-medium text-white/20 mt-2 uppercase tracking-tight">
                                                {timeAgo(n.createdAt)}
                                            </p>
                                        </div>

                                        {/* Delete Action */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(n.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 rounded-xl text-white/20 hover:text-red-400 transition-all self-center ml-2"
                                            title="Delete notification"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                    <div className="px-6 py-3 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                            Syncing via Cloud
                        </p>
                        <p className="text-[10px] font-bold text-white/30">
                            {notifications.length} TOTAL
                        </p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
