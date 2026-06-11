import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

interface ShareJobDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: number;
  jobTitle: string;
  companyName: string;
  type?: "job" | "collab";
}

export default function ShareJobDialog({
  isOpen,
  onClose,
  jobId,
  jobTitle,
  companyName,
  type = "job",
}: ShareJobDialogProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/${type === "collab" ? "blueprint" : "jobs"}/${jobId}`;
  const itemTypeLabel = type === "collab" ? "Collab Blueprint" : "opportunity";
  const shareText = `Check out this ${itemTypeLabel}: ${jobTitle} at ${companyName} on Krovaa!`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link.");
    }
  };

  const shareOptions = [
    {
      name: "Twitter / X",
      icon: (
        <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      color: "hover:bg-black hover:text-white border-slate-200 hover:border-black",
    },
    {
      name: "LinkedIn",
      icon: (
        <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      color: "hover:bg-[#0077b5] hover:text-white border-slate-200 hover:border-[#0077b5]",
    },
    {
      name: "WhatsApp",
      icon: (
        <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.666.988 3.311 1.485 5.352 1.486 5.517 0 10.005-4.49 10.009-10.01.002-2.673-1.04-5.186-2.936-7.084-1.897-1.897-4.412-2.942-7.084-2.944-5.52 0-10.009 4.491-10.013 10.013-.001 2.01.523 3.639 1.51 5.286L1.512 21.03l5.135-1.876zm13.136-7.558c-.33-.165-1.951-.963-2.253-1.074-.303-.11-.523-.165-.743.165-.22.33-.853 1.074-1.046 1.294-.193.22-.385.247-.715.082-1.745-.873-2.955-1.522-4.088-3.463-.298-.513.298-.476.853-1.58.192-.385.096-.715-.041-.88-.138-.166-.743-1.79-1.018-2.45-.269-.646-.543-.559-.743-.569l-.632-.008c-.22 0-.577.082-.88.413-.302.33-1.154 1.127-1.154 2.748 0 1.62 1.181 3.19 1.346 3.41 1.62 2.249 2.673 3.447 4.391 4.148 1.48.604 2.115.542 2.879.431.52-.075 1.614-.66 1.84-.963.22-.303.22-.562.152-.66-.068-.098-.247-.165-.577-.33z" />
        </svg>
      ),
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
      color: "hover:bg-[#25d366] hover:text-white border-slate-200 hover:border-[#25d366]",
    },
    {
      name: "Telegram",
      icon: (
        <svg className="h-5 w-5 fill-current animate-pulse" viewBox="0 0 24 24">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18.717-.962 4.084-1.362 5.462-.168.58-.505.753-.82.781-.693.063-1.218-.38-1.888-.84-.875-.615-1.393-.974-2.245-1.564-.984-.68-.346-1.055.215-1.674.147-.162 2.7-2.617 2.748-2.82.006-.027.012-.128-.047-.183-.06-.055-.147-.037-.21-.023-.09.02-1.523.978-4.298 2.868-.407.287-.775.43-1.104.422-.363-.008-1.06-.207-1.578-.376-.636-.208-1.142-.319-1.098-.673.023-.184.275-.373.757-.568 2.96-1.297 4.933-2.153 5.92-2.568 2.822-1.182 3.407-1.387 3.79-.115z" />
        </svg>
      ),
      url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      color: "hover:bg-[#0088cc] hover:text-white border-slate-200 hover:border-[#0088cc]",
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[460px] p-6 rounded-[2rem] border border-slate-200/80 bg-white/95 backdrop-blur-md shadow-2xl">
        <DialogHeader className="space-y-1">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#00A4EF]/10 text-[#00A4EF] mb-2 animate-bounce">
            <Share2 className="h-5 w-5" />
          </div>
          <DialogTitle className="text-xl font-bold text-center text-slate-900">
            Share {type === "collab" ? "Blueprint" : "Job Listing"}
          </DialogTitle>
          <DialogDescription className="text-sm text-center text-slate-500">
            Share this {type === "collab" ? "blueprint" : "opportunity"} with your social network or copy the direct link.
          </DialogDescription>
        </DialogHeader>

        {/* Copy Link Input Field */}
        <div className="mt-4 p-1 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 min-w-0 bg-transparent px-3 py-2 text-xs text-slate-700 outline-none font-medium truncate"
          />
          <Button
            size="sm"
            onClick={handleCopy}
            className={`rounded-xl h-9 px-4 text-xs font-bold transition-all shrink-0 ${
              copied
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-[#00A4EF] hover:bg-[#0087d1] text-white"
            }`}
          >
            {copied ? (
              <span className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />
                Copied!
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Copy className="h-3.5 w-3.5" />
                Copy Link
              </span>
            )}
          </Button>
        </div>

        {/* Social Share Grid */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          {shareOptions.map((option) => (
            <a
              key={option.name}
              href={option.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className={`flex items-center gap-2.5 p-3 rounded-2xl border text-xs font-bold text-slate-700 transition-all duration-200 ${option.color} group active:scale-[0.97]`}
            >
              <span className="shrink-0 transition-transform group-hover:scale-110">
                {option.icon}
              </span>
              <span>{option.name}</span>
            </a>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
