import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createPost, Post } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Image, X, Send, Upload, Play } from "lucide-react";

interface PostCreateProps {
  onPostCreated: (post: Post) => void;
}

export default function PostCreate({ onPostCreated }: PostCreateProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    processFiles(newFiles);
  };

  const processFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter((f) => {
      const isImage = f.type.startsWith("image/");
      const isVideo = f.type.startsWith("video/");
      const isValidSize = f.size <= 50 * 1024 * 1024;
      return (isImage || isVideo) && isValidSize;
    });

    setFiles((prev) => [...prev, ...validFiles].slice(0, 6));
    const newPreviews = validFiles.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews].slice(0, 6));
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    const newFiles = Array.from(e.dataTransfer.files || []);
    processFiles(newFiles);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!text.trim() && files.length === 0) {
      toast({ title: "Please add some text or media", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const post = await createPost(text.trim(), files);
      setText("");
      setFiles([]);
      setPreviews([]);
      onPostCreated(post);
      toast({ title: "Proof of work posted!" });
    } catch (err) {
      toast({ title: "Failed to post", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Caption Section */}
      <div className="space-y-3">
        <label className="block text-xs font-bold tracking-[0.15em] uppercase text-[#1C1C1C]/60">
          Share Your Story
        </label>
        <Textarea
          placeholder="Tell us about this work... What was the challenge? What did you achieve?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full min-h-[120px] resize-none border border-[#E0E0E0] focus:border-[#00A4EF] focus:ring-2 focus:ring-[#00A4EF]/20 rounded-xl bg-white text-base"
        />
      </div>

      {/* Media Upload Section */}
      <div className="space-y-4">
        {/* Upload Area or Media Grid */}
        {previews.length === 0 ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden ${
              isDragActive
                ? "border-[#00A4EF] bg-[#00A4EF]/10 shadow-lg shadow-[#00A4EF]/20"
                : "border-[#E0E0E0] bg-[#F9F9F9] hover:border-[#00A4EF] hover:bg-[#00A4EF]/5"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="py-16 px-6 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00A4EF]/20 to-[#00A4EF]/5 flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110">
                <Upload className="h-10 w-10 text-[#00A4EF]" />
              </div>
              <h3 className="text-lg font-bold text-[#1C1C1C] mb-2">
                {isDragActive ? "Drop your files here" : "Add Images or Videos"}
              </h3>
              <p className="text-sm text-[#1C1C1C]/60 mb-4">
                Drag and drop or click to select files
              </p>
              <p className="text-xs text-[#1C1C1C]/40">
                Support: JPG, PNG, MP4, MOV (up to 6 files, 50MB each)
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold tracking-[0.15em] uppercase text-[#1C1C1C]/60">
                Media ({files.length}/6)
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={files.length >= 6}
                className="text-xs font-bold text-[#00A4EF] hover:text-[#007BB5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add More
              </button>
            </div>

            {/* Instagram-style media grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {previews.map((preview, index) => {
                const isVideo = files[index]?.type.startsWith("video/");
                return (
                  <div
                    key={index}
                    className="relative group rounded-xl overflow-hidden bg-black aspect-square"
                  >
                    {isVideo ? (
                      <>
                        <video
                          src={preview}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                          <Play className="h-8 w-8 text-white fill-white" />
                        </div>
                      </>
                    ) : (
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    )}

                    {/* Remove button */}
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    {/* File info */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-xs font-medium truncate">
                        {files[index]?.name}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-[#E0E0E0]">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={files.length >= 6}
          className="flex items-center justify-center gap-2 flex-1 px-4 py-3 border-2 border-[#E0E0E0] hover:border-[#00A4EF] hover:bg-[#00A4EF]/5 text-[#1C1C1C] rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <Image className="h-5 w-5 group-hover:text-[#00A4EF]" />
          <span>Media</span>
        </button>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting || (!text.trim() && files.length === 0)}
          className="flex items-center justify-center gap-2 flex-1 px-4 py-3 bg-gradient-to-r from-[#00A4EF] to-[#007BB5] hover:from-[#007BB5] hover:to-[#005580] text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#00A4EF]/20 hover:shadow-xl hover:shadow-[#00A4EF]/30 active:scale-[0.98]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Posting...</span>
            </>
          ) : (
            <>
              <Send className="h-5 w-5" />
              <span>Share Post</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}