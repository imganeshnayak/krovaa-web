import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { toggleWishlist } from "@/lib/api";
import { cn } from "@/lib/utils";

interface WishlistButtonProps {
  listingId: number;
  initialWishlisted: boolean;
  isOwner?: boolean;
  className?: string;
  onChange?: (wishlisted: boolean) => void;
}

/**
 * Save-for-later heart.
 *
 * Optimistic on purpose: a heart that waits for a round trip feels broken, and
 * this is the cheapest conversion lever on a marketplace. A failed toggle rolls
 * back and explains itself.
 */
export default function WishlistButton({
  listingId,
  initialWishlisted,
  isOwner = false,
  className,
  onChange,
}: WishlistButtonProps) {
  const [saved, setSaved] = useState(initialWishlisted);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  if (isOwner) return null;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    const previous = saved;
    setSaved(!previous);
    setBusy(true);
    try {
      const res = await toggleWishlist(listingId);
      setSaved(res.wishlisted);
      onChange?.(res.wishlisted);
      toast({
        title: res.wishlisted ? "Saved to wishlist" : "Removed from wishlist",
        variant: "success",
      });
    } catch (err) {
      setSaved(previous);
      toast({
        title: "Could not update wishlist",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={saved}
      title={saved ? "Remove from wishlist" : "Save to wishlist"}
      className={cn(
        "h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm",
        "hover:scale-110 transition-transform active:scale-95 shrink-0",
        className
      )}
    >
      <Heart
        className={cn(
          "h-4 w-4 transition-colors",
          saved ? "fill-rose-500 text-rose-500" : "text-slate-400"
        )}
      />
    </Button>
  );
}
