import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { X } from 'lucide-react';

const HomePopup = () => {
  const [popup, setPopup] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const loadPopup = async () => {
    try {
      const { data } = await supabase
        .from('homepage_popup')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setPopup(data);
        // Verificar se já foi visto nesta sessão
        const sessionKey = `popup-${data.id}-seen`;
        if (!sessionStorage.getItem(sessionKey)) {
          setIsVisible(true);
          // Trigger animation após um frame
          requestAnimationFrame(() => setIsAnimating(true));
          sessionStorage.setItem(sessionKey, 'true');
        }
      }
    } catch (error) {
      // Silent error
    }
  };

  useEffect(() => {
    // Delay de 500ms para melhor UX
    const timer = setTimeout(() => {
      loadPopup();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsAnimating(false);
    // Esperar animação terminar antes de desaparecer
    setTimeout(() => setIsVisible(false), 300);
  };

  const handleImageClick = () => {
    if (popup?.link_url) {
      if (popup.link_url.startsWith('http')) {
        window.open(popup.link_url, '_blank');
      } else {
        window.location.href = popup.link_url;
      }
    }
  };

  if (!isVisible || !popup) return null;

  return (
    <>
      <style>{`
        @keyframes popupFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes popupScaleIn {
          from {
            transform: scale(0.9) translateY(-20px);
            opacity: 0;
          }
          to {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }

        @keyframes popupFadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        @keyframes popupScaleOut {
          from {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
          to {
            transform: scale(0.9) translateY(-20px);
            opacity: 0;
          }
        }

        .popup-overlay {
          animation: ${isAnimating ? 'popupFadeIn' : 'popupFadeOut'} 0.3s ease-out forwards;
        }

        .popup-content {
          animation: ${isAnimating ? 'popupScaleIn' : 'popupScaleOut'} 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>

      <div className="popup-overlay fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4 -mt-16">
        <div className="popup-content relative max-w-3xl w-full">
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 bg-red-600 rounded-full p-2 shadow-lg hover:bg-red-700 transition"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Image Container */}
          <div
            className={`bg-white rounded-lg overflow-hidden shadow-2xl ${
              popup.link_url ? 'cursor-pointer hover:shadow-3xl transition-shadow' : ''
            }`}
            onClick={handleImageClick}
          >
            <img
              src={popup.image_url}
              alt="Popup promocional"
              className="w-full h-auto object-cover"
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default HomePopup;
