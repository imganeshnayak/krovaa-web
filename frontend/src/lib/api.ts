import { apiUrl } from "./config";

// src/lib/api.ts

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> || {}),
  };

  // Only set Content-Type to application/json if the body is not FormData
  if (!(options?.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const fullUrl = apiUrl(path);
  console.log(`[API Request] ${options?.method || 'GET'} ${fullUrl}`);
  
  const res = await fetch(fullUrl, {
    credentials: 'include',
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage = errorText;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorText;

      // Handle account suspension/banned globally
      if (res.status === 403 && (errorMessage.toLowerCase().includes("suspended") || errorMessage.toLowerCase().includes("banned"))) {
        localStorage.removeItem("authToken");
        localStorage.removeItem("authUser");
        window.location.href = "/login?error=" + encodeURIComponent(errorMessage);
      }
    } catch (e) {
      // Not JSON, use raw text
    }

    const err: any = new Error(errorMessage);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

// ============ Auth API ============

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  shareId?: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  coverPhotoUrl?: string;
  role: string;
  status: string;
  verified?: boolean;
  socialLinks?: { platform: string; url: string }[];
  createdAt: string;
  averageRating?: number;
  ratingCount?: number;
  city?: string;
  pincode?: string;
  telegramId?: string;
  phoneNumber?: string;
  permissions?: string[];
  profession?: string;
  gender?: string;
  age?: number;
  userGoal?: string;
  skills?: string[];
  walletBalance?: number;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export function registerUser(data: {
  username: string;
  email: string;
  password: string;
  display_name?: string;
  profession?: string;
  otp: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function loginUser(data: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function loginWithTelegram(data: any): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/auth/telegram", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function logoutUser(): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/api/auth/logout", {
    method: "POST",
  });
}

export function getCurrentUser(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/auth/me");
}

// ============ Users API ============

export function getUser(id: number): Promise<AuthUser> {
  return apiFetch<AuthUser>(`/api/users/${id}`);
}

export function getUserByUsername(username: string): Promise<AuthUser> {
  return apiFetch<AuthUser>(`/api/users/username/${encodeURIComponent(username)}`);
}

export function getUserByShareId(shareId: string): Promise<AuthUser> {
  return apiFetch<AuthUser>(`/api/users/share-id/${encodeURIComponent(shareId)}`);
}

export interface ProfileFull {
  user: AuthUser & { averageRating: number; ratingCount: number };
  posts: Post[];
  ratingEligibility: { canRate: boolean; reason?: string | null };
}

export function getProfileFull(userId: number): Promise<ProfileFull> {
  return apiFetch<ProfileFull>(`/api/users/${userId}/profile-full`);
}

export function searchUsers(query: string): Promise<AuthUser[]> {
  return apiFetch<AuthUser[]>(`/api/users/search?q=${encodeURIComponent(query)}`);
}

export interface BestProfileUser extends AuthUser {
  score: number;
  avgRating: number;
  ratingCount: number;
  matchedSkills: string[];
  profileCompleteness: number;
}

export interface BestProfilesResponse {
  users: BestProfileUser[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export function getBestProfiles(params: {
  profession?: string;
  city?: string;
  pincode?: string;
  skills?: string[];
  page?: number;
  limit?: number;
}): Promise<BestProfilesResponse> {
  const query = new URLSearchParams();
  if (params.profession) query.append("profession", params.profession);
  if (params.city) query.append("city", params.city);
  if (params.pincode) query.append("pincode", params.pincode);
  if (params.skills && params.skills.length > 0) query.append("skills", JSON.stringify(params.skills));
  if (params.page) query.append("page", String(params.page));
  if (params.limit) query.append("limit", String(params.limit));
  return apiFetch<BestProfilesResponse>(`/api/users/best-profiles?${query.toString()}`);
}

export function rateUser(data: {
  reviewedId: number;
  rating: number;
  comment?: string;
}): Promise<any> {
  return apiFetch("/api/users/rate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getRatingEligibility(userId: number): Promise<{ canRate: boolean; reason?: string | null }> {
  return apiFetch(`/api/users/${userId}/rating-eligibility`);
}

export function getAllUsers(): Promise<AuthUser[]> {
  return apiFetch<AuthUser[]>("/api/users");
}

export function updateUserProfile(
  userId: number,
  data: {
    displayName?: string;
    bio?: string;
    telegramId?: string;
    email?: string;
    avatarUrl?: string;
    socialLinks?: { platform: string; url: string }[];
    city?: string;
    pincode?: string;
    phoneNumber?: string;
    profession?: string | null;
    gender?: string;
    age?: number | null;
    userGoal?: string;
    skills?: string[];
  }
): Promise<AuthUser> {
  return apiFetch<AuthUser>(`/api/users/profile/${userId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const formData = new FormData();
  formData.append("avatar", file);
  console.log('Uploading avatar:', { fileName: file.name, fileSize: file.size, fileType: file.type });
  return apiFetch<{ avatarUrl: string }>("/api/users/avatar", {
    method: "POST",
    body: formData,
  }).then(response => {
    console.log('Avatar upload response:', response);
    return response;
  }).catch(error => {
    console.error('Avatar upload failed:', error);
    throw error;
  });
}

export function uploadCoverPhoto(file: File): Promise<{ coverPhotoUrl: string }> {
  const formData = new FormData();
  formData.append("coverPhoto", file);
  console.log('Uploading cover photo:', { fileName: file.name, fileSize: file.size, fileType: file.type });
  return apiFetch<{ coverPhotoUrl: string }>("/api/users/cover-photo", {
    method: "POST",
    body: formData,
  }).then(response => {
    console.log('Cover photo upload response:', response);
    return response;
  }).catch(error => {
    console.error('Cover photo upload failed:', error);
    throw error;
  });
}

export function deleteAvatar(): Promise<{ message: string }> {
  return apiFetch('/api/users/avatar', { method: 'DELETE' });
}

export function deleteCoverPhoto(): Promise<{ message: string }> {
  return apiFetch('/api/users/cover-photo', { method: 'DELETE' });
}

// ============ Messages API ============

export interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  chatId: string;
  content: string;
  messageType: string;
  message_type?: string; // Backend legacy or raw payload alias
  read: boolean;
  isDeleted?: boolean;
  isViewOnce?: boolean;
  isOpened?: boolean;
  color?: string;
  deletedBySender?: boolean;
  deletedByReceiver?: boolean;
  createdAt: string;
  attachmentUrl?: string;
  attachmentName?: string;
  sender_name?: string;
  sender_avatar?: string;
  sender_username?: string;
  parentMessageId?: number;
  replyToText?: string;
  replyToUser?: string;
}

export interface Chat {
  chat_id: string;
  last_message: string;
  last_message_time: string;
  user_id: number;
  display_name: string;
  avatar_url?: string;
  username: string;
  unread_count: number;
  verified: boolean;
  isOfficial?: boolean;
}

// ============ Moderation API ============

export function blockUser(blockedId: number): Promise<any> {
  return apiFetch("/api/moderation/block", {
    method: "POST",
    body: JSON.stringify({ blockedId }),
  });
}

export function unblockUser(userId: number): Promise<any> {
  return apiFetch(`/api/moderation/block/${userId}`, {
    method: "DELETE",
  });
}

export function getBlockedUsers(): Promise<AuthUser[]> {
  return apiFetch<AuthUser[]>("/api/moderation/blocked");
}

export function reportUser(reportedId: number, reason: string): Promise<any> {
  return apiFetch("/api/moderation/report", {
    method: "POST",
    body: JSON.stringify({ reportedId, reason }),
  });
}

export function clearChatHistory(chatId: string): Promise<any> {
  return apiFetch(`/api/messages/chat/${chatId}`, {
    method: "DELETE",
  });
}

export function getChatList(): Promise<Chat[]> {
  return apiFetch<Chat[]>("/api/messages/chats/list");
}

export function getMessages(chatId: string): Promise<Message[]> {
  return apiFetch<Message[]>(`/api/messages/${chatId}`);
}

export function sendMessage(data: {
  receiver_id: number;
  chat_id: string;
  content: string;
  message_type?: string;
  is_view_once?: boolean;
  parent_message_id?: number;
  reply_to_text?: string;
  reply_to_user?: string;
}): Promise<Message> {
  return apiFetch<Message>("/api/messages", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteMessage(messageId: number, type: 'me' | 'everyone' = 'me'): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/messages/${messageId}?type=${type}`, {
    method: "DELETE",
  });
}

export function openViewOnceMessage(messageId: number): Promise<Message> {
  return apiFetch<Message>(`/api/messages/${messageId}/open`, {
    method: "PUT",
  });
}

export function getSupportChat(): Promise<{ admin: AuthUser; chatId: string }> {
  return apiFetch<{ admin: AuthUser; chatId: string }>("/api/messages/support");
}

// ============ Communities API ============

export interface Community {
  id: number;
  name: string;
  slug: string;
  description?: string;
  isPrivate: boolean;
  avatarUrl?: string;
  creatorId: number;
  createdAt: string;
}

export function listCommunities(): Promise<Community[]> {
  return apiFetch<Community[]>('/api/communities');
}

export function createCommunity(data: { name: string; description?: string; isPrivate?: boolean }): Promise<Community> {
  return apiFetch<Community>('/api/communities', { method: 'POST', body: JSON.stringify(data) });
}

export function getCommunity(id: number): Promise<any> {
  return apiFetch(`/api/communities/${id}`);
}

export function joinCommunity(id: number): Promise<any> {
  return apiFetch(`/api/communities/${id}/join`, { method: 'POST' });
}

export function leaveCommunity(id: number): Promise<any> {
  return apiFetch(`/api/communities/${id}/leave`, { method: 'POST' });
}

export function deleteCommunity(id: number): Promise<any> {
  return apiFetch(`/api/communities/${id}`, { method: 'DELETE' });
}

export function updateCommunityAvatar(communityId: number, file: File): Promise<{ avatarUrl: string }> {
  const formData = new FormData();
  formData.append("avatar", file);
  return apiFetch<{ avatarUrl: string }>(`/api/communities/${communityId}/avatar`, {
    method: "PUT",
    body: formData,
  });
}

export function approveCommunityMember(communityId: number, userId: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/communities/${communityId}/members/${userId}/approve`, {
    method: "PUT",
  });
}

// ============ Workspace Teams & Contracts API ============

export interface WorkspaceInvitation {
  id: number;
  email: string;
  role: string;
  expiresAt: string;
  status: string;
  inviteLink: string;
}

export interface WorkspaceAnalytics {
  totalFinancialSpend: number;
  activeContractsCount: number;
  totalHoursTracked: number;
}

export interface Contract {
  id: number;
  communityId: number;
  professionalId: number;
  title: string;
  rate: number;
  status: string;
  escrowDealId?: number;
  createdAt: string;
  professional?: { id: number; username: string; displayName: string; avatarUrl?: string };
}

export function inviteToWorkspace(communityId: number, email: string, role: string): Promise<{ success: boolean; invitation: WorkspaceInvitation }> {
  return apiFetch<{ success: boolean; invitation: WorkspaceInvitation }>(`/api/communities/${communityId}/invite`, {
    method: 'POST',
    body: JSON.stringify({ email, role })
  });
}

export function acceptWorkspaceInvitation(token: string): Promise<any> {
  return apiFetch<any>('/api/communities/invitations/accept', {
    method: 'POST',
    body: JSON.stringify({ token })
  });
}

export function getWorkspaceAnalytics(communityId: number): Promise<WorkspaceAnalytics> {
  return apiFetch<WorkspaceAnalytics>(`/api/communities/${communityId}/analytics`);
}

export function getWorkspaceContracts(communityId: number): Promise<Contract[]> {
  return apiFetch<Contract[]>(`/api/contracts?communityId=${communityId}`);
}

export function createWorkspaceContract(data: { communityId: number; professionalId: number; title: string; rate: number }): Promise<Contract> {
  return apiFetch<Contract>('/api/contracts', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function transferWorkspaceContract(contractId: number, targetCommunityId: number): Promise<any> {
  return apiFetch<any>(`/api/contracts/${contractId}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ targetCommunityId })
  });
}

export interface ShareLinkData {
  shareLink: string;
  slug: string;
  name: string;
  isPrivate: boolean;
}

export function getCommunityShareLink(id: number): Promise<ShareLinkData> {
  return apiFetch(`/api/communities/${id}/share`);
}

export function getCommunityBySlug(slug: string): Promise<any> {
  return apiFetch(`/api/communities/join/${slug}`);
}

export function joinCommunityBySlug(slug: string): Promise<any> {
  return apiFetch(`/api/communities/join/${slug}`, { method: 'POST' });
}

export interface Message {
  id: number;
  senderId: number;
  content: string;
  createdAt: string;
  sender?: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export function getCommunityMessages(communityId: number, limit = 50, offset = 0): Promise<Message[]> {
  return apiFetch(`/api/communities/${communityId}/messages?limit=${limit}&offset=${offset}`);
}

export function sendCommunityMessage(communityId: number, content: string, attachmentUrl?: string): Promise<Message> {
  return apiFetch(`/api/communities/${communityId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, attachmentUrl })
  });
}

export function deleteMessagesBatch(messageIds: number[], type: 'me' | 'everyone' = 'me'): Promise<any> {
  return apiFetch("/api/messages/batch-delete", {
    method: "POST",
    body: JSON.stringify({ ids: messageIds, type }),
  });
}

export function markMessagesAsRead(chatId: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/messages/read/${chatId}`, {
    method: "PUT",
  });
}

export async function uploadFile(data: {
  receiver_id: number;
  chat_id: string;
  file: File;
  content?: string;
  is_view_once?: boolean;
  parent_message_id?: number;
  reply_to_text?: string;
  reply_to_user?: string;
}): Promise<Message> {
  const formData = new FormData();
  formData.append("receiver_id", data.receiver_id.toString());
  formData.append("chat_id", data.chat_id);
  formData.append("file", data.file);
  if (data.content) formData.append("content", data.content);
  if (data.is_view_once) formData.append("is_view_once", "true");
  if (data.parent_message_id) formData.append("parent_message_id", data.parent_message_id.toString());
  if (data.reply_to_text) formData.append("reply_to_text", data.reply_to_text);
  if (data.reply_to_user) formData.append("reply_to_user", data.reply_to_user);

  const res = await fetch(apiUrl("/api/messages/upload"), {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(error);
  }

  return res.json();
}

export function notifyScreenshotAttempt(data: {
  receiver_id: number;
  chat_id: string;
}): Promise<Message> {
  return apiFetch<Message>("/api/messages/screenshot-attempt", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ============ Admin API ============

export interface ActivityLog {
  id: number;
  userId: number;
  action: string;
  details?: string;
  status: string;
  createdAt: string;
  user: {
    displayName: string;
    username: string;
    avatarUrl?: string;
  };
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  totalChats: number;
  totalEscrowDeals: number;
  activeEscrowDeals: number;
  totalEscrowValue: number;
  recentActivity: number;
  pendingPayouts: number;
  pendingVerifications: number;
  pendingReports: number;
  totalPayoutValue: number;
}

export interface AdminReport {
  id: number;
  reporterId: number;
  reportedId: number;
  reason: string;
  status: string;
  createdAt: string;
  reporter: { username: string; displayName: string };
  reported: { username: string; displayName: string };
}

export function getAdminReports(): Promise<{ reports: AdminReport[] }> {
  return apiFetch<{ reports: AdminReport[] }>("/api/admin/reports");
}

export function getSystemSettings(): Promise<Record<string, string>> {
  return apiFetch<Record<string, string>>("/api/admin/settings");
}

export function updateSystemSettings(settings: Record<string, string | number>): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/api/admin/settings", {
    method: "POST",
    body: JSON.stringify({ settings }),
  });
}

export function getImageGeneratorPricing(): Promise<{ plans: Array<{
  id: string;
  name: string;
  monthlyLimit: number;
  monthlyPrice: number;
  annualPrice: number;
  monthlyEquivalent: number;
}> }> {
  return apiFetch<{ plans: Array<{
    id: string;
    name: string;
    monthlyLimit: number;
    monthlyPrice: number;
    annualPrice: number;
    monthlyEquivalent: number;
  }> }>("/api/subscriptions/pricing");
}

export function updateReportStatus(reportId: number, status: string): Promise<any> {
  return apiFetch(`/api/admin/reports/${reportId}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
  status: string;
  createdAt: string;
  _count: {
    sentMessages: number;
    clientDeals: number;
    vendorDeals: number;
  };
}

export function getAdminStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>("/api/admin/stats");
}

export function getAdminUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<{
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.search) query.append("search", params.search);
  if (params?.status) query.append("status", params.status);

  return apiFetch(`/api/admin/users?${query.toString()}`);
}

export function getAdminChats(params?: {
  page?: number;
  limit?: number;
}): Promise<{
  chats: any[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());

  return apiFetch(`/api/admin/chats?${query.toString()}`);
}

export function getAdminChatMessages(chatId: string): Promise<Message[]> {
  return apiFetch(`/api/admin/chats/${chatId}/messages`);
}

export function getAdminChatDetails(chatId: string): Promise<{ deals: EscrowDeal[] }> {
  return apiFetch<{ deals: EscrowDeal[] }>(`/api/admin/chats/${chatId}/details`);
}

export function getAdminEscrowDeals(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{
  deals: EscrowDeal[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.status) query.append("status", params.status);

  return apiFetch(`/api/admin/escrow?${query.toString()}`);
}

export function getActivityLogs(params?: {
  page?: number;
  limit?: number;
}): Promise<{
  activities: ActivityLog[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());

  return apiFetch(`/api/admin/activity-logs?${query.toString()}`);
}

export function updateUserStatus(
  userId: number,
  status: string
): Promise<AdminUser> {
  return apiFetch(`/api/admin/users/${userId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export function updateUserRole(
  userId: number,
  role: string
): Promise<AdminUser> {
  return apiFetch(`/api/admin/users/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
}

export function deleteUser(userId: number): Promise<{ success: boolean }> {
  return apiFetch(`/api/admin/users/${userId}`, {
    method: "DELETE",
  });
}

export function getAdminStaff(): Promise<AuthUser[]> {
  return apiFetch<AuthUser[]>("/api/admin/staff");
}

export function createAdminStaff(data: {
  email: string;
  username: string;
  password: string;
  displayName?: string;
  permissions: string[];
}): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/admin/staff", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateAdminStaffPermissions(
  staffId: number,
  permissions: string[]
): Promise<AuthUser> {
  return apiFetch<AuthUser>(`/api/admin/staff/${staffId}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ permissions }),
  });
}

export function deleteAdminStaff(staffId: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/admin/staff/${staffId}`, {
    method: "DELETE",
  });
}

export function getUserTransactions(userId: number): Promise<{
  escrowDeals: EscrowDeal[];
  payoutRequests: PayoutRequest[];
  walletTransactions: WalletTransaction[];
}> {
  return apiFetch(`/api/admin/users/${userId}/transactions`);
}

// ============ Escrow API ============

export interface EscrowTransaction {
  id: number;
  dealId: number;
  percent: number;
  amount: number;
  note?: string;
  createdAt: string;
}


// ============ Wallet API ============

export interface WalletTransaction {
  id: number;
  userId: number;
  type: string;
  amount: number;
  balance: number;
  reference?: string;
  description: string;
  metadata?: any;
  createdAt: string;
  deal?: {
    id: number;
    title: string;
    createdAt: string;
    status: string;
    totalAmount: number;
    chatId: string;
    client: { id: number; displayName: string; username: string };
    vendor: { id: number; displayName: string; username: string };
  } | null;
}

export interface FullUserDetails extends AuthUser {
  walletBalance: number;
  razorpayContactId?: string;
  activities: ActivityLog[];
  walletTransactions: WalletTransaction[];
  clientDeals: (EscrowDeal & { vendor: { id: number; displayName: string; username: string } })[];
  vendorDeals: (EscrowDeal & { client: { id: number; displayName: string; username: string } })[];
  payoutRequests: PayoutRequest[];
  ratingsReceived: (any & { reviewer: { id: number; displayName: string; username: string } })[];
  ratingsGiven: (any & { reviewed: { id: number; displayName: string; username: string } })[];
  reportsReceived: (any & { reporter: { id: number; displayName: string; username: string } })[];
  reportsCreated: (any & { reported: { id: number; displayName: string; username: string } })[];
  blockedBy: (any & { blocker: { id: number; displayName: string; username: string } })[];
  blockedUsers: (any & { blocked: { id: number; displayName: string; username: string } })[];
  verificationRequests: VerificationRequest[];
  imageGenerations: ImageGeneration[];
}

export interface ImageGeneration {
  id: number;
  userId: number;
  prompt: string;
  style: string;
  imageUrl: string;
  size: string;
  createdAt: string;
}

export function getAdminUserFullDetails(userId: number): Promise<FullUserDetails> {
  return apiFetch<FullUserDetails>(`/api/admin/users/${userId}/full`);
}

export interface PayoutRequest {
  id: number;
  userId: number;
  amount: number;
  status: string;
  paymentMethod?: string; // 'bank' or 'upi'
  bankAccount?: string;
  ifscCode?: string;
  accountName: string;
  upiVpa?: string;
  razorpayPayoutId?: string;
  razorpayFundAccountId?: string;
  razorpayContactId?: string;
  adminNote?: string;
  requestedAt: string;
  processedAt?: string;
  phoneNumber?: string;
  email?: string;
  user?: {
    id: number;
    username: string;
    displayName: string;
    email: string;
    phoneNumber?: string;
    walletBalance?: number;
  };
}

export interface WalletRecipient {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
  shareId: string;
  verified: boolean;
  status: string;
  walletEnabled: boolean;
  razorpayContactId?: string;
  phoneNumber?: string;
}

export interface WalletTransferResponse {
  success: boolean;
  transferReference: string;
  amount: number;
  senderBalance: number;
  recipientBalance: number;
  recipient: {
    id: number;
    username: string;
    displayName: string;
    shareId: string;
  };
}

export function getWalletBalance(): Promise<{ balance: number }> {
  return apiFetch<{ balance: number }>("/api/wallet/balance");
}

export function getWalletRecipient(shareId: string): Promise<WalletRecipient> {
  return apiFetch<WalletRecipient>(`/api/wallet/recipient/${encodeURIComponent(shareId)}`);
}

export function getWalletTransactions(type: string = 'all'): Promise<WalletTransaction[]> {
  return apiFetch<WalletTransaction[]>(`/api/wallet/transactions?type=${type}`);
}

export function transferWalletBalance(data: {
  shareId: string;
  amount: number;
  note?: string;
}): Promise<WalletTransferResponse> {
  return apiFetch<WalletTransferResponse>("/api/wallet/transfer", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function requestPayout(data: {
  amount: number;
  paymentMethod?: string;
  bankAccount?: string;
  ifscCode?: string;
  accountName: string;
  upiVpa?: string;
  phoneNumber: string;
  email?: string;
}): Promise<PayoutRequest> {
  return apiFetch<PayoutRequest>("/api/wallet/payout/request", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getPayoutRequests(): Promise<PayoutRequest[]> {
  return apiFetch<PayoutRequest[]>("/api/wallet/payout/requests");
}

// ============ Admin Payout API ============

export function getAdminPayouts(page = 1, limit = 20, status = ''): Promise<{
  payouts: PayoutRequest[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(status && { status })
  });
  return apiFetch(`/api/admin/payouts?${params.toString()}`);
}

export function updatePayoutStatus(id: number, data: {
  status: string;
  adminNote?: string;
  razorpayPayoutId?: string;
}): Promise<PayoutRequest> {
  return apiFetch<PayoutRequest>(`/api/admin/payouts/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export interface EscrowDeal {
  id: number;
  chatId: string;
  clientId: number;
  vendorId: number;
  title: string;
  description?: string;
  terms?: string;
  totalAmount: number;
  releasedPercent: number;
  status: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paymentStatus?: string;
  paidAmount?: number;
  createdAt: string;
  updatedAt: string;
  client: {
    id: number;
    displayName: string;
    avatarUrl?: string;
    username: string;
  };
  vendor: {
    id: number;
    displayName: string;
    avatarUrl?: string;
    username: string;
  };
  transactions: EscrowTransaction[];
}

export function getEscrowDeals(chatId?: string): Promise<EscrowDeal[]> {
  const query = chatId ? `?chatId=${chatId}` : "";
  return apiFetch<EscrowDeal[]>(`/api/escrow${query}`);
}

export function getEscrowDeal(id: number): Promise<EscrowDeal> {
  return apiFetch<EscrowDeal>(`/api/escrow/${id}`);
}

export function createEscrowDeal(data: {
  chatId: string;
  vendorId: number;
  title: string;
  description?: string;
  terms?: string;
  totalAmount: number;
}): Promise<EscrowDeal> {
  return apiFetch<EscrowDeal>("/api/escrow", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getPlatformFee(): Promise<{ platform_fee_percent: number }> {
  return apiFetch<{ platform_fee_percent: number }>("/api/escrow/platform-fee");
}

export function releaseEscrowPayment(
  dealId: number,
  data: {
    percent: number;
    note?: string;
  }
): Promise<EscrowDeal> {
  return apiFetch<EscrowDeal>(`/api/escrow/${dealId}/release`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateEscrowDeal(
  dealId: number,
  data: {
    title?: string;
    description?: string;
    status?: string;
  }
): Promise<EscrowDeal> {
  return apiFetch<EscrowDeal>(`/api/escrow/${dealId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteEscrowDeal(dealId: number, reason?: string): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(`/api/escrow/${dealId}`, {
    method: "DELETE",
    body: reason ? JSON.stringify({ reason }) : undefined,
  });
}

// ============ Verification API ============

export interface VerificationRequest {
  id: number;
  userId: number;
  status: string; // pending, approved, rejected
  paymentAmount: number;
  paymentProof?: string;
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
  user?: AuthUser;
}

export function applyForVerification(data: { paymentProof?: string }): Promise<VerificationRequest> {
  return apiFetch<VerificationRequest>("/api/verification/apply", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getVerificationStatus(): Promise<VerificationRequest | null> {
  return apiFetch<VerificationRequest | null>("/api/verification/status");
}

export function getVerificationFee(): Promise<{ fee: number; currency: string }> {
  return apiFetch<{ fee: number; currency: string }>("/api/verification/fee");
}

// Admin functions
export function getVerificationRequests(status?: string): Promise<VerificationRequest[]> {
  const query = status ? `?status=${status}` : '';
  return apiFetch<VerificationRequest[]>(`/api/verification/requests${query}`);
}

export function approveVerificationRequest(requestId: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/verification/requests/${requestId}/approve`, {
    method: "PUT",
  });
}

export function rejectVerificationRequest(
  requestId: number,
  adminNote?: string
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/verification/requests/${requestId}/reject`, {
    method: "PUT",
    body: JSON.stringify({ adminNote }),
  });
}

//============ Payment API ============

export interface PaymentOrder {
  orderId: string;
  amount: number;
  currency: string;
  key_id: string;
  dealId?: number;
  requestId?: number;
  title?: string;
}

export function initiateEscrowPayment(dealId: number): Promise<PaymentOrder> {
  return apiFetch<PaymentOrder>("/api/payments/escrow/initiate", {
    method: "POST",
    body: JSON.stringify({ dealId }),
  });
}

export function initiateVerificationPayment(): Promise<PaymentOrder> {
  return apiFetch<PaymentOrder>("/api/payments/verification/initiate", {
    method: "POST",
  });
}

export function initiateWalletTopup(amount: number): Promise<PaymentOrder> {
  return apiFetch<PaymentOrder>("/api/payments/wallet/initiate", {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export function initiateSubscriptionPayment(planId: string, isAnnual: boolean): Promise<PaymentOrder & { free?: boolean }> {
  return apiFetch<PaymentOrder & { free?: boolean }>("/api/payments/subscription/initiate", {
    method: "POST",
    body: JSON.stringify({ planId, isAnnual }),
  });
}

export function verifySubscriptionPayment(data: {
  orderId: string;
  paymentId: string;
  signature: string;
  planId: string;
  isAnnual: boolean;
}): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/api/payments/subscription/verify", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function paySubscriptionWithWallet(planId: string, isAnnual: boolean): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>("/api/subscriptions/wallet", {
    method: "POST",
    body: JSON.stringify({ planId, isAnnual }),
  });
}

export function verifyPayment(data: {
  orderId: string;
  paymentId: string;
  signature: string;
  type: "escrow" | "verification" | "wallet";
  entityId: number;
}): Promise<{ message: string; status: string; amount?: number }> {
  return apiFetch<{ message: string; status: string; amount?: number }>("/api/payments/verify", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ============ Notifications API ============

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "alert";
  color?: string;
  createdAt: string;
  sentBy: string;
  sentById?: number;
  isRead: boolean;
  metadata?: any;
}

export function getNotifications(): Promise<Notification[]> {
  return apiFetch<Notification[]>("/api/notifications");
}

export function markNotificationRead(id: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/notifications/${id}/read`, {
    method: "POST",
  });
}

export function markAllNotificationsRead(): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/api/notifications/read-all", {
    method: "POST",
  });
}

export function deleteNotification(id: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/notifications/${id}`, {
    method: "DELETE",
  });
}

export function broadcastNotification(data: {
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "alert";
  color?: string;
}): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/api/notifications/broadcast", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ============ Jobs API ============

export interface JobPoster {
  id: number;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  profession?: string;
  bio?: string;
  city?: string;
  createdAt: string;
}

export interface JobAttachment {
  id: number;
  fileName: string;
  fileUrl: string;
  publicId: string;
  mimeType: string;
  fileSize?: number | null;
  sortOrder: number;
  createdAt: string;
}

export interface Job {
  id: number;
  postedById?: number;
  title: string;
  company: string;
  location: string;
  budget: string;
  mode: string;
  description: string;
  attachments?: JobAttachment[];
  terms?: string[];
  deadline?: string;
  createdAt: string;
}

export interface MyJob extends Job {
  postedById: number;
  applicationCount: number;
  applications?: Array<{
    id: number;
    userId: number;
    status: string;
    createdAt: string;
    bidAmount?: string | null;
    coverLetter?: string | null;
    user: {
      id: number;
      username: string;
      displayName: string;
      avatarUrl?: string;
      profession?: string;
    };
  }>;
  postedBy: JobPoster;
}

export interface JobDetails extends Job {
  postedBy: JobPoster;
  hasApplied?: boolean;
  isOwner?: boolean;
  applications?: Array<{
    id: number;
    jobId: number;
    userId: number;
    status: string;
    terms: string | null;
    createdAt: string;
    user: {
      id: number;
      username: string;
      displayName: string;
      avatarUrl?: string;
      profession?: string;
    };
  }>;
}

export function getJobs(): Promise<Job[]> {
  return apiFetch<Job[]>('/api/jobs');
}

export function getJob(id: number): Promise<JobDetails> {
  return apiFetch<JobDetails>(`/api/jobs/${id}`);
}

export function postJob(data: {
  title: string;
  company: string;
  location: string;
  budget: string;
  mode: string;
  description: string;
  attachments?: File[];
  duration?: string;
  skills?: string[];
  terms?: string;
  deadline?: string;
}): Promise<Job> {
  const hasAttachments = (data.attachments?.length || 0) > 0;

  if (hasAttachments) {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('company', data.company);
    formData.append('location', data.location);
    formData.append('budget', data.budget);
    formData.append('mode', data.mode);
    formData.append('description', data.description);
    if (data.duration) formData.append('duration', data.duration);
    if (data.skills) formData.append('skills', JSON.stringify(data.skills));
    if (data.terms) formData.append('terms', data.terms);
    if (data.deadline) formData.append('deadline', data.deadline);

    data.attachments?.forEach((file) => {
      formData.append('attachments', file);
    });

    return apiFetch<Job>('/api/jobs', {
      method: 'POST',
      body: formData,
    });
  }

  return apiFetch<Job>('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function applyJob(jobId: number, data: {
  bidAmount?: string;
  coverLetter?: string;
  termsAndConditions?: string;
}): Promise<{ message: string; application: any }> {
  return apiFetch<{ message: string; application: any }>(`/api/jobs/${jobId}/apply`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function withdrawJobApplication(jobId: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/jobs/${jobId}/withdraw`, {
    method: 'DELETE',
  });
}

export function getMyJobs(): Promise<MyJob[]> {
  return apiFetch<MyJob[]>('/api/jobs/my');
}

export function updateJob(jobId: number, data: {
  title?: string;
  company?: string;
  location?: string;
  budget?: string;
  mode?: string;
  description?: string;
}): Promise<Job> {
  return apiFetch<Job>(`/api/jobs/${jobId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteJob(jobId: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/jobs/${jobId}`, {
    method: 'DELETE',
  });
}

// ============ Ads API ============

export interface Ad {
  id: number;
  title: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  externalUrl?: string;
  ctaText?: string;
  type: "text" | "image" | "video";
  targetProfessions: string[];
  status: "active" | "paused";
  impressions: number;
  clickCount?: number;
  ctr?: string;
  createdAt: string;
  admin?: { displayName: string; username: string };
}

export function getActiveAd(): Promise<Ad | null> {
  return apiFetch<Ad | null>("/api/ads/active");
}

export function recordAdClick(adId: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/ads/${adId}/click`, { method: "POST" });
}

export function getAdminAds(): Promise<Ad[]> {
  return apiFetch<Ad[]>("/api/ads");
}

export function deleteAd(id: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/ads/${id}`, { method: "DELETE" });
}

export function createAd(formData: FormData): Promise<Ad> {
  return fetch(apiUrl("/api/ads"), {
    method: "POST",
    body: formData,
    credentials: "include",
  }).then(async (res) => {
    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: "Failed" }));
      throw new Error(e.error || "Failed to create ad");
    }
    return res.json();
  });
}

export function updateAd(id: number, formData: FormData): Promise<Ad> {
  return fetch(apiUrl(`/api/ads/${id}`), {
    method: "PUT",
    body: formData,
    credentials: "include",
  }).then(async (res) => {
    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: "Failed" }));
      throw new Error(e.error || "Failed to update ad");
    }
    return res.json();
  });
}

export function pushAdNotification(id: number): Promise<{ success: boolean; notifiedCount: number }> {
  return apiFetch<{ success: boolean; notifiedCount: number }>(`/api/ads/${id}/push`, { method: "POST" });
}

export interface PostMedia {
  url: string;
  resource_type: string;
}

export interface PostUser {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface PostComment {
  id: number;
  text: string;
  createdAt: string;
  user: PostUser;
}

export interface Post {
  id: number;
  userId: number;
  text: string | null;
  media: PostMedia[] | null;
  createdAt: string;
  user?: PostUser;
  likes?: Array<{ userId: number }>;
  comments?: PostComment[];
}

export function createPost(text: string, files: File[]): Promise<Post> {
  const formData = new FormData();
  if (text) formData.append("text", text);
  files.forEach((file) => formData.append("files", file));

  return fetch(apiUrl("/api/posts"), {
    method: "POST",
    body: formData,
    credentials: "include",
  }).then(async (res) => {
    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: "Failed" }));
      throw new Error(e.error || "Failed to create post");
    }
    return res.json();
  });
}

export function getUserPosts(userId: number): Promise<Post[]> {
  return apiFetch<Post[]>(`/api/posts/${userId}`);
}

export function likePost(postId: number): Promise<{ liked: boolean }> {
  return apiFetch<{ liked: boolean }>(`/api/posts/${postId}/like`, { method: "POST" });
}

export function getPostDetails(postId: number): Promise<Post> {
  return apiFetch<Post>(`/api/posts/${postId}/details`);
}

export function addPostComment(postId: number, text: string): Promise<PostComment> {
  return apiFetch<PostComment>(`/api/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function deletePostComment(postId: number, commentId: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/posts/${postId}/comments/${commentId}`, {
    method: "DELETE",
  });
}

export function deletePost(postId: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/posts/${postId}`, {
    method: "DELETE",
  });
}


// ============ Teams API ============

export interface Team {
  id: number;
  name: string;
  description: string;
  creatorId: number;
  createdAt: string;
  members: TeamMember[];
}

export interface TeamMember {
  id: number;
  userId: number;
  role: string;
  user: AuthUser;
}

export function getTeams(): Promise<Team[]> {
  return apiFetch<Team[]>('/api/teams');
}

export function createTeam(data: { name: string; description?: string }): Promise<Team> {
  return apiFetch<Team>('/api/teams', { method: 'POST', body: JSON.stringify(data) });
}

export function addTeamMember(teamId: number, data: { userId: number; role?: string }): Promise<TeamMember> {
  return apiFetch<TeamMember>(`/api/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify(data) });
}

// ============ Groups API ============

export interface GroupChat {
  id: number;
  name: string;
  description: string;
  isTeamChat: boolean;
  members: any[];
  messages: any[];
}

export function getGroupChats(): Promise<GroupChat[]> {
  return apiFetch<GroupChat[]>('/api/groups');
}

export function createGroupChat(data: { name?: string; description?: string; userIds: number[]; isTeamChat?: boolean }): Promise<GroupChat> {
  return apiFetch<GroupChat>('/api/groups', { method: 'POST', body: JSON.stringify(data) });
}

export function getGroupMessages(groupId: number): Promise<any[]> {
  return apiFetch<any[]>(`/api/groups/${groupId}/messages`);
}

export function sendGroupMessage(groupId: number, data: { content: string; messageType?: string; attachmentUrl?: string }): Promise<any> {
  return apiFetch<any>(`/api/groups/${groupId}/messages`, { method: 'POST', body: JSON.stringify(data) });
}

// ============ Community Jobs API ============

export interface CommunityJob {
  id: number;
  communityId: number;
  clientId: number;
  title: string;
  description: string;
  budget: number;
  deadline?: string;
  skills: string[];
  status: string;
  escrowDealId?: number;
  createdAt: string;
  client?: { id: number; username: string; displayName: string; avatarUrl?: string };
  _count?: { bids: number };
}

