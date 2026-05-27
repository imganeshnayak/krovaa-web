import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Send, Sparkles, Image, Download, Trash2, Loader2, Wand2,
  Maximize2, History, ArrowLeft, X, Plus, Zap, Crown,
} from "lucide-react";
import {
  generateImage, getImageHistory, deleteGeneratedImage,
  GeneratedImage, getSubscriptionStatus, getImageGeneratorStats,
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

interface ChatSession {
  id: string;
  title: string;
  messages: GenerationMessage[];
  updatedAt: number;
}

const ImageGeneratorPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<any>(null);
  const [imageGeneratorConfig, setImageGeneratorConfig] = useState<{ provider: string; supportsImg2Img: boolean } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");

  // Load sessions when user changes
  useEffect(() => {
    if (!user) return;
    try {
      const saved = localStorage.getItem(`krovai_generator_sessions_${user.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSessions(parsed.map((s: any) => ({
          ...s,
          messages: s.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }))
        })));
      } else {
        setSessions([{ id: `session_${Date.now()}`, title: "New Chat", messages: [], updatedAt: Date.now() }]);
      }
    } catch (e) {
      console.error("Failed to parse generator sessions", e);
      setSessions([{ id: `session_${Date.now()}`, title: "New Chat", messages: [], updatedAt: Date.now() }]);
    }

    try {
      const savedId = localStorage.getItem(`krovai_generator_current_session_${user.id}`);
      if (savedId) {
        setCurrentSessionId(savedId);
      } else {
        setCurrentSessionId(`session_${Date.now()}`);
      }
    } catch(e) {
      setCurrentSessionId(`session_${Date.now()}`);
    }
  }, [user]);

  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
  const messages = currentSession?.messages || [];

  const setMessages = useCallback((updater: GenerationMessage[] | ((prev: GenerationMessage[]) => GenerationMessage[])) => {
    setSessions(prev => prev.map(session => {
      if (session.id === currentSessionId) {
        const updatedMessages = typeof updater === 'function' ? updater(session.messages) : updater;
        let title = session.title;
        if (session.title === "New Chat" && updatedMessages.length > 0) {
          const firstPrompt = updatedMessages.find((m: any) => m.type === 'prompt');
          if (firstPrompt) title = firstPrompt.content?.substring(0, 30) + (firstPrompt.content!.length > 30 ? "..." : "");
        }
        return { ...session, messages: updatedMessages, updatedAt: Date.now(), title };
      }
      return session;
    }));
  }, [currentSessionId]);

  useEffect(() => {
    if (!user || sessions.length === 0 || !currentSessionId) return;
    localStorage.setItem(`krovai_generator_sessions_${user.id}`, JSON.stringify(sessions));
    localStorage.setItem(`krovai_generator_current_session_${user.id}`, currentSessionId);
  }, [sessions, currentSessionId, user]);

  const [historyTab, setHistoryTab] = useState<'chats' | 'images'>('chats');
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

  useEffect(() => {
    if (user) {
      getSubscriptionStatus()
        .then(setSubscription)
        .catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    getImageGeneratorStats()
      .then((stats) => {
        setImageGeneratorConfig({
          provider: stats.provider,
          supportsImg2Img: stats.supportsImg2Img,
        });
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (imageGeneratorConfig && !imageGeneratorConfig.supportsImg2Img && imagePreview) {
      clearUploadedImage();
    }
  }, [imageGeneratorConfig, imagePreview]);

  const handleGenerate = async (promptText?: string) => {
    const textToGenerate = promptText || prompt;
    if (!textToGenerate.trim() || isLoading) return;

    if (uploadedImage && imageGeneratorConfig && !imageGeneratorConfig.supportsImg2Img) {
      toast({
        title: "Reference images unavailable",
        description: `The current provider (${imageGeneratorConfig.provider}) only supports text prompts. Remove the image or switch IMAGE_GENERATOR_PROVIDER to stability.`,
        variant: "destructive",
      });
      return;
    }

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
      console.log('Generating image with:', { prompt: textToGenerate, image: uploadedImage ? 'present' : 'null' });
      const result = await generateImage({
        prompt: textToGenerate.trim(),
        image: uploadedImage || undefined,
      });
      
      console.log('Generation result:', result);

      setMessages(prev => [...prev, {
        id: `image-${Date.now()}`,
        type: "image",
        imageUrl: result.imageUrl,
        timestamp: new Date(),
        generatedImage: result,
      }]);
    } catch (error: any) {
      console.error('Generation error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate image";
      const isLimitError = error?.status === 429 || errorMessage.includes("limit");
      
      if (isLimitError) {
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          type: "error",
          content: "You've reached your monthly image limit. Upgrade to continue creating!",
          timestamp: new Date(),
        }]);
        // Refresh subscription status
        getSubscriptionStatus().then(setSubscription).catch(console.error);
      } else {
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          type: "error",
          content: errorMessage,
          timestamp: new Date(),
        }]);
      }
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imageGeneratorConfig && !imageGeneratorConfig.supportsImg2Img) {
      toast({
        title: "Reference images unavailable",
        description: `The current provider (${imageGeneratorConfig.provider}) only supports text prompts. Switch IMAGE_GENERATOR_PROVIDER to stability or puter to use image references.`,
        variant: "destructive",
      });
      e.target.value = '';
      return;
    }

    console.log('Image uploaded:', file.name, file.size, file.type);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      console.log('Image converted to base64 for preview, length:', dataUrl.length);
      setImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);

    setUploadedImage(file as any); // Store the actual File object instead of base64 string

    e.target.value = '';
  };

  const clearUploadedImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
  };

  const canUseReferenceImages = imageGeneratorConfig?.supportsImg2Img !== false;

  return (
    <div
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      className="min-h-screen bg-[#FDF4FF] text-[#1C1C1C]"
    >
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-[#D946EF]/10 blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-[#F97316]/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#D946EF]/5 to-[#F97316]/5 blur-[180px]" />
      </div>

      {/* Sticky Header */}
      <div className="sticky top-0 z-50 border-b border-white/20 backdrop-blur-xl bg-white/60">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-[#1C1C1C]/60 hover:text-[#1C1C1C] transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-3">
            {subscription && (
              <button
                onClick={() => navigate("/image-generator/pricing")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/60 border border-[#D946EF]/20 hover:bg-[#D946EF]/10 transition-colors text-xs"
              >
                {subscription.planId === 'pro' && <Zap className="h-3 w-3 text-[#D946EF]" />}
                {subscription.planId === 'enterprise' && <Crown className="h-3 w-3 text-[#D946EF]" />}
                <span className="font-medium text-[#1C1C1C]/70">
                  {subscription.imagesThisMonth}/{subscription.monthlyLimit}
                </span>
              </button>
            )}
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#D946EF] to-[#E879F9] flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-[#1C1C1C]">KrovAI</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const newId = `session_${Date.now()}`;
                setSessions(prev => [{ id: newId, title: "New Chat", messages: [], updatedAt: Date.now() }, ...prev]);
                setCurrentSessionId(newId);
                setPrompt("");
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              title="New Chat"
              className="p-2 hover:bg-[#D946EF]/10 rounded-lg transition-colors text-[#1C1C1C]/40 hover:text-[#D946EF]"
            >
              <Plus className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              title="History"
              className="p-2 hover:bg-[#D946EF]/10 rounded-lg transition-colors text-[#1C1C1C]/40 hover:text-[#D946EF]"
            >
              <History className="h-5 w-5" />
            </button>
            <Button
              onClick={() => navigate('/image-generator/pricing')}
              className="h-8 px-3 rounded-full bg-gradient-to-r from-[#D946EF] to-[#F97316] hover:opacity-90 text-white font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap"
              size="sm"
            >
              <Crown className="h-3.5 w-3.5" />
              <span>Upgrade</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 pb-32 relative z-10">
        {/* Page Header */}
        <div className="mb-8 mt-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#D946EF] to-[#F97316] flex items-center justify-center shadow-lg shadow-[#D946EF]/20">
              <Wand2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-3xl font-bold text-[#1C1C1C]">
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
                <div className="max-w-[80%] bg-gradient-to-r from-[#D946EF] to-[#F97316] text-white rounded-2xl rounded-br-md px-4 py-3 shadow-lg shadow-[#D946EF]/20">
                  <p className="text-sm">{msg.content}</p>
                  <p className="text-[10px] text-white/60 mt-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}

              {msg.type === "image" && (
                <div className="max-w-[85%] space-y-2">
                  <div className="relative group rounded-2xl overflow-hidden bg-white/60 border border-white/40 shadow-sm">
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
                <div className="max-w-[80%] bg-[#FDF4FF] border border-[#D946EF]/20 rounded-2xl px-4 py-3">
                  <p className="text-sm text-[#86198F]">{msg.content}</p>
                  <button
                    onClick={() => navigate("/image-generator/pricing")}
                    className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#D946EF] to-[#F97316] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    <Sparkles className="h-4 w-4" />
                    Upgrade Now
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl px-4 py-3 flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-[#D946EF] animate-spin" />
                <span className="text-sm text-[#1C1C1C]/60">Creating your image...</span>
              </div>
            </div>
          )}

          {/* Empty state */}
          {messages.length === 0 && !isLoading && (
            <div className="py-16 text-center animate-in fade-in duration-500">
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#D946EF]/20 to-[#F97316]/10 flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-[#D946EF]" />
                </div>
              </div>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-2xl font-bold text-[#1C1C1C] mb-2">
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
                      className="px-3 py-2 bg-white/60 backdrop-blur-xl border border-white/40 rounded-full text-xs text-[#1C1C1C]/60 hover:bg-[#D946EF]/10 hover:text-[#D946EF] hover:border-[#D946EF]/30 transition-all"
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
            className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl rounded-t-3xl max-h-[85vh] h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white/60 border-b border-white/20 p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-[#1C1C1C]">History</h3>
                <div className="flex bg-[#FDF4FF] rounded-lg p-1">
                  <button
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${historyTab === 'chats' ? 'bg-white shadow-sm text-[#D946EF]' : 'text-[#1C1C1C]/40 hover:text-[#1C1C1C]'}`}
                    onClick={() => setHistoryTab('chats')}
                  >
                    Chats
                  </button>
                  <button
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${historyTab === 'images' ? 'bg-white shadow-sm text-[#D946EF]' : 'text-[#1C1C1C]/40 hover:text-[#1C1C1C]'}`}
                    onClick={() => setHistoryTab('images')}
                  >
                    All Images
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-[#D946EF]/10 rounded-lg transition-colors text-[#1C1C1C]/40 hover:text-[#D946EF]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ScrollArea className="flex-1">
              {historyTab === 'chats' ? (
                <div className="p-4 space-y-2">
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => {
                        setCurrentSessionId(session.id);
                        setShowHistory(false);
                        setTimeout(() => scrollToBottom(), 100);
                      }}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${session.id === currentSessionId ? 'border-[#D946EF] bg-[#FDF4FF]' : 'border-white/40 bg-white/60 hover:bg-white/80'}`}
                    >
                      <div>
                        <h4 className={`font-semibold text-sm ${session.id === currentSessionId ? 'text-[#D946EF]' : 'text-[#1C1C1C]'}`}>
                          {session.title}
                        </h4>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs text-[#1C1C1C]/40">{session.messages.length} messages</span>
                          <span className="text-xs text-[#1C1C1C]/20">•</span>
                          <span className="text-xs text-[#1C1C1C]/40">
                            {new Date(session.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {session.messages.filter(m => m.type === 'image').slice(-3).map((img, i) => (
                          <div key={i} className="w-8 h-8 rounded-md overflow-hidden bg-black/5 border border-black/10">
                            <img src={img.imageUrl} alt="preview" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {history.map((img) => (
                      <div key={img.id} className="relative group rounded-xl overflow-hidden bg-white/60 border border-white/40">
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
                    <div className="mt-4">
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
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Image Upload UI */}
          {imagePreview && canUseReferenceImages && (
            <div className="mb-3 flex items-center gap-3">
              <div className="relative">
                <img src={imagePreview} alt="Uploaded" className="h-16 w-16 rounded-xl object-cover border-2 border-[#D946EF]/30" />
                <button
                  onClick={clearUploadedImage}
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <span className="text-xs text-[#1C1C1C]/60">Using your image as reference</span>
            </div>
          )}

          {/* Input Bar - Fixed Bottom */}
          <div className="fixed bottom-16 left-0 right-0 border-t border-white/20 bg-white/60 backdrop-blur-xl z-40">
            <div className="max-w-3xl mx-auto px-4 py-3">
              {imagePreview && canUseReferenceImages && (
                <div className="mb-3 flex items-center gap-3 animate-in">
                  <div className="relative">
                    <img src={imagePreview} alt="Uploaded" className="h-16 w-16 rounded-xl object-cover border-2 border-[#D946EF]/30" />
                    <button
                      onClick={clearUploadedImage}
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-xs text-[#1C1C1C]/60">Using your image as reference</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                {!imagePreview && canUseReferenceImages && (
                  <label className="flex items-center justify-center h-11 w-11 rounded-full bg-white/60 border border-white/40 hover:bg-[#D946EF]/10 hover:border-[#D946EF]/30 transition-all cursor-pointer shrink-0">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Image className="h-5 w-5 text-[#1C1C1C]/40" />
                  </label>
                )}
                {!canUseReferenceImages && (
                  <div className="h-11 px-4 rounded-full bg-white/40 border border-white/40 text-xs text-[#1C1C1C]/50 flex items-center shrink-0">
                    Reference images require Stability AI or Puter AI
                  </div>
                )}
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                    placeholder={imagePreview ? "Describe how you want to modify this image..." : "Describe the image you want..."}
                    className="h-11 bg-white/60 border-white/40 text-[#1C1C1C] placeholder:text-[#1C1C1C]/40 rounded-full pr-12 focus-visible:ring-[#D946EF]/30 backdrop-blur-xl"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={() => handleGenerate()}
                    disabled={!prompt.trim() || isLoading}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-gradient-to-r from-[#D946EF] to-[#F97316] hover:opacity-90 text-white disabled:opacity-50"
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
        <DialogContent className="max-w-4xl bg-white/80 backdrop-blur-xl border-white/40 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#1C1C1C] flex items-center gap-2">
              <Image className="h-5 w-5 text-[#D946EF]" />
              Generated Image
            </DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden bg-[#FDF4FF]">
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
                  className="flex-1 bg-gradient-to-r from-[#D946EF] to-[#F97316] hover:opacity-90 text-white rounded-xl"
                  onClick={() => handleDownload(previewImage!.imageUrl, previewImage!.prompt)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-white/40 bg-white/60 hover:bg-white/80 text-[#1C1C1C] rounded-xl"
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
                  className="border-white/40 bg-white/60 hover:bg-[#FFF0EB] text-[#D946EF] hover:text-[#D946EF] rounded-xl"
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
