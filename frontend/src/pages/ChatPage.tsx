import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { themeColors } from "@/lib/themeColors";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Search, Send, Paperclip, Smile, ArrowLeft, Image, FileText,
  Mic, MoreVertical, IndianRupee, User as UserIcon, Plus,
  Trash2, Ban, AlertTriangle, Download, X, CheckCircle2, Loader2, LogOut, Settings, User, HelpCircle, ShieldCheck, EyeOff, Eye, Lock, Shield, Camera, Film, Square,
  Sparkles, History
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useScreenshotProtection } from "@/hooks/useScreenshotProtection";
import { useMobileScreenshotProtection } from "@/hooks/useMobileScreenshotProtection";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  getChatList, getMessages, sendMessage, markMessagesAsRead, uploadFile,
  searchUsers, blockUser, reportUser, clearChatHistory, getUser,
  deleteMessage, deleteMessagesBatch, getSupportChat, openViewOnceMessage,
  getBestProfiles, getGroupChats, getGroupMessages, sendGroupMessage,
  listCommunities, getCommunity, getCommunityMessages, sendCommunityMessage,
  Chat as ChatType, Message as MessageType, AuthUser
} from "@/lib/api";
import { useIsMobile } from "@/hooks/use-mobile";
import { socketService } from "@/lib/socket";
import { getCloudinaryDownloadUrl, downloadFile } from "@/lib/cloudinary";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { detectDevice, applyPlatformSpecificProtections } from "@/lib/mobileProtectionService";
import { createScreenshotNotification } from "@/lib/screenshotNotification";
import { notifyScreenshotAttempt } from "@/lib/api";
import FilePreviewDialog from "@/components/chat/FilePreviewDialog";
import NotificationBell from "@/components/NotificationBell";
import AdBanner from "@/components/chat/AdBanner";
import { getActiveAd, Ad } from "@/lib/api";
import { ProfileCompletionModal } from "@/components/profile/ProfileCompletionModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LocalMessage = MessageType & { message_type?: string; isUploading?: boolean; sender?: { role?: string; avatarUrl?: string; displayName?: string } };

type CommunityDetailView = {
  id: number;
  name: string;
  creatorId: number;
  creator?: AuthUser;
  members?: Array<{
    id: number;
    userId: number;
    role: string;
    user?: AuthUser;
  }>;
};

