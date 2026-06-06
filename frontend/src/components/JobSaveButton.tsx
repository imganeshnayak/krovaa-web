import { useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveJob, unsaveJob, getSavedJobs } from '@/lib/api';

interface JobSaveButtonProps {
  jobId: number;
  isSaved?: boolean;
  className?: string;
}

export function JobSaveButton({ jobId, isSaved = false, className = '' }: JobSaveButtonProps) {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(isSaved);
  const { toast } = useToast();

  const handleSave = async () => {
    setLoading(true);
    try {
      if (saved) {
        await unsaveJob(jobId);
        setSaved(false);
        toast({
          title: 'Job unsaved',
          description: 'Removed from your saved jobs',
        });
      } else {
        await saveJob(jobId);
        setSaved(true);
        toast({
          title: 'Job saved',
          description: 'Added to your saved jobs',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update saved job',
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
          <Bookmark className="w-4 h-4 text-slate-400 hover:text-[#00A4EF]" />
        )
      )}
    </Button>
  );
}