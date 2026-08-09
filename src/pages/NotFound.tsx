import React from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

const NotFound = () => {
    return (
        <div className="container-main py-20 flex flex-col items-center text-center">
            {/* Car image */}
            <div className="relative rounded-3xl overflow-hidden mb-10 max-w-lg w-full aspect-[16/10] bg-slate-100 shadow-lg">
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1XK2L7EpsFR7K_eosnwu-nObzshJ1Ty2a8myYaJLGxNfVRumnjS7qbstQgmr0orhubbj2qWZONaSEPe_N7kcPM_1QfK25z_ISQyqhepk7R2dKxgZkvCaLxu1sknYBEuc8ql5XtjjvTxpkgGtcvcz9YskEEhJWegVcLP20ML2BowuulsKcxPJys4ux6Vi6vSqWwbUnsgtemZ2KMzcaeJsz8ZDBvA8U6qYDVmNQ5ksSaho1Svizzl2FUtSrad_4n_fgXjaKl4oo-CEH" alt="Car on a road" className="w-full h-full object-cover" />
                <div className="absolute bottom-4 left-4 bg-accent text-primary text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">warning</span> Wrong Way
                </div>
            </div>

            <h1 className="text-7xl font-black text-accent font-display mb-4">404</h1>
            <h2 className="text-2xl font-bold text-primary font-display mb-3">Looks like you took a wrong turn!</h2>
            <p className="text-slate-500 max-w-md mb-8">
                The page you are looking for might have been moved, deleted, or possibly never existed. Don't worry, even the best drivers get lost sometimes.
            </p>

            <div className="flex flex-wrap gap-4 justify-center mb-10">
                <Link to="/" className="inline-flex items-center gap-2 h-12 px-8 bg-accent text-primary font-bold rounded-xl hover:bg-accent-hover transition-all shadow-sm text-sm">
                    <span className="material-symbols-outlined text-lg">arrow_back</span> Back to Home
                </Link>
                <Link to="/inventory" className="inline-flex items-center gap-2 h-12 px-8 border-2 border-accent text-accent font-bold rounded-xl hover:bg-accent hover:text-primary transition-all text-sm">
                    Explore Inventory <span className="material-symbols-outlined text-lg">directions_car</span>
                </Link>
            </div>

            <p className="text-sm text-slate-500 mb-3">Looking for a specific model?</p>
            <div className="flex items-center gap-2 bg-white rounded-xl px-4 h-12 border border-slate-200 w-full max-w-md shadow-sm focus-within:ring-2 focus-within:ring-accent/20">
                <Search size={18} className="text-slate-400" />
                <input className="bg-transparent border-none text-sm w-full outline-none" placeholder="Search cars (e.g., 'Honda City', 'SUV')..." />
            </div>
        </div>
    );
};

export default NotFound;
