import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send, Sparkles, Image, Download, Trash2, Loader2, Wand2,
  Maximize2, History, ArrowLeft, X,
} from "lucide-react";
import {
  generateImage, getImageHistory, deleteGeneratedImage,
  GeneratedImage,
} from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SUGGESTED_PROMPTS = [
  "A futuristic city at sunset with flying cars",
  "Cute cat wearing a spacesuit on Mars",
  "Abstract geometric patterns in neon colors",
  "Serene Japanese garden with cherry blossoms",
  "Cyberpunk street food vendor at night",
  "Enchanted forest with glowing mushrooms",
];

interface GenerationMessage {
  id: string;
  type: "prompt" | "image" | "error";
  content?: string;
  imageUrl?: string;
  timestamp: Date;
  generatedImage?: GeneratedImage;
}

const ImageGeneratorPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<GenerationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const enabled = localStorage.getItem("image_generator_enabled");
    if (enabled === "false") {
      toast({
        title: "Feature Disabled",
        description: "AI Image Generator has been disabled in settings.",
        variant: "destructive",
      });
      navigate("/chat");
    }
  }, [navigate, toast]);

  const loadHistory = useCallback(async (page = 1) => {
    try {
      const result = await getImageHistory(page, 20);
      if (page === 1) {
        setHistory(result.generations);
      } else {
        setHistory(prev => [...prev, ...result.generations]);
      }
      setHasMoreHistory(page < result.totalPages);
      setHistoryPage(page);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load history",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    if (showHistory) {
      loadHistory(1);
    }
  }, [showHistory, loadHistory]);

  const handleGenerate = async (promptText?: string) => {
    const textToGenerate = promptText || prompt;
    if (!textToGenerate.trim() || isLoading) return;

    const promptId = `prompt-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: promptId,
      type: "prompt",
      content: textToGenerate,
      timestamp: new Date(),
    }]);
    setPrompt("");
    setIsLoading(true);

    try {
      const result = await generateImage({
        prompt: textToGenerate.trim(),
      });

      setMessages(prev => [...prev, {
        id: `image-${Date.now()}`,
        type: "image",
        imageUrl: result.imageUrl,
        timestamp: new Date(),
        generatedImage: result,
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: "error",
        content: error instanceof Error ? error.message : "Failed to generate image",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleDeleteImage = async (id: number) => {
    try {
      await deleteGeneratedImage(id);
      setMessages(prev => prev.filter(m => m.generatedImage?.id !== id));
      setHistory(prev => prev.filter(img => img.id !== id));
      toast({ title: "Deleted", description: "Image removed from history" });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete image",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (imageUrl: string, promptText: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `krovai-${promptText.slice(0, 30).replace(/[^a-z0-9]/gi, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Error",
        description: "Failed to download image",
        variant: "destructive",
      });
    }
  };

  const handleSuggestedPrompt = (p: string) => {
    handleGenerate(p);
  };

  return (
    <div
      style={{ fontFamily: "'DM Sans', sans-serif" }}
      className="min-h-screen bg-[#F5F5F5] text-[#1C1C1C]"
    >
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-[#00A4EF]/5 blur-[120px]" />
        <div className="absolute bottom-1/3 right-0 w-[400px] h-[400px] rounded-full bg-[#00A4EF]/3 blur-[100px]" />
      </div>

      {/* Sticky Header */}
      <div className="sticky top-0 z-50 border-b border-[#E0E0E0] backdrop-blur-xl bg-white/80">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-[#1C1C1C]/60 hover:text-[#1C1C1C] transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#00A4EF] to-[#7C3AED] flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-[#1C1C1C]">KrovAI</span>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 hover:bg-[#E0E0E0]/50 rounded-lg transition-colors text-[#1C1C1C]/40 hover:text-[#1C1C1C]"
          >
            <History className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 pb-32 relative z-10">
        {/* Page Header */}
        <div className="mb-8 mt-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#00A4EF] to-[#7C3AED] flex items-center justify-center shadow-lg shadow-[#00A4EF]/20">
              <Wand2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 style={{ fontFamily: "'Syne', sans-serif" }} className="text-3xl font-bold text-[#1C1C1C]">
                Image Generator
              </h1>
              <p className="text-sm text-[#1C1C1C]/50">Describe any image and AI will bring it to life</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.type === "prompt" ? "justify-end" : "justify-start"}`}>
              {msg.type === "prompt" && (
                <div className="max-w-[80%] bg-[#00A4EF] text-white rounded-2xl rounded-br-md px-4 py-3 shadow-md shadow-[#00A4EF]/10">
                  <p className="text-sm">{msg.content}</p>
                  <p className="text-[10px] text-white/60 mt-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}

              {msg.type === "image" && (
                <div className="max-w-[85%] space-y-2">
                  <div className="relative group rounded-2xl overflow-hidden bg-white border border-[#E0E0E0] shadow-sm">
                    <img
                      src={msg.imageUrl}
                      alt={msg.content || "Generated image"}
                      className="w-full max-w-md rounded-2xl cursor-pointer"
                      onClick={() => setPreviewImage(msg.generatedImage || null)}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <Button
                        size="icon"
                        className="h-10 w-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white"
                        onClick={() => msg.generatedImage && handleDownload(msg.imageUrl!, msg.generatedImage.prompt)}
                      >
                        <Download className="h-5 w-5" />
                      </Button>
                      <Button
                        size="icon"
                        className="h-10 w-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white"
                        onClick={() => setPreviewImage(msg.generatedImage || null)}
                      >
                        <Maximize2 className="h-5 w-5" />
                      </Button>
                      {msg.generatedImage && (
                        <Button
                          size="icon"
                          className="h-10 w-10 rounded-full bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm text-white"
                          onClick={() => handleDeleteImage(msg.generatedImage!.id)}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-[#1C1C1C]/40 ml-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}

              {msg.type === "error" && (
                <div className="max-w-[80%] bg-[#FFF0EB] border border-[#FF9800]/20 rounded-2xl px-4 py-3">
                  <p className="text-sm text-[#C43E00]">{msg.content}</p>
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-[#E0E0E0] rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                <Loader2 className="h-5 w-5 text-[#00A4EF] animate-spin" />
                <span className="text-sm text-[#1C1C1C]/60">Creating your image...</span>
              </div>
            </div>
          )}

          {/* Empty state */}
          {messages.length === 0 && !isLoading && (
            <div className="py-16 text-center animate-in fade-in duration-500">
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00A4EF]/20 to-[#7C3AED]/10 flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-[#00A4EF]" />
                </div>
              </div>
              <h3 style={{ fontFamily: "'Syne', sans-serif" }} className="text-2xl font-bold text-[#1C1C1C] mb-2">
                What will you create?
              </h3>
              <p className="text-[#1C1C1C]/60 text-base mb-8 max-w-sm mx-auto leading-relaxed">
                Describe any image and AI will bring your imagination to life
              </p>

              {/* Suggested Prompts */}
              <div className="max-w-md mx-auto">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1C1C1C]/40 mb-3 block text-left">Try these</label>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestedPrompt(p)}
                      className="px-3 py-2 bg-white border border-[#E0E0E0] rounded-full text-xs text-[#1C1C1C]/60 hover:bg-[#00A4EF]/5 hover:text-[#00A4EF] hover:border-[#00A4EF]/30 transition-all"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* History Drawer */}
      {showHistory && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setShowHistory(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-[#E0E0E0] p-4 flex items-center justify-between">
              <h3 className="font-bold text-[#1C1C1C]">Generation History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-[#E0E0E0]/50 rounded-lg transition-colors text-[#1C1C1C]/40 hover:text-[#1C1C1C]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ScrollArea className="max-h-[calc(80vh-60px)]">
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {history.map((img) => (
                  <div key={img.id} className="relative group rounded-xl overflow-hidden bg-[#F5F5F5] border border-[#E0E0E0]">
                    <img
                      src={img.imageUrl}
                      alt={img.prompt}
                      className="w-full aspect-square object-cover cursor-pointer"
                      onClick={() => setPreviewImage(img)}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                      <Button
                        size="icon"
                        className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 text-white"
                        onClick={() => handleDownload(img.imageUrl, img.prompt)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        className="h-8 w-8 rounded-full bg-red-500/20 hover:bg-red-500/30 text-white"
                        onClick={() => handleDeleteImage(img.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {hasMoreHistory && (
                <div className="p-4">
                  <Button
                    variant="outline"
                    className="w-full bg-white border-[#E0E0E0] text-[#1C1C1C] hover:bg-[#F5F5F5]"
                    onClick={() => loadHistory(historyPage + 1)}
                  >
                    Load More
                  </Button>
                </div>
              )}
              {history.length === 0 && (
                <div className="p-12 text-center text-[#1C1C1C]/40 text-sm">
                  No images generated yet
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Input Bar - Fixed Bottom */}
      <div className="fixed bottom-16 left-0 right-0 border-t border-[#E0E0E0] bg-white/80 backdrop-blur-xl z-40">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                placeholder="Describe the image you want..."
                className="h-11 bg-[#F5F5F5] border-[#E0E0E0] text-[#1C1C1C] placeholder:text-[#1C1C1C]/40 rounded-full pr-12 focus-visible:ring-[#00A4EF]/30"
                disabled={isLoading}
              />
              <Button
                onClick={() => handleGenerate()}
                disabled={!prompt.trim() || isLoading}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-[#00A4EF] hover:bg-[#007BB5] text-white disabled:opacity-50"
                size="icon"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-[#1C1C1C]/30 text-center mt-2">
            AI-generated images may not always be accurate. Use responsibly.
          </p>
        </div>
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl bg-white border-[#E0E0E0] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#1C1C1C] flex items-center gap-2">
              <Image className="h-5 w-5 text-[#00A4EF]" />
              Generated Image
            </DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden bg-[#F5F5F5]">
                <img
                  src={previewImage.imageUrl}
                  alt={previewImage.prompt}
                  className="w-full max-h-[60vh] object-contain"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-[#1C1C1C]/50">Prompt</p>
                <p className="text-[#1C1C1C]">{previewImage.prompt}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#1C1C1C]/40">
                <span>Size: {previewImage.size}</span>
                <span>{new Date(previewImage.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-[#00A4EF] hover:bg-[#007BB5] text-white rounded-xl"
                  onClick={() => handleDownload(previewImage!.imageUrl, previewImage!.prompt)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-[#E0E0E0] text-[#1C1C1C] hover:bg-[#F5F5F5] rounded-xl"
                  onClick={() => {
                    setPrompt(previewImage!.prompt);
                    setPreviewImage(null);
                    inputRef.current?.focus();
                  }}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Remix
                </Button>
                <Button
                  variant="outline"
                  className="border-[#E0E0E0] text-[#C43E00] hover:bg-[#FFF0EB] rounded-xl"
                  onClick={() => {
                    handleDeleteImage(previewImage!.id);
                    setPreviewImage(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes slideInFromTop {
          from {
            opacity: 0;
            transform: translateY(-16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-in {
          animation: slideInFromTop 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ImageGeneratorPage;
