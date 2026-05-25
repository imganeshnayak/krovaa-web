import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCommunities, createCommunity } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Users, Lock, Search, Plus, Globe, ChevronRight } from 'lucide-react';

interface Community {
  id: number;
  name: string;
  slug: string;
  description?: string;
  isPrivate: boolean;
  creatorId: number;
  createdAt: string;
  memberCount?: number;
  projectCount?: number;
}

const CommunitiesPage = () => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [filteredCommunities, setFilteredCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'public' | 'private'>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let filtered = communities;
    if (searchQuery) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (filter === 'public') {
      filtered = filtered.filter(c => !c.isPrivate);
    } else if (filter === 'private') {
      filtered = filtered.filter(c => c.isPrivate);
    }
    setFilteredCommunities(filtered);
  }, [communities, searchQuery, filter]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listCommunities();
      setCommunities(data || []);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to load communities', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return toast({ title: 'Name required', description: 'Please enter a community name' });
    setCreating(true);
    try {
      const c = await createCommunity({ name: newName.trim(), description: newDescription.trim(), isPrivate: newIsPrivate });
      setShowCreateDialog(false);
      setNewName('');
      setNewDescription('');
      setNewIsPrivate(false);
      toast({ title: 'Created', description: `Community "${c.name}" created successfully!` });
      load();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to create community', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const totalMembers = communities.reduce((sum, c) => sum + (c.memberCount || 0), 0);
  const publicCount = communities.filter(c => !c.isPrivate).length;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="min-h-screen bg-[#F5F5F5] text-[#1C1C1C] pb-20">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        
        {/* Upper Dashboard Banner Row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E0E0E0] pb-6">
          <div>
            <h2 style={{ fontFamily: "'Syne', sans-serif" }} className="text-3xl font-extrabold tracking-tight text-[#1C1C1C] mb-2">Communities</h2>
            <p className="text-sm text-[#1C1C1C]/60">Connect with specialized network clusters and align target workspace dependencies.</p>
          </div>
          <Button 
            onClick={() => setShowCreateDialog(true)} 
            className="bg-[#00A4EF] hover:bg-[#0087d1] text-white font-semibold text-xs h-11 px-5 rounded-xl transition-all shadow-md shadow-[#00A4EF]/10 shrink-0"
          >
            <Plus className="w-4 h-4 mr-1.5 stroke-[2.5]" />
            Create Workspace
          </Button>
        </div>

        {/* Global Structural Metrics Summary Card */}
        <div className="grid grid-cols-3 gap-4 rounded-2xl border border-[#E0E0E0] bg-white p-4 shadow-sm">
          <div className="text-center sm:text-left sm:pl-4">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#1C1C1C]/40">Active Nodes</span>
            <span className="text-xl font-bold text-[#1C1C1C] mt-0.5 block">{communities.length}</span>
          </div>
          <div className="text-center sm:text-left border-l border-[#E0E0E0] pl-4">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#1C1C1C]/40">Total Members</span>
            <span className="text-xl font-bold text-[#1C1C1C] mt-0.5 block">{totalMembers}</span>
          </div>
          <div className="text-center sm:text-left border-l border-[#E0E0E0] pl-4">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#1C1C1C]/40">Public Spaces</span>
            <span className="text-xl font-bold text-[#00A4EF] mt-0.5 block">{publicCount}</span>
          </div>
        </div>

        {/* Control Desk: Search Engine & Mode Filter Tabs */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1C1C1C]/40" />
            <Input
              placeholder="Filter clusters by label or index parameters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-white border-[#E0E0E0] text-sm rounded-xl focus:border-[#00A4EF] focus:ring-4 focus:ring-[#00A4EF]/10 shadow-sm outline-none placeholder:text-[#1C1C1C]/30"
            />
          </div>
          
          {/* Custom Segment Tab Controller */}
          <div className="flex bg-white border border-[#E0E0E0] p-1 rounded-xl shadow-sm max-w-fit self-start sm:self-auto">
            {(['all', 'public', 'private'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilter(type)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  filter === type 
                    ? 'bg-[#1C1C1C] text-white shadow-sm' 
                    : 'text-[#1C1C1C]/60 hover:text-[#1C1C1C] hover:bg-[#F5F5F5]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Core Rendering Engine Area */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-white rounded-2xl animate-pulse border border-[#E0E0E0]" />
            ))}
          </div>
        ) : filteredCommunities.length === 0 ? (
          <div className="text-center py-16 rounded-[2rem] border-2 border-dashed border-[#E0E0E0] bg-white p-8">
            <div className="w-14 h-14 bg-[#00A4EF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-[#00A4EF]" />
            </div>
            <h3 className="text-base font-bold text-[#1C1C1C] mb-1">No community vectors matched</h3>
            <p className="text-xs text-[#1C1C1C]/50 max-w-sm mx-auto mb-6">
              {searchQuery ? `No matrix signatures aligned with query trace: "${searchQuery}"` : 'Initialize the collaborative environment framework by launching the primary workspace.'}
            </p>
            <Button onClick={() => setShowCreateDialog(true)} className="bg-[#00A4EF] hover:bg-[#0087d1] text-white text-xs font-semibold h-10 px-5 rounded-xl">
              Launch Initial Node
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredCommunities.map((community) => (
              <Link 
                key={community.id} 
                to={`/communities/${community.id}`}
                className="group flex flex-col justify-between p-5 bg-white rounded-2xl border border-[#E0E0E0] hover:border-[#00A4EF] hover:shadow-md transition-all relative overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-[#E0E0E0] flex items-center justify-center text-[#1C1C1C] font-bold text-sm shadow-sm group-hover:border-[#00A4EF]/30 group-hover:bg-[#00A4EF]/5 transition-colors">
                      {community.name[0].toUpperCase()}
                    </div>
                    {community.isPrivate ? (
                      <Badge variant="secondary" className="bg-[#FF6B6B]/10 text-[#FF6B6B] font-bold text-[10px] tracking-wider uppercase border border-[#FF6B6B]/20 rounded-md py-0.5 px-2">
                        <Lock className="w-3 h-3 mr-1 stroke-[2.5]" />
                        Private
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-[#E8F4FF] text-[#0066CC] font-bold text-[10px] tracking-wider uppercase border border-[#00A4EF]/10 rounded-md py-0.5 px-2">
                        <Globe className="w-3 h-3 mr-1 stroke-[2.5]" />
                        Public
                      </Badge>
                    )}
                  </div>
                  
                  <h3 className="font-bold text-[#1C1C1C] text-base group-hover:text-[#00A4EF] transition-colors mb-1.5 tracking-tight">
                    {community.name}
                  </h3>
                  <p className="text-xs text-[#1C1C1C]/50 line-clamp-2 leading-relaxed mb-4">
                    {community.description || 'No summary parameters defined for this specific cluster framework.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-[11px] font-medium text-[#1C1C1C]/40">
                  <div className="flex gap-3">
                    <span>{community.memberCount || 0} Members</span>
                    <span>•</span>
                    <span>{community.projectCount || 0} Blueprints</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#1C1C1C]/30 group-hover:text-[#00A4EF] group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Community Drafting Interface Dialogue */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md bg-white border border-[#E0E0E0] rounded-[2rem] p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1C1C1C] tracking-tight">Initialize Workspace Vector</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#1C1C1C]/40">Workspace Name</label>
              <Input 
                placeholder="e.g. Mangaluru Web Engineers Core" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
                className="h-10 border-[#E0E0E0] rounded-xl text-sm focus:border-[#00A4EF] focus:ring-4 focus:ring-[#00A4EF]/10 placeholder:text-[#1C1C1C]/30" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#1C1C1C]/40">Scope Description</label>
              <Input 
                placeholder="Define exact technical focus or connection prerequisites..." 
                value={newDescription} 
                onChange={(e) => setNewDescription(e.target.value)} 
                className="h-10 border-[#E0E0E0] rounded-xl text-sm focus:border-[#00A4EF] focus:ring-4 focus:ring-[#00A4EF]/10 placeholder:text-[#1C1C1C]/30" 
              />
            </div>
            
            {/* Custom Interactive Mode Toggle Panel */}
            <div 
              className="flex items-center gap-3 p-3 bg-[#F5F5F5] rounded-xl border border-[#E0E0E0]/60 cursor-pointer user-select-none select-none active:scale-[0.99] transition-all" 
              onClick={() => setNewIsPrivate(!newIsPrivate)}
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${newIsPrivate ? 'bg-[#1C1C1C] border-[#1C1C1C]' : 'border-[#E0E0E0] bg-white'}`}>
                {newIsPrivate && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#1C1C1C]">Restricted Pipeline Scope</span>
                <span className="text-[10px] text-[#1C1C1C]/50 mt-0.5">Enforce encryption parameters. Discovery requires authorized token trace.</span>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="rounded-xl h-10 border-[#E0E0E0] font-medium text-xs">
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={creating || !newName.trim()} 
              className="bg-[#00A4EF] hover:bg-[#0087d1] text-white font-semibold text-xs h-10 px-5 rounded-xl transition-all disabled:opacity-50"
            >
              {creating ? 'Propagating Matrix...' : 'Provision Framework'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommunitiesPage;