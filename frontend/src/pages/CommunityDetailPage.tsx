import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCommunity, joinCommunity, leaveCommunity, getCommunityShareLink, getCommunityMessages, sendCommunityMessage, Message, deleteCommunity, updateCommunityAvatar, approveCommunityMember } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, Lock, Globe, Calendar, ArrowLeft, 
  MessageSquare, FolderKanban, 
  UserPlus, LogOut, Hash, 
  Send, Link2, Copy, Check, Trash2, ArrowUpRight,
  Camera, CheckCircle, Clock
} from 'lucide-react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => { if (id) load(); }, [id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getCommunity(Number(id));
      setCommunity(res);
      if (res.isMember) loadMessages();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to synchronize workspace data', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const loadMessages = async () => {
    try {
      const msgs = await getCommunityMessages(Number(id));
      setMessages(msgs || []);
    } catch (err) { console.error('Failed to load messages:', err); }
  };

  const handleJoin = async () => {
    if (!id) return;
    setJoining(true);
    try {
      const res = await joinCommunity(Number(id));
      if (res.status === 'pending') {
        toast({ title: 'Request Sent', description: 'Your request to join is pending approval.' });
      } else {
        toast({ title: 'Joined', description: 'Collaborative access enabled.' });
      }
      load();
    } catch (err: any) { 
      toast({ title: 'Error', description: err.message || 'Failed to establish connection.', variant: 'destructive' }); 
    }
    finally { setJoining(false); }
  };

  const handleLeave = async () => {
    if (!id) return;
    try {
      await leaveCommunity(Number(id));
      toast({ title: 'Left', description: 'Cluster access removed.' });
      load();
    } catch (err) { toast({ title: 'Error', description: 'Failed to disengage.', variant: 'destructive' }); }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('Delete this workspace node? This action is irreversible.')) return;
    setDeleting(true);
    try {
      await deleteCommunity(Number(id));
      navigate('/communities');
    } catch (err) { toast({ title: 'Error', description: 'Failed to terminate workspace.', variant: 'destructive' }); }
    finally { setDeleting(false); }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !id) return;
    setSending(true);
    try {
      const newMsg = await sendCommunityMessage(Number(id), messageInput.trim());
      setMessages(prev => [...prev, newMsg]);
      setMessageInput('');
    } catch (err) { toast({ title: 'Error', description: 'Transmission failed.', variant: 'destructive' }); }
    finally { setSending(false); }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !id) return;
    const file = e.target.files[0];
    try {
      toast({ title: 'Uploading', description: 'Updating community avatar...' });
      await updateCommunityAvatar(Number(id), file);
      toast({ title: 'Success', description: 'Community avatar updated.' });
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update avatar.', variant: 'destructive' });
    }
  };

  const handleApproveMember = async (userId: number) => {
    if (!id) return;
    try {
      await approveCommunityMember(Number(id), userId);
      toast({ title: 'Success', description: 'Member approved.' });
      load();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to approve member.', variant: 'destructive' });
    }
  };

  if (loading && !community) return <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center font-bold text-slate-400 animate-pulse">Syncing Cluster...</div>;
  if (!community) return null;

  const { members = [], projects = [], isMember, isCreator, isPending } = community;
  const approvedMembers = members.filter((m: any) => m.status === 'approved' || m.userId === community.creatorId);
  const pendingMembers = members.filter((m: any) => m.status === 'pending');

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="min-h-screen bg-[#F5F5F5] text-[#1C1C1C] pb-20">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        
        {/* Navigation Control */}
        <button onClick={() => navigate('/communities')} className="text-[#1C1C1C]/40 hover:text-[#1C1C1C] transition-colors flex items-center gap-2 text-sm font-bold tracking-wider uppercase">
          <ArrowLeft className="w-4 h-4" />
          Navigate Back
        </button>

        {/* Immersive Community Header Block */}
        <div className="bg-white rounded-[2rem] border border-[#E0E0E0] p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
            <div className="relative group">
              <Avatar className="w-24 h-24 rounded-2xl border-2 border-[#00A4EF]/10 shadow-sm">
                <AvatarImage src={community.avatarUrl} className="object-cover" />
                <AvatarFallback className="bg-[#00A4EF]/10 text-[#00A4EF] font-bold text-4xl rounded-2xl">
                  {community.name[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isCreator && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera className="w-6 h-6 text-white" />
                </button>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 style={{ fontFamily: "'Syne', sans-serif" }} className="text-3xl font-extrabold text-[#1C1C1C] tracking-tight">{community.name}</h1>
                {community.isPrivate ? (
                  <Badge className="bg-[#FF6B6B]/10 text-[#FF6B6B] border border-[#FF6B6B]/20 font-bold text-[10px] uppercase tracking-wider h-6 rounded-md">
                    <Lock className="w-3 h-3 mr-1" /> Private
                  </Badge>
                ) : (
                  <Badge className="bg-[#E8F4FF] text-[#0066CC] border border-[#00A4EF]/10 font-bold text-[10px] uppercase tracking-wider h-6 rounded-md">
                    <Globe className="w-3 h-3 mr-1" /> Public
                  </Badge>
                )}
              </div>
              <p className="text-sm text-[#1C1C1C]/60 max-w-2xl leading-relaxed">{community.description || 'No descriptive structural parameters initialized for this workspace.'}</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button onClick={() => { getCommunityShareLink(Number(id)).then(d => { setShareLink(d.shareLink); setShowShareDialog(true); }) }} variant="outline" className="h-11 rounded-xl border-[#E0E0E0] font-bold text-xs hover:bg-slate-50">
              <Link2 className="w-4 h-4 mr-2" /> Share Node
            </Button>
            {!isCreator && !isMember && !isPending ? (
              <Button onClick={handleJoin} disabled={joining} className="h-11 rounded-xl bg-[#00A4EF] hover:bg-[#0087d1] text-white font-bold text-xs shadow-md shadow-[#00A4EF]/10">
                <UserPlus className="w-4 h-4 mr-2" /> {joining ? 'Joining...' : 'Request Access'}
              </Button>
            ) : isPending ? (
              <Button disabled variant="outline" className="h-11 rounded-xl border-[#00A4EF] text-[#00A4EF] font-bold text-xs">
                <Clock className="w-4 h-4 mr-2" /> Request Pending
              </Button>
            ) : isMember && !isCreator ? (
              <Button onClick={handleLeave} variant="outline" className="h-11 rounded-xl text-[#FF6B6B] border-[#FF6B6B] hover:bg-[#FF6B6B]/5 font-bold text-xs">
                <LogOut className="w-4 h-4 mr-2" /> Disengage
              </Button>
            ) : (
              <Button onClick={handleDelete} disabled={deleting} variant="outline" className="h-11 rounded-xl text-[#FF6B6B] border-[#FF6B6B] hover:bg-[#FF6B6B]/5 font-bold text-xs">
                <Trash2 className="w-4 h-4 mr-2" /> Terminate Cluster
              </Button>
            )}
          </div>
        </div>

        {/* Dashboard Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[ { icon: Users, val: community.memberCount, label: 'Members' }, { icon: FolderKanban, val: projects.length, label: 'Blueprints' }, { icon: MessageSquare, val: messages.length, label: 'Logs' }, { icon: Calendar, val: new Date(community.createdAt).getFullYear(), label: 'Provisioned' } ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E0E0E0] p-5 text-center shadow-sm">
              <s.icon className="w-5 h-5 text-[#00A4EF] mx-auto mb-2" />
              <div className="text-xl font-extrabold text-[#1C1C1C]">{s.val}</div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-[#1C1C1C]/40">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Workstream Tabs */}
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="bg-white border border-[#E0E0E0] p-1.5 rounded-2xl h-14 w-full flex overflow-x-auto no-scrollbar">
            {['chat', 'projects', 'members'].map((t) => (
              <TabsTrigger key={t} value={t} className="flex-1 data-[state=active]:bg-[#1C1C1C] data-[state=active]:text-white font-bold text-xs uppercase tracking-wider rounded-xl h-full px-4 transition-all whitespace-nowrap">
                {t}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="chat" className="mt-6">
            <div className="bg-white rounded-[2rem] border border-[#E0E0E0] overflow-hidden shadow-sm h-[500px] flex flex-col">
              {isMember ? (
                <>
                  <div className="flex-1 overflow-auto p-6 space-y-6">
                    {messages.map((msg) => (
                      <div key={msg.id} className="flex gap-4">
                        <Avatar className="h-10 w-10 shrink-0 border border-[#E0E0E0]">
                          <AvatarImage src={msg.sender?.avatarUrl} />
                          <AvatarFallback className="bg-[#00A4EF]/5 text-[#00A4EF] font-bold text-xs">
                            {msg.sender?.displayName?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-bold text-sm text-[#1C1C1C]">{msg.sender?.displayName}</span>
                            <span className="text-[10px] font-mono text-[#1C1C1C]/30">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-sm text-[#1C1C1C]/70 leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="p-4 border-t border-[#E0E0E0] bg-[#F5F5F5]">
                    <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex gap-2">
                      <Input value={messageInput} onChange={(e) => setMessageInput(e.target.value)} placeholder="Broadcast message..." className="bg-white border-[#E0E0E0] rounded-xl h-11" />
                      <Button type="submit" disabled={sending} className="bg-[#00A4EF] hover:bg-[#007BB5] text-white rounded-xl h-11 w-11 shrink-0 p-0">
                        <Send className="w-4 h-4" />
                      </Button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#1C1C1C]/40">
                  <Lock className="w-12 h-12 mb-4 text-[#00A4EF]/10" />
                  <p className="font-bold text-[#1C1C1C]">Restricted Pipeline</p>
                  <p className="text-xs mb-6">Join to broadcast or view logs.</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="projects" className="mt-6">
            <div className="bg-white rounded-[2rem] border border-[#E0E0E0] p-8 shadow-sm min-h-[300px]">
              {isMember ? (
                projects.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {projects.map((p: any) => (
                      <div key={p.id} className="p-4 rounded-xl border border-[#E0E0E0] hover:border-[#00A4EF]/30 transition-colors cursor-pointer flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-[#1C1C1C]">{p.name}</h3>
                          <p className="text-sm text-[#1C1C1C]/60 line-clamp-1">{p.description}</p>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-[#1C1C1C]/40" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-[#1C1C1C]/40">
                    <FolderKanban className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No blueprints initialized yet.</p>
                  </div>
                )
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-[#1C1C1C]/40 py-12">
                  <Lock className="w-12 h-12 mb-4 text-[#00A4EF]/10" />
                  <p className="font-bold">Access Denied</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="members" className="mt-6">
            <div className="bg-white rounded-[2rem] border border-[#E0E0E0] p-8 shadow-sm">
              {isCreator && pendingMembers.length > 0 && (
                <div className="mb-8">
                  <h3 className="font-bold text-lg mb-4 text-[#1C1C1C] flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#FF9900]" /> Pending Requests
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pendingMembers.map((m: any) => (
                      <div key={m.userId} className="flex items-center justify-between p-4 rounded-xl border border-[#E0E0E0]">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={m.user?.avatarUrl} />
                            <AvatarFallback>{m.user?.displayName?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-bold text-sm text-[#1C1C1C]">{m.user?.displayName}</p>
                            <p className="text-xs text-[#1C1C1C]/60">Requested access</p>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => handleApproveMember(m.userId)} className="bg-[#00A4EF] hover:bg-[#0087d1] text-white rounded-lg px-3">
                          <CheckCircle className="w-4 h-4 mr-1" /> Approve
                        </Button>
                      </div>
                    ))}
                  </div>
                  <hr className="my-8 border-[#E0E0E0]" />
                </div>
              )}

              <h3 className="font-bold text-lg mb-4 text-[#1C1C1C]">Active Members ({community.memberCount})</h3>
              {isMember ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Ensure Creator is shown first if in the list */}
                  {[
                    ...(community.creator ? [{ user: community.creator, role: 'owner' }] : []),
                    ...approvedMembers.filter((m: any) => m.userId !== community.creatorId)
                  ].map((m: any) => (
                    <div key={m.user?.id || Math.random()} className="flex items-center gap-4 p-4 rounded-xl border border-[#E0E0E0] bg-[#F9F9F9]">
                      <Avatar className="h-12 w-12 shrink-0 border border-[#E0E0E0]">
                        <AvatarImage src={m.user?.avatarUrl} />
                        <AvatarFallback className="bg-white font-bold text-[#1C1C1C]">{m.user?.displayName?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <div className="font-bold text-sm text-[#1C1C1C] truncate">{m.user?.displayName}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#1C1C1C]/50 mt-1">
                          {m.role === 'owner' || m.user?.id === community.creatorId ? 'Creator / Admin' : 'Member'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-[#1C1C1C]/40 py-12 border border-[#E0E0E0] rounded-xl bg-[#F9F9F9]">
                  <Lock className="w-12 h-12 mb-4 text-[#00A4EF]/10" />
                  <p className="font-bold">Access Denied</p>
                  <p className="text-xs">Join community to view members.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold text-xl">Share Workspace Node</DialogTitle>
            <DialogDescription>
              Anyone with this link can {community.isPrivate ? 'request access' : 'join'} the cluster.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 mt-4">
            <div className="grid flex-1 gap-2">
              <Input
                readOnly
                value={shareLink}
                className="bg-[#F5F5F5] font-mono text-xs text-[#1C1C1C]/70"
              />
            </div>
            <Button size="sm" onClick={copyShareLink} className="px-3 rounded-lg bg-[#1C1C1C] hover:bg-black text-white">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommunityDetailPage;