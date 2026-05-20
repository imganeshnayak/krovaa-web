import { io, Socket } from "socket.io-client";
import { SOCKET_URL } from "./config";

class SocketService {
    private socket: Socket | null = null;

    connect(userId: number) {
        if (this.socket) return;

        this.socket = io(SOCKET_URL, {
            withCredentials: true,
            transports: ["websocket", "polling"],
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
        });

        this.socket.on("connect", () => {
            console.log("🟢 Connected to socket server");
            this.socket?.emit("join", { userId, chatId: `user_${userId}` });
        });

        this.socket.on("disconnect", (reason) => {
            // Only log if it's not an expected client-side disconnect
            if (reason !== "io client disconnect") {
                console.log("🔴 Disconnected from socket server:", reason);
            }
        });

        this.socket.on("reconnect", (attempt) => {
            console.log(`🟡 Reconnected after ${attempt} attempt(s)`);
            this.socket?.emit("join", { userId, chatId: `user_${userId}` });
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
