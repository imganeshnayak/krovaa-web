import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, Paperclip, X, Briefcase, Building, MapPin, IndianRupee, Clock, Code2, FileText } from "lucide-react";
import { Job, postJob } from "../lib/api";
import { Button } from "@/components/ui/button";

const PostJobPage = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [mode, setMode] = useState("Remote");
  const [duration, setDuration] = useState(""); // New field for context
  const [skills, setSkills] = useState(""); // New field for alignment
  const [description, setDescription] = useState("");
  const [terms, setTerms] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdJob, setCreatedJob] = useState<Job | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<(string | null)[]>([]);

  useEffect(() => {
    const previewUrls = attachments.map((file) => (
      file.type.startsWith("image/") ? URL.createObjectURL(file) : null
    ));

    setAttachmentPreviews(previewUrls);

    return () => {
      previewUrls.forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [attachments]);

  const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachments((prev) => [...prev, ...files].slice(0, 10)); // Caps at 10 files max
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments((current) => current.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Extended payload structure with parsed skills and timeline settings
      const job = await postJob({ 
        title, 
        company, 
        location, 
        budget, 
        mode, 
        description, 
        attachments,
        duration,
        skills: skills.split(",").map(s => s.trim()).filter(Boolean),
        terms: terms.trim() || undefined
      });
      setCreatedJob(job);
      setSubmitted(true);
      setAttachments([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post job.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pb-28 pt-6 sm:px-6">
      {/* Page Header */}
      <div className="mb-8 border-b border-slate-100 pb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors group mb-3"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to jobs
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">Post a job</h1>
        <p className="text-sm text-slate-500 mt-1">Deploy a brand-new scope profile tracking direct developer matching parameters.</p>
      </div>

      <div className="space-y-6">
        {submitted ? (
          <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50/40 p-6 sm:p-8 text-slate-900 shadow-sm space-y-6">
            <div className="flex items-start gap-4 text-emerald-800">
              <div className="p-2 bg-emerald-100 rounded-xl shrink-0">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Job Cluster Initialized Successfully</h2>
                <p className="text-sm text-slate-600 mt-0.5">Your assignment listing pipeline has been accurately propagated to the infrastructure database.</p>
              </div>
            </div>
            
            <div className="rounded-2xl border border-slate-200 bg-white p-6 grid gap-4 text-sm text-slate-700">
              <p className="border-b border-slate-50 pb-2"><strong className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">Job Title</strong> <span className="font-semibold text-slate-900">{createdJob?.title || title}</span></p>
              <p className="border-b border-slate-50 pb-2"><strong className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">Company</strong> {createdJob?.company || company}</p>
              <div className="grid sm:grid-cols-3 gap-4 border-b border-slate-50 pb-2">
                <p><strong className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">Location</strong> {createdJob?.location || location}</p>
                <p><strong className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">Mode</strong> {createdJob?.mode || mode}</p>
                <p><strong className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">Budget Matrix</strong> {createdJob?.budget || budget}</p>
              </div>
              {skills && <p className="border-b border-slate-50 pb-2"><strong className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">Skills Mapped</strong> {skills}</p>}
              <p><strong className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">Detailed Scope Context</strong> <span className="block mt-1 text-slate-600 whitespace-pre-wrap leading-relaxed text-xs">{createdJob?.description || description}</span></p>
            </div>

            <Button 
              className="w-full sm:w-auto rounded-xl bg-slate-950 text-white font-semibold text-xs h-11 px-6 hover:bg-slate-800"
              onClick={() => navigate('/jobs')}
            >
              Return to Listing Continuum
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            {/* Block 1: Role Core Context */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-[#00A4EF]" />
                Primary Identifier Data
              </h3>
              
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <span>Job title <span className="text-rose-500">*</span></span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Lead Full-Stack Architect (Next.js)"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm normal-case font-normal text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-4 focus:ring-[#00A4EF]/10"
                    required
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <span>Company Registry <span className="text-rose-500">*</span></span>
                  <div className="relative flex items-center">
                    <Building className="absolute left-4 h-4 w-4 text-slate-400" />
                    <input
                      value={company}
                      onChange={(event) => setCompany(event.target.value)}
                      placeholder="e.g. Utopia SaaS Platforms"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 py-2.5 text-sm normal-case font-normal text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-4 focus:ring-[#00A4EF]/10"
                      required
                    />
                  </div>
                </label>
              </div>
            </div>

            {/* Block 2: Location, Budget, Alignment Fields */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#00A4EF]" />
                Workspace Operational Alignment
              </h3>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <span>Location Hub <span className="text-rose-500">*</span></span>
                  <input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="e.g. Remote / Mangaluru"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm normal-case font-normal text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-4 focus:ring-[#00A4EF]/10"
                    required
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <span>Mode Matrix <span className="text-rose-500">*</span></span>
                  <select
                    value={mode}
                    onChange={(event) => setMode(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm normal-case font-normal text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-4 focus:ring-[#00A4EF]/10"
                    required
                  >
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Onsite">Onsite</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <span>Budget Scope <span className="text-rose-500">*</span></span>
                  <div className="relative flex items-center">
                    <IndianRupee className="absolute left-4 h-3.5 w-3.5 text-slate-400" />
                    <input
                      value={budget}
                      onChange={(event) => setBudget(event.target.value)}
                      placeholder="e.g. 45,000 - 60,000"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-4 py-2.5 text-sm normal-case font-normal text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-4 focus:ring-[#00A4EF]/10"
                      required
                    />
                  </div>
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <span>Expected Duration</span>
                  <div className="relative flex items-center">
                    <Clock className="absolute left-4 h-4 w-4 text-slate-400" />
                    <input
                      value={duration}
                      onChange={(event) => setDuration(event.target.value)}
                      placeholder="e.g. 3 Months / Initial Scope"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 py-2.5 text-sm normal-case font-normal text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-4 focus:ring-[#00A4EF]/10"
                    />
                  </div>
                </label>
              </div>

              <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 pt-2">
                <span className="flex items-center gap-1">
                  <Code2 className="h-3.5 w-3.5 text-slate-400" />
                  Target Skill Arrays
                </span>
                <input
                  value={skills}
                  onChange={(event) => setSkills(event.target.value)}
                  placeholder="e.g. React, TypeScript, Next.js, Tailwind CSS (Comma separated)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm normal-case font-normal text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-4 focus:ring-[#00A4EF]/10"
                />
              </label>
            </div>

            {/* Block 3: Assignment Specifications & Assets */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <span>Detailed Deliverables Specification <span className="text-rose-500">*</span></span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Enumerate exact system milestones, engineering requirements, architectural responsibilities, and criteria metrics..."
                  className="min-h-[160px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm normal-case font-normal text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-4 focus:ring-[#00A4EF]/10 leading-relaxed"
                  required
                />
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <span>Terms & Conditions (Optional)</span>
                <textarea
                  value={terms}
                  onChange={(event) => setTerms(event.target.value)}
                  placeholder="Specify any terms, conditions, or prerequisites for this job..."
                  className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm normal-case font-normal text-slate-900 outline-none transition focus:border-[#00A4EF] focus:ring-4 focus:ring-[#00A4EF]/10 leading-relaxed"
                />
              </label>

              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Optional Technical Briefs / Attachments</span>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 transition hover:border-[#00A4EF] hover:bg-[#F3FAFF] group">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm group-hover:scale-105 transition-transform">
                    <Paperclip className="h-4 w-4 text-slate-500 group-hover:text-[#00A4EF]" />
                  </div>
                  <span className="font-semibold text-xs text-slate-700 mt-1">Bind Reference Documentation</span>
                  <span className="text-[10px] text-slate-400">Upload Figma panels, project schemas, JSON datasets or PDF instructions. Max 10 files.</span>
                  <input
                    type="file"
                    multiple
                    accept="*/*"
                    onChange={handleAttachmentChange}
                    className="hidden"
                  />
                </label>

                {/* Displaying Uploaded File Assets */}
                {attachments.length > 0 && (
                  <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/30 p-4 mt-3">
                    {attachments.map((file, index) => {
                      const previewUrl = attachmentPreviews[index];

                      return (
                        <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                          {previewUrl ? (
                            <img src={previewUrl} alt={file.name} className="h-12 w-12 rounded-lg object-cover border border-slate-100" />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-100 text-slate-400">
                              <FileText className="h-5 w-5 text-slate-400" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-slate-900">{file.name}</p>
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                              {(file.size / (1024 * 1024)).toFixed(2)} MB · {file.type || "binary/octet-stream"}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-100 text-slate-400 transition hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
                            aria-label={`Remove asset ${file.name}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Submit Control Action Bar */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-xl bg-[#00A4EF] px-8 text-sm font-bold text-white shadow-lg shadow-[#00A4EF]/10 transition-all hover:bg-[#0087d1] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {isSubmitting ? 'Deploying Listing...' : 'Publish Job Listing'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PostJobPage;