import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import EmojiPickerReact from 'emoji-picker-react';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
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
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  getChatList, getMessages, sendMessage, markMessagesAsRead, uploadFile,
  searchUsers, blockUser, reportUser, clearChatHistory, getUser,
  deleteMessage, deleteMessagesBatch, getSupportChat, openViewOnceMessage,
  getBestProfiles, getGroupChats, getGroupMessages, sendGroupMessage, leaveGroupChat,
  listCommunities, getCommunity, getCommunityMessages, sendCommunityMessage, leaveCommunity, deleteCommunityHistory,
  Chat as ChatType, Message as MessageType, AuthUser,
  BestProfileUser, getEscrowDeals, EscrowDeal
} from "@/lib/api";
import { useIsMobile } from "@/hooks/use-mobile";
import { socketService } from "@/lib/socket";
import { getCloudinaryDownloadUrl, downloadFile } from "@/lib/cloudinary";
import LoadingScreen from "@/components/ui/LoadingScreen";
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
// import FloatingCommunityButton from "@/components/FloatingCommunityButton";
import ChatOptionsBottomSheet from "@/components/chat/ChatOptionsBottomSheet";
import { MuteDurationOption } from "@/lib/chatMute";
import { useChatActions } from "@/hooks/useChatActions";

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

function getReplySnippet(msg: MessageType | LocalMessage): string {
  if (msg.isDeleted) return 'This message was deleted';
  if (msg.isViewOnce) return '📷 View Once photo';
  if (msg.messageType === 'voice') return '🎤 Voice message';
  if (msg.messageType === 'image' || msg.attachmentUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return '📷 Photo';
  if (msg.attachmentUrl) return '📎 File';
  return msg.content || '';
}

const CHAT_LIST_LONG_PRESS_MS = 600;

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
  isMobile,
  isChatMuted,
  onMuteChat,
  onUnmuteChat,
  onDeleteChat,
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
  isChatMuted: (chatId: string) => boolean;
  onMuteChat: (chatId: string, duration: MuteDurationOption) => void;
  onUnmuteChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => Promise<void>;
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(() => localStorage.getItem("show_welcome_banner") === "true");
  const [activeChatOptions, setActiveChatOptions] = useState<ChatType | null>(null);
  const [chatOptionsMode, setChatOptionsMode] = useState<'main' | 'mute'>('main');
  const [pendingDeleteChat, setPendingDeleteChat] = useState<ChatType | null>(null);
  const [pressedChatId, setPressedChatId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  useEffect(() => {
    // Removed auto-dismiss timer to prevent layout shift.
    // The banner will stay until the user manually dismisses it.
  }, [showWelcomeBanner, isMobile, searchQuery, filteredChats.length]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };
  }, []);

  const triggerHapticFeedback = useCallback(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
    }
  }, []);

  const clearLongPressState = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setPressedChatId(null);
  }, []);

  const handleChatPressStart = useCallback((chat: ChatType) => {
    clearLongPressState();
    longPressTriggeredRef.current = false;
    setPressedChatId(chat.chat_id);

    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setChatOptionsMode('main');
      setActiveChatOptions(chat);
      setPressedChatId(null);
      triggerHapticFeedback();
      longPressTimerRef.current = null;
    }, CHAT_LIST_LONG_PRESS_MS);
  }, [clearLongPressState, triggerHapticFeedback]);

  const handleChatPressEnd = useCallback(() => {
    clearLongPressState();
  }, [clearLongPressState]);

  const handleChatSelect = useCallback((chat: ChatType) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    setSelectedChat(chat);
  }, [setSelectedChat]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDeleteChat) return;
    const chat = pendingDeleteChat;

    setPendingDeleteChat(null);
    setActiveChatOptions(null);

    try {
      await onDeleteChat(chat.chat_id);
      toast({
        title: 'Chat deleted',
        description: 'Conversation removed from your chat list.',
      });
    } catch (err) {
      toast({
        title: 'Failed to delete chat',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [onDeleteChat, pendingDeleteChat, toast]);

  return (
    <div className="flex flex-col min-h-screen bg-white overflow-hidden font-dm-sans">

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
              <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                  <Icon name="X" className="h-4 w-4" />
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
              {isSearchVisible ? <Icon name="X" className="h-5 w-5" /> : <Icon name="Search" className="h-5 w-5" />}
            </Button>

            {!isSearchVisible && (
              <>
                <NotificationBell />
                {user && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 p-0 overflow-hidden border border-white/5 hover:border-blue-500/30 hover:bg-white/5 transition-all">

                        <Avatar className="h-full w-full">
                          <AvatarImage src={user.avatarUrl} loading="lazy" />
                          <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{user.displayName?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-card border-border shadow-xl rounded-xl p-1.5">
                      <div className="flex items-center gap-3 p-3 border-b border-border/50 mb-1.5 bg-secondary/30 rounded-lg">
                        <Avatar className="h-10 w-10 border border-primary/10 shadow-sm">
                          <AvatarImage src={user.avatarUrl} loading="lazy" />
                          <AvatarFallback className="bg-primary/5 text-primary font-bold">{user.displayName?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate leading-none mb-1">{user.displayName}</p>
                          <p className="text-[11px] text-muted-foreground truncate leading-none">@{user.username}</p>
                        </div>
                      </div>
                      <DropdownMenuItem onClick={() => window.location.href = '/profile'} className="rounded-md cursor-pointer">
                        <Icon name="User" className="mr-2 h-4 w-4 opacity-70" /> Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.location.href = '/wallet'} className="rounded-md cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mr-2 h-4 w-4 opacity-70">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                        </svg>
                        Wallet
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.location.href = '/settings'} className="rounded-md cursor-pointer">
                        <Icon name="Settings" className="mr-2 h-4 w-4 opacity-70" /> Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border/50" />
                      <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10 rounded-md cursor-pointer">
                        <Icon name="LogOut" className="mr-2 h-4 w-4" /> Logout
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
            <Icon name="Shield" className="w-14 h-14 text-[#00A4EF]" />
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("show_welcome_banner");
              setShowWelcomeBanner(false);
            }}
            className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-black/5 text-[#1C1C1C40] hover:text-[#1C1C1C] transition-colors z-20"
          >
            <Icon name="X" className="h-4 w-4" />
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
                      <AvatarFallback>{foundUser.displayName?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-medium text-foreground truncate">{foundUser.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">@{foundUser.username}</p>
                    </div>
                    <Icon name="Plus" className="h-4 w-4 text-muted-foreground" />
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
                handleChatSelect(chat);
              }}
              onPointerDown={() => handleChatPressStart(chat)}
              onPointerUp={handleChatPressEnd}
              onPointerLeave={handleChatPressEnd}
              onPointerCancel={handleChatPressEnd}
              onContextMenu={(e) => {
                e.preventDefault();
                setChatOptionsMode('main');
                setActiveChatOptions(chat);
              }}
              className={`w-full grid grid-cols-[48px_1fr_auto] items-center gap-3 p-4 transition-all duration-150 text-left overflow-hidden bg-white ${pressedChatId === chat.chat_id ? 'scale-[0.97]' : 'scale-100'}`}
            >
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarImage src={chat.avatar_url} loading="lazy" />
                <AvatarFallback className="bg-muted text-muted-foreground">
                  {(chat.display_name || chat.username || '?')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="font-semibold text-foreground text-[14px] truncate leading-tight">{chat.display_name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {chat.isOfficial ? (
                      <Badge variant="secondary" className="bg-primary/10 text-primary text-[9px] h-3.5 px-1 border-none flex items-center gap-0.5">
                        <Icon name="ShieldCheck" className="h-2.5 w-2.5" />
                        OFFICIAL
                      </Badge>
                    ) : chat.chat_id.startsWith('support_') ? (
                      <Badge variant="secondary" className="bg-indigo-100/80 text-indigo-700 text-[9px] h-3.5 px-1 border-none flex items-center gap-0.5 dark:bg-indigo-900/30 dark:text-indigo-400">
                        <Icon name="HelpCircle" className="h-2.5 w-2.5" />
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
                <div className="flex items-center gap-1">
                  {isChatMuted(chat.chat_id) && (
                    <Icon name="BellOff" className="h-3.5 w-3.5 text-muted-foreground/80" />
                  )}
                  <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap opacity-80">
                    {chat.last_message_time ? formatTime(chat.last_message_time) : ""}
                  </span>
                </div>
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

      <ChatOptionsBottomSheet
        open={!!activeChatOptions}
        mode={chatOptionsMode}
        isMuted={activeChatOptions ? isChatMuted(activeChatOptions.chat_id) : false}
        onClose={() => {
          setActiveChatOptions(null);
          setChatOptionsMode('main');
        }}
        onOpenMuteMenu={() => setChatOptionsMode('mute')}
        onToggleMute={() => {
          if (!activeChatOptions) return;
          onUnmuteChat(activeChatOptions.chat_id);
          setActiveChatOptions(null);
          toast({ title: 'Chat unmuted' });
        }}
        onSelectMuteDuration={(duration) => {
          if (!activeChatOptions) return;
          onMuteChat(activeChatOptions.chat_id, duration);
          setActiveChatOptions(null);
          setChatOptionsMode('main');
          toast({ title: 'Chat muted' });
        }}
        onDeleteRequest={() => {
          if (!activeChatOptions) return;
          setPendingDeleteChat(activeChatOptions);
        }}
      />

      <AlertDialog open={!!pendingDeleteChat} onOpenChange={(open) => !open && setPendingDeleteChat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the conversation from your chat list. Messages will remain for the other user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleDeleteConfirm();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
  cancelVoiceRecording,
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
  recommendationCards,
  setRecommendationCards,
  recommendationMeta,
  setRecommendationMeta,
  replyingTo,
  setReplyingTo,
  selectedCommunity,
  filteredChats,
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
  messageInputRef: React.RefObject<HTMLTextAreaElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMessageDeleted: (messageId: number, type?: 'me' | 'everyone') => void;
  selectedMessages: number[];
  setSelectedMessages: (ids: number[]) => void;
  onDeleteMessagesBatch: (ids: number[], type?: 'me' | 'everyone') => void;
  pendingFile: File | null;
  setPendingFile: (file: File | null) => void;
  handleConfirmUpload: (caption: string, viewOnce: boolean) => void;
  botState: 'IDLE' | 'AWAITING_PROFESSION' | 'AWAITING_LOCATION' | 'SEARCHING';
  setBotState: (state: 'IDLE' | 'AWAITING_PROFESSION' | 'AWAITING_LOCATION' | 'SEARCHING') => void;
  botData: { city?: string; pincode?: string; profession?: string; skills?: string[] };
  setBotData: (data: { city?: string; pincode?: string; profession?: string; skills?: string[] } | ((prev: { city?: string; pincode?: string; profession?: string; skills?: string[] }) => { city?: string; pincode?: string; profession?: string; skills?: string[] })) => void;
  setMessages: React.Dispatch<React.SetStateAction<MessageType[]>>;
  recommendationCards: Record<number, BestProfileUser[]>;
  setRecommendationCards: React.Dispatch<React.SetStateAction<Record<number, BestProfileUser[]>>>;
  recommendationMeta: Record<number, { total: number; hasMore: boolean }>;
  setRecommendationMeta: React.Dispatch<React.SetStateAction<Record<number, { total: number; hasMore: boolean }>>>;
  isLoading: boolean;
  isRecordingVoice: boolean;
  recordingSeconds: number;
  startVoiceRecording: (e?: any) => void;
  stopVoiceRecording: (e?: any) => void;
  cancelVoiceRecording: (e?: any) => void;
  isBlurred: boolean;
  setIsBlurred: (val: boolean) => void;
  isPreviewViewOnce: boolean;
  setIsPreviewViewOnce: (val: boolean) => void;
  currentAcceptType: string;
  setCurrentAcceptType: (val: string) => void;
  replyingTo: MessageType | null;
  setReplyingTo: (val: MessageType | null) => void;
  filteredChats: ChatType[];
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewSenderUsername, setPreviewSenderUsername] = useState<string | null>(null);
  const [previewCaption, setPreviewCaption] = useState<string | null>(null);
  const inputBarRef = useRef<HTMLDivElement | null>(null);
  const [inputBarHeight, setInputBarHeight] = useState(0);
  const [activeMessageMenu, setActiveMessageMenu] = useState<MessageType | null>(null);
  const [chatAd, setChatAd] = useState<Ad | null>(null);
  const [adDismissed, setAdDismissed] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const [forwardTargetMsg, setForwardTargetMsg] = useState<MessageType | null>(null);
  const swipeSlideRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const swipeStateRef = useRef<Map<number, { startX: number; currentX: number; isSwiping: boolean }>>(new Map());
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const highlightTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const [activeEscrow, setActiveEscrow] = useState<EscrowDeal | null>(null);

  const fetchActiveEscrow = useCallback(() => {
    if (!selectedChat) {
      setActiveEscrow(null);
      return;
    }
    getEscrowDeals(selectedChat.chat_id)
      .then(deals => {
        if (deals && deals.length > 0) {
          setActiveEscrow(deals[0]);
        } else {
          setActiveEscrow(null);
        }
      })
      .catch(() => setActiveEscrow(null));
  }, [selectedChat?.chat_id]);

  useEffect(() => {
    fetchActiveEscrow();
  }, [fetchActiveEscrow, messages.length]);

  const getSenderId = useCallback((msg: MessageType | LocalMessage): number | null => {
    const rawSenderId =
      msg.senderId ??
      (msg as any).sender_id ??
      (msg as any).sender?.id ??
      null;

    if (rawSenderId === null || rawSenderId === undefined) return null;

    const parsed = Number(rawSenderId);
    return Number.isFinite(parsed) ? parsed : null;
  }, []);

  const getReceiverId = useCallback((msg: MessageType | LocalMessage): number | null => {
    const rawReceiverId =
      msg.receiverId ??
      (msg as any).receiver_id ??
      (msg as any).receiver?.id ??
      null;

    if (rawReceiverId === null || rawReceiverId === undefined) return null;

    const parsed = Number(rawReceiverId);
    return Number.isFinite(parsed) ? parsed : null;
  }, []);

  const isMyMessage = useCallback((msg: MessageType | LocalMessage): boolean => {
    const myId = Number(user?.id);
    if (!Number.isFinite(myId)) return false;

    const senderId = getSenderId(msg);
    const receiverId = getReceiverId(msg);
    const senderUsername = ((msg as any).sender_username || '').trim().toLowerCase();
    const senderName = ((msg as any).sender_name || '').trim().toLowerCase();
    const myUsername = String(user?.username || '').trim().toLowerCase();
    const myDisplayName = String(user?.displayName || '').trim().toLowerCase();

    if (senderId !== null) return senderId === myId;

    if (senderUsername && myUsername) return senderUsername === myUsername;

    if (senderName && myDisplayName) return senderName === myDisplayName;

    if (receiverId !== null) return receiverId !== myId;

    return false;
  }, [getReceiverId, getSenderId, user?.displayName, user?.id, user?.username]);

  const getMessageContent = useCallback((msg: MessageType): string => {
    if (msg.isViewOnce) return '[View-Once Media]';
    if (msg.isDeleted) return '[Deleted]';
    if (msg.attachmentUrl) {
      if (msg.attachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return '[Photo]';
      if (msg.messageType === 'voice') return '[Voice Message]';
      return '[File]';
    }
    return msg.content || '';
  }, []);

  // Auto-resize the textarea based on the content of newMessage state
  useEffect(() => {
    if (messageInputRef.current) {
      messageInputRef.current.style.height = 'auto';
      if (newMessage) {
        messageInputRef.current.style.height = Math.min(messageInputRef.current.scrollHeight, 120) + 'px';
      }
    }
  }, [newMessage, messageInputRef]);

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

  // ── Swipe-to-Reply ─────────────────────────────────────────
  const SWIPE_THRESHOLD = 80;

  const handleSwipeTouchStart = (e: React.TouchEvent, msgId: number, isMine: boolean) => {
    if (isSelectionMode || replyingTo) return;
    const touch = e.touches[0];
    swipeStateRef.current.set(msgId, { startX: touch.clientX, currentX: 0, isSwiping: true });
  };

  const handleSwipeTouchMove = (e: React.TouchEvent, msgId: number, isMine: boolean) => {
    const state = swipeStateRef.current.get(msgId);
    const slideEl = swipeSlideRefs.current.get(msgId);
    if (!state || !state.isSwiping || !slideEl) return;

    const rawDelta = e.touches[0].clientX - state.startX;
    const absRaw = Math.abs(rawDelta);
    const sign = Math.sign(rawDelta);
    let effectiveDelta: number;

    const isCorrectDirection = isMine ? (rawDelta < 0) : (rawDelta > 0);

    if (!isCorrectDirection) {
      // Wrong direction: heavy damping (12%)
      effectiveDelta = rawDelta * 0.12;
    } else {
      // Correct direction: 1:1 up to threshold, then rubber-band at 30%
      const pulled = Math.min(absRaw, SWIPE_THRESHOLD) + Math.max(absRaw - SWIPE_THRESHOLD, 0) * 0.3;
      effectiveDelta = sign * pulled;
    }

    state.currentX = effectiveDelta;
    slideEl.style.transform = `translateX(${effectiveDelta}px)`;
  };

  const handleSwipeTouchEnd = (_e: React.TouchEvent, msgId: number, isMine: boolean) => {
    const state = swipeStateRef.current.get(msgId);
    const slideEl = swipeSlideRefs.current.get(msgId);
    if (!state || !slideEl) return;

    state.isSwiping = false;
    const deltaX = state.currentX;
    const passedThreshold = isMine ? deltaX <= -SWIPE_THRESHOLD : deltaX >= SWIPE_THRESHOLD;

    if (passedThreshold) {
      const msg = messages.find(m => m.id === msgId);
      if (msg && !msg.isDeleted) {
        setReplyingTo(msg);
        messageInputRef.current?.focus();
      }
    }

    slideEl.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    slideEl.style.transform = 'translateX(0px)';
    const cleanup = setTimeout(() => {
      if (slideEl) slideEl.style.transition = '';
    }, 350);
    swipeStateRef.current.delete(msgId);
  };

  const scrollToMessage = (messageId: number) => {
    if (!messagesContainerRef.current) return;
    const el = messagesContainerRef.current.querySelector(`[data-msg-id="${messageId}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      if (highlightTimersRef.current.has(messageId)) {
        clearTimeout(highlightTimersRef.current.get(messageId)!);
      }
      highlightTimersRef.current.set(
        messageId,
        setTimeout(() => {
          setHighlightedMessageId(prev => prev === messageId ? null : prev);
          highlightTimersRef.current.delete(messageId);
        }, 2000)
      );
    }
  };

  // ── End Swipe-to-Reply ─────────────────────────────────────

  const [isChatReady, setIsChatReady] = useState(false);
  const activeChatIdRef = useRef<string | null>(null);
  const initialLoadDoneRef = useRef(false);

  // Synchronously reset ready state on chat switch to prevent paint before scroll
  if (selectedChat && selectedChat.chat_id !== activeChatIdRef.current) {
    activeChatIdRef.current = selectedChat.chat_id;
    if (isChatReady) {
      setIsChatReady(false);
    }
    initialLoadDoneRef.current = false;
  }

  const isNearBottomRef = useRef(true);
  const prevMessagesRef = useRef<MessageType[]>([]);
  const prevScrollHeightRef = useRef<number>(0);
  const prevScrollTopRef = useRef<number>(0);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    prevScrollTopRef.current = scrollTop;
    prevScrollHeightRef.current = scrollHeight;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 150;
  }, []);

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (!initialLoadDoneRef.current) {
      if (messages.length > 0) {
        container.scrollTop = container.scrollHeight;
        initialLoadDoneRef.current = true;
        setIsChatReady(true);
      } else {
        setIsChatReady(true);
      }
      prevMessagesRef.current = messages;
      prevScrollHeightRef.current = container.scrollHeight;
      prevScrollTopRef.current = container.scrollTop;
      isNearBottomRef.current = true;
      return;
    }

    const prevMsgs = prevMessagesRef.current;
    prevMessagesRef.current = messages;

    if (messages.length === 0) {
      prevScrollHeightRef.current = container.scrollHeight;
      prevScrollTopRef.current = container.scrollTop;
      return;
    }

    const oldFirstMsgId = prevMsgs[0]?.id;
    const newFirstMsgId = messages[0]?.id;
    const isPrepended = oldFirstMsgId !== newFirstMsgId && messages.some(m => m.id === oldFirstMsgId);

    if (isPrepended) {
      const oldHeight = prevScrollHeightRef.current;
      const newHeight = container.scrollHeight;
      const heightDiff = newHeight - oldHeight;
      if (heightDiff > 0) {
        container.scrollTop = prevScrollTopRef.current + heightDiff;
      }
    } else if (messages.length > prevMsgs.length) {
      if (isNearBottomRef.current) {
        const isSingleNewMessage = messages.length === prevMsgs.length + 1;
        if (isSingleNewMessage) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth"
          });
        } else {
          container.scrollTop = container.scrollHeight;
        }
      }
    }

    prevScrollHeightRef.current = container.scrollHeight;
    prevScrollTopRef.current = container.scrollTop;
  }, [messages, selectedChat?.chat_id, isChatReady]);

  // Listen to media/image loads to correct scroll positioning without layout jumps
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleMediaLoad = (e: Event) => {
      if (e.target instanceof HTMLImageElement || e.target instanceof HTMLVideoElement) {
        if (isNearBottomRef.current) {
          container.scrollTop = container.scrollHeight;
        }
      }
    };

    container.addEventListener("load", handleMediaLoad, true);
    return () => {
      container.removeEventListener("load", handleMediaLoad, true);
    };
  }, []);

  // Cleanup swipe refs when chat changes
  useEffect(() => {
    swipeSlideRefs.current.clear();
    swipeStateRef.current.clear();
    highlightTimersRef.current.forEach(t => clearTimeout(t));
    highlightTimersRef.current.clear();
    setHighlightedMessageId(null);
  }, [selectedChat?.chat_id]);

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
      // after resizing, keep view attached to bottom if near bottom
      setTimeout(() => {
        const container = messagesContainerRef.current;
        if (container && isNearBottomRef.current) {
          container.scrollTop = container.scrollHeight;
        }
      }, 50);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const handleOpenViewOnce = async (msg: MessageType) => {
    if (Number(msg.senderId ?? (msg as any).sender_id) === Number(user?.id)) return; // Don't handle opening for sender (local only)
    
    // Store original values for potential rollback
    const originalAttachmentUrl = msg.attachmentUrl;
    const originalContent = msg.content;

    // Optimistically update local messages state so it is marked as opened immediately
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id
          ? {
            ...m,
            isOpened: true,
            attachmentUrl: undefined,
            content: "View Once message opened",
          }
          : m
      )
    );

    try {
      await openViewOnceMessage(msg.id);
    } catch (err) {
      console.error("Failed to open view-once message:", err);
      // Rollback on error
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? {
              ...m,
              isOpened: false,
              attachmentUrl: originalAttachmentUrl,
              content: originalContent,
            }
            : m
        )
      );
    }
  };
  if (!selectedChat) {
    return (
      <div className={`flex flex-col h-full min-h-0 items-center ${isMobile ? 'justify-start pt-20' : 'justify-center'} bg-white relative overflow-hidden`}>
        {/* Decorative background for empty state */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00A4EF]/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="text-center relative z-10 p-8">

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
    <div className={`flex flex-col h-full min-h-0 bg-whatsapp-chat relative overflow-hidden ${isBlurred ? 'blur-privacy' : ''}`} data-nocontext>
      {/* Privacy Screen Overlay - Only show when blurred and selected chat exists */}
      {isBlurred && selectedChat && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xl animate-in fade-in duration-200 pointer-events-auto">
          <div className="text-center p-6 scale-in-95 animate-in duration-300">
            <div className="bg-destructive/10 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 border 2px border-destructive/30 shadow-lg">
              <Icon name="Shield" className="h-10 w-10 text-destructive animate-pulse" />
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
      <div className="flex items-center gap-3 p-4 border-b border-[#E0E0E0] z-20 min-h-[73px] flex-shrink-0 bg-white">

        {isSelectionMode ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedMessages([])}
                className="p-1 hover:bg-secondary rounded-full transition-colors"
              >
                <Icon name="X" className="h-6 w-6 text-foreground" />
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
                    <Icon name="Trash2" className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-background border-border">
                  <DropdownMenuItem
                    onClick={() => onDeleteMessagesBatch(selectedMessages, 'me')}
                    className="cursor-pointer gap-2"
                  >
                    <Icon name="EyeOff" className="h-4 w-4" />
                    <span>Delete for Me</span>
                  </DropdownMenuItem>
                  {(user?.role === 'admin' || user?.role === 'staff' || selectedMessages.every(id => {
              const m = messages.find(msg => msg.id === id);
              return m && Number(m.senderId ?? (m as any).sender_id) === Number(user?.id);
            })) && (
                    <DropdownMenuItem
                      onClick={() => onDeleteMessagesBatch(selectedMessages, 'everyone')}
                      className="text-destructive focus:text-destructive cursor-pointer gap-2"
                    >
                      <Icon name="Trash2" className="h-4 w-4" />
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
                <Icon name="ArrowLeft" className="h-5 w-5 text-foreground" />
              </button>
            )}
            {selectedChat.chat_id.startsWith("community_") && selectedCommunity ? (
              <div
                className="shrink-0 rounded-full ring-2 ring-[#00A4EF]/10 transition-all"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedCommunity.creator?.avatarUrl} loading="lazy" />
                  <AvatarFallback>{selectedCommunity.name?.[0]?.toUpperCase() || (selectedChat.display_name || selectedChat.username || '?')[0].toUpperCase()}</AvatarFallback>
                </Avatar>
              </div>
            ) : (
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedChat.avatar_url} loading="lazy" />
                <AvatarFallback>{(selectedChat.display_name || selectedChat.username || '?')[0].toUpperCase()}</AvatarFallback>
              </Avatar>
            )}

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <h3 style={{ fontFamily: "'Syne', sans-serif" }} className="font-bold text-foreground tracking-tight truncate">{selectedChat.display_name}</h3>

                {selectedChat.isOfficial ? (
                  <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] px-1.5 border-none flex items-center gap-0.5">
                    <Icon name="ShieldCheck" className="h-3.5 w-3.5" />
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
            {selectedChat.chat_id.startsWith("community_") ? (
              <div className="flex gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" title="View Members">
                      <Icon name="User" className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="end">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">Members</h4>
                      <div className="flex flex-wrap gap-3">
                        {(selectedCommunity?.members || []).map((member) => (
                          <button
                            key={member.id}
                            onClick={() => navigate(`/${encodeURIComponent(member.user?.username ?? '')}`)}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-secondary/60 transition-colors"
                            title={member.user?.displayName || member.user?.username}
                          >
                            <Avatar className="h-12 w-12 ring-2 ring-border/40">
                              <AvatarImage src={member.user?.avatarUrl} loading="lazy" />
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
                  isLeft={selectedChat.isLeft}
                />
              </div>
            ) : !(selectedChat.isOfficial && (user?.role !== 'admin' && user?.role !== 'staff')) && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => navigate(`/${encodeURIComponent(selectedChat.username)}`)}>
                  <Icon name="User" className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/wallet/pay")}
                  title="Pay via QR"
                >
                  <Icon name="QrCode" className="h-5 w-5 text-primary" />
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
                  isLeft={selectedChat.isLeft}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Deal Status Bar */}
      {activeEscrow && (
        <div 
          onClick={() => navigate(`/deal/transaction/${activeEscrow.id}`)}
          className="bg-sky-50/90 dark:bg-sky-950/20 border-b border-sky-100 dark:border-sky-900/30 px-4 py-2 flex items-center justify-between gap-3 cursor-pointer hover:bg-sky-100/50 dark:hover:bg-sky-950/30 transition-all shrink-0"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-[#00A4EF] dark:text-sky-400 shrink-0">
              <Icon name="ShoppingBag" className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{activeEscrow.title}</p>
              <p className="text-[10px] font-semibold text-[#00A4EF] dark:text-sky-400 flex items-center gap-1.5 flex-wrap">
                <span>₹{activeEscrow.totalAmount.toLocaleString('en-IN')}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                <span className="capitalize">{activeEscrow.status.replace('_', ' ')}</span>
                {activeEscrow.shippingStatus && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                    <span className="capitalize text-slate-500">{activeEscrow.shippingStatus.replace('_', ' ')}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {activeEscrow.status === 'pending_payment' && activeEscrow.clientId === user?.id && (
              <Button size="sm" className="h-7 text-[10px] font-bold bg-[#00A4EF] hover:bg-[#0087d1] text-white rounded-lg px-2.5">
                Pay Now
              </Button>
            )}
            {activeEscrow.status === 'pending_payment' && activeEscrow.vendorId === user?.id && (
              <Badge variant="secondary" className="h-6 text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-lg">
                Awaiting Payment
              </Badge>
            )}
            {activeEscrow.status === 'active' && !activeEscrow.trackingId && activeEscrow.vendorId === user?.id && (
              <Button size="sm" className="h-7 text-[10px] font-bold bg-[#00A4EF] hover:bg-[#0087d1] text-white rounded-lg px-2.5">
                Ship Package
              </Button>
            )}
            {activeEscrow.status === 'active' && !activeEscrow.trackingId && activeEscrow.clientId === user?.id && (
              <Badge variant="secondary" className="h-6 text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-lg">
                Awaiting Shipment
              </Badge>
            )}
            {activeEscrow.status === 'active' && activeEscrow.trackingId && activeEscrow.shippingStatus === 'in_transit' && (
              <Button size="sm" className="h-7 text-[10px] font-bold bg-[#00A4EF] hover:bg-[#0087d1] text-white rounded-lg px-2.5">
                Track Order
              </Button>
            )}
            {activeEscrow.status === 'active' && activeEscrow.shippingStatus === 'delivered' && activeEscrow.clientId === user?.id && (
              <Button size="sm" className="h-7 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5">
                Confirm Receipt
              </Button>
            )}
            {activeEscrow.status === 'active' && activeEscrow.shippingStatus === 'delivered' && activeEscrow.vendorId === user?.id && (
              <Badge variant="secondary" className="h-6 text-[9px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 rounded-lg">
                Delivered
              </Badge>
            )}
            {activeEscrow.status === 'completed' && (
              <Badge variant="secondary" className="h-6 text-[9px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 rounded-lg">
                Completed
              </Badge>
            )}
            {activeEscrow.status === 'cancelled' && (
              <Badge variant="destructive" className="h-6 text-[9px] font-bold rounded-lg">
                Cancelled
              </Badge>
            )}
            <Icon name="ChevronRight" className="h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 relative overflow-hidden min-h-0 bg-transparent" data-nocontext>

        {/* Persistent Ad Banner below header (Floating to prevent Layout Shift) */}
        {!adDismissed && chatAd && selectedChat && !selectedChat.isOfficial && (
          <div className="absolute top-0 left-0 right-0 z-20 shadow-lg border-b border-white/5 bg-background/60 backdrop-blur-md animate-in slide-in-from-top-2 duration-300">
            <AdBanner
              ad={chatAd}
              onDismiss={() => {
                setAdDismissed(true);
                sessionStorage.setItem(`ad_dismissed_${selectedChat!.chat_id}`, '1');
              }}
            />
          </div>
        )}

        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 relative z-10"
          style={{ opacity: isChatReady ? 1 : 0 }}
          data-nocontext
        >
          <div
            className="px-4 pt-4 pb-2 space-y-1 chat-message-container privacy-protected"
            style={{
              marginBottom: 12
            }}
          >
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">Start a conversation</div>
            ) : (
              messages.map((rawMsg, index) => {
                const msg = rawMsg as LocalMessage;
                const _rawSenderId = (msg as any).sender_id ?? (msg as any).sender?.id ?? msg.senderId;
                const isMine = Number(_rawSenderId) === Number(user?.id) && Number(user?.id) > 0;
                const isAdminMsg = selectedChat?.isOfficial && (!isMine || (user?.role === 'admin' || user?.role === 'staff'));
                const isEscrowOrNotify = msg.messageType?.startsWith?.('escrow_') || msg.message_type?.startsWith?.('escrow_') || msg.messageType === 'notification' || msg.message_type === 'notification' || isAdminMsg;

                const isImageMsg = msg.messageType === 'image' || !!msg.attachmentUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                const hasCaption = isImageMsg && msg.content && msg.content !== "Sent a photo" && msg.content.trim() !== "";
                const isCleanImageBubble = isImageMsg && !hasCaption;

                // Date separator logic
                const currentDate = new Date(msg.createdAt).toDateString();
                const previousDate = index > 0 ? new Date(messages[index - 1].createdAt).toDateString() : null;
                const showDateSeparator = currentDate !== previousDate;

                // Sanitize plain text message content to remove stray markdown asterisks and quotes
                const sanitizedContent = (msg.content || "")
                  .replace(/\*\*(.*?)\*\*/g, '$1')
                  .replace(/\*(.*?)\*/g, '$1')
                  .replace(/[\u201C\u201D\"]/g, '')
                  .trim();

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
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          data-msg-id={msg.id}
                          data-senderid={_rawSenderId}
                          data-userid={user?.id}
                          data-ismine={isMine ? 'true' : 'false'}
                          className={`w-full flex items-center gap-2 group relative chat-message privacy-protected ${selectedMessages.includes(msg.id) ? "bg-primary/10 -mx-4 px-4 py-1" : ""}`}
                          style={{ justifyContent: isMine ? 'flex-end' : 'flex-start' }}
                          onClick={() => handleMessageClick(msg)}
                          onTouchStart={() => onTouchStart(msg)}
                          onTouchEnd={onTouchEnd}
                          onContextMenu={(e) => {
                            if (isMobile) {
                              e.preventDefault();
                              if (!isSelectionMode) {
                                setActiveMessageMenu(msg);
                              } else {
                                toggleMessageSelection(msg.id);
                              }
                            }
                          }}
                          data-nocontext
                        >
                          {isSelectionMode && (
                            <div className={`absolute ${isMine ? "left-2" : "right-2"} z-10`}>
                              <div className={`h-5 w-5 rounded-full border-2 ${selectedMessages.includes(msg.id) ? "bg-primary border-primary flex items-center justify-center" : "border-muted-foreground"}`}>
                                {selectedMessages.includes(msg.id) && <Icon name="CheckCircle2" className="h-3 w-3 text-primary-foreground" />}
                              </div>
                            </div>
                          )}
                          {!msg.isDeleted && !isSelectionMode && !isMobile && (
                            <div className={`opacity-0 group-hover:opacity-100 transition-opacity ${isMine ? "order-first" : "order-last"}`}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-secondary">
                                    <Icon name="MoreVertical" className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={isMine ? "end" : "start"} className="w-56 bg-card border-border">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setReplyingTo(msg);
                                      messageInputRef.current?.focus();
                                    }}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Icon name="Reply" className="h-4 w-4" /> Reply
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setForwardTargetMsg(msg);
                                    }}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Icon name="Forward" className="h-4 w-4" /> Forward
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(getMessageContent(msg));
                                      toast({ title: "Copied to clipboard" });
                                    }}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Icon name="Copy" className="h-4 w-4" /> Copy
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleMessageSelection(msg.id);
                                    }}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Icon name="CheckCircle2" className="h-4 w-4" /> Select
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onMessageDeleted(msg.id, 'me');
                                    }}
                                    className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                                  >
                                    <Icon name="EyeOff" className="h-4 w-4" /> Delete for Me
                                  </DropdownMenuItem>
                                  {(isMine || user?.role === 'admin') && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onMessageDeleted(msg.id, 'everyone');
                                      }}
                                      className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                                    >
                                      <Icon name="Trash2" className="h-4 w-4" /> Delete for Everyone
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                      <div
                        className={`max-w-[85%] rounded-2xl relative privacy-protected overflow-hidden ${highlightedMessageId === msg.id ? 'animate-message-highlight' : ''}`}
                        style={{ marginLeft: isMine ? 'auto' : undefined, marginRight: !isMine ? 'auto' : undefined }}
                      >
                        {/* Reply icon background for swipeable messages - hidden at rest, revealed during swipe */}
                        {!isEscrowOrNotify && !msg.isViewOnce && !msg.isDeleted && !msg.isUploading && (
                          <div className={`absolute inset-0 flex items-center z-0 rounded-2xl bg-[#00A4EF]/10 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <Icon name="Reply" className={`h-5 w-5 text-[#00A4EF] ${isMine ? 'mr-3' : 'ml-3'}`} />
                          </div>
                        )}

                        {/* Sliding bubble - has all original styling (bg, padding, corners) */}
                        <div
                          className={`
                            relative z-[1] rounded-2xl
                            ${isCleanImageBubble ? 'p-[3px]' : 'px-4 py-3'}
                            ${isMine
                              ? (isEscrowOrNotify ? "" : isCleanImageBubble ? "bg-[#d9fdd3] text-[#1c1c1c] rounded-br-md border border-[#d9fdd3]" : "bg-[#00A4EF] text-white rounded-br-md")
                              : (isEscrowOrNotify ? "" : isCleanImageBubble ? "bg-white text-[#1C1C1C] rounded-bl-md border border-gray-100/50" : "bg-[#F5F5F5] text-[#1C1C1C] rounded-bl-md")
                            }
                            ${msg.isDeleted ? "opacity-60 italic" : ""}
                            ${isEscrowOrNotify ? (
                              (msg.messageType === 'escrow_released' || msg.message_type === 'escrow_released')
                                ? "bg-[#E7F8F2] text-[#0B8C62] shadow-sm border border-[#0FB881]/20 rounded-2xl"
                                : (msg.messageType === 'notification' || msg.message_type === 'notification' || isAdminMsg)
                                  ? (isAdminMsg ? (msg.color ? "" : "bg-[#E6F6FE] text-[#007BB5] shadow-sm border border-[#00A4EF]/20 rounded-2xl") : "bg-[#FFF0EB] text-[#C43E00] shadow-sm border border-[#FF9800]/20 rounded-2xl")
                                  : "bg-[#E6F6FE] text-[#007BB5] shadow-sm border border-[#00A4EF]/20 rounded-2xl"
                            ) : ""}
                          `}
                          ref={(el) => { if (el) swipeSlideRefs.current.set(msg.id, el); }}
                          onTouchStart={(e) => {
                            if (!isEscrowOrNotify && !msg.isViewOnce && !msg.isDeleted && !msg.isUploading) {
                              handleSwipeTouchStart(e, msg.id, isMine);
                            }
                          }}
                          onTouchMove={(e) => {
                            if (!isEscrowOrNotify && !msg.isViewOnce && !msg.isDeleted && !msg.isUploading) {
                              handleSwipeTouchMove(e, msg.id, isMine);
                            }
                          }}
                          onTouchEnd={(e) => {
                            if (!isEscrowOrNotify && !msg.isViewOnce && !msg.isDeleted && !msg.isUploading) {
                              handleSwipeTouchEnd(e, msg.id, isMine);
                            }
                          }}
                          style={{
                            touchAction: 'pan-y',
                            ...(isEscrowOrNotify && isAdminMsg && msg.color ? {
                              background: "#FFFFFF",
                              boxShadow: `0 0 0 1px #E0E0E0, 0 4px 12px ${msg.color}15`,
                              borderLeft: `3px solid ${msg.color}`,
                              borderRadius: '14px'
                            } : isEscrowOrNotify && isAdminMsg && !msg.color ? {
                              background: "#FFFFFF",
                              boxShadow: `0 0 0 1px #E0E0E0`,
                              borderLeft: `3px solid #00A4EF`,
                              borderRadius: '14px'
                            } : {})
                          }}
                        >
                          {/* WhatsApp-Style Reply Preview Banner */}
                          {msg.parentMessageId && msg.replyToText && (() => {
                            const parentMsg = messages.find(m => m.id === msg.parentMessageId);
                            const replyName = parentMsg
                              ? (Number(parentMsg.senderId ?? (parentMsg as any).sender_id) === Number(user?.id) ? 'You' : (parentMsg.sender_name || selectedChat?.display_name || 'Unknown'))
                              : (msg.replyToUser || 'Unknown');
                            const replySnippet = parentMsg ? getReplySnippet(parentMsg) : msg.replyToText;
                            return (
                              <div
                                onClick={() => scrollToMessage(msg.parentMessageId!)}
                                className={`cursor-pointer mb-2 p-2 rounded-lg text-xs flex flex-col border-l-[3px] text-left selection:bg-transparent transition-colors ${
                                  isMine
                                    ? 'bg-white/15 border-white hover:bg-white/25'
                                    : 'bg-neutral-100/90 border-[#0099ff] hover:bg-neutral-200/80'
                                }`}
                              >
                                <span className={`font-semibold tracking-wide text-[11px] mb-0.5 ${
                                  isMine ? 'text-white' : 'text-[#0099ff]'
                                }`}>
                                  {replyName}
                                </span>
                                <span className={`truncate max-w-full font-normal ${
                                  isMine ? 'text-white/90' : 'text-neutral-600'
                                }`}>
                                  {replySnippet}
                                </span>
                              </div>
                            );
                          })()}

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
                                    setPreviewCaption(msg.content && msg.content !== "Sent a photo" && msg.content !== "File shared" ? msg.content : null);
                                    handleOpenViewOnce(msg);
                                  }
                                }
                              }}
                            >
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isMine ? 'bg-white/20' : 'bg-[#00A4EF]/10 text-[#00A4EF]'}`}>
                                {msg.isOpened ? <Icon name="EyeOff" className="h-4 w-4" /> : <Icon name="Eye" className="h-4 w-4" />}
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
                                    ? <Icon name="Plus" className="h-4 w-4 text-[#00A4EF]" />
                                    : (msg.messageType === 'escrow_released' || msg.message_type === 'escrow_released')
                                      ? <Icon name="IndianRupee" className="h-4 w-4 text-[#0FB881]" />
                                      : <Icon name="ShieldCheck" className="h-4 w-4 text-[#00A4EF]" />
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
                                {isAdminMsg && msg.content.startsWith('__REC__') ? (
                                  <RecommendationCards
                                    cards={recommendationCards[msg.id] || []}
                                    meta={recommendationMeta[msg.id]}
                                    navigate={navigate}
                                    username={selectedChat?.username || ''}
                                  />
                                ) : isAdminMsg ? (
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
                                  : sanitizedContent
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
                                    ? "border-emerald-500/30 text-[#0b8c62] hover:bg-emerald-500/10"
                                    : "border-[#00a4ef]/30 text-black hover:bg-black/5"
                                    }`}
                                >
                                  View Details <Icon name="ArrowLeft" className="h-3.5 w-3.5 rotate-180 text-black" />
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
                                  <Icon name="MoreVertical" className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] opacity-70">
                                <Icon name="Mic" className="h-3.5 w-3.5" />
                                Voice message
                              </div>
                              <audio
                                controls
                                src={msg.attachmentUrl}
                                className="w-full max-w-[280px]"
                              />
                            </div>
                          ) : (
                            <>
                              {msg.attachmentUrl && !msg.isDeleted && !msg.isViewOnce && msg.messageType !== 'voice' && (
                                <div className={`${isCleanImageBubble ? 'mt-0 p-0 w-full' : 'mt-2 p-2 bg-black/10 rounded-lg'} flex items-center gap-2`}>
                                  {isImageMsg ? (
                                    <div
                                      className="cursor-pointer hover:opacity-90 transition-opacity relative privacy-protected w-full"
                                      onContextMenu={(e) => e.preventDefault()}
                                      onClick={() => {
                                        setIsPreviewViewOnce(false);
                                        setPreviewImage(msg.attachmentUrl || null);
                                        setPreviewSenderUsername(isMine ? user?.username : selectedChat.username);
                                        setPreviewCaption(msg.content && msg.content !== "Sent a photo" && msg.content !== "File shared" ? msg.content : null);
                                      }}
                                    >
                                      <img src={msg.attachmentUrl} alt="attachment" className={`max-w-full rounded-[13px] h-48 object-cover shadow-sm select-none pointer-events-none ${isCleanImageBubble ? 'w-full h-auto max-h-[384px] min-h-[120px] bg-neutral-200/20' : 'border border-white/10'}`} />
                                      {msg.isUploading && (
                                        <div className="absolute inset-0 bg-black/40 rounded-[13px] flex items-center justify-center backdrop-blur-sm">
                                          <Icon name="Loader2" className="h-8 w-8 text-white animate-spin" />
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      <Icon name="FileText" className="h-5 w-5 shrink-0" />
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          downloadFile(msg.attachmentUrl || "", msg.attachmentName || "download");
                                        }}
                                        className="text-xs underline truncate hover:text-primary transition-colors flex items-center gap-1"
                                      >
                                        {msg.attachmentName || 'Download File'}
                                        <Icon name="Download" className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                              {!isCleanImageBubble && msg.content && (
                                <p className="text-sm mt-2">{msg.content}</p>
                              )}
                            </>
                          )}
                          <p
                            className={
                              isCleanImageBubble
                                ? "absolute bottom-2 right-2 text-[10px] text-white bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-[2px] flex items-center gap-1 z-10 select-none pointer-events-none font-sans"
                                : `text-[10px] mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`
                            }
                          >
                            {formatTime(msg.createdAt)}
                            {isMine && (
                              <span className={msg.read ? "text-[#53bdeb] font-bold" : "text-white/60 font-bold"}>
                                {msg.read ? " ✓✓" : " ✓"}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-card border-border">
                        <ContextMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => { setReplyingTo(msg); messageInputRef.current?.focus(); }}
                        >
                          <Icon name="Reply" className="h-4 w-4" /> Reply
                        </ContextMenuItem>
                        <ContextMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => setForwardTargetMsg(msg)}
                        >
                          <Icon name="Forward" className="h-4 w-4" /> Forward
                        </ContextMenuItem>
                        <ContextMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => {
                            navigator.clipboard.writeText(getMessageContent(msg));
                            toast({ title: "Copied to clipboard" });
                          }}
                        >
                          <Icon name="Copy" className="h-4 w-4" /> Copy
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => toggleMessageSelection(msg.id)}
                        >
                          <Icon name="CheckCircle2" className="h-4 w-4" /> Select
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                          onClick={() => onMessageDeleted(msg.id, 'me')}
                        >
                          <Icon name="EyeOff" className="h-4 w-4" /> Delete for Me
                        </ContextMenuItem>
                        {(isMine || user?.role === 'admin') && (
                          <ContextMenuItem
                            className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                            onClick={() => onMessageDeleted(msg.id, 'everyone')}
                          >
                            <Icon name="Trash2" className="h-4 w-4" /> Delete for Everyone
                          </ContextMenuItem>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>
      </div>

      {/* Reply Preview */}
      {replyingTo && (
        <div className="flex-shrink-0 px-3 pt-2 animate-in slide-in-from-bottom-2 duration-200">
          <div className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
            <div className="flex items-stretch">
              <div className="w-1 shrink-0 bg-[#00A4EF]" />
              <div className="flex-1 min-w-0 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-[#00A4EF] uppercase tracking-wider">
                    {Number(replyingTo.senderId ?? (replyingTo as any).sender_id) === Number(user?.id) ? 'You' : (replyingTo.sender_name || selectedChat?.display_name || 'Unknown')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {replyingTo.messageType === 'voice' && <Icon name="Mic" className="h-3 w-3 text-muted-foreground shrink-0" />}
                  {replyingTo.isViewOnce && <Icon name="Eye" className="h-3 w-3 text-muted-foreground shrink-0" />}
                  {replyingTo.attachmentUrl && replyingTo.messageType !== 'voice' && !replyingTo.isViewOnce && (
                    replyingTo.attachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                      ? <Icon name="Image" className="h-3 w-3 text-muted-foreground shrink-0" />
                      : <Icon name="FileText" className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  <p className="text-[12px] text-muted-foreground truncate">
                    {replyingTo.isDeleted
                      ? 'This message was deleted'
                      : replyingTo.messageType === 'voice'
                        ? '🎤 Voice message'
                        : replyingTo.isViewOnce
                          ? '📷 View Once photo'
                          : replyingTo.messageType === 'image' || replyingTo.attachmentUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                            ? '📷 Photo'
                            : replyingTo.attachmentUrl
                              ? '📎 File'
                              : replyingTo.content || ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="shrink-0 px-3 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Icon name="X" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div
        ref={inputBarRef}
        className="p-3 bg-transparent flex-shrink-0"
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
                  id: Date.now() + 1,
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
                if (val === 'Other') {
                  setNewMessage('');
                  setTimeout(() => messageInputRef.current?.focus(), 50);
                } else {
                  setNewMessage(val);
                }
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

        {selectedChat?.isOfficial && botState === 'AWAITING_LOCATION' && (
          <div className="flex flex-col gap-2 mb-3 max-w-[320px]">
            <p className="text-[10px] text-muted-foreground font-medium px-1">City or Pincode (optional):</p>
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="e.g. Mumbai or 400001"
                className="h-9 bg-card border-border rounded-xl text-sm flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter' && newMessage.trim()) handleSend(); }}
              />
              <Button
                onClick={handleSend}
                size="sm"
                className="bg-primary hover:bg-primary/90 rounded-xl"
                disabled={!newMessage.trim()}
              >
                Search
              </Button>
            </div>
            {(user?.city || user?.pincode) && (
              <button
                onClick={() => {
                  setBotData(prev => ({ ...prev, city: user.city, pincode: user.pincode }));
                  setBotState('SEARCHING');
                }}
                className="text-[10px] text-primary font-semibold hover:underline flex items-center gap-1 self-start"
              >
                <Icon name="MapPin" className="w-3 h-3" /> Use my location{user?.city ? ` (${user.city}${user?.pincode ? `, ${user.pincode}` : ''})` : ''}
              </button>
            )}
          </div>
        )}

        {botState !== 'IDLE' && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest font-bold text-primary animate-pulse flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Bot: {botState === 'AWAITING_PROFESSION' ? "Awaiting Profession..." : botState === 'AWAITING_LOCATION' ? "Awaiting Location..." : "Searching Profiles..."}
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
                <Icon name="Sparkles" className="h-4 w-4" />
                Upgrade Now
              </button>
            )}
          </div>
        )}
        {selectedChat?.isLeft ? (
          <div className="w-full p-4 bg-muted text-center rounded-2xl border border-border">
            <p className="text-sm font-medium text-muted-foreground">You left this group. You can no longer send messages.</p>
          </div>
        ) : (
        <div className="flex items-end gap-2 w-full">
          {/* Main Pill-Shaped Container */}
          <div className="flex-1 flex items-end bg-white dark:bg-slate-800 rounded-[24px] min-h-[48px] py-1 pl-1 pr-1 gap-1 shadow-[0_1px_1px_rgba(0,0,0,0.1)] relative min-w-0 border border-border/20">

            {/* Hidden native input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept={currentAcceptType}
            />

            {/* Voice recording indicators inside pill */}
            {isRecordingVoice ? (
              <div className="flex-1 flex items-center justify-between px-3 h-[40px]">
                <div className="flex items-center gap-2 text-destructive">
                  <span className="h-2 w-2 rounded-full bg-destructive animate-pulse shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {formatRecordingDuration(recordingSeconds)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={cancelVoiceRecording}
                  className="text-xs font-extrabold text-destructive hover:underline z-10 relative cursor-pointer px-2 py-1"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                {/* Smiley/Sticker/Emoji button */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center justify-center h-10 w-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors active:scale-95 shrink-0"
                      title="Emojis"
                    >
                      <Icon name="Smile" className="h-[22px] w-[22px]" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" sideOffset={10} className="p-0 border-none bg-transparent shadow-none w-auto">
                    <EmojiPickerReact
                      onEmojiClick={(emojiData) => setNewMessage(newMessage + emojiData.emoji)}
                    />
                  </PopoverContent>
                </Popover>

                {/* Message Input */}
                <textarea
                  ref={messageInputRef}
                  className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-1 py-2.5 text-[16px] leading-5 text-[#1C1C1C] dark:text-white placeholder:text-muted-foreground min-w-0 min-h-[40px] max-h-[120px] resize-none overflow-y-auto"
                  placeholder="Message"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  autoComplete="off"
                />

                {/* Paperclip attachment icon */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center justify-center h-10 w-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors active:scale-95 shrink-0"
                      title="Attach"
                    >
                      <Icon name="Paperclip" className="h-[22px] w-[22px] -rotate-45" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 bg-card border-border shadow-xl rounded-xl p-1 mb-2">
                    <DropdownMenuItem
                      onClick={() => {
                        setCurrentAcceptType("image/*,video/*");
                        setTimeout(() => fileInputRef.current?.click(), 50);
                      }}
                      className="cursor-pointer py-2 rounded-lg"
                    >
                      <Icon name="Image" className="h-4 w-4 mr-2" />
                      <span>Gallery</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setCurrentAcceptType(".pdf,.doc,.docx,.txt,.zip,.rar");
                        setTimeout(() => fileInputRef.current?.click(), 50);
                      }}
                      className="cursor-pointer py-2 rounded-lg"
                    >
                      <Icon name="FileText" className="h-4 w-4 mr-2" />
                      <span>Document</span>
                    </DropdownMenuItem>
                    {selectedChat && !selectedChat.isOfficial && (
                      <DropdownMenuItem
                        onClick={() => navigate(`/escrow?chatId=${selectedChat.chat_id}&vendorId=${selectedChat.user_id}&vendorUsername=${selectedChat.username}`)}
                        className="cursor-pointer py-2 rounded-lg text-[#00A4EF] focus:bg-[#00A4EF]/5 focus:text-[#00A4EF]"
                      >
                        <Icon name="Wallet" className="h-4 w-4 mr-2" />
                        <span>Create Escrow Deal</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>

          {/* Send / Stop Voice Button outside the pill */}
          <button
            onClick={newMessage.trim() ? handleSend : (isRecordingVoice ? stopVoiceRecording : startVoiceRecording)}
            className={`flex items-center justify-center h-[48px] w-[48px] rounded-full bg-[#00A4EF] hover:bg-[#007BB5] text-white transition-transform active:scale-90 shrink-0 shadow-sm ${isRecordingVoice ? "animate-pulse bg-destructive hover:bg-destructive" : ""}`}
            title={newMessage.trim() ? "Send Message" : (isRecordingVoice ? "Stop Recording" : "Voice Note")}
          >
            {newMessage.trim() ? (
              <Icon name="Send" className="h-5 w-5 text-white ml-1" />
            ) : isRecordingVoice ? (
              <Icon name="Square" className="h-5 w-5 fill-white" />
            ) : (
              <Icon name="Mic" className="h-[22px] w-[22px] text-white" />
            )}
          </button>
        </div>
        )}
      </div>

      {/* Modals outside flex flow */}
      <Dialog open={!!previewImage} onOpenChange={(open) => {
        if (!open) {
          setPreviewImage(null);
          setPreviewCaption(null);
        }
      }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
          <div className="relative group overflow-auto max-h-[90vh] flex flex-col">
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

            {/* Caption Display */}
            {previewCaption && (
              <div className="mt-4 px-4 py-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg max-w-full">
                <p className="text-sm text-foreground break-words whitespace-pre-wrap">{previewCaption}</p>
              </div>
            )}

            <div className="absolute top-4 right-4 flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full bg-black/50 hover:bg-black/70 border-none text-white h-10 w-10 shadow-lg backdrop-blur-sm"
                onClick={() => {
                  setPreviewImage(null);
                  setPreviewCaption(null);
                }}
              >
                <Icon name="ArrowLeft" className="h-5 w-5 rotate-180" />
              </Button>
              {!isPreviewViewOnce && (
                <button
                  onClick={() => {
                    const filename = messages.find(m => m.attachmentUrl === previewImage)?.attachmentName || "download";
                    downloadFile(previewImage || "", filename);
                  }}
                  className="flex items-center justify-center h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-transform active:scale-95"
                >
                  <Icon name="Download" className="h-5 w-5" />
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
            <Button
              variant="ghost"
              className="w-full justify-start text-foreground hover:bg-secondary h-14 text-lg font-semibold rounded-2xl px-6"
              onClick={() => {
                if (activeMessageMenu && !activeMessageMenu.isDeleted) {
                  setReplyingTo(activeMessageMenu);
                  messageInputRef.current?.focus();
                }
                setActiveMessageMenu(null);
              }}
            >
              <Icon name="Reply" className="mr-4 h-6 w-6" /> Reply
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-foreground hover:bg-secondary h-14 text-lg font-semibold rounded-2xl px-6"
              onClick={() => {
                if (activeMessageMenu) setForwardTargetMsg(activeMessageMenu);
                setActiveMessageMenu(null);
              }}
            >
              <Icon name="Forward" className="mr-4 h-6 w-6" /> Forward
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-foreground hover:bg-secondary h-14 text-lg font-semibold rounded-2xl px-6"
              onClick={() => {
                if (activeMessageMenu) {
                  navigator.clipboard.writeText(getMessageContent(activeMessageMenu));
                  toast({ title: "Copied to clipboard" });
                }
                setActiveMessageMenu(null);
              }}
            >
              <Icon name="Copy" className="mr-4 h-6 w-6" /> Copy
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-foreground hover:bg-secondary h-14 text-lg font-semibold rounded-2xl px-6"
              onClick={() => {
                if (activeMessageMenu) toggleMessageSelection(activeMessageMenu.id);
                setActiveMessageMenu(null);
              }}
            >
              <Icon name="CheckCircle2" className="mr-4 h-6 w-6" /> Select
            </Button>
            {!activeMessageMenu?.isDeleted && (
              <>
                <div className="border-t border-border my-2" />
                <Button
                  variant="ghost"
                  className="w-full justify-start text-foreground hover:bg-secondary h-14 text-lg font-semibold rounded-2xl px-6"
                  onClick={() => {
                    if (activeMessageMenu) onMessageDeleted(activeMessageMenu.id, 'me');
                    setActiveMessageMenu(null);
                  }}
                >
                  <Icon name="EyeOff" className="mr-4 h-6 w-6" /> Delete for Me
                </Button>

                {(activeMessageMenu && Number(activeMessageMenu.senderId ?? (activeMessageMenu as any).sender_id) === Number(user?.id) || user?.role === 'admin') && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 h-14 text-lg font-semibold rounded-2xl px-6"
                    onClick={() => {
                      if (activeMessageMenu) onMessageDeleted(activeMessageMenu.id, 'everyone');
                      setActiveMessageMenu(null);
                    }}
                  >
                    <Icon name="Trash2" className="mr-4 h-6 w-6" /> Delete for Everyone
                  </Button>
                )}
              </>
            )}
            <DrawerClose asChild>
              <Button
                variant="secondary"
                className="w-full h-14 text-lg font-semibold rounded-2xl px-6 bg-secondary text-secondary-foreground"
              >
                <Icon name="X" className="mr-4 h-6 w-6" /> Cancel
              </Button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Forward Dialog */}
      <Dialog open={!!forwardTargetMsg} onOpenChange={(open) => !open && setForwardTargetMsg(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-center">Forward message</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-1 -mx-6 px-6">
            {filteredChats.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No chats to forward to</p>
            ) : (
              filteredChats.map((chat) => {
                const displayName = chat.display_name || chat.username || `User ${chat.user_id}`;
                return (
                  <button
                    key={chat.chat_id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary transition-colors text-left"
                    onClick={async () => {
                      try {
                        const content = forwardTargetMsg
                          ? getMessageContent(forwardTargetMsg)
                          : '';
                        if (forwardTargetMsg && content) {
                          await sendMessage({
                            receiver_id: chat.user_id,
                            chat_id: chat.chat_id,
                            content,
                            message_type: forwardTargetMsg.attachmentUrl ? 'image' : 'text',
                            parent_message_id: undefined,
                          });
                          toast({ title: `Forwarded to ${displayName}` });
                        }
                      } catch (err) {
                        toast({
                          title: 'Failed to forward',
                          description: err instanceof Error ? err.message : 'Unknown error',
                          variant: 'destructive',
                        });
                      }
                      setForwardTargetMsg(null);
                    }}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={chat.avatar_url || undefined} />
                      <AvatarFallback className="bg-[#00A4EF]/10 text-[#00A4EF] text-sm font-bold">
                        {(displayName[0] || '?').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{displayName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">@{chat.username}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
};

const RecommendationCards = ({ cards, meta, navigate, username }: {
  cards: BestProfileUser[];
  meta?: { total: number; hasMore: boolean };
  navigate: ReturnType<typeof useNavigate>;
  username: string;
}) => {
  if (cards.length === 0) return null;
  return (
    <div className="space-y-2 py-1">
      <p className="text-xs font-bold opacity-80 mb-2">
        {meta?.total || cards.length} matching profile{cards.length !== 1 ? 's' : ''}
        {meta?.hasMore ? ` (${meta.total - cards.length} more)` : ''}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {cards.slice(0, 6).map(user => (
          <div
            key={user.id}
            onClick={() => navigate(`/${user.username}`)}
            className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl p-2.5 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all active:scale-[0.97]"
          >
            <Avatar className="h-10 w-10 shrink-0 ring-2 ring-slate-100">
              <AvatarImage src={user.avatarUrl || undefined} loading="lazy" />
              <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-bold">
                {(user.displayName || user.username)[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-900 truncate leading-tight">
                {user.displayName || user.username}
              </p>
              <p className="text-[9px] text-slate-500 truncate leading-tight">
                {user.profession || ''}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                {user.verified && (
                  <span className="text-[8px] bg-blue-100 text-blue-600 font-bold px-1 rounded">✓</span>
                )}
                {user.avgRating > 0 && (
                  <span className="text-[8px] text-amber-600 font-bold">★{user.avgRating}</span>
                )}
                {user.score > 0 && (
                  <span className="text-[8px] text-green-600 font-medium">{Math.round(user.score * 100)}%</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {cards.length > 6 && (
        <p className="text-[10px] text-blue-600 font-semibold text-center pt-1">
          +{cards.length - 6} more profiles
        </p>
      )}
    </div>
  );
};

const ChatMoreMenu = ({
  chatId,
  userInfo,
  onChatCleared,
  isLeft
}: {
  chatId: string;
  userInfo: { id: number, displayName: string };
  onChatCleared: () => void;
  isLeft?: boolean;
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isLeaveGroupDialogOpen, setIsLeaveGroupDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isCommunity = chatId.startsWith('community_');

  const handleLeaveGroup = async () => {
    setIsLoading(true);
    try {
      if (chatId.startsWith('community_')) {
        const communityId = parseInt(chatId.split('_')[1], 10);
        await leaveCommunity(communityId);
      } else if (chatId.startsWith('group_')) {
        const groupId = parseInt(chatId.split('_')[1], 10);
        await leaveGroupChat(groupId);
      }
      toast({ title: "Left Group", description: "You have left the group chat." });
      onChatCleared();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to leave group", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsLeaveGroupDialogOpen(false);
    }
  };

  const handleClearHistory = async () => {
    setIsLoading(true);
    try {
      if (isCommunity && isLeft) {
        const communityId = parseInt(chatId.split('_')[1], 10);
        await deleteCommunityHistory(communityId);
        toast({ title: "Chat Deleted", description: "The group chat has been removed from your list." });
      } else {
        await clearChatHistory(chatId);
        toast({ title: "History Cleared", description: "All messages in this chat have been deleted." });
      }
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
            <Icon name="MoreVertical" className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-card border-border">
          {(!isCommunity && !chatId.startsWith('group_') || isLeft) && (
            <DropdownMenuItem onClick={() => setIsClearDialogOpen(true)} className={isCommunity && isLeft ? "text-destructive focus:text-destructive" : "text-foreground"}>
              <Icon name="Trash2" className="mr-2 h-4 w-4" /> {isCommunity && isLeft ? "Delete Chat" : "Clear History"}
            </DropdownMenuItem>
          )}
          {(!isCommunity && !chatId.startsWith('group_') || isLeft) && <DropdownMenuSeparator />}
          {isCommunity || chatId.startsWith('group_') ? (
            !isLeft && (
              <DropdownMenuItem onClick={() => setIsLeaveGroupDialogOpen(true)} className="text-destructive focus:text-destructive">
                <Icon name="LogOut" className="mr-2 h-4 w-4" /> Leave Group
              </DropdownMenuItem>
            )
          ) : (
            <>
              <DropdownMenuItem onClick={() => setIsBlockDialogOpen(true)} className="text-destructive focus:text-destructive">
                <Icon name="Ban" className="mr-2 h-4 w-4" /> Block User
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsReportDialogOpen(true)} className="text-foreground">
                <Icon name="AlertTriangle" className="mr-2 h-4 w-4" /> Report User
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Leave Group Dialog */}
      <AlertDialog open={isLeaveGroupDialogOpen} onOpenChange={setIsLeaveGroupDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Collab Group?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this collab group? You will no longer receive messages from this group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isLoading ? "Leaving..." : "Leave Group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear History / Delete Chat Dialog */}
      <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>{isCommunity && isLeft ? "Delete Chat?" : "Clear Chat History?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isCommunity && isLeft 
                ? "This will permanently remove this group chat from your list. You will not be able to see its messages anymore." 
                : "This will permanently delete all messages in this conversation for both participants. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isLoading ? (isCommunity && isLeft ? "Deleting..." : "Clearing...") : (isCommunity && isLeft ? "Delete Chat" : "Clear Everything")}
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


  const [chats, setChats] = useState<ChatType[]>(() => {
    try {
      const cached = localStorage.getItem("cached_chats");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AuthUser[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [botState, setBotState] = useState<'IDLE' | 'AWAITING_PROFESSION' | 'AWAITING_LOCATION' | 'SEARCHING'>('IDLE');
  const [botData, setBotData] = useState<{ city?: string; pincode?: string; profession?: string; skills?: string[] }>({});
  const [recommendationCards, setRecommendationCards] = useState<Record<number, BestProfileUser[]>>({});
  const [recommendationMeta, setRecommendationMeta] = useState<Record<number, { total: number; hasMore: boolean }>>({});
  const [error, setError] = useState("");
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<BlobPart[]>([]);
  const voiceTimerRef = useRef<number | null>(null);
  const [currentAcceptType, setCurrentAcceptType] = useState<string>("image/*,.pdf,.doc,.docx,.txt,.zip,.rar");
  const [selectedMessages, setSelectedMessages] = useState<number[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [replyingTo, setReplyingTo] = useState<MessageType | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isBlurred, setIsBlurred] = useState(false);
  const [isPreviewViewOnce, setIsPreviewViewOnce] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<CommunityDetailView | null>(null);

  const wrappedClearChatHistory = useCallback(async (chatId: string) => {
    if (chatId.startsWith('community_')) {
      const communityId = parseInt(chatId.split('_')[1], 10);
      return deleteCommunityHistory(communityId);
    }
    if (chatId.startsWith('group_')) {
      const groupId = parseInt(chatId.split('_')[1], 10);
      return leaveGroupChat(groupId);
    }
    return clearChatHistory(chatId);
  }, []);

  const {
    isChatMuted,
    muteChat,
    unmuteChat,
    deleteChat,
  } = useChatActions({
    clearChatHistory: wrappedClearChatHistory,
    setChats,
    setSelectedChat,
    selectedChatId: selectedChat?.chat_id,
  });

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


  const loadChats = useCallback(async (showSpinner = true) => {
    // Only show loading spinner if we have no chats yet (first load)
    // On subsequent calls (background refresh), keep showing existing chats
    const cached = localStorage.getItem("cached_chats");
    if (showSpinner && !cached) setIsLoading(true);
    try {
      // Run all API calls in parallel to massively speed up loading time
      const [chatListResult, groupsResult, supportChatResult, communitiesResult] = await Promise.allSettled([
        getChatList(),
        getGroupChats(),
        user?.role !== 'admin' && user?.role !== 'staff' && user?.id ? getSupportChat() : Promise.resolve(null),
        listCommunities()
      ]);

      if (chatListResult.status === 'rejected') {
        throw chatListResult.reason;
      }

      const data = chatListResult.value;

      // Handle Group Chats
      if (groupsResult.status === 'fulfilled') {
        const mappedGroups: ChatType[] = groupsResult.value.map(g => ({
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
      } else {
        console.error("Failed to load group chats", groupsResult.reason);
      }

      // Handle Community Chats
      if (communitiesResult.status === 'fulfilled') {
        const myCommunities = (communitiesResult.value as any[]).filter(c => 
          c.members?.some(m => m.userId === user?.id && (m.status === 'approved' || m.status === 'left'))
        );

        const mappedCommunities: ChatType[] = myCommunities.map(c => {
          const isLeft = c.members?.find(m => m.userId === user?.id)?.status === 'left';
          return {
            chat_id: `community_${c.id}`,
            last_message: c.messages?.[0]?.content || "Community Chat",
            last_message_time: c.messages?.[0]?.createdAt || c.createdAt || new Date().toISOString(),
            user_id: 0,
            display_name: c.name || "Unnamed Community",
            avatar_url: c.avatarUrl || "/group-icon.svg",
            username: c.slug || "community",
            unread_count: 0,
            verified: false,
            isOfficial: false,
            isLeft: !!isLeft,
          };
        });
        data.push(...mappedCommunities);
      } else {
        console.error("Failed to load community chats", communitiesResult.reason);
      }

      // Handle Support Chat
      if (supportChatResult.status === 'fulfilled' && supportChatResult.value) {
        const supportChatId = `support_${user?.id}`;
        const hasSupportChat = data.some((chat) => chat.chat_id === supportChatId);

        if (!hasSupportChat) {
          data.unshift({
            chat_id: supportChatId,
            last_message: "Official Support & Notifications",
            last_message_time: new Date().toISOString(),
            user_id: supportChatResult.value.admin.id,
            display_name: "Krovaa",
            avatar_url: "/krovaa-logo.svg?v=3",
            username: "krovaa",
            unread_count: 0,
            verified: true,
            isOfficial: true,
          });
        }
      }

      // Final Sort
      data.sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());

      setChats(data);
      try {
        localStorage.setItem("cached_chats", JSON.stringify(data));
      } catch (e) {
        console.error("Failed to cache chats to localStorage:", e);
      }
    } catch (err) {
      if (!cached) {
        setError(err instanceof Error ? err.message : "Failed to load chats");
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.role]);

  const loadMessages = useCallback(async (chatId: string) => {
    const cacheKey = user?.id ? `cached_messages_${user.id}_${chatId}` : `cached_messages_${chatId}`;
    const legacyCacheKey = `cached_messages_${chatId}`;

    // 1. Instantly load messages from localStorage cache
    try {
      const cached = localStorage.getItem(cacheKey) || localStorage.getItem(legacyCacheKey);
      if (cached) {
        setMessages(JSON.parse(cached));
      }
    } catch (e) {
      console.error("Failed to load cached messages:", e);
    }

    // 2. Fetch latest messages from API silently in background
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
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (e) {
        console.error("Failed to cache messages to localStorage:", e);
      }
    } catch (err) {
      const cached = localStorage.getItem(cacheKey) || localStorage.getItem(legacyCacheKey);
      if (!cached) {
        setError(err instanceof Error ? err.message : "Failed to load messages");
      }
    }
  }, [user?.id]);

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
      // Show spinner only if chat list is empty (first time), silent refresh otherwise
      loadChats(chats.length === 0);
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
          const updated = [...prev, msg];
          try {
            const cacheKey = user?.id ? `cached_messages_${user.id}_${selectedChat.chat_id}` : `cached_messages_${selectedChat.chat_id}`;
            localStorage.setItem(cacheKey, JSON.stringify(updated));
          } catch (e) {
            console.error("Failed to cache messages to localStorage:", e);
          }
          return updated;
        });
        // Mark as read if we are looking at this chat
        if ((msg.senderId ?? (msg as any).sender_id) !== user.id) {
          markMessagesAsRead(selectedChat.chat_id).then(() => loadChats(false));
        }
      } else {
        // Always refresh chat list to show latest message/unread count
        loadChats(false);
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
      loadChats(false);
    });
    return cleanup;
  }, [user, selectedChat, loadChats]);

  // Load messages and join room when selected chat changes
  useEffect(() => {
    // Clear blur state when changing chats
    setIsBlurred(false);
    setReplyingTo(null);

    if (selectedChat && user) {
      loadMessages(selectedChat.chat_id);
      socketService.joinChat(user.id, selectedChat.chat_id);
      // Mark as read when opening chat
      markMessagesAsRead(selectedChat.chat_id).then(() => loadChats(false));
    }
  }, [selectedChat?.chat_id, user, loadMessages, loadChats]);

  // Handle message deletion from other users
  useEffect(() => {
    if (!user) return;
    const cleanup = socketService.onMessageDeleted((data) => {
      if (selectedChat && data.chatId === selectedChat.chat_id) {
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === data.messageId
              ? { ...m, isDeleted: true, content: "This message was deleted", attachmentUrl: undefined, attachmentName: undefined }
              : m
          );
          try {
            const cacheKey = user?.id ? `cached_messages_${user.id}_${selectedChat.chat_id}` : `cached_messages_${selectedChat.chat_id}`;
            localStorage.setItem(cacheKey, JSON.stringify(updated));
          } catch (e) {
            console.error("Failed to cache messages to localStorage:", e);
          }
          return updated;
        });
      }
      loadChats(false); // Update last message in chat list
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
    // Sanitize outgoing message: remove stray asterisks and double quotes to keep messages professional
    const sanitizeOutgoing = (s: string) => {
      return s
        .replace(/[\*]+/g, "")
        .replace(/[\u201C\u201D\"]/g, "")
        .trim();
    };

    const messageToSend = sanitizeOutgoing(newMessage);
    setNewMessage("");

    // Bot Logic
    if (selectedChat?.isOfficial) {
      if (botState === 'AWAITING_PROFESSION') {
        setBotData(prev => ({ ...prev, profession: messageToSend }));
        setBotState('AWAITING_LOCATION');

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

        setTimeout(() => {
          const botReply: MessageType = {
            id: Date.now() + 1,
            senderId: selectedChat.user_id,
            receiverId: user.id,
            chatId: selectedChat.chat_id,
            content: "Got it! Now enter a city or pincode (optional) to find matching profiles near you.",
            messageType: 'text',
            read: true,
            createdAt: new Date().toISOString()
          };
          setMessages(prev => [...prev, botReply]);
        }, 600);
        return;
      } else if (botState === 'AWAITING_LOCATION') {
        const isPincode = /^\d{6}$/.test(messageToSend.trim());
        const locationData = isPincode
          ? { pincode: messageToSend.trim() }
          : { city: messageToSend.trim() };

        setBotData(prev => ({ ...prev, ...locationData }));
        setBotState('SEARCHING');

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
            const profession = botData.profession || '';
            const city = botData.city || locationData.city || '';
            const pincode = botData.pincode || locationData.pincode || '';
            const userSkills = (user?.skills as string[]) || [];

            const response = await getBestProfiles({
              profession,
              city,
              pincode,
              skills: userSkills,
              limit: 10
            });

            const results = response.users;
            setBotState('IDLE');
            setBotData({});

            const msgId = Date.now() + 2;
            if (results.length === 0) {
              const botReply: MessageType = {
                id: msgId,
                senderId: selectedChat.user_id,
                receiverId: user.id,
                chatId: selectedChat.chat_id,
                content: `I couldn't find any verified ${profession || 'profile'}s${city ? ` in ${city}` : ''}${pincode ? ` (${pincode})` : ''}. 😔`,
                messageType: 'text',
                read: true,
                createdAt: new Date().toISOString()
              };
              setMessages(prev => [...prev, botReply]);
            } else {
              const header = `**${response.total}** verified ${profession || 'profile'}(s) found${city ? ` in **${city}**` : ''}${pincode ? ` (**${pincode}**)` : ''}`;
              const footer = response.hasMore ? `\n+${response.total - results.length} more` : '';

              setRecommendationCards(prev => ({ ...prev, [msgId]: results }));
              setRecommendationMeta(prev => ({ ...prev, [msgId]: { total: response.total, hasMore: response.hasMore } }));

              const botReply: MessageType = {
                id: msgId,
                senderId: selectedChat.user_id,
                receiverId: user.id,
                chatId: selectedChat.chat_id,
                content: `__REC__${header}${footer}`,
                messageType: 'text',
                read: true,
                createdAt: new Date().toISOString()
              };
              setMessages(prev => [...prev, botReply]);
            }
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
        }, 800);
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
          is_view_once: false,
          parent_message_id: replyingTo?.id,
          reply_to_text: replyingTo ? getReplySnippet(replyingTo) : undefined,
          reply_to_user: replyingTo
            ? (Number(replyingTo.senderId) === Number(user?.id)
              ? "You"
              : (replyingTo.sender_name || selectedChat?.display_name || "Unknown"))
            : undefined,
        });
      }
      setReplyingTo(null);
      await loadMessages(selectedChat.chat_id);
      await loadChats(false);

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
  }, [newMessage, selectedChat, user, replyingTo, loadMessages, loadChats]);

  // Handle "Use my location" button — triggers search when botState becomes SEARCHING
  useEffect(() => {
    if (botState !== 'SEARCHING' || !selectedChat?.isOfficial || !user) return;
    const profession = botData.profession || '';
    const city = botData.city || '';
    const pincode = botData.pincode || '';
    if (!profession && !city && !pincode) return;

    const userSkills = (user?.skills as string[]) || [];

    (async () => {
      try {
        const response = await getBestProfiles({
          profession,
          city,
          pincode,
          skills: userSkills,
          limit: 10
        });

        const results = response.users;
        setBotState('IDLE');
        setBotData({});

        const msgId = Date.now() + 2;
        if (results.length === 0) {
          const botReply: MessageType = {
            id: msgId,
            senderId: selectedChat.user_id,
            receiverId: user.id,
            chatId: selectedChat.chat_id,
            content: `I couldn't find any verified ${profession || 'profile'}s${city ? ` in ${city}` : ''}${pincode ? ` (${pincode})` : ''}. 😔`,
            messageType: 'text',
            read: true,
            createdAt: new Date().toISOString()
          };
          setMessages(prev => [...prev, botReply]);
        } else {
          const header = `**${response.total}** verified ${profession || 'profile'}(s) found${city ? ` in **${city}**` : ''}${pincode ? ` (**${pincode}**)` : ''}`;
          const footer = response.hasMore ? `\n+${response.total - results.length} more` : '';

          setRecommendationCards(prev => ({ ...prev, [msgId]: results }));
          setRecommendationMeta(prev => ({ ...prev, [msgId]: { total: response.total, hasMore: response.hasMore } }));

          const botReply: MessageType = {
            id: msgId,
            senderId: selectedChat.user_id,
            receiverId: user.id,
            chatId: selectedChat.chat_id,
            content: `__REC__${header}${footer}`,
            messageType: 'text',
            read: true,
            createdAt: new Date().toISOString()
          };
          setMessages(prev => [...prev, botReply]);
        }
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
    })();
  }, [botState, botData, selectedChat, user, setMessages, setBotState, setBotData, setRecommendationCards, setRecommendationMeta]);

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
        is_view_once: viewOnce,
        parent_message_id: replyingTo?.id,
        reply_to_text: replyingTo ? getReplySnippet(replyingTo) : undefined,
        reply_to_user: replyingTo
          ? (Number(replyingTo.senderId) === Number(user?.id) ? "You" : (replyingTo.sender_name || selectedChat?.display_name || "Unknown"))
          : undefined,
      });

      setReplyingTo(null);

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
  }, [pendingFile, selectedChat, user, replyingTo, loadMessages, loadChats, getReplySnippet]);

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
        parent_message_id: replyingTo?.id,
        reply_to_text: replyingTo ? getReplySnippet(replyingTo) : undefined,
        reply_to_user: replyingTo
          ? (Number(replyingTo.senderId) === Number(user?.id) ? "You" : (replyingTo.sender_name || selectedChat?.display_name || "Unknown"))
          : undefined,
      });
      setReplyingTo(null);
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
  }, [loadChats, loadMessages, selectedChat, user, replyingTo, getReplySnippet]);

  const stopVoiceRecording = useCallback((e?: React.MouseEvent | React.TouchEvent | any) => {
    if (e && e.preventDefault) {
      e.preventDefault();
      e.stopPropagation();
    }
    const recorder = mediaRecorderRef.current;

    setIsRecordingVoice(false);
    clearVoiceRecordingTimer();

    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch (err) { }
    }
  }, [clearVoiceRecordingTimer]);

  const cancelVoiceRecording = useCallback((e?: React.MouseEvent | React.TouchEvent | any) => {
    if (e && e.preventDefault) {
      e.preventDefault();
      e.stopPropagation();
    }
    const recorder = mediaRecorderRef.current;

    setIsRecordingVoice(false);
    clearVoiceRecordingTimer();
    setRecordingSeconds(0);

    if (recorder) {
      (recorder as any).isCancelled = true;
      if (recorder.state !== 'inactive') {
        try { recorder.stop(); } catch (err) { }
      }
    }
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

        if ((recorder as any).isCancelled) return;

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
    (c.display_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteChat = useCallback(async (chatId: string) => {
    const snapshot = chats;
    try {
      await deleteChat(chatId);
    } catch (err) {
      setChats(snapshot);
      throw err;
    }
  }, [chats, deleteChat]);

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
            cancelVoiceRecording={cancelVoiceRecording}
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
            recommendationCards={recommendationCards}
            setRecommendationCards={setRecommendationCards}
            recommendationMeta={recommendationMeta}
            setRecommendationMeta={setRecommendationMeta}
            replyingTo={replyingTo}
            setReplyingTo={setReplyingTo}
            filteredChats={filteredChats}
            selectedCommunity={selectedCommunity}
          />
        ) : (
          <div className="relative h-full flex-1 overflow-hidden">
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
              onLogout={handleLogout}
              onSupport={handleSupport}
              isMobile={isMobile}
              isChatMuted={isChatMuted}
              onMuteChat={muteChat}
              onUnmuteChat={unmuteChat}
              onDeleteChat={handleDeleteChat}
            />
            {/* Floating Market Button */}
            <button
              onClick={() => navigate('/marketplace')}
              className="absolute bottom-6 right-6 h-14 w-14 rounded-2xl bg-[#00A4EF] text-white shadow-lg shadow-[#00A4EF]/30 flex items-center justify-center hover:bg-[#0087d1] hover:scale-105 active:scale-95 transition-all z-50"
              title="Marketplace"
            >
              <Icon name="Store" className="h-6 w-6 text-white" />
            </button>
          </div>
        )}
        <ProfileCompletionModal />
      </div>
    );
  }

  // Desktop: side-by-side
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#050810]">
      <div className="w-80 border-r border-white/5 shrink-0 h-full overflow-hidden relative">

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
          isChatMuted={isChatMuted}
          onMuteChat={muteChat}
          onUnmuteChat={unmuteChat}
          onDeleteChat={handleDeleteChat}
        />

        {/* Floating Market Button */}
        <button
          onClick={() => navigate('/marketplace')}
          className="absolute bottom-6 right-6 h-14 w-14 rounded-2xl bg-[#00A4EF] text-white shadow-lg shadow-[#00A4EF]/30 flex items-center justify-center hover:bg-[#0087d1] hover:scale-105 active:scale-95 transition-all z-50"
          title="Marketplace"
        >
          <Icon name="Store" className="h-6 w-6 text-white" />
        </button>
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
          cancelVoiceRecording={cancelVoiceRecording}
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
          recommendationCards={recommendationCards}
          setRecommendationCards={setRecommendationCards}
          recommendationMeta={recommendationMeta}
          setRecommendationMeta={setRecommendationMeta}
          replyingTo={replyingTo}
          setReplyingTo={setReplyingTo}
          filteredChats={filteredChats}
          selectedCommunity={selectedCommunity}
        />
      </div>
      <ProfileCompletionModal />
    </div>
  );
};

export default ChatPage;
