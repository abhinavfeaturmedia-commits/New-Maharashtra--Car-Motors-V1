import React from 'react';
import clsx from 'clsx';

interface BadgeProps {
    variant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'accent' | 'outline';
    size?: 'sm' | 'md';
    children: React.ReactNode;
    className?: string;
    dot?: boolean;
}

const Badge: React.FC<BadgeProps> = ({ variant = 'default', size = 'sm', children, className, dot }) => {
    const base = 'inline-flex items-center gap-1.5 font-bold rounded-full whitespace-nowrap';

    const variants: Record<string, string> = {
        default: 'bg-slate-100 text-slate-700',
        success: 'bg-success-light text-success',
        danger: 'bg-danger-light text-danger',
        warning: 'bg-warning-light text-warning',
        info: 'bg-info-light text-info',
        accent: 'bg-accent text-primary',
        outline: 'border border-slate-200 text-slate-600',
    };

    const sizes: Record<string, string> = {
        sm: 'px-2.5 py-0.5 text-[11px]',
        md: 'px-3 py-1 text-xs',
    };

    return (
        <span className={clsx(base, variants[variant], sizes[size], className)}>
            {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', {
                'bg-slate-500': variant === 'default',
                'bg-success': variant === 'success',
                'bg-danger': variant === 'danger',
                'bg-warning': variant === 'warning',
                'bg-info': variant === 'info',
            })} />}
            {children}
        </span>
    );
};

export default Badge;
