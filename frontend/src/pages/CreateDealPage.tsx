import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, ShoppingBag, IndianRupee, Copy, Check, ExternalLink, Trash2, UploadCloud, RefreshCw, Lock, Package, Images, DollarSign, CheckCircle2 } from "lucide-react";
import { createDealListing, uploadDealImage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Electronics", "Fashion", "Handmade", "Home & Living", "Books", "Services", "Digital Products", "Other"];
const DELIVERY_TYPES = [
  { value: "shipping", label: "Shipping" },
  { value: "digital", label: "Digital Delivery" },
  { value: "pickup", label: "Pickup" },
];

const STEPS = [
  { id: 1, label: "Details", icon: Package },
  { id: 2, label: "Photos", icon: Images },
  { id: 3, label: "Price", icon: IndianRupee },
  { id: 4, label: "Done", icon: CheckCircle2 },
];

export default function CreateDealPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isBusiness = user?.accountType === "business";

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [deliveryType, setDeliveryType] = useState("shipping");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [shippingWeight, setShippingWeight] = useState("");
  const [shippingDimensions, setShippingDimensions] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [category, setCategory] = useState("");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Success state
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [dealShareCode, setDealShareCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (uploadedImages.length + files.length > 5) {
      toast.error("You can upload a maximum of 5 images.");
      return;
    }

    setIsUploading(true);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`File ${file.name} is too large. Max size is 10MB.`);
          continue;
        }
        const res = await uploadDealImage(file);
        newUrls.push(res.imageUrl);
      }
      setUploadedImages(prev => [...prev, ...newUrls]);
      toast.success("Images uploaded successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload images.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const isStepValid = () => {
    if (step === 1) return title.trim().length > 0 && description.trim().length > 0;
    if (step === 2) return true;
    if (step === 3) {
      const isPriceValid = price !== "" && !isNaN(Number(price)) && Number(price) > 0;
      if (!isPriceValid) return false;
      if (deliveryType === "shipping") {
        return (
          shippingWeight.trim().length > 0 &&
          !isNaN(Number(shippingWeight)) &&
          Number(shippingWeight) > 0 &&
          shippingDimensions.trim().length > 0 &&
          pickupAddress.trim().length > 0
        );
      }
      if (deliveryType === "pickup") {
        return pickupAddress.trim().length > 0;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (!isStepValid()) return;
    setError("");
    if (step < 4) setStep(s => s + 1);
  };

  const handleBack = () => {
    setError("");
    if (step > 1) setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    setError("");
    if (!title.trim()) { setError("Please enter a title for your deal."); return; }
    if (!description.trim()) { setError("Please describe your deal."); return; }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      setError("Please enter a valid price greater than ₹0.");
      return;
    }
    if (deliveryType === "shipping") {
      if (!shippingWeight || isNaN(Number(shippingWeight)) || Number(shippingWeight) <= 0) {
        setError("Please enter a valid shipping weight.");
        return;
      }
      if (!shippingDimensions.trim()) {
        setError("Please enter shipping dimensions.");
        return;
      }
      if (!pickupAddress.trim()) {
        setError("Please enter a pickup address.");
        return;
      }
    } else if (deliveryType === "pickup") {
      if (!pickupAddress.trim()) {
        setError("Please enter a pickup address.");
        return;
      }
    }

    setIsLoading(true);
    try {
      const result = await createDealListing({
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        imageUrls: uploadedImages,
        category: category || undefined,
        deliveryType,
        deliveryDays: deliveryDays ? Number(deliveryDays) : undefined,
        shippingWeight: deliveryType === "shipping" ? Number(shippingWeight) : undefined,
        shippingDimensions: deliveryType === "shipping" ? shippingDimensions.trim() : undefined,
        pickupAddress: (deliveryType === "shipping" || deliveryType === "pickup") ? pickupAddress.trim() : undefined,
      });
      setShareUrl(result.shareUrl);
      setDealShareCode(result.deal.shareCode);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create deal.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const whatsappUrl = shareUrl
    ? `https://wa.me/?text=${encodeURIComponent(`Check out this deal on Krovaa!\n\n*${title}*\n₹${Number(price).toLocaleString('en-IN')}\n\n${shareUrl}`)}`
    : "";

  const twitterUrl = shareUrl
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this deal on Krovaa: ${title} for ₹${Number(price).toLocaleString('en-IN')} ${shareUrl}`)}`
    : "";

  if (!isBusiness) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-6 pb-28">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/explore")}
            className="text-slate-500 hover:text-slate-900 h-8 gap-1.5 px-2 text-xs font-semibold group mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Explore
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
            <Lock className="h-7 w-7 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Business Account Required</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
              Only business accounts can list products on the marketplace. Please complete your profile and select <span className="font-semibold text-amber-600">"My Business"</span> as your goal.
            </p>
          </div>
          <Button
            onClick={() => navigate("/profile")}
            className="h-10 px-6 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs"
          >
            Complete Business Profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 pt-6 pb-28">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => step === 1 ? navigate("/explore") : handleBack()}
          className="text-slate-500 hover:text-slate-900 h-8 gap-1.5 px-2 text-xs font-semibold group mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          {step === 1 ? "Back to Explore" : "Back"}
        </Button>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[#00A4EF] flex items-center justify-center shrink-0">
            <ShoppingBag className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Create a Deal</h1>
            <p className="text-xs text-slate-500 mt-0.5">Step {step} of 3</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1 bg-slate-100 rounded-full mb-6 overflow-hidden">
        <motion.div
          className="h-full bg-[#00A4EF] rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: `${(Math.min(step, 3) / 3) * 100}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-between mb-6 px-2">
        {STEPS.filter(s => s.id <= 3).map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300",
              step >= s.id ? "bg-[#00A4EF] text-white" : "bg-slate-100 text-slate-400"
            )}>
              {step > s.id ? <Check className="w-3.5 h-3.5" /> : s.id}
            </div>
            <span className={cn(
              "text-[11px] font-semibold hidden sm:block",
              step >= s.id ? "text-slate-900" : "text-slate-400"
            )}>{s.label}</span>
            {i < 2 && <div className={cn("w-8 sm:w-12 h-0.5 rounded-full mx-1", step > s.id ? "bg-[#00A4EF]" : "bg-slate-100")} />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="space-y-5"
        >
          {/* Step 1: Product Details */}
          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  What are you selling? *
                </Label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Handmade Leather Bag, iPhone 13 Pro..."
                  className="h-11 text-sm"
                  maxLength={80}
                />
                <p className="text-[11px] text-slate-400 text-right">{title.length}/80</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Describe your deal *
                </Label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the condition, what's included, any terms..."
                  rows={4}
                  className="text-sm resize-none"
                  maxLength={1000}
                />
                <p className="text-[11px] text-slate-400 text-right">{description.length}/1000</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Category</Label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#00A4EF]/20 focus:border-[#00A4EF]"
                >
                  <option value="">Select a category...</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Step 2: Photos */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-[11px] text-slate-500">Add up to 5 product photos. The first photo will be the cover image.</p>
              </div>
              
              <div className="grid grid-cols-5 gap-2.5">
                {uploadedImages.map((url, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group">
                    <img src={url} alt={`product-${index}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4 text-white" />
                    </button>
                    {index === 0 && (
                      <span className="absolute top-1 left-1 text-[8px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded-md">COVER</span>
                    )}
                  </div>
                ))}

                {uploadedImages.length < 5 && (
                  <label className="relative aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-[#00A4EF] hover:bg-slate-50 flex flex-col items-center justify-center cursor-pointer transition-all gap-1 text-slate-400 hover:text-[#00A4EF]">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                      className="hidden"
                    />
                    {isUploading ? (
                      <RefreshCw className="h-5 w-5 animate-spin text-[#00A4EF]" />
                    ) : (
                      <>
                        <UploadCloud className="h-5 w-5" />
                        <span className="text-[9px] font-bold">Add</span>
                      </>
                    )}
                  </label>
                )}
              </div>

              {uploadedImages.length === 0 && (
                <p className="text-[11px] text-slate-400 text-center">You can skip this step and add photos later.</p>
              )}
            </div>
          )}

          {/* Step 3: Price & Delivery */}
          {step === 3 && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Price *</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="0"
                    className="h-11 pl-9 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Delivery Method *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {DELIVERY_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        setDeliveryType(t.value);
                        setError("");
                      }}
                      className={cn(
                        "py-3 px-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5",
                        deliveryType === t.value
                          ? "border-[#00A4EF] bg-[#00A4EF]/5 text-[#00A4EF]"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {deliveryType === "shipping" && (
                <div className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Weight (kg) *</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={shippingWeight}
                        onChange={e => setShippingWeight(e.target.value)}
                        placeholder="e.g. 0.5"
                        className="h-10 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dimensions (cm) *</Label>
                      <Input
                        type="text"
                        value={shippingDimensions}
                        onChange={e => setShippingDimensions(e.target.value)}
                        placeholder="L x W x H (e.g. 15x10x5)"
                        className="h-10 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pickup Address *</Label>
                    <Textarea
                      value={pickupAddress}
                      onChange={e => setPickupAddress(e.target.value)}
                      placeholder="Enter the complete address where the courier will pick up the package (include Pincode)"
                      rows={3}
                      className="text-xs resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Estimated Delivery Days</Label>
                    <Input
                      type="number"
                      min="1"
                      value={deliveryDays}
                      onChange={e => setDeliveryDays(e.target.value)}
                      placeholder="e.g. 5"
                      className="h-10 text-xs"
                    />
                  </div>
                </div>
              )}

              {deliveryType === "pickup" && (
                <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pickup Location *</Label>
                    <Textarea
                      value={pickupAddress}
                      onChange={e => setPickupAddress(e.target.value)}
                      placeholder="Specify the address or location details where the buyer can pick up the item."
                      rows={3}
                      className="text-xs resize-none"
                    />
                  </div>
                </div>
              )}

              {deliveryType === "digital" && (
                <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Delivery Time (Days)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={deliveryDays}
                      onChange={e => setDeliveryDays(e.target.value)}
                      placeholder="e.g. 1"
                      className="h-10 text-xs"
                    />
                    <p className="text-[10px] text-slate-400">Specify how many days it will take to deliver the digital assets / details.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium mt-4">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-6">
        {step > 1 && step < 4 && (
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="flex-1 h-12 font-semibold border-slate-200"
          >
            <ArrowLeft className="mr-1.5 w-3.5 h-3.5" /> Back
          </Button>
        )}
        {step < 3 ? (
          <Button
            type="button"
            onClick={handleNext}
            disabled={!isStepValid()}
            className={cn("h-12 font-bold bg-[#00A4EF] hover:bg-[#0087d1] text-white shadow-lg shadow-[#00A4EF]/20 rounded-xl text-xs", step === 1 ? "flex-1" : "flex-[2]")}
          >
            Continue <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
          </Button>
        ) : step === 3 ? (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !isStepValid()}
            className="flex-[2] h-12 font-bold bg-[#00A4EF] hover:bg-[#0087d1] text-white shadow-lg shadow-[#00A4EF]/20 rounded-xl text-xs"
          >
            {isLoading ? (
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Publish Deal
              </div>
            )}
          </Button>
        ) : null}
      </div>

      {/* Success Modal */}
      <Dialog open={!!shareUrl} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm bg-white rounded-3xl border-0 shadow-2xl p-6" onInteractOutside={e => e.preventDefault()}>
          <div className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
              <Check className="h-8 w-8 text-white stroke-[3]" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Your Deal is Live!</h2>
              <p className="text-xs text-slate-500 mt-1">Share this link anywhere to attract buyers</p>
            </div>

            {/* Share URL box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2">
              <p className="flex-1 text-xs text-slate-700 font-mono break-all text-left leading-relaxed">
                {shareUrl}
              </p>
              <button
                onClick={handleCopy}
                className="shrink-0 p-2 rounded-lg hover:bg-slate-200 transition-colors"
                title="Copy link"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-slate-500" />}
              </button>
            </div>

            {/* Social share */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-bold hover:bg-green-100 transition-colors"
              >
                WhatsApp
              </a>
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 text-xs font-bold hover:bg-sky-100 transition-colors"
              >
                Twitter / X
              </a>
            </div>

            {/* Bottom actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => dealShareCode && navigate(`/deal/${dealShareCode}`)}
                className="h-10 text-xs font-semibold gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View Deal
              </Button>
              <Button
                size="sm"
                onClick={() => navigate("/my-listings")}
                className="h-10 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white"
              >
                My Listings
              </Button>
            </div>

            <button
              onClick={() => { setShareUrl(null); setTitle(""); setDescription(""); setPrice(""); setDeliveryDays(""); setCategory(""); setUploadedImages([]); setStep(1); }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Create another deal
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
