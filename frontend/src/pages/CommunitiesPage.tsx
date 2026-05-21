import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCommunities, createCommunity } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Users, Lock, Search, Plus, TrendingUp, Globe, ChevronRight } from 'lucide-react';

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
  const toast = useToast();

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
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h2 style={{ fontFamily: "'Syne', sans-serif" }} className="text-3xl font-bold text-[#1C1C1C] mb-2">Communities</h2>
          <p className="text-[#1C1C1C]/60">Connect with like-minded professionals and collaborate on projects.</p>
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1C1C1C]/40" />
          <Input
            placeholder="Search communities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white border-[#E0E0E0] focus:border-[#00A4EF] focus:ring-[#00A4EF]/20"
          />
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="bg-[#00A4EF] hover:bg-[#007BB5] text-white">
          <Plus className="w-5 h-5 mr-2" />
          Create
        </Button>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-white rounded-xl animate-pulse border border-[#E0E0E0]" />
            ))}
          </div>
        ) : filteredCommunities.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-[#00A4EF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-[#00A4EF]" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No communities found</h3>
            <p className="text-[#1C1C1C]/60 mb-6">{searchQuery ? `No results for "${searchQuery}"` : 'Be the first to create a community!'}</p>
            <Button onClick={() => setShowCreateDialog(true)} className="bg-[#00A4EF] hover:bg-[#007BB5] text-white">
              Create Community
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCommunities.map((community) => (
              <Link 
                key={community.id} 
                to={`/communities/${community.id}`}
                className="group p-5 bg-white rounded-xl border border-[#E0E0E0] hover:border-[#00A4EF] hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-[#00A4EF]/10 flex items-center justify-center text-[#00A4EF] font-bold text-lg">
                    {community.name[0].toUpperCase()}
                  </div>
                  {community.isPrivate && (
                    <Badge variant="secondary" className="bg-[#FF6B6B]/10 text-[#FF6B6B]">
                      <Lock className="w-3 h-3 mr-1" />
                      Private
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold text-[#1C1C1C] group-hover:text-[#00A4EF] transition-colors mb-1">{community.name}</h3>
                <p className="text-sm text-[#1C1C1C]/60 line-clamp-2">{community.description || 'No description'}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Community</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input placeholder="Community name" value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input placeholder="What is this about?" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-center gap-2 p-3 bg-[#F5F5F5] rounded-lg cursor-pointer" onClick={() => setNewIsPrivate(!newIsPrivate)}>
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${newIsPrivate ? 'bg-[#00A4EF] border-[#00A4EF]' : 'border-[#E0E0E0]'}`}>
                {newIsPrivate && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="text-sm font-medium">Private Community</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="bg-[#00A4EF] hover:bg-[#007BB5] text-white">
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommunitiesPage;