import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { MuteDurationOption } from '@/lib/chatMute';

type ChatOptionsBottomSheetProps = {
  open: boolean;
  mode: 'main' | 'mute';
  isMuted: boolean;
  onClose: () => void;
  onOpenMuteMenu: () => void;
  onToggleMute: () => void;
  onSelectMuteDuration: (option: MuteDurationOption) => void;
  onDeleteRequest: () => void;
};

const rowClass = 'w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-secondary/70 transition-colors';

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const sheetVariants = {
  hidden: { y: '100%' },
  visible: {
    y: 0,
    transition: { type: 'spring', damping: 28, stiffness: 300 },
  },
  exit: {
    y: '100%',
    transition: { type: 'spring', damping: 24, stiffness: 320 },
  },
};

const ChatOptionsBottomSheet = ({
  open,
  mode,
  isMuted,
  onClose,
  onOpenMuteMenu,
  onToggleMute,
  onSelectMuteDuration,
  onDeleteRequest,
}: ChatOptionsBottomSheetProps) => {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label="Chat Options">
          <motion.button
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            aria-label="Dismiss chat options"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
          />

          <motion.div
            className="absolute bottom-0 left-0 right-0"
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div
              className="bg-background rounded-t-[24px] border border-border/50 shadow-2xl overflow-hidden"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
            >
              <div className="px-5 pt-4 pb-2 border-b border-border/50">
                <p className="text-xs text-muted-foreground font-semibold tracking-wide">Chat Options</p>
              </div>

              {mode === 'main' ? (
                <div className="py-1">
                  <button
                    onClick={isMuted ? onToggleMute : onOpenMuteMenu}
                    className={rowClass}
                    type="button"
                  >
                    <span className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Icon name={isMuted ? 'Bell' : 'BellOff'} className="h-4 w-4" />
                      {isMuted ? 'Unmute Chat' : 'Mute Chat'}
                    </span>
                  </button>

                  <button
                    onClick={onDeleteRequest}
                    className={`${rowClass} text-destructive`}
                    type="button"
                  >
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Icon name="Trash2" className="h-4 w-4" />
                      Delete Chat
                    </span>
                  </button>

                  <div className="px-5 pt-2 pb-2">
                    <Button variant="outline" className="w-full" onClick={onClose}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="py-1">
                  <button onClick={() => onSelectMuteDuration('8h')} className={rowClass} type="button">
                    <span className="text-sm font-medium text-foreground">Mute for: 8 Hours</span>
                  </button>
                  <button onClick={() => onSelectMuteDuration('1w')} className={rowClass} type="button">
                    <span className="text-sm font-medium text-foreground">Mute for: 1 Week</span>
                  </button>
                  <button onClick={() => onSelectMuteDuration('always')} className={rowClass} type="button">
                    <span className="text-sm font-medium text-foreground">Mute Always</span>
                  </button>

                  <div className="px-5 pt-2 pb-2">
                    <Button variant="outline" className="w-full" onClick={onClose}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ChatOptionsBottomSheet;
