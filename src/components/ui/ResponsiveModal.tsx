import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { X } from 'lucide-react';

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  open,
  onOpenChange,
  title,
  children,
  icon,
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-end md:hidden">
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" 
          onClick={() => onOpenChange(false)} 
        />
        <div className="relative w-full bg-white rounded-t-3xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-full duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              {icon && <span className="text-slate-700">{icon}</span>}
              {title}
            </h3>
            <button 
              onClick={() => onOpenChange(false)} 
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full bg-slate-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="pb-4">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Desktop View
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white sm:rounded-xl">
        <DialogHeader className="border-b border-slate-100 pb-4 mb-4">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            {icon && <span className="text-slate-700">{icon}</span>}
            {title}
          </DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
};
