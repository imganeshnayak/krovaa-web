import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCommunity, joinCommunity, leaveCommunity, getCommunityShareLink, getCommunityMessages, sendCommunityMessage, Message, deleteCommunity } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, Lock, Globe, Calendar, ArrowLeft, 
  MessageSquare, FolderKanban, Settings, 
  UserPlus, LogOut, ChevronRight, Hash, 
  Send, Link2, Copy, Check, X, Trash2
} from 'lucide-react';

interface CommunityMember {
  id: number;
  userId: number;
  role: string;
  joinedAt: string;
  user?: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
}

interface Project {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  createdBy?: number;
}

const CommunityDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => { if (id) load(); }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getCommunity(Number(id));
      setCommunity(res);
      if (res.isMember) {
        loadMessages();
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to load', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const loadMessages = async () => {
    try {
      const msgs = await getCommunityMessages(Number(id));
      setMessages(msgs || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleJoin = async () => {
    if (!id) return;
    setJoining(true);
    try {
      await joinCommunity(Number(id));
      toast({ title: 'Success', description: 'You have joined the community!' });
      load();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to join', variant: 'destructive' });
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!id) return;
    try {
      await leaveCommunity(Number(id));
      toast({ title: 'Left', description: 'You have left the community' });
      load();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to leave', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('Are you sure you want to delete this community? This action cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteCommunity(Number(id));
      toast({ title: 'Deleted', description: 'Community has been deleted' });
      navigate('/communities');
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !id) return;
    setSending(true);
    try {
      const newMsg = await sendCommunityMessage(Number(id), messageInput.trim());
      setMessages(prev => [...prev, newMsg]);
      setMessageInput('');
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to send message', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleShare = async () => {
    if (!id) return;
    try {
      const data = await getCommunityShareLink(Number(id));
      setShareLink(data.shareLink);
      setShowShareDialog(true);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to get share link', variant: 'destructive' });
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#00A4EF] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#1C1C1C]/60">Loading community...</p>
        </div>
      </div>
    );
  }

  if (!community) return null;

  const members: CommunityMember[] = community.members || [];
  const projects: Project[] = community.projects || [];
  const isMember = community.isMember || false;
  const isCreator = community.isCreator || false;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="min-h-screen bg-[#F5F5F5] text-[#1C1C1C] pb-20">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <button onClick={() => navigate('/communities')} className="text-[#1C1C1C]/60 hover:text-[#1C1C1C] transition-colors flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        {/* Community Header */}
        <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
          <div className="flex items-start gap-6 mb-6">
            <div className="w-20 h-20 rounded-lg bg-[#00A4EF]/10 flex items-center justify-center text-[#00A4EF] font-bold text-3xl shrink-0">
              {community.name[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 style={{ fontFamily: "'Syne', sans-serif" }} className="text-2xl font-bold text-[#1C1C1C]">{community.name}</h1>
                {community.isPrivate ? (
                  <Badge className="bg-[#FF6B6B]/10 text-[#FF6B6B] border-0">
                    <Lock className="w-3 h-3 mr-1" />
                    Private
                  </Badge>
                ) : (
                  <Badge className="bg-[#00A4EF]/10 text-[#00A4EF] border-0">
                    <Globe className="w-3 h-3 mr-1" />
                    Public
                  </Badge>
                )}
              </div>
              <p className="text-[#1C1C1C]/60">{community.description || 'No description'}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleShare} variant="outline" className="border-[#E0E0E0] text-[#1C1C1C] hover:bg-[#F5F5F5]">
              <Link2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            {!isCreator && !isMember ? (
              <Button onClick={handleJoin} disabled={joining} className="bg-[#00A4EF] hover:bg-[#007BB5] text-white">
                <UserPlus className="w-4 h-4 mr-2" />
                {joining ? 'Joining...' : 'Join'}
              </Button>
            ) : isMember && !isCreator ? (
              <Button onClick={handleLeave} variant="outline" className="text-[#FF6B6B] border-[#FF6B6B] hover:bg-[#FF6B6B]/5">
                <LogOut className="w-4 h-4 mr-2" />
                Leave
              </Button>
            ) : (
              <Button onClick={handleDelete} disabled={deleting} variant="outline" className="text-[#FF6B6B] border-[#FF6B6B] hover:bg-[#FF6B6B]/5">
                <Trash2 className="w-4 h-4 mr-2" />
                {deleting ? 'Deleting...' : 'Delete Community'}
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-[#E0E0E0] p-4 text-center">
            <Users className="w-6 h-6 text-[#00A4EF] mx-auto mb-2" />
            <div className="text-2xl font-bold text-[#1C1C1C]">{members.length}</div>
            <div className="text-sm text-[#1C1C1C]/60">Members</div>
          </div>
          <div className="bg-white rounded-lg border border-[#E0E0E0] p-4 text-center">
            <FolderKanban className="w-6 h-6 text-[#00A4EF] mx-auto mb-2" />
            <div className="text-2xl font-bold text-[#1C1C1C]">{projects.length}</div>
            <div className="text-sm text-[#1C1C1C]/60">Projects</div>
          </div>
          <div className="bg-white rounded-lg border border-[#E0E0E0] p-4 text-center">
            <MessageSquare className="w-6 h-6 text-[#00A4EF] mx-auto mb-2" />
            <div className="text-2xl font-bold text-[#1C1C1C]">{messages.length}</div>
            <div className="text-sm text-[#1C1C1C]/60">Messages</div>
          </div>
          <div className="bg-white rounded-lg border border-[#E0E0E0] p-4 text-center">
            <Calendar className="w-6 h-6 text-[#00A4EF] mx-auto mb-2" />
            <div className="text-sm font-medium text-[#1C1C1C]">
              {new Date(community.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </div>
            <div className="text-sm text-[#1C1C1C]/60">Created</div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="bg-white border-[#E0E0E0] border w-full justify-start rounded-lg p-1">
            <TabsTrigger value="chat" className="data-[state=active]:bg-[#00A4EF] data-[state=active]:text-white rounded-md">
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="projects" className="data-[state=active]:bg-[#00A4EF] data-[state=active]:text-white rounded-md">
              <FolderKanban className="w-4 h-4 mr-2" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="members" className="data-[state=active]:bg-[#00A4EF] data-[state=active]:text-white rounded-md">
              <Users className="w-4 h-4 mr-2" />
              Members ({members.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="mt-6">
            <div className="bg-white rounded-lg border border-[#E0E0E0] overflow-hidden">
              <div className="h-[500px] flex flex-col">
                {isMember ? (
                  <>
                    <div className="flex-1 overflow-auto p-4 space-y-4">
                      {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-[#1C1C1C]/60">
                          <MessageSquare className="w-12 h-12 text-[#00A4EF]/20 mb-4" />
                          <p className="font-medium mb-2">No messages yet</p>
                          <p className="text-sm">Be the first to send a message!</p>
                        </div>
                      ) : (
                        messages.map((msg) => (
                          <div key={msg.id} className="flex gap-3 hover:bg-[#F5F5F5] p-2 rounded-lg transition-colors">
                            <Avatar className="h-10 w-10 shrink-0">
                              <AvatarImage src={msg.sender?.avatarUrl} />
                              <AvatarFallback className="bg-[#00A4EF]/10 text-[#00A4EF] text-sm">
                                {msg.sender?.displayName?.[0] || msg.sender?.username?.[0] || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 mb-1">
                                <span className="font-medium text-sm text-[#1C1C1C]">
                                  {msg.sender?.displayName || msg.sender?.username}
                                </span>
                                <span className="text-xs text-[#1C1C1C]/40">
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-sm text-[#1C1C1C] break-words">{msg.content}</p>
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                    <div className="p-4 border-t border-[#E0E0E0] bg-[#F5F5F5]">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Type a message..."
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                          className="flex-1 bg-white border-[#E0E0E0] focus:border-[#00A4EF]"
                          disabled={sending}
                        />
                        <Button 
                          onClick={handleSendMessage} 
                          disabled={!messageInput.trim() || sending}
                          className="bg-[#00A4EF] hover:bg-[#007BB5]"
                        >
                          {sending ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-[#1C1C1C]/60 p-8">
                    <Lock className="w-12 h-12 text-[#00A4EF]/20 mb-4" />
                    <p className="font-medium mb-2">Join to access chat</p>
                    <p className="text-sm mb-4">You need to be a member to send messages</p>
                    {!isCreator && (
                      <Button onClick={handleJoin} disabled={joining} className="bg-[#00A4EF] hover:bg-[#007BB5]">
                        <UserPlus className="w-4 h-4 mr-2" />
                        {joining ? 'Joining...' : 'Join Community'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Projects</h3>
              {(isMember || isCreator) && (
                <Button size="sm" className="bg-[#00A4EF] hover:bg-[#007BB5] text-white">
                  <FolderKanban className="w-4 h-4 mr-2" />
                  New Project
                </Button>
              )}
            </div>
            {projects.length === 0 ? (
              <div className="bg-white rounded-lg border border-[#E0E0E0] py-12 text-center">
                <FolderKanban className="w-12 h-12 text-[#00A4EF]/20 mx-auto mb-4" />
                <h4 className="font-medium mb-2">No projects yet</h4>
                <p className="text-[#1C1C1C]/60 text-sm">{(isMember || isCreator) ? 'Start a new project' : 'Join to create projects'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map((project) => (
                  <div key={project.id} className="bg-white rounded-lg border border-[#E0E0E0] hover:border-[#00A4EF] p-4 transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-[#1C1C1C]">{project.name}</h4>
                    </div>
                    <p className="text-sm text-[#1C1C1C]/60 line-clamp-2 mb-3">{project.description || 'No description'}</p>
                    <div className="text-xs text-[#1C1C1C]/40">{new Date(project.createdAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="members" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Members</h3>
              <Badge variant="secondary">{members.length} members</Badge>
            </div>
            {members.length === 0 ? (
              <div className="bg-white rounded-lg border border-[#E0E0E0] py-12 text-center">
                <Users className="w-12 h-12 text-[#00A4EF]/20 mx-auto mb-4" />
                <h4 className="font-medium mb-2">No members yet</h4>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {members.map((member) => (
                  <div 
                    key={member.id}
                    className="flex items-center gap-3 p-4 bg-white rounded-lg border border-[#E0E0E0] hover:border-[#00A4EF] transition-all"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.user?.avatarUrl} />
                      <AvatarFallback className="bg-[#00A4EF]/10 text-[#00A4EF] text-sm">
                        {member.user?.displayName?.[0] || member.user?.username?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[#1C1C1C] truncate">
                        {member.user?.displayName || member.user?.username}
                      </div>
                      <div className="text-xs text-[#1C1C1C]/60 capitalize">
                        {member.role}
                      </div>
                    </div>
                    {member.role === 'owner' && (
                      <Badge className="bg-[#00A4EF]/10 text-[#00A4EF]">Owner</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-[#00A4EF]" />
              Share Community
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-[#1C1C1C]/60">
              Share this link to invite others to join "{community?.name}"
            </p>
            <div className="flex gap-2">
              <Input 
                value={shareLink} 
                readOnly
                className="flex-1 bg-[#F5F5F5] border-[#E0E0E0]"
              />
              <Button onClick={copyShareLink} variant="outline" className="shrink-0 border-[#E0E0E0] hover:bg-[#F5F5F5]">
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2 p-3 bg-[#00A4EF]/10 rounded-lg">
              <Globe className="w-4 h-4 text-[#00A4EF]" />
              <span className="text-sm text-[#00A4EF]">
                {community?.isPrivate ? 'Only approved members can join' : 'Anyone with this link can join'}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommunityDetailPage;