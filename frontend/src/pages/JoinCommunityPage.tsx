import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getCommunityBySlug, joinCommunityBySlug } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Users, Lock, Globe, ArrowLeft, Check, Loader2 } from 'lucide-react';

const JoinCommunityPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [community, setCommunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) loadCommunity(slug);
  }, [slug]);

  const loadCommunity = async (communitySlug: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCommunityBySlug(communitySlug);
      setCommunity(data.community);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Community not found');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!slug) return;
    setJoining(true);
    try {
      await joinCommunityBySlug(slug);
      toast({ title: 'Success', description: 'You have joined the community!' });
      if (community?.id) {
        navigate(`/communities/${community.id}`);
      } else {
        navigate('/communities');
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error', description: err.message || 'Failed to join community', variant: 'destructive' });
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-violet-600 animate-spin" />
          <p className="text-muted-foreground">Loading community...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50 flex items-center justify-center">
        <Card className="max-w-md w-full bg-white border-purple-100">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Community Not Found</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => navigate('/communities')} className="bg-violet-600 hover:bg-violet-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Communities
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-white border-purple-100 overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-8 text-center relative">
          <div className="absolute inset-0 bg-white/10" />
          <div className="relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4">
              {community?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{community?.name}</h1>
            {community?.isPrivate ? (
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-white text-sm">
                <Lock className="w-3 h-3" />
                Private
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-white text-sm">
                <Globe className="w-3 h-3" />
                Public
              </div>
            )}
          </div>
        </div>
        <CardContent className="p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Users className="w-5 h-5 text-violet-600" />
            <span className="text-lg font-medium">{community?.memberCount || 0} members</span>
          </div>
          {community?.description && (
            <p className="text-muted-foreground mb-6">{community.description}</p>
          )}
          <div className="space-y-3">
            <Button 
              onClick={handleJoin} 
              disabled={joining}
              size="lg"
              className="w-full bg-violet-600 hover:bg-violet-700"
            >
              {joining ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Join Community
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/communities')} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Communities
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default JoinCommunityPage;