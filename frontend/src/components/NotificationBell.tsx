import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, Notification } from "@/lib/api";
import { toast } from "sonner";
import { io as socketIO } from "socket.io-client";
import { SOCKET_URL } from "@/lib/config";
import { useAuth } from "@/contexts/AuthContext";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

const typeConfig = {
    info: { icon: "Info" as const, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-100 dark:border-blue-900/50", label: "Info" },
    warning: { icon: "AlertTriangle" as const, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-100 dark:border-amber-900/50", label: "Warning" },
    success: { icon: "CircleCheck" as const, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-100 dark:border-emerald-900/50", label: "Success" },
    alert: { icon: "AlertCircle" as const, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-100 dark:border-rose-900/50", label: "Alert" },
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

    useEffect(() => {
        if (!token) return;
        getNotifications()
            .then(data => {
                const filtered = data.filter(n => n.sentById !== user?.id);
                setNotifications(filtered);
            })
            .catch((err) => console.error("Failed to load notifications:", err));
    }, [token, user]);

    useEffect(() => {
        if (!token || !user) return;

        const socket = socketIO(SOCKET_URL, { withCredentials: true });

        socket.on("connect", () => {
            socket.emit("join", { userId: user.id, chatId: "global" });
        });

        socket.on("admin:notification", (notification: Notification) => {
            if (notification.sentById === user.id) return;

            setNotifications(prev => [notification, ...prev]);

            const toastFn = notification.type === "alert" ? toast.error
                : notification.type === "warning" ? toast.warning
                    : notification.type === "success" ? toast.success
                        : toast.info;

            toastFn(`${notification.title}`, {
                description: notification.message,
                duration: 6000,
            });
        });

        return () => { socket.disconnect(); };
    }, [token, user]);

    const handleMarkRead = async (id: number, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
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

        if (n.metadata) {
            try {
                const meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata;

                if (meta?.redirect) navigate(meta.redirect);
                else if (meta?.type === 'job' || meta?.jobId) navigate(`/jobs/${meta.jobId}`);
                else if (meta?.type === 'escrow') navigate(`/escrow?id=${meta.dealId}${meta.chatId ? `&chatId=${meta.chatId}` : ''}`);
                else if (meta?.type === 'wallet') navigate('/wallet');
                else if (meta?.type === 'chat' || meta?.chatId) navigate(`/chat?id=${meta.chatId}`);
            } catch (err) {
                console.error('Failed to parse notification metadata:', err);
            }
        }
        setOpen(false);
    };

    const handleMarkAllRead = async () => {
        try {
            await markAllNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (err) {
            console.error("Failed to mark all notifications as read:", err);
        }
    };

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const originalList = [...notifications];
        setNotifications(prev => prev.filter(n => n.id !== id));

        try {
            await deleteNotification(id);
        } catch (err) {
            setNotifications(originalList);
            console.error("Failed to delete notification:", err);
            toast.error("Action restricted", {
                description: "System notifications cannot be removed."
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    className="relative p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors focus:outline-none"
                    aria-label="Open notifications overlay panel"
                >
                    <Icon name="Bell" className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-[#00A4EF] rounded-full ring-2 ring-white dark:ring-slate-950 animate-pulse" />
                    )}
                </button>
            </DialogTrigger>

            {/* ── MOBILE OPTIMIZED DRAWER CONTAINER ── */}
           {/* ── DESKTOP DROPDOWN & MOBILE BOTTOM-SHEET OVERLAY ── */}
<DialogContent
    className="w-[calc(100vw-32px)] sm:w-[420px] p-0 gap-0 rounded-2xl border border-slate-200/80 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[600px] animate-in fade-in zoom-in-95 duration-200 focus:outline-none"
>
                {/* Header Container */}
                <DialogHeader className="px-5 py-4 border-b border-slate-100 flex flex-row items-center justify-between text-left shrink-0 bg-white">
                    <div className="flex items-center gap-2.5">
                        <DialogTitle className="text-base font-bold text-slate-900">Notifications</DialogTitle>
                        {unreadCount > 0 && (
                            <span className="bg-[#00A4EF]/10 text-[#00A4EF] text-[10px] font-bold rounded-md px-1.5 py-0.5 tracking-wide">
                                {unreadCount} New
                            </span>
                        )}
                    </div>
                    <div>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs font-semibold text-[#00A4EF] hover:text-[#0082bd] transition-colors px-2 py-1 rounded-md hover:bg-slate-50 mr-6"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>
                </DialogHeader>

                {/* Main Scroller Notifications View */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-full">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <div className="bg-slate-50 p-4 rounded-2xl mb-3 border border-slate-100">
                                <Icon name="Bell" className="w-8 h-8 text-slate-300" />
                            </div>
                            <p className="text-sm font-semibold text-slate-800">All caught up!</p>
                            <p className="text-xs text-slate-400 mt-0.5">No new alerts to review right now.</p>
                        </div>
                    ) : (
                        notifications.map(n => {
                            const cfg = typeConfig[n.type] || typeConfig.info;
                            return (
                                <div
                                    key={n.id}
                                    onClick={() => handleNotificationClick(n)}
                                    className={`w-full text-left px-5 py-4 transition-all flex gap-3.5 group relative cursor-pointer active:bg-slate-50/80 sm:hover:bg-slate-50/60 ${
                                        !n.isRead ? "bg-slate-50/40 font-medium" : ""
                                    }`}
                                >
                                    {/* Action Status Mark Element indicator bar */}
                                    {!n.isRead && (
                                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#00A4EF]" />
                                    )}

                                    {/* Icon Column Module */}
                                    <div className="flex-shrink-0 mt-0.5">
                                        <div className={`w-9 h-9 rounded-xl ${cfg.bg} ${cfg.border} border flex items-center justify-center shadow-sm`}>
                                            <Icon name={cfg.icon} className={`w-4 h-4 ${cfg.color}`} />
                                        </div>
                                    </div>

                                    {/* Core Text Info Payload Columns */}
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <p className={`text-sm tracking-tight leading-snug break-words pr-2 ${
                                                n.isRead ? "text-slate-500 font-normal" : "text-slate-900 font-semibold"
                                            }`}>
                                                {n.title}
                                            </p>
                                        </div>
                                        <p className={`text-xs mt-1 leading-relaxed break-words ${
                                            n.isRead ? "text-slate-400" : "text-slate-600"
                                        }`}>
                                            {n.message}
                                        </p>
                                        <span className="inline-block text-[10px] font-medium text-slate-400 mt-2 tracking-wide">
                                            {timeAgo(n.createdAt)}
                                        </span>
                                    </div>

                                    {/* Individual Floating Row Action Utilities */}
                                    <div className="flex flex-col gap-1 items-center justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity self-center shrink-0">
                                        {!n.isRead && (
                                            <button
                                                onClick={(e) => handleMarkRead(n.id, e)}
                                                className="p-1.5 hover:bg-slate-200/60 rounded-md text-slate-400 hover:text-slate-700 transition-colors"
                                                title="Mark as read"
                                            >
                                                <Icon name="CircleCheck" className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => handleDelete(n.id, e)}
                                            className="p-1.5 hover:bg-rose-50 rounded-md text-slate-400 hover:text-rose-600 transition-colors"
                                            title="Delete alert"
                                        >
                                            <Icon name="X" className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Matrix Row */}
                {notifications.length > 0 && (
                    <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between shrink-0 text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
                        <span>Realtime Synced</span>
                        <span>{notifications.length} notifications</span>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}