export interface CommunityBidMember {
  id: number;
  userId: number;
  role?: string;
  paymentPercent: number;
  user?: { id: number; username: string; displayName: string; avatarUrl?: string };
}

export interface CommunityBid {
  id: number;
  jobId: number;
  leaderId: number;
  isGroup: boolean;
  coverLetter?: string;
  bidAmount: number;
  estimatedDays?: number;
  status: string;
  createdAt: string;
  leader?: { id: number; username: string; displayName: string; avatarUrl?: string };
  members: CommunityBidMember[];
}

export function getCommunityJobs(communityId: number, status?: string): Promise<CommunityJob[]> {
  const query = status ? `?status=${status}` : '';
  return apiFetch<CommunityJob[]>(`/api/communities/${communityId}/jobs${query}`);
}

export function postCommunityJob(communityId: number, data: { title: string; description: string; budget: number; deadline?: string; skills?: string[] }): Promise<CommunityJob> {
  return apiFetch<CommunityJob>(`/api/communities/${communityId}/jobs`, { method: 'POST', body: JSON.stringify(data) });
}

export function getCommunityJobDetail(communityId: number, jobId: number): Promise<CommunityJob & { bids: CommunityBid[] }> {
  return apiFetch<CommunityJob & { bids: CommunityBid[] }>(`/api/communities/${communityId}/jobs/${jobId}`);
}

export function submitCommunityBid(communityId: number, jobId: number, data: { isGroup: boolean; coverLetter?: string; bidAmount: number; estimatedDays?: number; members?: { userId: number; role?: string; paymentPercent: number }[] }): Promise<CommunityBid> {
  return apiFetch<CommunityBid>(`/api/communities/${communityId}/jobs/${jobId}/bids`, { method: 'POST', body: JSON.stringify(data) });
}

export function withdrawCommunityBid(communityId: number, jobId: number, bidId: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/communities/${communityId}/jobs/${jobId}/bids/${bidId}`, { method: 'DELETE' });
}

export function acceptCommunityBid(communityId: number, jobId: number, bidId: number): Promise<any> {
  return apiFetch<any>(`/api/communities/${communityId}/jobs/${jobId}/bids/${bidId}/accept`, { method: 'POST' });
}

export function rateCommunityJob(communityId: number, jobId: number, data: { reviewedId: number; rating: number; feedback?: string }): Promise<any> {
  return apiFetch<any>(`/api/communities/${communityId}/jobs/${jobId}/ratings`, { method: 'POST', body: JSON.stringify(data) });
}

// ============ Image Sharing API ============

export function shareImageToChat(
  generationId: number,
  data: {
    chatId: string;
    receiverId: number;
    caption?: string;
  }
): Promise<{ success: boolean; message?: string }> {
  return apiFetch<{ success: boolean; message?: string }>(`/api/image-generator/${generationId}/share`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface ImageGeneratorStats {
  todayGenerations: number;
  uniqueUsersToday: number;
  usersAtLimitToday: number;
  isEnabled: boolean;
  dailyLimit: number;
}

export function getImageGeneratorStats(): Promise<ImageGeneratorStats> {
  return apiFetch<ImageGeneratorStats>('/api/admin/image-generator/stats');
}


