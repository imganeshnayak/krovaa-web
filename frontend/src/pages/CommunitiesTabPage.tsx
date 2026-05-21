import React, { useEffect, useState } from 'react';
import { listCommunities, getCommunity } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Search, Users, ChevronRight, Lock, Globe } from 'lucide-react';

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
    <div className="h-full flex bg-[#F5F5F5]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="w-80 border-r border-[#E0E0E0] bg-white">
        <div className="p-4 border-b border-[#E0E0E0] flex items-center justify-between">
          <h2 className="text-lg font-semibold">Communities</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/communities')}
            className="text-[#00A4EF] hover:text-[#007BB5] hover:bg-[#00A4EF]/10"
          >
            View All
          </Button>
        </div>
        <div className="p-3 border-b border-[#E0E0E0]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1C1C1C]/40" />
            <Input 
              placeholder="Search communities..." 
              value={query} 
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 bg-[#F5F5F5] border-[#E0E0E0] focus:border-[#00A4EF]"
            />
          </div>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-[#F5F5F5] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="p-2 overflow-auto h-[calc(100vh-140px)]">
            <div className="space-y-2">
              {filteredCommunities.map((c) => (
                <button 
                  key={c.id} 
                  onClick={() => openCommunity(c)} 
                  className={`flex items-center gap-3 w-full p-3 rounded-lg transition-all duration-200 ${
                    selected?.id === c.id 
                      ? 'bg-[#00A4EF]/10 border border-[#00A4EF]' 
                      : 'hover:bg-[#F5F5F5] border border-transparent'
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg bg-[#00A4EF]/10 flex items-center justify-center text-[#00A4EF] font-bold text-lg shrink-0">
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#1C1C1C] truncate">{c.name}</span>
                      {c.isPrivate && (
                        <Lock className="w-3 h-3 text-[#FF6B6B] shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-[#1C1C1C]/60 truncate">{c.description || 'No description'}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[#00A4EF] flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {c.memberCount || 0}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="p-6 border-b border-[#E0E0E0] bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-[#00A4EF]/10 flex items-center justify-center text-[#00A4EF] font-bold text-2xl">
                    {selected.name[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 style={{ fontFamily: "'Syne', sans-serif" }} className="font-bold text-xl text-[#1C1C1C]">{selected.name}</h3>
                      {selected.isPrivate ? (
                        <Badge className="bg-[#FF6B6B]/10 text-[#FF6B6B]">
                          <Lock className="w-3 h-3 mr-1" />
                          Private
                        </Badge>
                      ) : (
                        <Badge className="bg-[#00A4EF]/10 text-[#00A4EF]">
                          <Globe className="w-3 h-3 mr-1" />
                          Public
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-[#1C1C1C]/60 max-w-md">{selected.description || 'No description'}</p>
                  </div>
                </div>
                <Button 
                  onClick={() => navigate(`/communities/${selected.id}`)}
                  className="bg-[#00A4EF] hover:bg-[#007BB5] text-white"
                >
                  Open
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                <div className="lg:col-span-2 bg-white rounded-lg border border-[#E0E0E0] p-6 overflow-auto">
                  <h4 className="font-semibold text-lg mb-4">Community Feed</h4>
                  <div className="flex items-center justify-center h-48 text-[#1C1C1C]/60">
                    <div className="text-center">
                      <p className="mb-2">No messages yet</p>
                      <Button variant="outline" size="sm" className="border-[#E0E0E0] hover:bg-[#F5F5F5]">
                        Start discussion
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-[#E0E0E0] p-6 overflow-auto">
                  <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#00A4EF]" />
                    Members ({(selected.members || []).length})
                  </h4>
                  <div className="space-y-3">
                    {(selected.members || []).slice(0, 8).map((member, i) => (
                      <div key={member.id || i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#F5F5F5] transition-colors">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-[#00A4EF]/10 text-[#00A4EF] text-sm">
                            {String(i + 1)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">Member {i + 1}</div>
                          <div className="text-xs text-[#1C1C1C]/60 capitalize">{member.role}</div>
                        </div>
                      </div>
                    ))}
                    {(selected.members || []).length === 0 && (
                      <p className="text-sm text-[#1C1C1C]/60 text-center py-8">No members yet</p>
                    )}
                    {(selected.members || []).length > 8 && (
                      <Button variant="ghost" size="sm" className="w-full text-[#00A4EF] hover:text-[#007BB5]">
                        View all {(selected.members || []).length} members
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#1C1C1C]/60 bg-white">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-[#00A4EF]/20" />
              <p className="text-lg font-medium">Select a community</p>
              <p className="text-sm">Choose from the list to preview</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunitiesTabPage;