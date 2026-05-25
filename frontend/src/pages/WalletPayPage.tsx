import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Copy, ExternalLink, Loader2, MapPin, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { AuthUser, getUserByShareId } from "@/lib/api";

const WalletPayPage = () => {
  const { shareId = "" } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const [recipient, setRecipient] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const walletLink = useMemo(() => {
    if (!shareId) return "";
    return `${window.location.origin}/wallet/pay/${encodeURIComponent(shareId)}`;
  }, [shareId]);

  useEffect(() => {
    const loadRecipient = async () => {
      if (!shareId) {
        setError("Invalid wallet share link.");
        setIsLoading(false);
        return;
      }

      try {
        const user = await getUserByShareId(shareId);
        setRecipient(user);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load wallet recipient.");
      } finally {
        setIsLoading(false);
      }
    };

    loadRecipient();
  }, [shareId]);

  const copyLink = async () => {
    if (!walletLink) return;
    await navigator.clipboard.writeText(walletLink);
    toast.success("Wallet link copied.");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-white px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Wallet share</p>
                <h1 className="text-2xl font-bold text-slate-950">Send money to a Krovaa wallet</h1>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                Loading recipient details...
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                {error}
              </div>
            ) : recipient ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                    {recipient.avatarUrl ? (
                      <img src={recipient.avatarUrl} alt={recipient.displayName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-slate-500">
                        {(recipient.displayName || recipient.username || "U").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-slate-950">{recipient.displayName || recipient.username}</h2>
                      {recipient.verified && <BadgeCheck className="h-5 w-5 text-sky-600" />}
                    </div>
                    <p className="text-sm text-slate-500">@{recipient.username}</p>
                    {recipient.profession && <p className="mt-1 text-sm text-slate-700">{recipient.profession}</p>}
                    {recipient.city && (
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                        <MapPin className="h-4 w-4" />
                        {recipient.city}
                      </p>
                    )}
                  </div>
                </div>

                {recipient.bio && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    {recipient.bio}
                  </div>
                )}

                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  This page now resolves the recipient from the share link. The wallet transfer flow itself is not wired in the backend yet, so use the main wallet page for balance actions.
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="bg-sky-600 text-white hover:bg-sky-700">
                    <Link to="/wallet">
                      Open wallet
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={copyLink} disabled={!walletLink}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy share link
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WalletPayPage;