// Communities modal used by the chat page
const CommunitiesModal = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const [loading, setLoading] = useState(false);
  const [communities, setCommunities] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await listCommunities();
      setCommunities(data || []);
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to load communities', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) return toast({ title: 'Name required' });
    try {
      const c = await createCommunity({ name: name.trim(), description });
      toast({ title: 'Created', description: `Community ${c.name} created.` });
      setName(''); setDescription('');
      load();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to create', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Communities</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Create community</h4>
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="mb-2" />
            <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="mb-2" />
            <div className="flex justify-end"><Button onClick={handleCreate}>Create</Button></div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Your communities</h4>
            {loading ? <div>Loading...</div> : (
              <div className="grid gap-2">
                {communities.length === 0 ? <div className="text-sm text-muted-foreground">No communities yet</div> : communities.map(c => (
                  <div key={c.id} className="p-3 border rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.description}</div>
                    </div>
                    <div>
                      <Link to={`/communities/${c.id}`} className="text-sm text-blue-500">Open</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function formatTime(ts: string) {
  if (!ts) return "";
  try {
    const date = new Date(ts);
    if (isNaN(date.getTime())) return "";
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes < 10 ? '0' + minutes : minutes} ${ampm}`;
  } catch (e) {
    return "";
  }
}

function formatRecordingDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

const EMOJIS = ["😀", "😂", "🥰", "😍", "😊", "😎", "🤔", "😅", "🔥", "👍", "❤️", "🙌", "✨", "🎉", "💯", "🙏"];

const EmojiPicker = ({ onSelect }: { onSelect: (emoji: string) => void }) => (
  <PopoverContent className="w-64 p-2 bg-card border-border shadow-xl">
    <div className="grid grid-cols-4 gap-1">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="h-10 text-xl hover:bg-secondary rounded-lg transition-colors flex items-center justify-center"
        >
          {emoji}
        </button>
      ))}
    </div>
  </PopoverContent>
);

// Conversation list component moved outside to prevent remounting on state changes
// Conversation list component moved outside to prevent remounting on state changes
const ConversationList = ({
  searchQuery,
  setSearchQuery,
  isSearching,
  searchResults,
  startChat,
  isLoading,
  filteredChats,
  selectedChat,
  setSelectedChat,
  user,
  onLogout,
  onSupport,
  isMobile
}: {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  isSearching: boolean;
  searchResults: AuthUser[];
  startChat: (user: AuthUser) => void;
  isLoading: boolean;
  filteredChats: ChatType[];
  selectedChat: ChatType | null;
  setSelectedChat: (chat: ChatType | null) => void;
  user: AuthUser | null;
  onLogout: () => void;
  onSupport: () => void;
  isMobile: boolean;
}) => {
  const navigate = useNavigate();
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(() => localStorage.getItem("show_welcome_banner") === "true");

  useEffect(() => {
    if (showWelcomeBanner && isMobile && !searchQuery.trim() && filteredChats.length <= 1) {
      const timer = setTimeout(() => {
        setShowWelcomeBanner(false);
        localStorage.removeItem("show_welcome_banner");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showWelcomeBanner, isMobile, searchQuery, filteredChats.length]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-white overflow-hidden font-dm-sans">

      {/* Header */}
      <div className="p-4 border-b border-[#E0E0E0] sticky top-0 z-10 bg-white/80 backdrop-blur-xl">

        <div className="flex items-center justify-between">
          {!isSearchVisible ? (
            <div className="flex flex-col">
              <h1 style={{ fontFamily: "'Inter', sans-serif" }} className="text-xl font-bold text-[#1C1C1C] tracking-tight leading-none">Chats</h1>
              <span className="text-[10px] text-[#1C1C1C60] font-medium tracking-wide mt-1 uppercase">Messages</span>
            </div>
          ) : (

            <div className="flex-1 relative mr-2 animate-in fade-in slide-in-from-right-4 duration-200">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                className="h-9 pl-9 pr-9 bg-secondary/80 border-none text-sm placeholder:text-muted-foreground/50 w-full rounded-full focus-visible:ring-1 focus-visible:ring-primary/20"
                placeholder="Search username or chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setIsSearchVisible(false)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {user && (
              <>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={`h-9 w-9 rounded-full transition-all duration-200 ${isSearchVisible ? 'bg-secondary text-primary' : 'hover:bg-secondary text-muted-foreground hover:text-foreground'}`}
              onClick={() => {
                setIsSearchVisible(!isSearchVisible);
                if (isSearchVisible) setSearchQuery("");
              }}
              title={isSearchVisible ? "Close search" : "Search"}
            >
              {isSearchVisible ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </Button>

            {!isSearchVisible && (
              <>
                <NotificationBell />
                {user && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 p-0 overflow-hidden border border-white/5 hover:border-blue-500/30 hover:bg-white/5 transition-all">

                        <Avatar className="h-full w-full">
                          <AvatarImage src={user.avatarUrl} />
                          <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{user.displayName[0]}</AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-card border-border shadow-xl rounded-xl p-1.5">
                      <div className="flex items-center gap-3 p-3 border-b border-border/50 mb-1.5 bg-secondary/30 rounded-lg">
                        <Avatar className="h-10 w-10 border border-primary/10 shadow-sm">
                          <AvatarImage src={user.avatarUrl} />
                          <AvatarFallback className="bg-primary/5 text-primary font-bold">{user.displayName[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate leading-none mb-1">{user.displayName}</p>
                          <p className="text-[11px] text-muted-foreground truncate leading-none">@{user.username}</p>
                        </div>
                      </div>
                      <DropdownMenuItem onClick={() => window.location.href = '/profile'} className="rounded-md cursor-pointer">
                        <User className="mr-2 h-4 w-4 opacity-70" /> Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.location.href = '/wallet'} className="rounded-md cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mr-2 h-4 w-4 opacity-70">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                        </svg>
                        Wallet
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.location.href = '/settings'} className="rounded-md cursor-pointer">
                        <Settings className="mr-2 h-4 w-4 opacity-70" /> Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border/50" />
                      <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10 rounded-md cursor-pointer">
                        <LogOut className="mr-2 h-4 w-4" /> Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Welcome Banner for Mobile (New Users) */}
      {isMobile && !searchQuery.trim() && filteredChats.length <= 1 && showWelcomeBanner && (
        <div className="mx-4 mt-2 mb-4 p-5 rounded-2xl bg-gradient-to-br from-[#00A4EF]/10 to-[#007BB5]/5 border border-[#00A4EF]/20 relative overflow-hidden group shadow-lg shadow-[#00A4EF]/10 animate-in slide-in-from-top-4 duration-500">
          <div className="absolute top-0 right-0 p-3 opacity-[0.05] group-hover:scale-110 transition-transform duration-500">
            <Shield className="w-14 h-14 text-[#00A4EF]" />
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("show_welcome_banner");
              setShowWelcomeBanner(false);
            }}
            className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-black/5 text-[#1C1C1C40] hover:text-[#1C1C1C] transition-colors z-20"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative z-10">
            <h2 style={{ fontFamily: "'Inter', sans-serif" }} className="text-xl font-extrabold text-[#1C1C1C] tracking-tight mb-1.5 flex items-center gap-2">

              <span className="w-1.5 h-1.5 rounded-full bg-[#00A4EF] animate-pulse" />
              Welcome to Krovaa
            </h2>
            <p className="text-[11px] text-[#1C1C1C60] leading-relaxed max-w-[85%] font-light">
              Your secure end-to-end encrypted workspace is active. Search for users or contact support to start chatting.
            </p>
          </div>
          {/* Decorative line */}
          <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-[#00A4EF]/40 via-[#00A4EF]/10 to-transparent w-full" />
        </div>
      )}

      {/* Chat list */}
      <ScrollArea className="flex-1">
        {/* Show search results if searching for users */}
        {searchQuery.trim().length > 0 && (
          <>
            <div className="p-4 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-2">USERS</p>
              {isSearching ? (
                <div className="text-center text-muted-foreground py-4">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 flex flex-col items-center gap-2">
                  <span>No users found</span>
                  <a href="mailto:support@krovaa.com" className="text-xs text-blue-500 hover:underline">Need help? Contact support@krovaa.com</a>
                </div>
              ) : (
                searchResults.map((foundUser) => (
                  <button
                    key={foundUser.id}
                    onClick={() => startChat(foundUser)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-secondary/60 transition-colors rounded-lg mb-2"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={foundUser.avatarUrl} />
                      <AvatarFallback>{foundUser.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-medium text-foreground truncate">{foundUser.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">@{foundUser.username}</p>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
            <div className="p-4 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground">CONVERSATIONS</p>
            </div>
          </>
        )}

        {/* Show chats */}
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Loading chats...</div>
        ) : filteredChats.length === 0 && searchQuery.trim().length === 0 ? (
          <div className="text-center text-muted-foreground py-8 px-4 flex flex-col items-center gap-4">
            <div>
              <p>No conversations yet</p>
              <p className="text-xs mt-2">Search for a user to start chatting</p>
            </div>


        </div>
        ) : (
          filteredChats.map((chat) => (
            <button
              key={chat.chat_id}
              onClick={() => {
                if (chat.isKrovAI) {
                  navigate('/image-generator');
                } else {
                  setSelectedChat(chat);
                }
              }}
              className={`w-full grid grid-cols-[48px_1fr_auto] items-center gap-3 p-4 hover:bg-secondary/60 transition-colors border-b border-border text-left overflow-hidden ${selectedChat?.chat_id === chat.chat_id ? "bg-secondary" : ""} ${chat.isKrovAI ? 'bg-gradient-to-r from-[#FDF4FF]/80 to-[#FDF4FF]/40' : ''}`}
            >
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarImage src={chat.avatar_url} />
                <AvatarFallback className="bg-muted text-muted-foreground">
                  {chat.display_name[0]}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="font-semibold text-foreground text-[14px] truncate leading-tight">{chat.display_name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {chat.isKrovAI ? (
                      <Badge variant="secondary" className="bg-gradient-to-r from-[#D946EF]/10 to-[#F97316]/10 text-[#D946EF] text-[9px] h-3.5 px-1 border-none flex items-center gap-0.5">
                        <Sparkles className="h-2.5 w-2.5" />
                        AI
                      </Badge>
                    ) : chat.isOfficial ? (
                      <Badge variant="secondary" className="bg-primary/10 text-primary text-[9px] h-3.5 px-1 border-none flex items-center gap-0.5">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        OFFICIAL
                      </Badge>
                    ) : chat.chat_id.startsWith('support_') ? (
                      <Badge variant="secondary" className="bg-indigo-100/80 text-indigo-700 text-[9px] h-3.5 px-1 border-none flex items-center gap-0.5 dark:bg-indigo-900/30 dark:text-indigo-400">
                        <HelpCircle className="h-2.5 w-2.5" />
                        SUPPORT
                      </Badge>
                    ) : chat.verified && (
                      <img src="/verified-badge.svg" alt="Verified" className="h-4 w-4" />
                    )}
                  </div>
                </div>
                <p className="text-[12px] text-muted-foreground truncate leading-tight w-full hover:overflow-visible">
                  {chat.last_message}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2 self-start pt-0.5 shrink-0 min-w-[50px]">
                <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap opacity-80">
                  {chat.last_message_time ? formatTime(chat.last_message_time) : ""}
                </span>
                {chat.unread_count > 0 && (
                  <div className="bg-primary text-primary-foreground h-4 min-w-[16px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full">
                    {chat.unread_count}
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </ScrollArea>

      {/* Floating Communities button (navigates to Communities page) */}
      <button
        onClick={() => navigate('/communities')}
        title="Communities"
        className="fixed right-4 bottom-32 z-40 bg-white border border-border rounded-full p-3 shadow-lg hover:scale-105 transition-transform"
      >
      </button>
    </div>
  );
};

// Chat view component moved outside to prevent remounting
const ChatView = ({
  selectedChat,
  setSelectedChat,
  isMobile,
  navigate,
  user,
  messages,
  error,
  newMessage,
  setNewMessage,
  handleSend,
  messageInputRef,
  fileInputRef,
  handleFileSelect,
  onMessageDeleted,
  selectedMessages,
  setSelectedMessages,
  onDeleteMessagesBatch,
  pendingFile,
  setPendingFile,
  handleConfirmUpload,
  isLoading,
  isRecordingVoice,
  recordingSeconds,
  startVoiceRecording,
  stopVoiceRecording,
  isBlurred,
  setIsBlurred,
  isPreviewViewOnce,
  setIsPreviewViewOnce,
  currentAcceptType,
  setCurrentAcceptType,
  botState,
  setBotState,
  botData,
  setBotData,
  setMessages,
  selectedCommunity,
}: {
  selectedChat: ChatType | null;
  selectedCommunity: CommunityDetailView | null;
  setSelectedChat: (chat: ChatType | null) => void;
  isMobile: boolean;
  navigate: ReturnType<typeof useNavigate>;
  user: AuthUser | null;
  messages: MessageType[];
  error: string;
  newMessage: string;
  setNewMessage: (val: string) => void;
  handleSend: () => void;
  messageInputRef: React.RefObject<HTMLInputElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMessageDeleted: (messageId: number, type?: 'me' | 'everyone') => void;
  selectedMessages: number[];
  setSelectedMessages: (ids: number[]) => void;
  onDeleteMessagesBatch: (ids: number[], type?: 'me' | 'everyone') => void;
  pendingFile: File | null;
  setPendingFile: (file: File | null) => void;
  handleConfirmUpload: (caption: string, viewOnce: boolean) => void;
  botState: 'IDLE' | 'AWAITING_PROFESSION' | 'AWAITING_CITY' | 'AWAITING_PINCODE' | 'SEARCHING';
  setBotState: (state: 'IDLE' | 'AWAITING_PROFESSION' | 'AWAITING_CITY' | 'AWAITING_PINCODE' | 'SEARCHING') => void;
  botData: { city?: string; pincode?: string; profession?: string };
  setBotData: (data: { city?: string; pincode?: string; profession?: string } | ((prev: { city?: string; pincode?: string; profession?: string }) => { city?: string; pincode?: string; profession?: string })) => void;
  setMessages: React.Dispatch<React.SetStateAction<MessageType[]>>;
  isLoading: boolean;
  isRecordingVoice: boolean;
  recordingSeconds: number;
  startVoiceRecording: () => void;
  stopVoiceRecording: () => void;
  isBlurred: boolean;
  setIsBlurred: (val: boolean) => void;
  isPreviewViewOnce: boolean;
  setIsPreviewViewOnce: (val: boolean) => void;
  currentAcceptType: string;
  setCurrentAcceptType: (val: string) => void;
}) => {
  const [isHoldingView, setIsHoldingView] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewSenderUsername, setPreviewSenderUsername] = useState<string | null>(null);
  const inputBarRef = useRef<HTMLDivElement | null>(null);
  const [inputBarHeight, setInputBarHeight] = useState(0);
  const [activeMessageMenu, setActiveMessageMenu] = useState<MessageType | null>(null);
  const [chatAd, setChatAd] = useState<Ad | null>(null);
  const [adDismissed, setAdDismissed] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const isSelectionMode = selectedMessages.length > 0;

  const toggleMessageSelection = (messageId: number) => {
    if (selectedMessages.includes(messageId)) {
      setSelectedMessages(selectedMessages.filter(id => id !== messageId));
    } else {
      setSelectedMessages([...selectedMessages, messageId]);
    }
  };

  const handleMessageClick = (msg: MessageType) => {
    if (isSelectionMode) {
      toggleMessageSelection(msg.id);
    }
  };

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const onTouchStart = (msg: MessageType) => {
    if (!isMobile || isSelectionMode) return;
    // Clear any existing timer just in case
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      // Logic for Instagram-like long press: show action menu
      setActiveMessageMenu(msg);
      longPressTimerRef.current = null;
    }, 500);
  };

  const onTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const scrollingRef = useRef(false);
  const prevChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (messages.length > 0 && selectedChat) {
      if (prevChatIdRef.current !== selectedChat.chat_id) {
        scrollingRef.current = false;
        prevChatIdRef.current = selectedChat.chat_id;
      }
      // Use auto for chat switch, smooth for new messages
      const behavior = scrollingRef.current ? "smooth" : "auto";
      messagesEndRef.current?.scrollIntoView({ behavior });
      scrollingRef.current = true;
    } else {
      scrollingRef.current = false;
      if (!selectedChat) prevChatIdRef.current = null;
    }
  }, [messages.length, selectedChat?.chat_id]);

  // Load targeted ad when chat opens (once per chat session)
  useEffect(() => {
    if (!selectedChat || selectedChat.isOfficial) return; // Don't show ads in support chat
    const sessionKey = `ad_dismissed_${selectedChat.chat_id}`;
    if (sessionStorage.getItem(sessionKey)) { setAdDismissed(true); return; }
    setAdDismissed(false);
    setChatAd(null);
    getActiveAd().then(ad => { if (ad) setChatAd(ad); }).catch(() => { });
  }, [selectedChat?.chat_id]);

  // Measure input bar height on mount/resize to avoid overlap / large gaps on mobile
  useEffect(() => {
    const measure = () => {
      const h = inputBarRef.current ? inputBarRef.current.getBoundingClientRect().height : 0;
      setInputBarHeight(h || 0);
      // after resizing, keep view attached to bottom
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const handleOpenViewOnce = async (msg: MessageType) => {
    if (msg.senderId === user?.id) return; // Don't handle opening for sender (local only)
    try {
      await openViewOnceMessage(msg.id);
    } catch (err) {
      console.error("Failed to open view-once message:", err);
    }
  };
  if (!selectedChat) {
    return (
      <div className={`flex flex-col h-full min-h-0 items-center ${isMobile ? 'justify-start pt-20' : 'justify-center'} bg-white relative overflow-hidden`}>
        {/* Decorative background for empty state */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00A4EF]/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="text-center relative z-10 p-8">
          <div className="bg-[#00A4EF]/10 h-24 w-24 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-[#00A4EF]/20 shadow-2xl shadow-[#00A4EF]/10 -rotate-6 animate-float">
            <Send className="h-10 w-10 text-[#00A4EF] opacity-80" />
          </div>
          <h2 style={{ fontFamily: "'Inter', sans-serif" }} className="text-3xl font-bold text-[#1C1C1C] mb-4 tracking-tight">Welcome to Krovaa</h2>
          <p className="max-w-[280px] mx-auto text-sm text-[#1C1C1C60] leading-relaxed font-light">
            Select a conversation from the list to start chatting. <br />
            Your privacy is our priority.
          </p>
        </div>
      </div>
    );

  }

  return (
    <div className={`flex flex-col h-full min-h-0 bg-white relative overflow-hidden ${isBlurred ? 'blur-privacy' : ''}`} data-nocontext>
      {/* Privacy Screen Overlay - Only show when blurred and selected chat exists */}
      {isBlurred && selectedChat && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xl animate-in fade-in duration-200 pointer-events-auto">
          <div className="text-center p-6 scale-in-95 animate-in duration-300">
            <div className="bg-destructive/10 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 border 2px border-destructive/30 shadow-lg">
              <Shield className="h-10 w-10 text-destructive animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3 tracking-tight">Screenshot Detected</h2>
            <p className="text-sm text-muted-foreground mb-2">Unauthorized screen capture attempt blocked.</p>
            <p className="text-xs text-muted-foreground opacity-70 mb-6">Your chat privacy is protected.</p>

            <Button
              variant="outline"
              className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-xl px-6"
              onClick={() => setIsBlurred(false)}
            >
              Click to Restore View
            </Button>
          </div>
        </div>
      )}

      {/* Chat header */}
      <div className={`flex items-center gap-3 p-4 border-b border-white/5 z-20 min-h-[73px] flex-shrink-0 ${selectedChat?.isKrovAI ? 'bg-gradient-to-r from-[#FDF4FF]/90 to-[#FDF4FF]/60 backdrop-blur-xl' : 'bg-background/40 backdrop-blur-xl'}`}>

        {isSelectionMode ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedMessages([])}
                className="p-1 hover:bg-secondary rounded-full transition-colors"
              >
                <X className="h-6 w-6 text-foreground" />
              </button>
              <h3 className="font-semibold text-lg">{selectedMessages.length}</h3>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-background border-border">
                  <DropdownMenuItem
                    onClick={() => onDeleteMessagesBatch(selectedMessages, 'me')}
                    className="cursor-pointer gap-2"
                  >
                    <EyeOff className="h-4 w-4" />
                    <span>Delete for Me</span>
                  </DropdownMenuItem>
                  {(user?.role === 'admin' || user?.role === 'staff' || selectedMessages.every(id => messages.find(m => m.id === id)?.senderId === user?.id)) && (
                    <DropdownMenuItem
                      onClick={() => onDeleteMessagesBatch(selectedMessages, 'everyone')}
                      className="text-destructive focus:text-destructive cursor-pointer gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete for Everyone</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : (
          <>
            {isMobile && (
              <button onClick={() => setSelectedChat(null)}>
                <ArrowLeft className="h-5 w-5 text-foreground" />
              </button>
            )}
            {selectedChat.chat_id.startsWith("community_") && selectedCommunity ? (
              <button
                type="button"
                onClick={() => {
                  navigate(`/communities/${selectedCommunity.id}`);
                }}
                className="shrink-0 rounded-full ring-2 ring-[#00A4EF]/10 hover:ring-[#00A4EF]/30 transition-all"
                title={`View ${selectedCommunity.name} Info`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedCommunity.creator?.avatarUrl} />
                  <AvatarFallback>{selectedCommunity.name?.[0]?.toUpperCase() || selectedChat.display_name[0]}</AvatarFallback>
                </Avatar>
              </button>
            ) : (
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedChat.avatar_url} />
                <AvatarFallback>{selectedChat.display_name[0]}</AvatarFallback>
              </Avatar>
            )}

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <h3 style={{ fontFamily: "'Syne', sans-serif" }} className="font-bold text-foreground tracking-tight truncate">{selectedChat.display_name}</h3>

                {selectedChat.isKrovAI ? (
                  <Badge variant="secondary" className="bg-gradient-to-r from-[#D946EF]/10 to-[#F97316]/10 text-[#D946EF] text-[10px] px-1.5 border-none flex items-center gap-0.5">
                    <Sparkles className="h-3 w-3" />
                    AI
                  </Badge>
                ) : selectedChat.isOfficial ? (
                  <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] px-1.5 border-none flex items-center gap-0.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    OFFICIAL
                  </Badge>
                ) : selectedChat.verified && (
                  <img src="/verified-badge.svg" alt="Verified" className="h-7 w-7 flex-shrink-0" title="Verified Account" />
                )}
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                {selectedChat.isOfficial ? "Official Support Channel" : `@${selectedChat.username}`}
              </p>
            </div>
            {selectedChat.isKrovAI ? (
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => navigate('/image-generator')}
                  className="p-2 hover:bg-[#D946EF]/10 rounded-lg transition-colors text-[#1C1C1C]/40 hover:text-[#D946EF]"
                >
                  <History className="h-5 w-5" />
                </button>
              </div>
            ) : selectedChat.chat_id.startsWith("community_") ? (
              <div className="flex gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" title="View Members">
                      <UserIcon className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="end">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">Members</h4>
                      <div className="flex flex-wrap gap-3">
                        {(selectedCommunity?.members || []).map((member) => (
                          <button
                            key={member.id}
                            onClick={() => navigate(`/${member.user?.username}`)}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-secondary/60 transition-colors"
                            title={member.user?.displayName || member.user?.username}
                          >
                            <Avatar className="h-12 w-12 ring-2 ring-border/40">
                              <AvatarImage src={member.user?.avatarUrl} />
                              <AvatarFallback className="text-xs font-bold bg-slate-100 text-slate-600">
                                {(member.user?.displayName || member.user?.username || "M")[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[10px] font-medium truncate max-w-[64px] text-center leading-tight">
                              {member.user?.displayName || member.user?.username}
                            </span>
                          </button>
                        ))}
                        {(!selectedCommunity?.members || selectedCommunity.members.length === 0) && (
                          <span className="text-xs text-muted-foreground">No members available</span>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <ChatMoreMenu
                  chatId={selectedChat.chat_id}
                  userInfo={{ id: selectedChat.user_id, displayName: selectedChat.display_name }}
                  onChatCleared={() => setSelectedChat(null)}
                />
              </div>
            ) : !(selectedChat.isOfficial && (user?.role !== 'admin' && user?.role !== 'staff')) && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => navigate(`/${selectedChat.username}`)}>
                  <UserIcon className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/escrow?chatId=${selectedChat.chat_id}&vendorId=${selectedChat.user_id}&vendorUsername=${selectedChat.username}`)}
                  title="Escrow"
                >
                  <span className="text-lg font-bold text-primary">₹</span>
                </Button>
                <ChatMoreMenu
                  chatId={selectedChat.chat_id}
                  userInfo={{ id: selectedChat.user_id, displayName: selectedChat.display_name }}
                  onChatCleared={() => setSelectedChat(null)}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Persistent Ad Banner below header */}
      {!adDismissed && chatAd && selectedChat && !selectedChat.isOfficial && (
        <div className="z-10 shadow-lg border-b border-white/5 bg-background/60 backdrop-blur-md">
          <AdBanner
            ad={chatAd}
            onDismiss={() => {
              setAdDismissed(true);
              sessionStorage.setItem(`ad_dismissed_${selectedChat!.chat_id}`, '1');
            }}
          />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 relative overflow-hidden min-h-0 bg-[#050810]/30" data-nocontext>


        <div
          className={`h-full overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 scroll-smooth relative z-10 ${selectedChat?.isKrovAI ? 'bg-[#FDF4FF]/30' : ''}`}
          data-nocontext
        >
          <div
            className={`px-4 pt-4 pb-2 space-y-1 chat-message-container privacy-protected ${selectedChat?.isKrovAI ? 'bg-[#FDF4FF]/30' : ''}`}
            style={{
              marginBottom: 12
            }}
          >
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">Start a conversation</div>
            ) : (
              messages.map((rawMsg, index) => {
                const msg = rawMsg as LocalMessage;
                const isMine = msg.senderId === user?.id;
                const isAdminMsg = selectedChat?.isOfficial && (!isMine || (user?.role === 'admin' || user?.role === 'staff'));
                const isEscrowOrNotify = msg.messageType?.startsWith?.('escrow_') || msg.message_type?.startsWith?.('escrow_') || msg.messageType === 'notification' || msg.message_type === 'notification' || isAdminMsg;

                // Date separator logic
                const currentDate = new Date(msg.createdAt).toDateString();
                const previousDate = index > 0 ? new Date(messages[index - 1].createdAt).toDateString() : null;
                const showDateSeparator = currentDate !== previousDate;

                return (
                  <React.Fragment key={msg.id}>
                    {showDateSeparator && (
                      <div className="flex justify-center my-6">
                        <span className="bg-secondary/60 text-secondary-foreground text-[11px] font-bold px-3 py-1.5 rounded-full border border-border/50 uppercase tracking-tighter shadow-sm backdrop-blur-sm">
                          {new Date(msg.createdAt).toLocaleDateString(undefined, {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                    <div
                      className={`flex ${isMine ? "justify-end" : "justify-start"} items-center gap-2 group relative chat-message privacy-protected ${selectedMessages.includes(msg.id) ? "bg-primary/10 -mx-4 px-4 py-1" : ""}`}
                      onClick={() => handleMessageClick(msg)}
                      onTouchStart={() => onTouchStart(msg)}
                      onTouchEnd={onTouchEnd}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (isMobile && !isSelectionMode) {
                          setActiveMessageMenu(msg);
                        } else if (isMobile && isSelectionMode) {
                          toggleMessageSelection(msg.id);
                        }
                      }}
                      data-nocontext
                    >
                      {isSelectionMode && (
                        <div className={`absolute ${isMine ? "left-2" : "right-2"} z-10`}>
                          <div className={`h-5 w-5 rounded-full border-2 ${selectedMessages.includes(msg.id) ? "bg-primary border-primary flex items-center justify-center" : "border-muted-foreground"}`}>
                            {selectedMessages.includes(msg.id) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                          </div>
                        </div>
                      )}
                      {!msg.isDeleted && !isSelectionMode && !isMobile && (
                        <div className={`opacity-0 group-hover:opacity-100 transition-opacity ${isMine ? "order-first" : "order-last"}`}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-secondary">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isMine ? "end" : "start"} className="w-56 bg-card border-border">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMessageDeleted(msg.id, 'me');
                                }}
                                className="gap-2 cursor-pointer"
                              >
                                <EyeOff className="h-4 w-4" /> Delete for Me
                              </DropdownMenuItem>

                              {(isMine || user?.role === 'admin') && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMessageDeleted(msg.id, 'everyone');
                                  }}
                                  className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4" /> Delete for Everyone
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleMessageSelection(msg.id);
                                }}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Select
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 relative privacy-protected ${isMine
                          ? (isEscrowOrNotify ? "" : "bg-[#00A4EF] text-white rounded-br-md")
                          : (isEscrowOrNotify ? "" : "bg-[#F5F5F5] text-[#1C1C1C] rounded-bl-md")
                          } ${msg.isDeleted ? "opacity-60 italic" : ""} ${isEscrowOrNotify ? (
                            (msg.messageType === 'escrow_released' || msg.message_type === 'escrow_released')
                              ? "bg-[#E7F8F2] text-[#0B8C62] shadow-sm border border-[#0FB881]/20 rounded-2xl"
                              : (msg.messageType === 'notification' || msg.message_type === 'notification' || isAdminMsg)
                                ? (isAdminMsg ? (msg.color ? "" : "bg-[#E6F6FE] text-[#007BB5] shadow-sm border border-[#00A4EF]/20 rounded-2xl") : "bg-[#FFF0EB] text-[#C43E00] shadow-sm border border-[#FF9800]/20 rounded-2xl")
                                : "bg-[#E6F6FE] text-[#007BB5] shadow-sm border border-[#00A4EF]/20 rounded-2xl"
                          ) : ""}`}
                        style={isEscrowOrNotify && isAdminMsg && msg.color ? {
                          background: "#FFFFFF",
                          boxShadow: `0 0 0 1px #E0E0E0, 0 4px 12px ${msg.color}15`,
                          borderLeft: `3px solid ${msg.color}`,
                          borderRadius: '14px'
                        } : isEscrowOrNotify && isAdminMsg && !msg.color ? {
                          background: "#FFFFFF",
                          boxShadow: `0 0 0 1px #E0E0E0`,
                          borderLeft: `3px solid #00A4EF`,
                          borderRadius: '14px'
                        } : {}}
                      >
                        {msg.isViewOnce ? (
                          <div
                            className={`flex items-center gap-3 py-1 cursor-pointer transition-all active:scale-95 ${msg.isOpened ? 'opacity-60' : 'hover:opacity-80'}`}
                            onClick={(e) => {
                              if (!isMine && !msg.isOpened && !isSelectionMode) {
                                e.stopPropagation();
                                if (msg.attachmentUrl) {
                                  setIsPreviewViewOnce(true);
                                  setPreviewImage(msg.attachmentUrl);
                                  setPreviewSenderUsername(selectedChat.username);
                                  handleOpenViewOnce(msg);
                                }
                              }
                            }}
                          >
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isMine ? 'bg-white/20' : 'bg-[#00A4EF]/10 text-[#00A4EF]'}`}>
                              {msg.isOpened ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold">
                                {msg.isOpened ? "Viewed" : (isMine ? "Photo" : "View Photo")}
                              </span>
                              {!msg.isOpened && !isMine && <span className="text-[10px] opacity-70">Click to view once</span>}
                            </div>
                          </div>
                        ) : isEscrowOrNotify ? (
                          <div className="space-y-3">
                            {/* Header row */}
                            <div className="flex items-center gap-2.5">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isAdminMsg
                                ? 'bg-[#00A4EF]/10 border border-[#00A4EF]/20'
                                : (msg.messageType === 'escrow_released' || msg.message_type === 'escrow_released')
                                  ? 'bg-[#0FB881]/10 border border-[#0FB881]/20'
                                  : 'bg-[#00A4EF]/10 border border-[#00A4EF]/20'
                                }`}>
                                {msg.messageType === 'escrow_created' || msg.message_type === 'escrow_created'
                                  ? <Plus className="h-4 w-4 text-[#00A4EF]" />
                                  : (msg.messageType === 'escrow_released' || msg.message_type === 'escrow_released')
                                    ? <IndianRupee className="h-4 w-4 text-[#0FB881]" />
                                    : <ShieldCheck className="h-4 w-4 text-[#00A4EF]" />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`font-semibold text-[13px] leading-none tracking-tight ${(msg.messageType === 'escrow_released' || msg.message_type === 'escrow_released') ? 'text-[#0B8C62]' : (msg.messageType === 'notification' || msg.message_type === 'notification' || isAdminMsg) ? 'text-[#007BB5]' : 'text-[#C43E00]'}`}>
                                  {isAdminMsg
                                    ? "Krovaa"
                                    : msg.messageType === 'escrow_created' || msg.message_type === 'escrow_created'
                                      ? "Deal Created"
                                      : (msg.messageType === 'escrow_released' || msg.message_type === 'escrow_released')
                                        ? "Payment Released"
                                        : (msg.messageType === 'notification' || msg.message_type === 'notification')
                                          ? (msg.content.match(/\*\*(.*?)\*\*/) ? msg.content.match(/\*\*(.*?)\*\*/)?.[1] : "System Update")
                                          : "Payment Confirmed"
                                  }
                                </p>
                                <p className={`text-[10px] mt-0.5 uppercase tracking-widest font-medium opacity-60 ${(msg.messageType === 'escrow_released' || msg.message_type === 'escrow_released') ? 'text-[#0B8C62]' : 'text-[#1C1C1C]'}`}>
                                  {isAdminMsg ? "Krovaa · Official" : (msg.messageType === 'notification' || msg.message_type === 'notification') ? "Krovaa · Notification" : "Krovaa"}
                                </p>
                              </div>
                              {isAdminMsg && (
                                <div className="flex items-center gap-1 bg-[#00A4EF]/10 border border-[#00A4EF]/20 px-2 py-0.5 rounded-full shrink-0">
                                  <span className="h-1.5 w-1.5 rounded-full bg-[#00A4EF] animate-pulse" />
                                  <span className="text-[9px] text-[#00A4EF] font-bold tracking-widest uppercase">Live</span>
                                </div>
                              )}
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-[#E0E0E0]" />

                            {/* Message body */}
                            <div className={`text-[13px] leading-relaxed font-normal ${(msg.messageType === 'escrow_released' || msg.message_type === 'escrow_released') ? 'text-[#0B8C62]/80' : 'text-[#1C1C1C]'}`}>
                              {isAdminMsg ? (
                                msg.content.split('\n').map((line, i) => (
                                  <React.Fragment key={i}>
                                    {line.split(/(\*\*.*?\*\*)/).map((part, j) => {
                                      if (part.startsWith('**') && part.endsWith('**')) {
                                        return <span key={j} className="font-semibold text-[#1C1C1C]">{part.slice(2, -2)}</span>;
                                      }
                                      return part;
                                    })}
                                    {i < msg.content.split('\n').length - 1 && <br />}
                                  </React.Fragment>
                                ))
                              ) : (msg.messageType === 'notification' || msg.message_type === 'notification')
                                ? msg.content.split('\n\n')[1] || msg.content.replace(/🔔 \*\*(.*?)\*\*\n\n/, '')
                                : msg.content
                              }
                            </div>

                            {/* Escrow CTA */}
                            {(msg.messageType?.startsWith?.('escrow_') || msg.message_type?.startsWith?.('escrow_')) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/escrow?chatId=${selectedChat.chat_id}`);
                                }}
                                className={`w-full py-2 rounded-lg text-[12px] font-semibold tracking-wide border transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${(msg.messageType === 'escrow_released' || msg.message_type === 'escrow_released')
                                  ? "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                                  : "border-white/10 text-white/70 hover:bg-white/5"
                                  }`}
                              >
                                View Details <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                              </button>
                            )}
                          </div>
                        ) : msg.messageType === 'voice' && msg.attachmentUrl ? (
                          <div className="relative space-y-2 pr-8">
                            {!msg.isDeleted && !isSelectionMode && (
                              <button
                                type="button"
                                aria-label="Voice message options"
                                title="Voice message options"
                                className="absolute right-0 top-0 rounded-full border border-border/60 bg-white/90 p-1.5 text-muted-foreground shadow-sm opacity-70 transition-all hover:opacity-100 hover:bg-background"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMessageMenu(msg);
                                }}
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] opacity-70">
                              <Mic className="h-3.5 w-3.5" />
                              Voice message
                            </div>
                            <audio
                              controls
                              src={msg.attachmentUrl}
                              className="w-full max-w-[280px]"
                            />
                          </div>
                        ) : (
                          <p className="text-sm">{msg.content}</p>
                        )}
                        {msg.attachmentUrl && !msg.isDeleted && !msg.isViewOnce && msg.messageType !== 'voice' && (
                          <div className="mt-2 p-2 bg-black/10 rounded-lg flex items-center gap-2">
                            {msg.messageType === 'image' || msg.attachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <div
                                className="cursor-pointer hover:opacity-90 transition-opacity relative privacy-protected"
                                onContextMenu={(e) => e.preventDefault()}
                                onClick={() => {
                                  setIsPreviewViewOnce(false);
                                  setPreviewImage(msg.attachmentUrl || null);
                                  setPreviewSenderUsername(isMine ? user?.username : selectedChat.username);
                                }}
                              >
                                <img src={msg.attachmentUrl} alt="attachment" className="max-w-full rounded h-48 object-cover shadow-sm border border-white/10 select-none pointer-events-none" />
                                {msg.isUploading && (
                                  <div className="absolute inset-0 bg-black/40 rounded flex items-center justify-center backdrop-blur-sm">
                                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 overflow-hidden">
                                <FileText className="h-5 w-5 shrink-0" />
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    downloadFile(msg.attachmentUrl || "", msg.attachmentName || "download");
                                  }}
                                  className="text-xs underline truncate hover:text-primary transition-colors flex items-center gap-1"
                                >
                                  {msg.attachmentName || 'Download File'}
                                  <Download className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        <p
                          className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}
                        >
                          {formatTime(msg.createdAt)}
                          {isMine && (msg.read ? " ✓✓" : " ✓")}
                        </p>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>
      </div>

      {/* Input */}
      <div
        ref={inputBarRef}
        className="p-3 border-t border-border bg-background flex-shrink-0"
      >
        {selectedChat?.isOfficial && botState === 'IDLE' && (
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => {
                setBotState('AWAITING_PROFESSION');
                const botReply: MessageType = {
                  id: Date.now(),
                  senderId: selectedChat.user_id,
                  receiverId: user?.id || 0,
                  chatId: selectedChat.chat_id,
                  content: "I can help you find the best verified profiles! 🌟 First, what profession or skill are you looking for?",
                  messageType: 'text',
                  read: true,
                  createdAt: new Date().toISOString()
                };
                setMessages(prev => [...prev, botReply]);
              }}
              className="bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold px-3 py-1.5 rounded-full border border-primary/20 transition-all active:scale-95"
            >
              Suggest me the best profiles 👤
            </button>
            <button
              onClick={() => {
                const botReply: MessageType = {
                  id: Date.now(),
                  senderId: selectedChat.user_id,
                  receiverId: user?.id || 0,
                  chatId: selectedChat.chat_id,
                  content: "To get verified, please go to your Profile settings and click on 'Verify Account'. Professional verification ensures trust in our community!",
                  messageType: 'text',
                  read: true,
                  createdAt: new Date().toISOString()
                };
                setMessages(prev => [...prev, botReply]);
              }}
              className="bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold px-3 py-1.5 rounded-full border border-border transition-all active:scale-95"
            >
              How to get verified? 🛡️
            </button>
          </div>
        )}

        {selectedChat?.isOfficial && botState === 'AWAITING_PROFESSION' && (
          <div className="flex flex-col gap-2 mb-3 max-w-[280px]">
            <p className="text-[10px] text-muted-foreground font-medium px-1">Choose a profession:</p>
            <div className="flex gap-2">
              <Select onValueChange={(val) => {
                setNewMessage(val);
              }}>
                <SelectTrigger className="h-9 bg-card border-border rounded-xl text-sm">
                  <SelectValue placeholder="Select Profession" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="Software Engineer">Software Engineer</SelectItem>
                  <SelectItem value="Graphic Designer">Graphic Designer</SelectItem>
                  <SelectItem value="Web Developer">Web Developer</SelectItem>
                  <SelectItem value="Video Editor">Video Editor</SelectItem>
                  <SelectItem value="Content Writer">Content Writer</SelectItem>
                  <SelectItem value="Digital Marketer">Digital Marketer</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleSend}
                size="sm"
                className="bg-primary hover:bg-primary/90 rounded-xl"
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {botState !== 'IDLE' && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest font-bold text-primary animate-pulse flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Bot: {botState === 'AWAITING_PROFESSION' ? "Awaiting Profession..." : botState === 'AWAITING_CITY' ? "Awaiting City..." : botState === 'AWAITING_PINCODE' ? "Awaiting Pincode..." : "Searching Profiles..."}
            </span>
            <button
              onClick={() => {
                setBotState('IDLE');
                setBotData({});
              }}
              className="text-[10px] text-muted-foreground hover:text-destructive font-bold uppercase tracking-tighter"
            >
              Cancel
            </button>
          </div>
        )}
        {error && (
          <div className="text-sm text-[#86198F] bg-[#FDF4FF] border border-[#D946EF]/20 p-3 rounded-lg mb-2">
            {error}
            {error.toLowerCase().includes('limit') && (
              <button
                onClick={() => navigate('/image-generator/pricing')}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#D946EF] to-[#F97316] text-white text-sm font-semibold hover:opacity-90 transition-opacity w-full justify-center"
              >
                <Sparkles className="h-4 w-4" />
                Upgrade Now
              </button>
            )}
          </div>
        )}
        <div className={`flex items-center gap-2 ${selectedChat?.isKrovAI ? 'bg-[#FDF4FF]/80 backdrop-blur-xl border-t border-[#D946EF]/10' : ''}`}>
          {isRecordingVoice && (
            <div className="flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-destructive shrink-0">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              Recording {formatRecordingDuration(recordingSeconds)}
            </div>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Smile className="h-5 w-5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <EmojiPicker onSelect={(emoji) => setNewMessage(newMessage + emoji)} />
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
              >
                <Paperclip className="h-5 w-5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 bg-card border-border">
              <DropdownMenuItem
                onClick={() => {
                  setCurrentAcceptType("image/*");
                  setTimeout(() => fileInputRef.current?.click(), 50);
                }}
              >
                <Camera className="h-4 w-4 mr-2" />
                <span>Camera</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setCurrentAcceptType("image/*");
                  setTimeout(() => fileInputRef.current?.click(), 50);
                }}
              >
                <Image className="h-4 w-4 mr-2" />
                <span>Photos</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setCurrentAcceptType("video/*");
                  setTimeout(() => fileInputRef.current?.click(), 50);
                }}
              >
                <Film className="h-4 w-4 mr-2" />
                <span>Videos</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setCurrentAcceptType(".pdf,.doc,.docx,.txt,.zip,.rar");
                  setTimeout(() => fileInputRef.current?.click(), 50);
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                <span>Documents</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept={currentAcceptType}
          />
          <Input
            ref={messageInputRef}
            className={`${selectedChat?.isKrovAI ? 'bg-white/60 border-[#D946EF]/20 focus-visible:ring-[#D946EF]/30' : 'bg-secondary border-border'}`}
            placeholder={selectedChat?.isKrovAI ? "Ask me anything..." : "Type a message..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            data-nopaste
            type="text"
            inputMode="text"
            autoComplete="off"
          />
          {newMessage.trim() ? (
            <Button size="icon" onClick={handleSend} className={`shrink-0 ${selectedChat?.isKrovAI ? 'bg-gradient-to-r from-[#D946EF] to-[#F97316] hover:opacity-90 text-white' : ''}`}>
              <Send className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
              className={`shrink-0 ${isRecordingVoice ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground animate-pulse' : selectedChat?.isKrovAI ? 'bg-gradient-to-r from-[#D946EF] to-[#F97316] hover:opacity-90 text-white' : ''}`}
              aria-label={isRecordingVoice ? 'Stop voice recording' : 'Start voice recording'}
            >
              {isRecordingVoice ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Modals outside flex flow */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
          <div
            className={`relative group overflow-auto max-h-[90vh] ${isPreviewViewOnce && !isHoldingView ? 'blur-2xl grayscale' : ''}`}
            onMouseDown={() => isPreviewViewOnce && setIsHoldingView(true)}
            onMouseUp={() => setIsHoldingView(false)}
            onMouseLeave={() => setIsHoldingView(false)}
            onTouchStart={() => isPreviewViewOnce && setIsHoldingView(true)}
            onTouchEnd={() => setIsHoldingView(false)}
          >
            <img
              src={previewImage || ""}
              alt="Preview"
              className="max-w-full max-h-[85vh] h-auto object-contain rounded-lg shadow-2xl select-none pointer-events-none privacy-protected"
              onContextMenu={(e) => e.preventDefault()}
            />

            {/* Watermark for tracing and security */}
            {isPreviewViewOnce && (
              <div className="absolute inset-0 pointer-events-none select-none overflow-hidden origin-center flex items-center justify-center z-10">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-24 -rotate-45 scale-125 transition-opacity duration-300 opacity-20">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="text-white text-xl md:text-3xl font-black tracking-widest uppercase whitespace-nowrap flex flex-col items-center">
                      <span>@{previewSenderUsername || user?.username}</span>
                      <span className="text-[10px] font-bold tracking-[0.4em] opacity-70">CONFIDENTIAL</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isPreviewViewOnce && !isHoldingView && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-lg pointer-events-none">
                <div className="text-center p-6 text-white">
                  <div className="bg-white/20 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-white/30 backdrop-blur-md">
                    <Eye className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-lg font-bold">Press and hold to view</p>
                  <p className="text-xs opacity-70 mt-1">Screen capture is blocked</p>
                </div>
              </div>
            )}
            <div className="absolute top-4 right-4 flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full bg-black/50 hover:bg-black/70 border-none text-white h-10 w-10 shadow-lg backdrop-blur-sm"
                onClick={() => setPreviewImage(null)}
              >
                <ArrowLeft className="h-5 w-5 rotate-180" />
              </Button>
              {!isPreviewViewOnce && (
                <button
                  onClick={() => {
                    const filename = messages.find(m => m.attachmentUrl === previewImage)?.attachmentName || "download";
                    downloadFile(previewImage || "", filename);
                  }}
                  className="flex items-center justify-center h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-transform active:scale-95"
                >
                  <Download className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FilePreviewDialog
        file={pendingFile}
        isOpen={!!pendingFile}
        onClose={() => setPendingFile(null)}
        onSend={handleConfirmUpload}
        isUploading={isLoading}
      />

      {/* Message Action Drawer for Mobile (Instagram style) */}
      <Drawer open={!!activeMessageMenu} onOpenChange={(open) => !open && setActiveMessageMenu(null)}>
        <DrawerContent className="bg-background border-border pb-8">
          <DrawerHeader className="pb-2 border-b border-border mb-4">
            <DrawerTitle className="text-center text-sm font-bold opacity-70">Message Options</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 space-y-3">
            {!activeMessageMenu?.isDeleted && (
              <>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-foreground hover:bg-secondary h-14 text-lg font-semibold rounded-2xl px-6"
                  onClick={() => {
                    if (activeMessageMenu) onMessageDeleted(activeMessageMenu.id, 'me');
                    setActiveMessageMenu(null);
                  }}
                >
                  <EyeOff className="mr-4 h-6 w-6" /> Delete for Me
                </Button>

                {(activeMessageMenu?.senderId === user?.id || user?.role === 'admin') && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 h-14 text-lg font-semibold rounded-2xl px-6"
                    onClick={() => {
                      if (activeMessageMenu) onMessageDeleted(activeMessageMenu.id, 'everyone');
                      setActiveMessageMenu(null);
                    }}
                  >
                    <Trash2 className="mr-4 h-6 w-6" /> Delete for Everyone
                  </Button>
                )}
              </>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start h-14 text-lg font-semibold rounded-2xl px-6 text-foreground"
              onClick={() => {
                if (activeMessageMenu) toggleMessageSelection(activeMessageMenu.id);
                setActiveMessageMenu(null);
              }}
            >
              <CheckCircle2 className="mr-4 h-6 w-6" /> Select More
            </Button>
            <DrawerClose asChild>
              <Button
                variant="secondary"
                className="w-full h-14 text-lg font-semibold rounded-2xl px-6 bg-secondary text-secondary-foreground"
              >
                <X className="mr-4 h-6 w-6" /> Cancel
              </Button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>
    </div >
  );
};

const ChatMoreMenu = ({
  chatId,
  userInfo,
  onChatCleared
}: {
  chatId: string;
  userInfo: { id: number, displayName: string };
  onChatCleared: () => void;
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleClearHistory = async () => {
    setIsLoading(true);
    try {
      await clearChatHistory(chatId);
      toast({ title: "History Cleared", description: "All messages in this chat have been deleted." });
      onChatCleared();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to clear history", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsClearDialogOpen(false);
    }
  };

  const handleBlockUser = async () => {
    setIsLoading(true);
    try {
      await blockUser(userInfo.id);
      toast({ title: "User Blocked", description: `${userInfo.displayName} has been blocked.` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to block user", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsBlockDialogOpen(false);
    }
  };

  const handleReportUser = async () => {
    if (!reportReason.trim()) return;
    setIsLoading(true);
    try {
      await reportUser(userInfo.id, reportReason);
      toast({ title: "Report Submitted", description: "Thank you for your report. We will investigate." });
      setReportReason("");
      setIsReportDialogOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to submit report", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-card border-border">
          <DropdownMenuItem onClick={() => setIsClearDialogOpen(true)} className="text-foreground">
            <Trash2 className="mr-2 h-4 w-4" /> Clear History
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsBlockDialogOpen(true)} className="text-destructive focus:text-destructive">
            <Ban className="mr-2 h-4 w-4" /> Block User
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsReportDialogOpen(true)} className="text-foreground">
            <AlertTriangle className="mr-2 h-4 w-4" /> Report User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear History Dialog */}
      <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Chat History?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all messages in this conversation for both participants. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isLoading ? "Clearing..." : "Clear Everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block User Dialog */}
      <AlertDialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Block {userInfo.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer be able to send you messages. You can unblock them anytime from your settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlockUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isLoading ? "Blocking..." : "Block User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report User Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Report User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to report {userInfo.displayName}? Please provide a reason below.
            </p>
            <Textarea
              placeholder="Reason for report (harassment, spam, etc.)..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="bg-secondary border-border min-h-[100px]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsReportDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReportUser}
                disabled={isLoading || !reportReason.trim()}
              >
                {isLoading ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ChatPage = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user, isLoading: authLoading, logout } = useAuth();
  const { toast } = useToast();

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  // No longer redirecting admin to dashboard, allowing them to use ChatPage for support


  const [chats, setChats] = useState<ChatType[]>([]);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AuthUser[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [botState, setBotState] = useState<'IDLE' | 'AWAITING_PROFESSION' | 'AWAITING_CITY' | 'AWAITING_PINCODE' | 'SEARCHING'>('IDLE');
  const [botData, setBotData] = useState<{ city?: string; pincode?: string; profession?: string }>({});
  const [error, setError] = useState("");
  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<BlobPart[]>([]);
  const voiceTimerRef = useRef<number | null>(null);
  const [currentAcceptType, setCurrentAcceptType] = useState<string>("image/*,.pdf,.doc,.docx,.txt,.zip,.rar");
  const [selectedMessages, setSelectedMessages] = useState<number[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isBlurred, setIsBlurred] = useState(false);
  const [isPreviewViewOnce, setIsPreviewViewOnce] = useState(false);
  const [isHoldingView, setIsHoldingView] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<CommunityDetailView | null>(null);

  // Hide bottom navbar when in a chat on mobile
  useEffect(() => {
    if (selectedChat && isMobile) {
      document.body.classList.add('hide-navbar');
    } else {
      document.body.classList.remove('hide-navbar');
    }
    return () => document.body.classList.remove('hide-navbar');
  }, [selectedChat, isMobile]);

  // Sync selected chat state for BottomNavbar
  useEffect(() => {
    if (selectedChat) {
      sessionStorage.setItem('chat_open', 'true');
    } else {
      sessionStorage.removeItem('chat_open');
    }
    window.dispatchEvent(new CustomEvent('chatChange', { detail: { isOpen: !!selectedChat } }));
  }, [selectedChat]);


  // Blur when tab is hidden or window loses focus
  useEffect(() => {
    if (!selectedChat) return;
    const handleVisibility = () => {
      setIsBlurred(document.hidden);
    };
    const handleBlur = () => setIsBlurred(true);
    const handleFocus = () => setIsBlurred(false);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [selectedChat]);

  // Disable right click/context menu on chat page
  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', preventContextMenu);
    return () => document.removeEventListener('contextmenu', preventContextMenu);
  }, []);


  const loadChats = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getChatList();
      try {
        const groups = await getGroupChats();
        const mappedGroups: ChatType[] = groups.map(g => ({
          chat_id: `group_${g.id}`,
          last_message: g.messages?.[0]?.content || "Group Chat",
          last_message_time: g.messages?.[0]?.createdAt || new Date().toISOString(),
          user_id: 0,
          display_name: g.name || "Unnamed Group",
          avatar_url: "/group-icon.svg",
          username: "group",
          unread_count: 0,
          verified: false,
          isOfficial: false,
        }));
        data.push(...mappedGroups);
        data.sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());
      } catch (err) {
        console.error("Failed to load group chats", err);
      }
      try {
        const communities = await listCommunities();
        // only show communities we are a member of
        const joinedCommunities = communities.filter(c => c.members?.some((m: any) => m.userId === user?.id));
        const mappedCommunities: ChatType[] = joinedCommunities.map(c => ({
          chat_id: `community_${c.id}`,
          last_message: "Community Chat",
          last_message_time: c.createdAt || new Date().toISOString(),
          user_id: 0,
          display_name: c.name,
          avatar_url: "", // Can use a default community icon if needed
          username: "community",
          unread_count: 0,
          verified: false,
          isOfficial: false,
        }));
        data.push(...mappedCommunities);
        data.sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());
      } catch (err) {
        console.error("Failed to load communities", err);
      }
      if (user?.role !== 'admin' && user?.role !== 'staff' && user?.id) {
        const supportChatId = `support_${user.id}`;
        const hasSupportChat = data.some((chat) => chat.chat_id === supportChatId);

        if (!hasSupportChat) {
          try {
            const { admin } = await getSupportChat();
            data.unshift({
              chat_id: supportChatId,
              last_message: "Official Support & Notifications",
              last_message_time: new Date().toISOString(),
              user_id: admin.id,
              display_name: "Krovaa",
              avatar_url: "/krovaa-logo.svg?v=3",
              username: "krovaa",
              unread_count: 0,
              verified: true,
              isOfficial: true,
            });
          } catch {
            // Leave the list as-is if support cannot be resolved right now.
          }
        }
      }

      setChats(data);
          // Inject KrovAI chat row
          const isImageGeneratorEnabled = localStorage.getItem("image_generator_enabled") !== "false";
          const krovaiChatId = `krovai_${user?.id}`;
          const hasKrovaiChat = data.some((chat) => chat.chat_id === krovaiChatId);
          if (isImageGeneratorEnabled && !hasKrovaiChat && user?.role !== 'admin' && user?.role !== 'staff' && user?.id) {
            data.unshift({
              chat_id: krovaiChatId,
              last_message: "Generate images & chat with AI!",
              last_message_time: new Date().toISOString(),
              user_id: 0,
              display_name: "KrovAI",
              avatar_url: "/ai-sparkle.svg",
              username: "krovai",
              unread_count: 0,
              verified: false,
              isKrovAI: true,
            });
          }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chats");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.role]);

  const loadMessages = useCallback(async (chatId: string) => {
    try {
      let data;
      if (chatId.startsWith("group_")) {
        const groupId = parseInt(chatId.replace("group_", ""));
        data = await getGroupMessages(groupId);
      } else if (chatId.startsWith("community_")) {
        const communityId = parseInt(chatId.replace("community_", ""));
        data = await getCommunityMessages(communityId);
      } else {
        data = await getMessages(chatId);
      }
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    }
  }, []);

  const startChat = useCallback((foundUser: AuthUser) => {
    // Create a new chat object for the user
    const newChat: ChatType = {
      chat_id: `chat_${user?.id}_${foundUser.id}_${Date.now()}`,
      last_message: "New conversation",
      last_message_time: new Date().toISOString(),
      user_id: foundUser.id,
      display_name: foundUser.displayName,
      avatar_url: foundUser.avatarUrl,
      username: foundUser.username,
      unread_count: 0,
      verified: foundUser.verified || false,
    };

    setSelectedChat(newChat);
    setSearchQuery("");
    setSearchResults([]);
    setMessages([]);
  }, [user?.id]);

  const handleSearch = useCallback(async (query = searchQuery) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchUsers(query);
      setSearchResults(results);
      return results;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search users");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Handle automatic chat selection from query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetUserId = params.get('userId');
    const targetChatId = params.get('chatId');

    if (chats.length > 0 && user) {
      if (targetChatId) {
        const chat = chats.find(c => c.chat_id === targetChatId);
        if (chat) {
          setSelectedChat(chat);
          window.history.replaceState({}, '', '/chat');
          return;
        }
      }

      if (targetUserId) {
        const targetIdNum = parseInt(targetUserId);

        // Validation for non-numeric ID or missing ID
        if (isNaN(targetIdNum) || targetIdNum === user.id) {
          window.history.replaceState({}, '', '/chat');
          return;
        }

        // 1. Check if chat already exists
        const existingChat = chats.find(c => c.user_id === targetIdNum);
        if (existingChat) {
          setSelectedChat(existingChat);
          // Clear param to avoid re-triggering if user navigates back to list
          window.history.replaceState({}, '', '/chat');
        } else {
          // 2. If not, fetch user and start new chat
          const fetchAndStartChat = async () => {
            try {
              const targetUser = await getUser(targetIdNum);
              startChat(targetUser);
              window.history.replaceState({}, '', '/chat');
            } catch (err) {
              console.error("Failed to start chat from query param:", err);
            }
          };
          fetchAndStartChat();
        }
      }
    }
  }, [user, chats, startChat]);

  // Load chats on mount and when user changes
  const socketConnectedRef = useRef(false);
  useEffect(() => {
    if (!user && !authLoading) {
      navigate("/login", { replace: true });
      return;
    }
    if (user) {
      loadChats();
      if (!socketConnectedRef.current) {
        socketService.connect(user.id);
        socketConnectedRef.current = true;
      }
    }
    // Only disconnect on true component unmount
    return () => {
      if (socketConnectedRef.current) {
        socketService.disconnect();
        socketConnectedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  // Handle real-time messages
  useEffect(() => {
    if (!user) return;

    const cleanup = socketService.onNewMessage((msg: MessageType) => {
      // If message is for the current open chat, add it to messages list
      if (selectedChat && msg.chatId === selectedChat.chat_id) {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Mark as read if we are looking at this chat
        if (msg.senderId !== user.id) {
          markMessagesAsRead(selectedChat.chat_id).then(() => loadChats());
        }
      } else {
        // Always refresh chat list to show latest message/unread count
        loadChats();
      }
    });

    return cleanup;
  }, [user, selectedChat, loadChats]);

  // Handle messages being read
  useEffect(() => {
    if (!user) return;
    const cleanup = socketService.onMessagesRead((data) => {
      if (selectedChat && data.chatId === selectedChat.chat_id) {
        setMessages((prev) =>
          prev.map((m) => (m.receiverId === data.readerId ? { ...m, read: true } : m))
        );
      }
    });
    return cleanup;
  }, [user, selectedChat]);

  // Handle View Once messages being opened
  useEffect(() => {
    if (!user) return;
    const cleanup = socketService.onMessageOpened((msg: MessageType) => {
      if (selectedChat && msg.chatId === selectedChat.chat_id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? msg : m))
        );
      }
      loadChats();
    });
    return cleanup;
  }, [user, selectedChat, loadChats]);

  // Load messages and join room when selected chat changes
  useEffect(() => {
    // Clear blur state when changing chats
    setIsBlurred(false);

    if (selectedChat && user) {
      loadMessages(selectedChat.chat_id);
      socketService.joinChat(user.id, selectedChat.chat_id);
      // Mark as read when opening chat
      markMessagesAsRead(selectedChat.chat_id).then(() => loadChats());
    }
  }, [selectedChat?.chat_id, user, loadMessages, loadChats]);

  // Handle message deletion from other users
  useEffect(() => {
    if (!user) return;
    const cleanup = socketService.onMessageDeleted((data) => {
      if (selectedChat && data.chatId === selectedChat.chat_id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId
              ? { ...m, isDeleted: true, content: "This message was deleted", attachmentUrl: undefined, attachmentName: undefined }
              : m
          )
        );
      }
      loadChats(); // Update last message in chat list
    });
    return cleanup;
  }, [user, selectedChat, loadChats]);

  // Handle screenshot attempt notifications from other users
  useEffect(() => {
    if (!user) return;
    const cleanup = socketService.onScreenshotAttempt((data) => {
      if (selectedChat && data.chatId === selectedChat.chat_id) {
        // Add screenshot attempt notification to messages
        setMessages((prev) => {
          // Prevent duplicates
          const isDuplicate = prev.some(m =>
            m.messageType === 'notification' &&
            m.content.includes('attempted to take a screenshot') &&
            Math.abs(new Date(m.createdAt).getTime() - new Date(data.message.createdAt).getTime()) < 1000
          );

          if (isDuplicate) return prev;
          return [...prev, data.message];
        });
      }
    });
    return cleanup;
  }, [user, selectedChat]);

  // Search users when query changes - debounce to avoid excessive searching
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);


  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || !selectedChat || !user) return;

    const messageToSend = newMessage;
    setNewMessage("");

    // Bot Logic
    if (selectedChat?.isOfficial) {
      if (botState === 'AWAITING_PROFESSION') {
        setBotData(prev => ({ ...prev, profession: messageToSend }));
        setBotState('AWAITING_CITY');

        // Add user message to UI immediately for better UX
        const userMsg: MessageType = {
          id: Date.now(),
          senderId: user.id,
          receiverId: selectedChat.user_id,
          chatId: selectedChat.chat_id,
          content: messageToSend,
          messageType: 'text',
          read: true,
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, userMsg]);

        // Add Bot reply
        setTimeout(() => {
          const botReply: MessageType = {
            id: Date.now() + 1,
            senderId: selectedChat.user_id,
            receiverId: user.id,
            chatId: selectedChat.chat_id,
            content: "Got it. Now, which City are you looking in?",
            messageType: 'text',
            read: true,
            createdAt: new Date().toISOString()
          };
          setMessages(prev => [...prev, botReply]);
        }, 600);
        return;
      } else if (botState === 'AWAITING_CITY') {
        setBotData(prev => ({ ...prev, city: messageToSend }));
        setBotState('AWAITING_PINCODE');

        // Add user message to UI immediately for better UX
        const userMsg: MessageType = {
          id: Date.now(),
          senderId: user.id,
          receiverId: selectedChat.user_id,
          chatId: selectedChat.chat_id,
          content: messageToSend,
          messageType: 'text',
          read: true,
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, userMsg]);

        // Add Bot reply
        setTimeout(() => {
          const botReply: MessageType = {
            id: Date.now() + 1,
            senderId: selectedChat.user_id,
            receiverId: user.id,
            chatId: selectedChat.chat_id,
            content: "Great! Now please enter your Pincode to narrow down results.",
            messageType: 'text',
            read: true,
            createdAt: new Date().toISOString()
          };
          setMessages(prev => [...prev, botReply]);
        }, 600);
        return;
      } else if (botState === 'AWAITING_PINCODE') {
        setBotData(prev => ({ ...prev, pincode: messageToSend }));
        setBotState('SEARCHING');

        // Add user message
        const userMsg: MessageType = {
          id: Date.now(),
          senderId: user.id,
          receiverId: selectedChat.user_id,
          chatId: selectedChat.chat_id,
          content: messageToSend,
          messageType: 'text',
          read: true,
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, userMsg]);

        // Trigger Search
        setTimeout(async () => {
          try {
            const results = await getBestProfiles({ 
              city: botData.city, 
              pincode: messageToSend,
              profession: botData.profession 
            });
            setBotState('IDLE');
            setBotData({});

            let content = "";
            if (results.length === 0) {
              content = `I couldn't find any verified ${botData.profession || ''} profiles in ${botData.city || 'that location'}. 😔`;
            } else {
              content = `I found ${results.length} verified ${botData.profession || 'profile'}(s) for you! 🌟\n\n` +
                results.map(u => `• @${u.username} (${u.displayName || 'No Name'})${u.city ? ` in ${u.city}` : ''}`).join('\n');
            }

            const botReply: MessageType = {
              id: Date.now() + 2,
              senderId: selectedChat.user_id,
              receiverId: user.id,
              chatId: selectedChat.chat_id,
              content: content,
              messageType: 'text',
              read: true,
              createdAt: new Date().toISOString()
            };
            setMessages(prev => [...prev, botReply]);
          } catch (err) {
            setBotState('IDLE');
            const botReply: MessageType = {
              id: Date.now() + 2,
              senderId: selectedChat.user_id,
              receiverId: user.id,
              chatId: selectedChat.chat_id,
              content: "Sorry, I encountered an error while searching. Please try again later.",
              messageType: 'text',
              read: true,
              createdAt: new Date().toISOString()
            };
            setMessages(prev => [...prev, botReply]);
          }
        }, 1000);
        return;
      }
    }

    try {
      if (selectedChat.chat_id.startsWith("group_")) {
        const groupId = parseInt(selectedChat.chat_id.replace("group_", ""));
        await sendGroupMessage(groupId, {
          content: messageToSend,
          messageType: "text"
        });
      } else if (selectedChat.chat_id.startsWith("community_")) {
        const communityId = parseInt(selectedChat.chat_id.replace("community_", ""));
        await sendCommunityMessage(communityId, messageToSend);
      } else {
        await sendMessage({
          receiver_id: selectedChat.user_id,
          chat_id: selectedChat.chat_id,
          content: messageToSend,
          message_type: "text",
          is_view_once: false // Text messages are no longer view-once via main input
        });
      }
      await loadMessages(selectedChat.chat_id);
      await loadChats();

      // Refocus input after sending (keep keyboard open on mobile)
      if (messageInputRef.current) {
        messageInputRef.current.focus();
        // Scroll input into view for mobile
        if (window.innerWidth <= 600) {
          messageInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setNewMessage(messageToSend);
    }
  }, [newMessage, selectedChat, user, loadMessages, loadChats]);

  const handleMessageDeleted = useCallback(async (messageId: number, type: 'me' | 'everyone' = 'me') => {
    try {
      await deleteMessage(messageId, type);
      toast({
        title: type === 'me' ? "Deleted for You" : "Deleted for Everyone",
        description: type === 'me' ? "Message hidden from your view." : "Message has been deleted."
      });
      if (selectedChat) loadMessages(selectedChat.chat_id);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to delete message", variant: "destructive" });
    }
  }, [selectedChat, loadMessages, toast]);

  const handleDeleteMessagesBatch = useCallback(async (ids: number[], type: 'me' | 'everyone' = 'me') => {
    if (ids.length === 0) return;
    try {
      await deleteMessagesBatch(ids, type);
      toast({
        title: type === 'me' ? "Deleted for You" : "Deleted for Everyone",
        description: `${ids.length} messages have been deleted.`
      });
      setSelectedMessages([]);
      if (selectedChat) loadMessages(selectedChat.chat_id);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to delete messages", variant: "destructive" });
    }
  }, [selectedChat, loadMessages, toast]);


  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat || !user) return;

    // Check file size (500MB limit)
    if (file.size > 500 * 1024 * 1024) {
      setError("File is too large. Max size is 500MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setPendingFile(file);
    // Reset file input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [selectedChat, user]);

  const handleConfirmUpload = useCallback(async (caption: string, viewOnce: boolean) => {
    if (!pendingFile || !selectedChat || !user) return;

    // Create optimistic message immediately
    const tempId = Date.now();
    const tempMessage: MessageType = {
      id: tempId,
      chatId: selectedChat.chat_id,
      senderId: user.id,
      receiverId: selectedChat.user_id,
      content: caption || (pendingFile.type.startsWith('image/') ? "Sent a photo" : `Sent a file: ${pendingFile.name}`),
      messageType: pendingFile.type.startsWith('image/') ? 'image' : 'file',
      attachmentUrl: URL.createObjectURL(pendingFile), // Temporary local URL
      attachmentName: pendingFile.name,
      createdAt: new Date().toISOString(),
      read: false,
      isDeleted: false,
      isViewOnce: viewOnce
    } as MessageType & { isUploading?: boolean };

    // Add optimistic message to UI
    setMessages(prev => [...prev, tempMessage]);
    setPendingFile(null);

    setIsLoading(true);
    try {
      const result = await uploadFile({
        receiver_id: selectedChat.user_id,
        chat_id: selectedChat.chat_id,
        file: pendingFile,
        content: caption || (pendingFile.type.startsWith('image/') ? "Sent a photo" : `Sent a file: ${pendingFile.name}`),
        is_view_once: viewOnce
      });

      // Replace optimistic message with real one
      await loadMessages(selectedChat.chat_id);
      await loadChats();
    } catch (err) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setIsLoading(false);
    }
  }, [pendingFile, selectedChat, user, loadMessages, loadChats]);

  const clearVoiceRecordingTimer = useCallback(() => {
    if (voiceTimerRef.current !== null) {
      window.clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  }, []);

  const releaseVoiceResources = useCallback(() => {
    clearVoiceRecordingTimer();
    if (voiceStreamRef.current) {
      voiceStreamRef.current.getTracks().forEach((track) => track.stop());
      voiceStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    voiceChunksRef.current = [];
  }, [clearVoiceRecordingTimer]);

  const sendVoiceBlob = useCallback(async (blob: Blob, mimeType: string) => {
    if (!selectedChat || !user) return;

    const tempId = Date.now();
    const tempUrl = URL.createObjectURL(blob);
    const extension = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
    const voiceFile = new File([blob], `voice-message-${tempId}.${extension}`, {
      type: mimeType || 'audio/webm',
    });

    const tempMessage = {
      id: tempId,
      chatId: selectedChat.chat_id,
      senderId: user.id,
      receiverId: selectedChat.user_id,
      content: 'Voice message',
      messageType: 'voice',
      attachmentUrl: tempUrl,
      attachmentName: voiceFile.name,
      createdAt: new Date().toISOString(),
      read: false,
      isDeleted: false,
      isViewOnce: false,
      isUploading: true,
    } as MessageType & { isUploading?: boolean };

    setMessages((prev) => [...prev, tempMessage]);
    setIsLoading(true);

    try {
      await uploadFile({
        receiver_id: selectedChat.user_id,
        chat_id: selectedChat.chat_id,
        file: voiceFile,
        content: 'Voice message',
      });
      await loadMessages(selectedChat.chat_id);
      await loadChats();

      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }
    } catch (err) {
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      setError(err instanceof Error ? err.message : 'Failed to send voice message');
    } finally {
      setIsLoading(false);
      URL.revokeObjectURL(tempUrl);
    }
  }, [loadChats, loadMessages, selectedChat, user]);

  const stopVoiceRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;

    setIsRecordingVoice(false);
    clearVoiceRecordingTimer();
    recorder.stop();
  }, [clearVoiceRecordingTimer]);

  const startVoiceRecording = useCallback(async () => {
    if (!selectedChat || !user) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported in this browser.');
      return;
    }

    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedMimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
      ].find((type) => MediaRecorder.isTypeSupported(type));

      const recorder = supportedMimeType ? new MediaRecorder(stream, { mimeType: supportedMimeType }) : new MediaRecorder(stream);
      voiceStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      voiceChunksRef.current = [];
      setRecordingSeconds(0);
      setIsRecordingVoice(true);

      voiceTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((current) => current + 1);
      }, 1000);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const chunks = voiceChunksRef.current.slice();
        const mimeType = recorder.mimeType || supportedMimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });

        releaseVoiceResources();

        if (blob.size === 0) {
          setError('Voice recording was empty. Please try again.');
          return;
        }

        await sendVoiceBlob(blob, mimeType);
      };

      recorder.start();
    } catch (err) {
      releaseVoiceResources();
      setIsRecordingVoice(false);
      setError(err instanceof Error ? err.message : 'Failed to start voice recording.');
    }
  }, [releaseVoiceResources, selectedChat, sendVoiceBlob, user]);

  useEffect(() => {
    return () => {
      releaseVoiceResources();
      setIsRecordingVoice(false);
      setRecordingSeconds(0);
    };
  }, [releaseVoiceResources]);

  const handleSupport = useCallback(async () => {
    try {
      setIsLoading(true);
      const { admin } = await getSupportChat();

      // Start chat with admin
      const supportChat: ChatType = {
        chat_id: `support_${user?.id}`,
        last_message: "Official Support & Notifications",
        last_message_time: new Date().toISOString(),
        user_id: admin.id,
        display_name: "Help Center",
        avatar_url: admin.avatarUrl,
        username: admin.username,
        unread_count: 0,
        verified: true,
        isOfficial: true,
      };

      setSelectedChat(supportChat);
      setSearchQuery("");
      setMessages([]);
    } catch (err) {
      toast({
        title: "Support Unavailable",
        description: err instanceof Error ? err.message : "Failed to connect to support",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    if (!selectedChat?.chat_id.startsWith("community_")) {
      setSelectedCommunity(null);
      return;
    }

    const communityId = parseInt(selectedChat.chat_id.replace("community_", ""));
    if (Number.isNaN(communityId)) {
      setSelectedCommunity(null);
      return;
    }

    let active = true;

    const loadCommunityDetails = async () => {
      try {
        const detail = await getCommunity(communityId) as CommunityDetailView;
        if (active) {
          setSelectedCommunity(detail);
        }
      } catch (err) {
        console.error("Failed to load community details:", err);
        if (active) {
          setSelectedCommunity(null);
        }
      }
    };

    loadCommunityDetails();

    return () => {
      active = false;
    };
  }, [selectedChat?.chat_id]);

  const openProfile = useCallback((username?: string) => {
    if (!username) return;
    navigate(`/profile/${encodeURIComponent(username)}`);
  }, [navigate]);

  const filteredChats = chats.filter((c) =>
    c.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading) return <LoadingScreen />;

  // Mobile: show one panel at a time
  if (isMobile) {
    return (
      <div className={`${selectedChat ? 'h-[100dvh]' : 'h-[calc(100dvh-64px)]'} overflow-hidden flex flex-col`}>
        {selectedChat ? (
          <ChatView
            selectedChat={selectedChat}
            setSelectedChat={setSelectedChat}
            isMobile={isMobile}
            navigate={navigate}
            user={user}
            messages={messages}
            error={error}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            handleSend={handleSend}
            messageInputRef={messageInputRef}
            fileInputRef={fileInputRef}
            handleFileSelect={handleFileSelect}
            onMessageDeleted={handleMessageDeleted}
            selectedMessages={selectedMessages}
            setSelectedMessages={setSelectedMessages}
            onDeleteMessagesBatch={handleDeleteMessagesBatch}
            pendingFile={pendingFile}
            setPendingFile={setPendingFile}
            handleConfirmUpload={handleConfirmUpload}
            isLoading={isLoading}
            isRecordingVoice={isRecordingVoice}
            recordingSeconds={recordingSeconds}
            startVoiceRecording={startVoiceRecording}
            stopVoiceRecording={stopVoiceRecording}
            isBlurred={isBlurred}
            setIsBlurred={setIsBlurred}
            isPreviewViewOnce={isPreviewViewOnce}
            setIsPreviewViewOnce={setIsPreviewViewOnce}
            currentAcceptType={currentAcceptType}
            setCurrentAcceptType={setCurrentAcceptType}
            botState={botState}
            setBotState={setBotState}
            botData={botData}
            setBotData={setBotData}
            setMessages={setMessages}
            selectedCommunity={selectedCommunity}
          />
        ) : (
          <ConversationList
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isSearching={isSearching}
            searchResults={searchResults}
            startChat={startChat}
            isLoading={isLoading}
            filteredChats={filteredChats}
            selectedChat={selectedChat}
            setSelectedChat={setSelectedChat}
            user={user}
            onSupport={handleSupport}
            onLogout={handleLogout}
            isMobile={isMobile}
          />
        )}
      <ProfileCompletionModal />
    </div>
  );
}

  // Desktop: side-by-side
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#050810]">
      <div className="w-80 border-r border-white/5 shrink-0 h-full overflow-hidden">

        <ConversationList
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isSearching={isSearching}
          searchResults={searchResults}
          startChat={startChat}
          isLoading={isLoading}
          filteredChats={filteredChats}
          selectedChat={selectedChat}
          setSelectedChat={setSelectedChat}
          user={user}
          onSupport={handleSupport}
          onLogout={handleLogout}
          isMobile={isMobile}
        />
      </div>
      <div className="flex-1 h-full min-h-0 overflow-hidden">
        <ChatView
          selectedChat={selectedChat}
          setSelectedChat={setSelectedChat}
          isMobile={isMobile}
          navigate={navigate}
          user={user}
          messages={messages}
          error={error}
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          handleSend={handleSend}
          messageInputRef={messageInputRef}
          fileInputRef={fileInputRef}
          handleFileSelect={handleFileSelect}
          onMessageDeleted={handleMessageDeleted}
          selectedMessages={selectedMessages}
          setSelectedMessages={setSelectedMessages}
          onDeleteMessagesBatch={handleDeleteMessagesBatch}
          pendingFile={pendingFile}
          setPendingFile={setPendingFile}
          handleConfirmUpload={handleConfirmUpload}
          isRecordingVoice={isRecordingVoice}
          recordingSeconds={recordingSeconds}
          startVoiceRecording={startVoiceRecording}
          stopVoiceRecording={stopVoiceRecording}
          currentAcceptType={currentAcceptType}
          setCurrentAcceptType={setCurrentAcceptType}
          isLoading={isLoading}
          isBlurred={isBlurred}
          setIsBlurred={setIsBlurred}
          isPreviewViewOnce={isPreviewViewOnce}
          setIsPreviewViewOnce={setIsPreviewViewOnce}
          botState={botState}
          setBotState={setBotState}
          botData={botData}
          setBotData={setBotData}
          setMessages={setMessages}
          selectedCommunity={selectedCommunity}
        />
      </div>
      <ProfileCompletionModal />
    </div>
  );
};

export default ChatPage;
