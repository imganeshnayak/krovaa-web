import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Send, Mail, KeyRound, CheckCircle2, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { validatePassword } from "@/lib/passwordValidation";
import PasswordStrength from "@/components/auth/PasswordStrength";

type Step = "email" | "otp" | "newPassword" | "done";

const ForgotPassword = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [resetToken, setResetToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Step 1: Send reset OTP
    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);
        try {
            await apiFetch("/api/auth/forgot-password", {
                method: "POST",
                body: JSON.stringify({ email }),
            });
            setStep("otp");
            setResendCooldown(120);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send reset email");
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: Verify OTP
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);
        try {
            const res = await apiFetch<{ resetToken: string }>("/api/auth/verify-reset-otp", {
                method: "POST",
                body: JSON.stringify({ email, otp }),
            });
            setResetToken(res.resetToken);
            setStep("newPassword");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Invalid OTP");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setError("");
        setIsSendingOtp(true);
        try {
            await apiFetch("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
            setResendCooldown(120);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to resend");
        } finally {
            setIsSendingOtp(false);
        }
    };

    // Cooldown timer
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
        return () => clearInterval(t);
    }, [resendCooldown]);

    // Step 3: Set new password
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (newPassword !== confirmPassword) {
            setError("Passwords don't match.");
            return;
        }
        const passwordCheck = validatePassword(newPassword);
        if (!passwordCheck.isValid) {
            setError(passwordCheck.message || "Please use a stronger password");
            return;
        }
        setIsLoading(true);
        try {
            await apiFetch("/api/auth/reset-password", {
                method: "POST",
                body: JSON.stringify({ resetToken, newPassword }),
            });
            setStep("done");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to reset password");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <div className="flex items-center justify-center mb-8">
                    <span style={{ fontFamily: "'Syne', sans-serif" }} className="text-3xl font-bold tracking-tight text-black">Krovaa</span>
                </div>


                <div className="bg-card border border-border rounded-xl p-6">
                    {/* Step 1: Email */}
                    {step === "email" && (
                        <>
                            <div className="text-center mb-6">
                                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <KeyRound className="w-7 h-7 text-primary" />
                                </div>
                                <h2 className="text-xl font-semibold text-card-foreground mb-1">Forgot Password?</h2>
                                <p className="text-sm text-muted-foreground">Enter your email and we'll send a reset code</p>
                            </div>
                            {error && <div className="mb-4 p-3 bg-destructive/20 text-destructive-foreground border border-destructive/30 rounded-lg text-sm">{error}</div>}
                            <form onSubmit={handleSendOtp} className="space-y-4">
                                <div>
                                    <Label className="text-card-foreground">Email Address</Label>
                                    <Input className="mt-1.5 bg-secondary border-border" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                                </div>
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : <><Mail className="w-4 h-4 mr-2" />Send Reset Code</>}
                                </Button>
                            </form>
                        </>
                    )}

                    {/* Step 2: OTP */}
                    {step === "otp" && (
                        <>
                            <div className="text-center mb-6">
                                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Mail className="w-7 h-7 text-primary" />
                                </div>
                                <h2 className="text-xl font-semibold text-card-foreground mb-1">Enter Reset Code</h2>
                                <p className="text-sm text-muted-foreground">
                                    We sent a 6-digit code to<br />
                                    <strong className="text-foreground">{email}</strong>
                                </p>
                            </div>
                            {error && <div className="mb-4 p-3 bg-destructive/20 text-destructive-foreground border border-destructive/30 rounded-lg text-sm">{error}</div>}
                            <form onSubmit={handleVerifyOtp} className="space-y-4">
                                <div>
                                    <Label className="text-card-foreground">OTP Code</Label>
                                    <Input
                                        className="mt-1.5 bg-secondary border-border text-center text-2xl font-mono tracking-widest"
                                        placeholder="000000"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                        maxLength={6}
                                        required
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={otp.length !== 6 || isLoading}>
                                    {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : "Verify Code →"}
                                </Button>
                            </form>
                            <div className="mt-3 text-center">
                                <button onClick={() => setStep("email")} className="text-xs text-muted-foreground hover:underline">← Change email</button>
                            </div>
                            <div className="text-center mt-4">
                                <p className="text-sm mb-2" style={{ color: "#1C1C1C" }}>Didn't receive the code? Request a new one</p>
                                {resendCooldown > 0 ? (
                                    <p className="text-xs" style={{ color: "#6B7280" }}>Resend OTP in {Math.floor(resendCooldown/60)}:{String(resendCooldown%60).padStart(2,'0')}</p>
                                ) : (
                                    <button
                                        onClick={handleResendOtp}
                                        disabled={isSendingOtp}
                                        className="text-xs font-medium"
                                        style={{ color: "#00A4EF", background: "transparent", border: "none", padding: 0, cursor: isSendingOtp ? 'not-allowed' : 'pointer' }}
                                    >
                                        {isSendingOtp ? "Sending..." : "Resend OTP"}
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                    {/* Step 3: New Password */}
                    {step === "newPassword" && (
                        <>
                            <div className="text-center mb-6">
                                <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <CheckCircle2 className="w-7 h-7 text-green-500" />
                                </div>
                                <h2 className="text-xl font-semibold text-card-foreground mb-1">Set New Password</h2>
                                <p className="text-sm text-muted-foreground">Choose a strong password for your account</p>
                            </div>
                            {error && <div className="mb-4 p-3 bg-destructive/20 text-destructive-foreground border border-destructive/30 rounded-lg text-sm">{error}</div>}
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <div>
                                    <Label className="text-card-foreground">New Password</Label>
                                    <div className="relative mt-1.5">
                                        <Input className="bg-secondary border-border pr-10" type={showPassword ? "text" : "password"} placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                                        <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <PasswordStrength password={newPassword} />
                                </div>
                                <div>
                                    <Label className="text-card-foreground">Confirm Password</Label>
                                    <Input className="mt-1.5 bg-secondary border-border" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                                </div>
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Resetting...</> : "Reset Password"}
                                </Button>
                            </form>
                        </>
                    )}

                    {/* Done */}
                    {step === "done" && (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-green-500" />
                            </div>
                            <h2 className="text-xl font-semibold text-card-foreground mb-2">Password Reset!</h2>
                            <p className="text-sm text-muted-foreground mb-6">Your password has been updated successfully.</p>
                            <Button className="w-full" onClick={() => navigate("/login")}>
                                Sign In Now
                            </Button>
                        </div>
                    )}
                </div>

                <p className="text-center text-sm text-muted-foreground mt-6">
                    Remember your password?{" "}
                    <Link to="/login" className="text-primary hover:underline">Sign in</Link>
                </p>
            </div>
        </div>
    );
};

export default ForgotPassword;
