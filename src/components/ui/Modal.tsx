import React from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, subtitle, children, size = 'md' }) => {
    if (!isOpen) return null;

    const sizes: Record<string, string> = {
        sm: 'max-w-md',
        md: 'max-w-xl',
        lg: 'max-w-3xl',
        xl: 'max-w-5xl',
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={clsx(
                'relative bg-white rounded-2xl shadow-[var(--shadow-elevated)] w-full overflow-hidden',
                sizes[size]
            )}>
                {(title || subtitle) && (
                    <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-100">
                        <div>
                            {title && <h3 className="text-xl font-bold text-primary">{title}</h3>}
                            {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 -m-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                )}
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
};

export default Modal;
