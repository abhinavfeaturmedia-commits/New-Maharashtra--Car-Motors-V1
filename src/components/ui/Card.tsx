import React from 'react';
import clsx from 'clsx';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

const Card: React.FC<CardProps> = ({ children, className, hover = false, padding = 'md' }) => {
    const paddings: Record<string, string> = {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
    };

    return (
        <div className={clsx(
            'bg-white rounded-2xl border border-slate-100',
            'shadow-[var(--shadow-card)]',
            hover && 'hover:shadow-[var(--shadow-card-hover)] transition-shadow duration-300',
            paddings[padding],
            className
        )}>
            {children}
        </div>
    );
};

export default Card;
