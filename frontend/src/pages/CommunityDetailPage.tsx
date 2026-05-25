import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCommunity, joinCommunity, leaveCommunity, getCommunityShareLink, getCommunityMessages, sendCommunityMessage, Message, deleteCommunity } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, Lock, Globe, Calendar, ArrowLeft, 
  MessageSquare, FolderKanban, 
  UserPlus, LogOut, Hash, 
  Send, Link2, Copy, Check, Trash2, ArrowUpRight
} from 'lucide-react';

// ... (Keep existing Interfaces: CommunityMember, Project)

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
      await joinCommunity(Number(id));
      toast({ title: 'Joined', description: 'Collaborative access enabled.' });
      load();
    } catch (err) { toast({ title: 'Error', description: 'Failed to establish connection.', variant: 'destructive' }); }
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

  if (loading) return <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center font-bold text-slate-400 animate-pulse">Syncing Cluster...</div>;
  if (!community) return null;

  const { members, projects, isMember, isCreator } = community;

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
            <div className="w-20 h-20 rounded-2xl bg-[#00A4EF]/10 flex items-center justify-center text-[#00A4EF] font-bold text-4xl shrink-0 border border-[#00A4EF]/10 shadow-sm">
              {community.name[0].toUpperCase()}
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
            {!isCreator && !isMember ? (
              <Button onClick={handleJoin} disabled={joining} className="h-11 rounded-xl bg-[#00A4EF] hover:bg-[#0087d1] text-white font-bold text-xs shadow-md shadow-[#00A4EF]/10">
                <UserPlus className="w-4 h-4 mr-2" /> {joining ? 'Joining...' : 'Request Access'}
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
          {[ { icon: Users, val: members.length, label: 'Members' }, { icon: FolderKanban, val: projects.length, label: 'Blueprints' }, { icon: MessageSquare, val: messages.length, label: 'Logs' }, { icon: Calendar, val: new Date(community.createdAt).getFullYear(), label: 'Provisioned' } ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E0E0E0] p-5 text-center shadow-sm">
              <s.icon className="w-5 h-5 text-[#00A4EF] mx-auto mb-2" />
              <div className="text-xl font-extrabold text-[#1C1C1C]">{s.val}</div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-[#1C1C1C]/40">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Workstream Tabs */}
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="bg-white border border-[#E0E0E0] p-1.5 rounded-2xl h-14">
            {['chat', 'projects', 'members'].map((t) => (
              <TabsTrigger key={t} value={t} className="data-[state=active]:bg-[#1C1C1C] data-[state=active]:text-white font-bold text-xs uppercase tracking-wider rounded-xl h-full px-8 transition-all">
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
                    <div className="flex gap-2">
                      <Input value={messageInput} onChange={(e) => setMessageInput(e.target.value)} placeholder="Broadcast message..." className="bg-white border-[#E0E0E0] rounded-xl h-11" />
                      <Button onClick={handleSendMessage} className="bg-[#00A4EF] hover:bg-[#007BB5] text-white rounded-xl h-11 w-11 shrink-0 p-0">
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
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
          
          {/* Projects and Members Tabs follow same structural pattern... */}
        </Tabs>
      </div>
      {/* Share Dialog ... */}
    </div>
  );
};

export default CommunityDetailPage;