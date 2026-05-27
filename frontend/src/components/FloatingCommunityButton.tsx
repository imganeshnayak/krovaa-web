import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { ENABLE_COMMUNITIES } from '@/lib/features';

const FloatingCommunityButton = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [isChatOpen, setIsChatOpen] = React.useState(false);

  React.useEffect(() => {
    const checkChat = () => setIsChatOpen(sessionStorage.getItem('chat_open') === 'true');
    const onChatChange = (e: Event) => setIsChatOpen((e as CustomEvent).detail.isOpen);
    checkChat();
    window.addEventListener('chatChange', onChatChange);
    window.addEventListener('storage', checkChat);
    return () => {
      window.removeEventListener('chatChange', onChatChange);
      window.removeEventListener('storage', checkChat);
    };
  }, []);

  if (!ENABLE_COMMUNITIES) return null;
  if (!user || user.role === 'staff') return null;
  if (isChatOpen) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/communities')}
      aria-label="Communities"
      className="fixed bottom-24 right-6 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#00A4EF] text-white shadow-[0_12px_30px_rgba(0,164,239,0.3)] transition-all duration-200 hover:bg-[#0087d1] hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#00A4EF]/50"
    >
      <Users className="h-6 w-6 stroke-[2.5]" />
    </button>
  );
};

export default FloatingCommunityButton;
