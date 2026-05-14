import React from "react";
import { Loader2 } from "lucide-react";

const LoadingScreen = () => {
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white backdrop-blur-3xl animate-in fade-in duration-500">
            <div className="flex flex-col items-center gap-6">
                <h1 style={{ fontFamily: "'Syne', sans-serif" }} className="text-5xl font-bold tracking-tight text-[#00A4EF] animate-pulse">Krovaa</h1>
                <div className="flex items-center gap-2 text-[#1C1C1C]/40">
                    <Loader2 className="h-5 w-5 animate-spin text-[#00A4EF]" />
                    <span className="text-sm font-medium tracking-widest uppercase opacity-80">Initializing Secure Layer</span>
                </div>
            </div>
        </div>
    );

};

export default LoadingScreen;
