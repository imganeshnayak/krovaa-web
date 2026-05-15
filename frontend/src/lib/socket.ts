import { io, Socket } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

class SocketService {
    private socket: Socket | null = null;

    connect(userId: number) {
        if (this.socket) return;

        this.socket = io(API_URL, {
            withCredentials: true,
            transports: ["websocket", "polling"],
        });

        this.socket.on("connect", () => {
            console.log("🟢 Connected to socket server");
            this.socket?.emit("join", { userId, chatId: `user_${userId}` });
        });

        this.socket.on("disconnect", () => {
            console.log("🔴 Disconnected from socket server");
        });
    }

    joinChat(userId: number, chatId: string) {
        if (!this.socket) return;
        this.socket.emit("join", { userId, chatId });
    }

    onNewMessage(callback: (message: any) => void) {
        if (!this.socket) return;
        this.socket.on("newMessage", callback);
        return () => { this.socket?.off("newMessage", callback); };
    }

    onUserOnline(callback: (data: { userId: number; online: boolean }) => void) {
        if (!this.socket) return;
        this.socket.on("userOnline", callback);
        return () => { this.socket?.off("userOnline", callback); };
    }

    onMessagesRead(callback: (data: { chatId: string; readerId: number }) => void) {
        if (!this.socket) return;
        this.socket.on("messagesRead", callback);
        return () => { this.socket?.off("messagesRead", callback); };
    }

    onMessageDeleted(callback: (data: { messageId: number; chatId: string }) => void) {
        if (!this.socket) return;
        this.socket.on("messageDeleted", callback);
        return () => { this.socket?.off("messageDeleted", callback); };
    }

    onMessageOpened(callback: (message: any) => void) {
        if (!this.socket) return;
        this.socket.on("messageOpened", callback);
        return () => { this.socket?.off("messageOpened", callback); };
    }

    onScreenshotAttempt(callback: (data: { chatId: string; message: any }) => void) {
        if (!this.socket) return;
        this.socket.on("screenshotAttempt", callback);
        return () => { this.socket?.off("screenshotAttempt", callback); };
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    getSocket() {
        return this.socket;
    }
}

export const socketService = new SocketService();
