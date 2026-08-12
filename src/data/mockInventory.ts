export interface CarItem {
    id: string;
    make: string;
    model: string;
    year: number;
    price: number;
    original_price?: number;
    fuel_type: string;
    transmission: string;
    mileage: number;
    images: string[];
    condition: string;
    status: string;
    body_type?: string;
    deal_ends_at?: string | null;
    description?: string | null;
    created_at?: string;
}

export const FALLBACK_INVENTORY: CarItem[] = [
    {
        id: 'e7a402eb-ca0c-43e1-94b0-b7c043a1ffb7',
        make: 'Toyota',
        model: 'Innova Crysta',
        year: 2021,
        price: 1850000,
        original_price: 1950000,
        fuel_type: 'Diesel',
        transmission: 'Manual',
        mileage: 42000,
        images: [
            'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80'
        ],
        condition: 'Excellent',
        status: 'available',
        body_type: 'MUV',
        description: 'Well maintained Toyota Innova Crysta with complete service record.',
        created_at: new Date().toISOString()
    },
    {
        id: '5dc721dd-871b-4273-b20f-9d5a778dca91',
        make: 'Hyundai',
        model: 'Creta',
        year: 2022,
        price: 1280000,
        original_price: 1350000,
        fuel_type: 'Petrol',
        transmission: 'Manual',
        mileage: 28000,
        images: [
            'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=800&q=80'
        ],
        condition: 'Excellent',
        status: 'available',
        body_type: 'SUV',
        description: 'Single owner Hyundai Creta with sunroof and alloy wheels.',
        created_at: new Date().toISOString()
    },
    {
        id: 'b9e4f0f0-05ae-47da-b6b8-cffb5af24847',
        make: 'Honda',
        model: 'City',
        year: 2020,
        price: 890000,
        original_price: 950000,
        fuel_type: 'Petrol',
        transmission: 'Manual',
        mileage: 35000,
        images: [
            'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80'
        ],
        condition: 'Excellent',
        status: 'available',
        body_type: 'Sedan',
        description: 'Premium Honda City Sedan in top condition.',
        created_at: new Date().toISOString()
    },
    {
        id: '1d4d0cff-c4e2-46a3-8020-9e2018929e5b',
        make: 'Mahindra',
        model: 'Thar',
        year: 2023,
        price: 1450000,
        original_price: 1520000,
        fuel_type: 'Diesel',
        transmission: 'Manual',
        mileage: 15000,
        images: [
            'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80'
        ],
        condition: 'Excellent',
        status: 'available',
        body_type: 'SUV',
        description: 'Hardtop Mahindra Thar 4x4 with low mileage.',
        created_at: new Date().toISOString()
    },
    {
        id: '19349912-e4f9-4f9f-889f-e7049d36b87c',
        make: 'Maruti Suzuki',
        model: 'Swift',
        year: 2019,
        price: 575000,
        fuel_type: 'Petrol',
        transmission: 'Manual',
        mileage: 48000,
        images: [
            'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=800&q=80'
        ],
        condition: 'Good',
        status: 'available',
        body_type: 'Hatchback',
        description: 'Fuel-efficient Maruti Swift, perfect for city driving.',
        created_at: new Date().toISOString()
    },
    {
        id: '818ad9f1-e22f-405c-9078-a94e4d586062',
        make: 'Tata',
        model: 'Nexon',
        year: 2022,
        price: 990000,
        fuel_type: 'Petrol',
        transmission: 'Manual',
        mileage: 22000,
        images: [
            'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80'
        ],
        condition: 'Excellent',
        status: 'available',
        body_type: 'SUV',
        description: '5-star safety rated Tata Nexon with touch screen infotainment.',
        created_at: new Date().toISOString()
    }
];
