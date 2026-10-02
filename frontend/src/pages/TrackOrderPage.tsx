import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Loader2,
  Search,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trackOrder, TrackingInfo } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  pickup_scheduled: "Pickup scheduled",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  ndr: "Delivery attempt failed",
  rto: "Returned to seller",
  cancelled: "Cancelled",
};

const STEP_ORDER = ["pickup_scheduled", "in_transit", "out_for_delivery", "delivered"];

function humanStatus(status?: string | null): string {
  if (!status) return "Status unknown";
  return STATUS_LABELS[status] || status.replace(/_/g, " ");
}

function formatWhen(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Public order tracking.
 *
 * Reachable without an account, because a buyer who has not signed in still
 * needs to know where their parcel is, and support needs to look one up by AWB.
 */
export default function TrackOrderPage() {
  const { trackingId: trackingIdParam } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(trackingIdParam || "");
  const [data, setData] = useState<TrackingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await trackOrder(trimmed);
      setData(res);
    } catch (err) {
      setData(null);
      setError(
        err instanceof Error
          ? err.message
          : "We could not find a shipment with that ID."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (trackingIdParam) load(trackingIdParam);
  }, [trackingIdParam]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = input.trim();
    if (!id) return;
    navigate(`/track/${encodeURIComponent(id)}`, { replace: true });
    load(id);
  };

  const currentStep = data
    ? STEP_ORDER.indexOf(data.status || "") === -1 && data.status !== "delivered"
      ? -1
      : STEP_ORDER.indexOf(data.status || "")
    : -1;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="mb-6 text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <h1 className="text-2xl font-black text-slate-900 mb-1">Track your order</h1>
      <p className="text-sm text-slate-500 mb-6">
        Enter the tracking ID or AWB from your shipping confirmation.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 sm:items-end mb-8">
        <div className="flex-1 space-y-2">
          <Label htmlFor="trackingId" className="text-xs font-semibold text-slate-600">
            Tracking ID
          </Label>
          <Input
            id="trackingId"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. 123456789012"
            className="rounded-xl h-11"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="bg-[#00A4EF] hover:bg-[#00A4EF]/90 text-white rounded-xl h-11 px-6 font-bold"
        >
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
          Track
        </Button>
      </form>

      {error && (
        <Card className="border-rose-200 bg-rose-50/50">
          <CardContent className="p-4 text-sm text-rose-700 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {!data && !error && !loading && (
        <div className="text-center py-16 text-slate-400">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="text-sm">Enter a tracking ID to see your delivery status.</p>
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-16">
          <Loader2 className="h-6 w-6 mx-auto animate-spin text-slate-400" />
        </div>
      )}

      {data && (
        <div className="space-y-5">
          {data.isNdr && (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-900 text-sm">
                      A delivery attempt failed
                    </p>
                    <p className="text-sm text-amber-800 mt-1">
                      The courier could not deliver this parcel. Please update your
                      delivery address or contact the courier to reschedule. If it
                      is not actioned within 24–48 hours, the parcel will be
                      returned to the seller.
                    </p>
                    {data.courier && (
                      <p className="text-xs text-amber-700 mt-2">
                        Courier: {data.courier}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4 text-slate-400" />
                  {data.trackingId}
                </CardTitle>
                <Badge
                  variant={data.delivered ? "default" : data.isNdr ? "destructive" : "outline"}
                  className={
                    data.delivered
                      ? "bg-emerald-600 text-white"
                      : data.isNdr
                      ? "bg-amber-600 text-white"
                      : "text-slate-600"
                  }
                >
                  {humanStatus(data.status)}
                </Badge>
              </div>
              {data.destination && (
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" />
                  Delivering to {data.destination}
                </p>
              )}
            </CardHeader>
            <CardContent>
              {!data.isNdr && currentStep >= 0 && (
                <ol className="flex items-center gap-1 mb-6">
                  {STEP_ORDER.map((step, i) => {
                    const done = i <= currentStep;
                    return (
                      <li key={step} className="flex-1 flex items-center gap-1">
                        <span
                          className={`h-2 flex-1 rounded-full transition-colors ${
                            done ? "bg-[#00A4EF]" : "bg-slate-200"
                          }`}
                        />
                      </li>
                    );
                  })}
                </ol>
              )}

              {data.timeline.length === 0 ? (
                <p className="text-sm text-slate-400 py-4">
                  No tracking events recorded yet.
                </p>
              ) : (
                <ol className="space-y-4">
                  {data.timeline.map((e, i) => (
                    <li key={i} className="flex gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            i === 0 ? "bg-[#00A4EF]" : "bg-slate-300"
                          }`}
                        />
                        {i < data.timeline.length - 1 && (
                          <span className="w-px flex-1 bg-slate-200 my-1" />
                        )}
                      </div>
                      <div className="pb-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">
                          {e.title || humanStatus(e.status)}
                        </p>
                        {e.description && (
                          <p className="text-xs text-slate-500 mt-0.5 break-words">
                            {e.description}
                          </p>
                        )}
                        {e.location && (
                          <p className="text-xs text-slate-400 mt-0.5">{e.location}</p>
                        )}
                        {e.at && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {formatWhen(e.at)}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {data.delivered && (
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-800">
                  Delivered. Funds are released to the seller once delivery is
                  confirmed.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
