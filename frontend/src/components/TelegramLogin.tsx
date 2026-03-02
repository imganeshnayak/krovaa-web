import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const TelegramLogin = () => {
    const { loginWithTelegram } = useAuth();
    const navigate = useNavigate();
    const scriptContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Define the callback function in the window object
        (window as any).onTelegramAuth = async (user: any) => {
            try {
                const loggedInUser = await loginWithTelegram(user);
                if (loggedInUser.role === 'admin' || loggedInUser.role === 'staff') {
                    navigate('/admin', { replace: true });
                } else {
                    navigate('/chat', { replace: true });
                }
            } catch (err) {
                console.error('Telegram login failed:', err);
            }
        };

        // Create the script element
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', import.meta.env.VITE_TELEGRAM_BOT_NAME || 'krovaabot');
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        script.setAttribute('data-request-access', 'write');
        script.async = true;

        // Append the script to the container
        if (scriptContainerRef.current) {
            scriptContainerRef.current.appendChild(script);
        }

        return () => {
            // Cleanup the script and callback
            if (scriptContainerRef.current) {
                scriptContainerRef.current.innerHTML = '';
            }
            delete (window as any).onTelegramAuth;
        };
    }, [loginWithTelegram, navigate]);

    return <div ref={scriptContainerRef} className="flex justify-center my-4 overflow-hidden min-h-[40px]"></div>;
};

export default TelegramLogin;
