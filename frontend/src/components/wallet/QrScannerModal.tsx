import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, AlertCircle, QrCode, ArrowRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface QrScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptText?: string;
}

const QrScannerModal = ({ open, onOpenChange, promptText }: QrScannerModalProps) => {
  const navigate = useNavigate();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [manualLink, setManualLink] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "wallet-qr-reader";

  const handleQrSuccess = async (decodedText: string) => {
    // Validate decoded text is a Krovaa payment link
    // Format should look like: [origin]/wallet/pay/[shareId]?expires=[expires]&token=[token]
    try {
      const url = new URL(decodedText);
      const isKrovaaDomain = url.origin === window.location.origin;
      const isWalletPayPath = url.pathname.startsWith("/wallet/pay/");

      if (isKrovaaDomain && isWalletPayPath) {
        toast.success("QR Code scanned successfully!");
        
        // Stop scanning first
        await stopScanner();
        
        // Close modal
        onOpenChange(false);
        
        // Navigate to the scanned URL (pathname + search params)
        navigate(url.pathname + url.search);
      } else {
        toast.error("Invalid QR Code. Please scan a valid Krovaa Wallet payment QR code.");
      }
    } catch (err) {
      toast.error("Invalid QR Code content. Please scan a valid Krovaa payment link.");
    }
  };

  const startScanner = async () => {
    if (isInitializing || isScanning) return;
    setIsInitializing(true);
    setScannerError(null);

    // Make sure container exists in DOM
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(scannerId);
        qrCodeRef.current = html5QrCode;

        // Try environment camera (rear camera on mobile)
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            },
          },
          (decodedText) => {
            handleQrSuccess(decodedText);
          },
          () => {
            // Ignore verbose frame scanning errors to prevent flooding logs
          }
        );

        setHasPermission(true);
        setIsScanning(true);
      } catch (err: any) {
        console.error("Error starting QR Code scanner:", err);
        
        if (err?.name === "NotAllowedError" || err?.message?.includes("Permission denied")) {
          setHasPermission(false);
          setScannerError("Camera permission denied. Please allow access to scan QR codes.");
        } else {
          setScannerError("Failed to access camera. Make sure no other app is using it.");
        }
      } finally {
        setIsInitializing(false);
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (qrCodeRef.current) {
      try {
        if (qrCodeRef.current.isScanning) {
          await qrCodeRef.current.stop();
        }
      } catch (err) {
        console.error("Error stopping scanner:", err);
      } finally {
        qrCodeRef.current = null;
        setIsScanning(false);
      }
    }
  };

  useEffect(() => {
    if (open) {
      startScanner();
    } else {
      stopScanner();
      setManualLink("");
      setScannerError(null);
    }

    return () => {
      stopScanner();
    };
  }, [open]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLink.trim()) return;

    try {
      let targetUrl = manualLink.trim();
      
      // If user pasted a relative path, prepand origin
      if (targetUrl.startsWith("/")) {
        targetUrl = window.location.origin + targetUrl;
      }
      
      const url = new URL(targetUrl);
      const isKrovaaDomain = url.origin === window.location.origin;
      const isWalletPayPath = url.pathname.startsWith("/wallet/pay/");

      if (isKrovaaDomain && isWalletPayPath) {
        onOpenChange(false);
        navigate(url.pathname + url.search);
      } else {
        toast.error("Link is not a valid Krovaa payment URL.");
      }
    } catch (err) {
      toast.error("Please enter a valid payment URL.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl border-slate-200/80 shadow-2xl p-6 overflow-hidden bg-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <QrCode className="h-5 w-5 text-sky-600" />
            Scan QR Code to Pay
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {promptText && (
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed">
              {promptText}
            </p>
          )}

          {/* Viewfinder Container */}
          <div className="relative mx-auto w-full aspect-square max-w-[280px] bg-slate-900 rounded-2xl overflow-hidden shadow-inner flex flex-col items-center justify-center border border-slate-800">
            <div id={scannerId} className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />
            
            {/* Custom Scanning Overlay */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* 4 corner brackets */}
                <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-sky-400 rounded-tl-md" />
                <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-sky-400 rounded-tr-md" />
                <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-sky-400 rounded-bl-md" />
                <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-sky-400 rounded-br-md" />
                
                {/* Scanning line animation */}
                <div className="absolute w-[80%] h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent animate-pulse" 
                     style={{
                       animation: "scan 2s linear infinite",
                       top: "20%"
                     }} 
                />
              </div>
            )}

            {/* Loading/Error states */}
            {isInitializing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-white p-4 text-center space-y-3">
                <RefreshCw className="h-8 w-8 animate-spin text-sky-400" />
                <span className="text-xs font-semibold text-slate-300">Initializing Camera...</span>
              </div>
            )}

            {!isScanning && !isInitializing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-white p-4 text-center space-y-3">
                {hasPermission === false ? (
                  <>
                    <CameraOff className="h-8 w-8 text-rose-500" />
                    <span className="text-xs font-bold text-slate-200">Camera Access Blocked</span>
                    <span className="text-[10px] text-slate-400 max-w-[200px]">
                      Enable camera access in your browser settings to scan QR codes.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-8 w-8 text-amber-500" />
                    <span className="text-xs font-bold text-slate-200">Camera Not Available</span>
                    {scannerError && <span className="text-[10px] text-slate-400 max-w-[200px]">{scannerError}</span>}
                    <Button 
                      size="sm" 
                      onClick={startScanner}
                      className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs h-8 px-4 font-semibold mt-1"
                    >
                      Try Again
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Style injection for scanning line animation */}
          <style>{`
            @keyframes scan {
              0% { top: 15%; }
              50% { top: 85%; }
              100% { top: 15%; }
            }
          `}</style>

          {/* Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Or enter link manually</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Manual Link Input */}
          <form onSubmit={handleManualSubmit} className="space-y-2.5">
            <div className="space-y-1">
              <Label htmlFor="manual-link" className="text-xs font-semibold text-slate-600">Secure Payment Link</Label>
              <div className="flex gap-2">
                <Input
                  id="manual-link"
                  type="text"
                  placeholder="Paste https://krovaa.com/wallet/pay/..."
                  value={manualLink}
                  onChange={(e) => setManualLink(e.target.value)}
                  className="rounded-xl border-slate-200 focus-visible:ring-sky-500/20 h-10 flex-1 text-xs"
                />
                <Button 
                  type="submit" 
                  disabled={!manualLink.trim()}
                  className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl h-10 px-4 font-semibold shrink-0"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QrScannerModal;
