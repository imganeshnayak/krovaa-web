import React, { useEffect, useState } from 'react';
import { listCommunities, getCommunity } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Search, Users, ChevronRight, Lock, Globe, MessageSquare, ArrowUpRight, ShieldCheck } from 'lucide-react';

interface CommunityItem {
  id: number;
  name: string;
  slug: string;
  description?: string;
  isPrivate: boolean;
  creatorId: number;
  createdAt: string;
  memberCount?: number;
}

interface CommunityDetail {
  id: number;
  name: string;
  slug: string;
  description?: string;
  isPrivate: boolean;
  creatorId: number;
  createdAt: string;
  members?: Array<{ id: number; userId: number; role: string; joinedAt: string }>;
  projects?: Array<{ id: number; name: string; description?: string; createdAt: string }>;
  isMember?: boolean;
  isCreator?: boolean;
}

const CommunitiesTabPage = () => {
  const [communities, setCommunities] = useState<CommunityItem[]>([]);
  const [selected, setSelected] = useState<CommunityDetail | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listCommunities();
      setCommunities(data || []);
      if (data && data.length > 0) {
        openCommunity(data[0]);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCommunity = async (c: CommunityItem) => {
    try {
      const full = await getCommunity(c.id) as CommunityDetail;
      setSelected(full);
    } catch (err) { console.error(err); }
  };

  const filteredCommunities = communities.filter(c => 
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.description?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-[#F5F5F5] overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      
      {/* Master View Sidebar */}
      <div className="w-80 border-r border-[#E0E0E0] bg-white flex flex-col shrink-0">
        <div className="p-4 border-b border-[#E0E0E0] flex items-center justify-between bg-white z-10">
          <h2 className="text-base font-bold tracking-tight text-[#1C1C1C]">Hub Clusters</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/communities')}
            className="text-[#00A4EF] font-bold text-xs hover:text-[#007BB5] hover:bg-[#00A4EF]/5 rounded-lg h-8 px-2.5"
          >
            View All
          </Button>
        </div>
        
        {/* Dynamic Search Tool Strip */}
        <div className="p-3 border-b border-[#E0E0E0] bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#1C1C1C]/40" />
            <Input 
              placeholder="Filter nodes by signature..." 
              value={query} 
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-9 bg-white border-[#E0E0E0] text-xs rounded-lg focus:border-[#00A4EF] shadow-none outline-none placeholder:text-[#1C1C1C]/30"
            />
          </div>
        </div>

        {/* Master Node Feed */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-white">
          {loading ? (
            <div className="space-y-2 p-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-50 border border-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            filteredCommunities.map((c) => {
              const isSelected = selected?.id === c.id;
              return (
                <button 
                  key={c.id} 
                  onClick={() => openCommunity(c)} 
                  className={`flex items-start gap-3 w-full p-3 rounded-xl transition-all border text-left ${
                    isSelected 
                      ? 'bg-slate-950 border-slate-950 text-white shadow-sm' 
                      : 'hover:bg-slate-50/80 border-transparent text-[#1C1C1C]'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${
                    isSelected ? 'bg-white/10 text-white border border-white/10' : 'bg-[#00A4EF]/10 text-[#00A4EF] border border-transparent'
                  }`}>
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-bold text-xs truncate tracking-tight">{c.name}</span>
                      {c.isPrivate && (
                        <Lock className={`w-3 h-3 shrink-0 ${isSelected ? 'text-rose-400' : 'text-[#FF6B6B]'}`} />
                      )}
                    </div>
                    <p className={`text-[11px] line-clamp-1 font-normal ${isSelected ? 'text-white/60' : 'text-[#1C1C1C]/50'}`}>
                      {c.description || 'No network summary available.'}
                    </p>
                    <div className="flex items-center gap-1 pt-1">
                      <Users className={`w-3 h-3 ${isSelected ? 'text-white/40' : 'text-[#1C1C1C]/30'}`} />
                      <span className={`text-[10px] font-semibold ${isSelected ? 'text-white/40' : 'text-[#1C1C1C]/40'}`}>
                        {c.memberCount || 0} Nodes
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Detail Workspace View Pane */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#F5F5F5]">
        {selected ? (
          <>
            {/* Context Workspace Control Panel */}
            <div className="p-6 border-b border-[#E0E0E0] bg-white shadow-sm z-10 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-[#E0E0E0] flex items-center justify-center text-[#1C1C1C] font-bold text-xl shadow-sm">
                    {selected.name[0].toUpperCase()}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center flex-wrap gap-2">
                      <h3 style={{ fontFamily: "'Syne', sans-serif" }} className="font-extrabold text-xl text-[#1C1C1C] tracking-tight">{selected.name}</h3>
                      {selected.isPrivate ? (
                        <Badge className="bg-[#FF6B6B]/10 text-[#FF6B6B] border border-[#FF6B6B]/20 font-bold text-[9px] uppercase tracking-wider rounded-md h-5 px-1.5">
                          <Lock className="w-2.5 h-2.5 mr-1 stroke-[2.5]" />
                          Private
                        </Badge>
                      ) : (
                        <Badge className="bg-[#E8F4FF] text-[#0066CC] border border-[#00A4EF]/10 font-bold text-[9px] uppercase tracking-wider rounded-md h-5 px-1.5">
                          <Globe className="w-2.5 h-2.5 mr-1 stroke-[2.5]" />
                          Public
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-[#1C1C1C]/50 max-w-xl leading-relaxed">{selected.description || 'No descriptive structural log updated for this active partition matrix.'}</p>
                  </div>
                </div>
                
                <Button 
                  onClick={() => navigate(`/communities/${selected.id}`)}
                  className="bg-[#00A4EF] hover:bg-[#0087d1] text-white text-xs font-bold h-10 px-4 rounded-xl transition-all shadow-md shadow-[#00A4EF]/10 shrink-0 self-end sm:self-auto"
                >
                  Enter Cluster
                  <ArrowUpRight className="w-3.5 h-3.5 ml-1.5 stroke-[2.5]" />
                </Button>
              </div>
            </div>

            {/* Sub-Workspace Dashboard Workspace Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start max-w-6xl">
                
                {/* Embedded Pipeline Logs / Discussion Preview */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E0E0E0] p-5 sm:p-6 shadow-sm min-h-[300px] flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#1C1C1C]/40 flex items-center gap-2 mb-4">
                      <MessageSquare className="w-4 h-4 text-[#00A4EF]" />
                      Channel Activity Pipeline
                    </h4>
                    
                    {/* Empty Node Workspace Indicator */}
                    <div className="flex flex-col items-center justify-center py-14 border border-dashed border-[#E0E0E0] rounded-xl bg-slate-50/40">
                      <p className="text-xs font-medium text-[#1C1C1C]/40">No localized message sequences broadcasted yet.</p>
                      <Button variant="outline" size="sm" className="mt-3 border-[#E0E0E0] text-xs font-semibold h-8 rounded-lg hover:bg-white transition-all">
                        Initialize Discussion Block
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-[11px] text-[#1C1C1C]/30 font-medium border-t border-slate-50 pt-3 mt-4">
                    Active workspace encryption index synchronized.
                  </div>
                </div>

                {/* Local Network Node Directory (Members Side Panel) */}
                <div className="bg-white rounded-2xl border border-[#E0E0E0] p-5 sm:p-6 shadow-sm space-y-4">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#1C1C1C]/40 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#00A4EF]" />
                    Node Handshakes ({(selected.members || []).length})
                  </h4>
                  
                  <div className="divide-y divide-slate-50 max-h-[360px] overflow-y-auto pr-1">
                    {(selected.members || []).slice(0, 8).map((member, i) => (
                      <div key={member.id || i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 group">
                        <Avatar className="h-9 w-9 border-2 border-white shadow-sm shrink-0">
                          <AvatarFallback className="bg-slate-100 text-[#1C1C1C]/60 text-xs font-bold">
                            M{i + 1}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-[#1C1C1C] truncate group-hover:text-[#00A4EF] transition-colors">Cluster Engineer {i + 1}</div>
                          <div className="text-[10px] font-mono uppercase text-[#1C1C1C]/40 mt-0.5 flex items-center gap-1">
                            {member.role === 'creator' || member.role === 'admin' ? (
                              <ShieldCheck className="w-3 h-3 text-[#00A4EF] shrink-0" />
                            ) : null}
                            {member.role}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {(selected.members || []).length === 0 && (
                      <p className="text-xs text-[#1C1C1C]/40 text-center py-10 italic">No member nodes signed to segment.</p>
                    )}
                  </div>

                  {(selected.members || []).length > 8 && (
                    <Button variant="ghost" size="sm" className="w-full text-xs font-bold text-[#00A4EF] hover:text-[#007BB5] hover:bg-[#00A4EF]/5 rounded-xl mt-2 h-9">
                      View full matrix ({(selected.members || []).length})
                    </Button>
                  )}
                </div>

              </div>
            </div>
          </>
        ) : (
          /* Blank Frame Initial State Pointer */
          <div className="flex-1 flex items-center justify-center bg-white">
            <div className="text-center max-w-sm p-4">
              <div className="w-14 h-14 bg-slate-50 border border-[#E0E0E0] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Users className="w-5 h-5 text-[#1C1C1C]/30" />
              </div>
              <p className="text-sm font-bold text-[#1C1C1C] tracking-tight">Select a Community Node</p>
              <p className="text-xs text-[#1C1C1C]/40 mt-1">Choose from the directory matrix on the left sidebar map to engage the live dashboard ecosystem workspace.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunitiesTabPage;