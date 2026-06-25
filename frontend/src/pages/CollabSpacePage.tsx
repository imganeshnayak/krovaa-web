import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getCollabProject, ProjectListing, fundCollabProject, getCommunityMessages, sendCommunityMessage, Message } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Users, IndianRupee, Send, ShieldCheck, Milestone, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import WorkspaceDrawer from "@/components/collab/WorkspaceDrawer";

export default function CollabSpacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [project, setProject] = useState<ProjectListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [funding, setFunding] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const loadProject = async () => {
    try {
      const data = await getCollabProject(Number(id));
      setProject(data);
      if (data.status === 'ACTIVE_WORKSPACE' && data.collabCommunityId) {
        loadMessages(data.collabCommunityId);
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to load project.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (communityId: number) => {
    try {
      const msgs = await getCommunityMessages(communityId);
      setMessages(msgs || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadProject();
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFund = async () => {
    if (!project) return;
    setFunding(true);
    try {
      await fundCollabProject(project.id);
      toast({ title: "Escrow Funded", description: "The workspace is now active." });
      loadProject();
    } catch (err: any) {
      toast({ title: "Funding Failed", description: err.message, variant: "destructive" });
    } finally {
      setFunding(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !project?.collabCommunityId) return;
    
    setSending(true);
    try {
      const newMsg = await sendCommunityMessage(project.collabCommunityId, messageInput.trim());
      setMessages(prev => [...prev, newMsg]);
      setMessageInput("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send message", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-slate-500 animate-pulse font-bold">Initializing Collab Space...</div>;
  }

  if (!project) {
    return <div className="p-8 text-center text-slate-500">Project not found.</div>;
  }

  const isCreator = user?.id === project.creatorId;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-10">
         <div className="flex items-center gap-3">
            <button onClick={() => navigate('/explore')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
               <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
               <h1 className="text-lg font-bold text-slate-900 tracking-tight">{project.title}</h1>
               <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                 <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                 Escrow Protected • {project.status.replace('_', ' ')}
               </div>
            </div>
         </div>
         {project.status === 'ACTIVE_WORKSPACE' && (
            <div className="flex items-center gap-2">
               <div className="flex -space-x-2 mr-2">
                 {project.seats.filter(s=>s.user).map(s => (
                   <img key={s.id} src={s.user!.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${s.user!.username}`} className="w-7 h-7 rounded-full ring-2 ring-white" title={s.user!.displayName} />
                 ))}
               </div>
               <button onClick={() => setIsDrawerOpen(true)} className="bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm">
                 <Milestone className="w-3.5 h-3.5" /> Manage Milestones
               </button>
            </div>
         )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex relative">
         
         {project.status === 'FUNDING_PENDING' ? (
           <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center max-w-2xl mx-auto">
             <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-sm w-full">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                   <Zap className="w-10 h-10 text-blue-500" />
                </div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">Squad Assembled</h2>
                <p className="text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">
                  The team for <strong>{project.title}</strong> has been selected. Fund the escrow to officially launch the Collab Space and begin work.
                </p>

                <div className="bg-slate-50 rounded-2xl p-6 mb-8 text-left border border-slate-100">
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Contract Details</h3>
                   <div className="space-y-4">
                     <div className="flex justify-between items-center pb-4 border-b border-slate-200/60">
                        <span className="text-sm font-bold text-slate-700">Total Escrow Required</span>
                        <span className="text-lg font-bold text-slate-900 flex items-center"><IndianRupee className="w-4 h-4 mr-0.5" /> {project.baseBudget}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-700">Team Size</span>
                        <span className="text-sm font-bold text-slate-900 flex items-center"><Users className="w-4 h-4 mr-1.5 text-slate-400" /> {project.seats.filter(s=>s.status==='OCCUPIED').length} Members</span>
                     </div>
                   </div>
                </div>

                {isCreator ? (
                  <Button 
                    className="w-full h-14 text-base font-bold bg-[#00A4EF] hover:bg-[#0087d1] text-white shadow-lg shadow-blue-500/20"
                    onClick={handleFund}
                    disabled={funding}
                  >
                    {funding ? "Processing Funding..." : `Fund Escrow & Launch Workspace`}
                  </Button>
                ) : (
                  <div className="p-4 bg-amber-50 text-amber-700 rounded-xl text-sm font-bold border border-amber-200 inline-block w-full">
                    Waiting for the client to fund the escrow...
                  </div>
                )}
             </div>
           </div>
         ) : project.status === 'ACTIVE_WORKSPACE' || project.status === 'COMPLETED' ? (
           <div className="flex-1 flex flex-col h-full bg-[#f8fafc]">
             {/* Chat Messages */}
             <div className="flex-1 overflow-y-auto p-4 space-y-4">
               {messages.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <ShieldCheck className="w-12 h-12 opacity-20" />
                    <p className="text-sm font-medium">Welcome to the Collab Space. The escrow is secured.</p>
                 </div>
               ) : (
                 messages.map((msg, i) => {
                   const isSystem = msg.messageType === 'system';
                   const isMe = msg.sender?.id === user?.id;
                   
                   if (isSystem) {
                     return (
                       <div key={i} className="flex justify-center my-6">
                         <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-xs font-bold shadow-sm inline-flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5" /> {msg.content}
                         </div>
                       </div>
                     );
                   }

                   return (
                     <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                       <div className={`max-w-[75%] flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                         {!isMe && (
                           <img src={msg.sender?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${msg.sender?.username}`} className="w-8 h-8 rounded-full shrink-0 shadow-sm" />
                         )}
                         <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                           {!isMe && <span className="text-[10px] font-bold text-slate-500 mb-1 ml-1">{msg.sender?.displayName}</span>}
                           <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm ${
                             isMe ? 'bg-slate-900 text-white rounded-tr-sm' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm'
                           }`}>
                             {msg.content}
                           </div>
                         </div>
                       </div>
                     </div>
                   );
                 })
               )}
               <div ref={messagesEndRef} />
             </div>

             {/* Input Area */}
             <div className="p-4 bg-white border-t border-slate-200 shrink-0">
               <form onSubmit={handleSendMessage} className="flex items-center gap-2 max-w-4xl mx-auto">
                 <input
                   type="text"
                   value={messageInput}
                   onChange={e => setMessageInput(e.target.value)}
                   placeholder="Message the squad..."
                   className="flex-1 h-12 bg-slate-100 border-none focus:ring-2 focus:ring-[#00A4EF]/20 rounded-xl px-4 text-sm"
                   disabled={sending}
                 />
                 <Button type="submit" disabled={!messageInput.trim() || sending} className="h-12 w-12 rounded-xl bg-[#00A4EF] hover:bg-[#0087d1] text-white p-0 shrink-0 shadow-sm">
                   <Send className="w-5 h-5" />
                 </Button>
               </form>
             </div>
           </div>
         ) : (
           <div className="flex-1 flex items-center justify-center p-6 text-slate-500 font-medium">
              Project is in an unknown state: {project.status}
           </div>
         )}
      </div>

      <WorkspaceDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        project={project}
        onUpdate={loadProject}
      />
    </div>
  );
}
