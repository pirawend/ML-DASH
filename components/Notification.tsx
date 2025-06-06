
import React, { useEffect, useState } from 'react';
import { Info, XCircle, CheckCircle } from 'lucide-react';
import { NotificationType, NotificationMessage } from '../types';

interface NotificationProps {
  notification: NotificationMessage;
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ notification, onClose }) => {
  const { message, type } = notification;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let displayTimer: number | undefined;
    let closeTimer: number | undefined;

    if (message && type) {
      setIsVisible(true); // Trigger animation in

      displayTimer = window.setTimeout(() => {
        setIsVisible(false); // Trigger animation out
        closeTimer = window.setTimeout(() => {
          onClose();
        }, 300); // Duration of fade-out animation
      }, 5000); // Display duration before starting to fade out
    } else {
      setIsVisible(false); // If message becomes null/empty, ensure it's hidden
    }

    return () => {
      clearTimeout(displayTimer);
      clearTimeout(closeTimer);
    };
  }, [message, type, onClose]);

  if (!message && !isVisible) return null; // Only render null if message is gone AND animation out should be complete

  const bgColor = type === NotificationType.ERROR ? 'bg-red-600' :
                  type === NotificationType.SUCCESS ? 'bg-green-600' :
                  'bg-blue-600';
  const Icon = type === NotificationType.ERROR ? XCircle :
               type === NotificationType.SUCCESS ? CheckCircle :
               Info;

  return (
    <div
      className={`fixed top-5 right-5 ${bgColor} text-white p-4 rounded-lg shadow-2xl flex items-center z-[100] transform transition-all duration-300 ease-out
        ${isVisible && message ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}`}
    >
      <Icon size={24} className="mr-3 flex-shrink-0" />
      <span className="flex-grow">{message}</span>
      <button 
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }} 
        className="ml-4 text-xl font-bold flex-shrink-0"
        aria-label="Close notification"
      >
        &times;
      </button>
    </div>
  );
};

export default Notification;