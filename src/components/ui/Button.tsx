import React from 'react';
import clsx from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    children: React.ReactNode;
    as?: 'button' | 'a';
    href?: string;
}

const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', children, className, ...props }) => {
    const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 cursor-pointer select-none whitespace-nowrap';

    const variants: Record<string, string> = {
        primary: 'bg-primary text-white hover:bg-primary-light shadow-sm',
        secondary: 'bg-slate-100 text-primary hover:bg-slate-200',
        outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-white',
        ghost: 'text-slate-600 hover:bg-slate-100 hover:text-primary',
        accent: 'bg-accent text-primary font-bold hover:bg-accent-hover shadow-sm',
        danger: 'bg-danger text-white hover:bg-red-700',
    };

    const sizes: Record<string, string> = {
        sm: 'h-9 px-4 text-sm',
        md: 'h-11 px-6 text-sm',
        lg: 'h-13 px-8 text-base',
    };

    return (
        <button className={clsx(base, variants[variant], sizes[size], className)} {...props}>
            {children}
        </button>
    );
};

export default Button;
