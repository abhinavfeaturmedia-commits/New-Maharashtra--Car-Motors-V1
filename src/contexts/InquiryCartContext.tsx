import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Car {
    id: string;
    make: string;
    model: string;
    year: number;
    price: number;
    fuel_type: string;
    transmission: string;
    mileage: number;
    images: string[];
    status: string;
    created_at: string;
    condition: string;
    body_type?: string;
}

interface InquiryCartContextType {
    cartItems: Car[];
    addToCart: (car: Car) => void;
    removeFromCart: (carId: string) => void;
    clearCart: () => void;
    isInCart: (carId: string) => boolean;
    isCartOpen: boolean;
    setIsCartOpen: (open: boolean) => void;
}

const InquiryCartContext = createContext<InquiryCartContextType | undefined>(undefined);

export const InquiryCartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [cartItems, setCartItems] = useState<Car[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);

    // Load cart from LocalStorage on mount
    useEffect(() => {
        const storedCart = localStorage.getItem('nmm_inquiry_cart') || localStorage.getItem('swami_inquiry_cart');
        if (storedCart) {
            try {
                setCartItems(JSON.parse(storedCart));
            } catch (e) {
                console.error("Failed to parse inquiry cart from storage", e);
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('nmm_inquiry_cart', JSON.stringify(cartItems));
    }, [cartItems]);

    const addToCart = (car: Car) => {
        if (!cartItems.some(item => item.id === car.id)) {
            setCartItems(prev => [...prev, car]);
        }
        setIsCartOpen(true); // Open the drawer when an item is added
    };

    const removeFromCart = (carId: string) => {
        setCartItems(prev => prev.filter(item => item.id !== carId));
    };

    const clearCart = () => {
        setCartItems([]);
    };

    const isInCart = (carId: string) => {
        return cartItems.some(item => item.id === carId);
    };

    return (
        <InquiryCartContext.Provider value={{
            cartItems,
            addToCart,
            removeFromCart,
            clearCart,
            isInCart,
            isCartOpen,
            setIsCartOpen
        }}>
            {children}
        </InquiryCartContext.Provider>
    );
};

export const useInquiryCart = () => {
    const context = useContext(InquiryCartContext);
    if (!context) {
        throw new Error('useInquiryCart must be used within an InquiryCartProvider');
    }
    return context;
};
