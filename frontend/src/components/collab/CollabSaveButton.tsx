import { useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveCollabProject, unsaveCollabProject } from '@/lib/api';

interface CollabSaveButtonProps {
  projectId: number;
  isSaved?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function CollabSaveButton({ projectId, isSaved = false, className = '', onClick }: CollabSaveButtonProps) {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(isSaved);
  const { toast } = useToast();

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) onClick(e);
    
    setLoading(true);
    try {
      if (saved) {
        await unsaveCollabProject(projectId);
        setSaved(false);
        toast({
          title: 'Blueprint unsaved',
          description: 'Removed from your saved blueprints',
        });
      } else {
        await saveCollabProject(projectId);
        setSaved(true);
        toast({
          title: 'Blueprint saved',
          description: 'Added to your saved blueprints',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update saved blueprint',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleSave}
      disabled={loading}
      className={`flex h-10 w-10 items-center justify-center ${className}`}
    >
      {loading ? (
        <BookmarkCheck className="w-4 h-4 text-[#00A4EF]" />
      ) : (
        saved ? (
          <BookmarkCheck className="w-4 h-4 text-[#00A4EF]" />
        ) : (
          <Bookmark className="w-4 h-4 text-slate-500" />
        )
      )}
    </Button>
  );
}
