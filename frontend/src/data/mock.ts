import { User, Chat, Message, EscrowDeal } from "./types";

export const currentUser: User = {
  id: "u1",
  name: "Alex Carter",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
  role: "client",
  bio: "Product designer looking for talented developers",
  phone: "+1 555-0101",
  email: "alex@Krovaa.com",
  online: true,
  lastSeen: "now",
};

export const users: User[] = [
  currentUser,
  {
    id: "u2",
    name: "Mira Patel",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mira",
    role: "vendor",
    bio: "Full-stack developer | React & Node.js",
    phone: "+91 98765-43210",
    email: "mira@dev.io",
    online: true,
    lastSeen: "now",
  },
  {
    id: "u3",
    name: "James Okonkwo",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=James",
    role: "vendor",
    bio: "UI/UX designer with 5 years experience",
    phone: "+234 801-234-5678",
    email: "james@design.io",
    online: false,
    lastSeen: "2 hours ago",
  },
  {
    id: "u4",
    name: "Sofia Reyes",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sofia",
    role: "client",
    bio: "Startup founder, building SaaS products",
    phone: "+34 612-345-678",
    email: "sofia@startup.io",
    online: false,
    lastSeen: "30 min ago",
  },
  {
    id: "u5",
    name: "Krovaa",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Krovaa",
    role: "admin",
    bio: "Platform administrator",
    phone: "+1 555-0000",
    email: "admin@krovaa.com",
    online: true,
    lastSeen: "now",
  },
];

export const messages: Message[] = [
  { id: "m1", chatId: "c1", senderId: "u2", text: "Hey Alex! I've finished the API integration. Want to review?", timestamp: "2026-02-14T09:15:00Z", read: true },
  { id: "m2", chatId: "c1", senderId: "u1", text: "That's great Mira! Let me check it out.", timestamp: "2026-02-14T09:17:00Z", read: true },
  { id: "m3", chatId: "c1", senderId: "u2", text: "I'll send you the documentation in a sec", timestamp: "2026-02-14T09:18:00Z", read: true },
  { id: "m4", chatId: "c1", senderId: "u2", mediaUrl: "/placeholder.svg", mediaType: "document", text: "API_docs.pdf", timestamp: "2026-02-14T09:19:00Z", read: false },
  { id: "m5", chatId: "c2", senderId: "u3", text: "Hi Alex, I've updated the mockups based on your feedback", timestamp: "2026-02-14T08:30:00Z", read: true },
  { id: "m6", chatId: "c2", senderId: "u1", text: "Looks amazing! Can you also add a dark mode variant?", timestamp: "2026-02-14T08:45:00Z", read: true },
  { id: "m7", chatId: "c2", senderId: "u3", text: "Sure, I'll have it ready by tomorrow 👍", timestamp: "2026-02-14T08:50:00Z", read: false },
  { id: "m8", chatId: "c3", senderId: "u4", text: "Hey, interested in collaborating on a new project?", timestamp: "2026-02-13T16:00:00Z", read: true },
  { id: "m9", chatId: "c3", senderId: "u1", text: "Definitely! What's the project about?", timestamp: "2026-02-13T16:30:00Z", read: true },
];

export const chats: Chat[] = [
  {
    id: "c1",
    participants: ["u1", "u2"],
    lastMessage: messages[3],
    unreadCount: 1,
  },
  {
    id: "c2",
    participants: ["u1", "u3"],
    lastMessage: messages[6],
    unreadCount: 1,
  },
  {
    id: "c3",
    participants: ["u1", "u4"],
    lastMessage: messages[8],
    unreadCount: 0,
  },
];

export const escrowDeals: EscrowDeal[] = [
  {
    id: "d1",
    chatId: "c1",
    clientId: "u1",
    vendorId: "u2",
    title: "E-commerce API Development",
    description: "Full REST API for product catalog, cart, and checkout",
    totalAmount: 5000,
    releasedPercent: 50,
    status: "active",
    transactions: [
      { id: "t1", dealId: "d1", percent: 25, amount: 1250, note: "Initial milestone - database schema", timestamp: "2026-02-01T10:00:00Z" },
      { id: "t2", dealId: "d1", percent: 25, amount: 1250, note: "API endpoints completed", timestamp: "2026-02-10T14:00:00Z" },
    ],
    createdAt: "2026-01-25T09:00:00Z",
  },
  {
    id: "d2",
    chatId: "c2",
    clientId: "u1",
    vendorId: "u3",
    title: "Mobile App UI Design",
    description: "Complete UI/UX design for iOS and Android app",
    totalAmount: 3000,
    releasedPercent: 33,
    status: "active",
    transactions: [
      { id: "t3", dealId: "d2", percent: 33, amount: 990, note: "Wireframes delivered", timestamp: "2026-02-05T11:00:00Z" },
    ],
    createdAt: "2026-01-28T12:00:00Z",
  },
];
