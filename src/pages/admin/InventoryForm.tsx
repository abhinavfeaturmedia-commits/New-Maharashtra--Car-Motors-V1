import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { generateOpenRouterCompletion } from '../../lib/openrouter';
import imageCompression from 'browser-image-compression';
import VideoPlayer from '../../components/ui/VideoPlayer';

const MAKES = [
    'Maruti Suzuki', 'Hyundai', 'Tata', 'Honda', 'Toyota', 'Kia', 'MG', 'Mahindra', 
    'Volkswagen', 'Skoda', 'Renault', 'Nissan', 'Ford', 'Jeep', 'Mercedes-Benz', 
    'BMW', 'Audi', 'Citroën', 'BYD', 'Volvo', 'Land Rover', 'Jaguar', 'Lexus', 
    'Porsche', 'Mini', 'Force Motors', 'Isuzu', 'Datsun', 'Chevrolet', 'Fiat', 
    'Mitsubishi', 'Lamborghini', 'Ferrari', 'Bentley', 'Rolls-Royce', 'Ashok Leyland', 'Other'
];

interface Dealer {
    id: string;
    dealer_code: string;
    name: string;
    status: string;
}

const InventoryForm = () => {
    const { id } = useParams<{ id: string }>();
    const isEditMode = Boolean(id);
    const navigate = useNavigate();
    const { user, hasPermission } = useAuth();
    const { settings, refreshData } = (useData() as any) || {};
    const canManage = hasPermission('inventory', 'manage');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Form state ──────────────────────────────────────────────────────────
    const [form, setForm] = useState({
        make: '', model: '', variant: '', year: new Date().getFullYear(),
        price: '', original_price: '',
        fuel_type: 'Petrol', transmission: 'Manual',
        mileage: '', color: '', body_type: '', registration_no: '',
        ownership: '1', condition: 'used', status: 'available',
        insurance: '',
        video_url: '',
        description: '',
    });

    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
    const [generatingError, setGeneratingError] = useState<string | null>(null);

    // ─── Source state ─────────────────────────────────────────────────────────
    const [source, setSource] = useState<'purchased' | 'consignment' | 'dealer'>('purchased');
    const [purchaseCost, setPurchaseCost] = useState('');
    
    // Consignment state
    const [consignmentOwnerName, setConsignmentOwnerName] = useState('');
    const [consignmentOwnerPhone, setConsignmentOwnerPhone] = useState('');
    const [consignmentAgreedPrice, setConsignmentAgreedPrice] = useState('');
    const [consignmentFeeType, setConsignmentFeeType] = useState<'fixed' | 'percentage'>('fixed');
    const [consignmentFeeValue, setConsignmentFeeValue] = useState('');
    const [consignmentStartDate, setConsignmentStartDate] = useState('');
    const [consignmentEndDate, setConsignmentEndDate] = useState('');

    // Dealer state
    const [dealerId, setDealerId] = useState('');
    const [dealerAskingPrice, setDealerAskingPrice] = useState('');
    const [ourMargin, setOurMargin] = useState('');
    const [dealerCommission, setDealerCommission] = useState('');
    const [dealers, setDealers] = useState<Dealer[]>([]);
    const [dealerSearch, setDealerSearch] = useState('');       // text in the search box
    const [dealerDropdownOpen, setDealerDropdownOpen] = useState(false); // whether list is visible
    const dealerInputRef = useRef<HTMLInputElement>(null);

    // Fetch dealers for dropdown
    useEffect(() => {
        supabase.from('dealers').select('id, dealer_code, name, status').eq('status', 'active').then(({ data }) => {
            if (data) setDealers(data as Dealer[]);
        });
    }, []);

    // Sync dealerSearch with dealerId for edit mode
    useEffect(() => {
        if (dealerId && dealers.length > 0 && !dealerSearch) {
            const d = dealers.find(x => x.id === dealerId);
            if (d) setDealerSearch(`${d.dealer_code} — ${d.name}`);
        }
    }, [dealerId, dealers, dealerSearch]);

    const [existingImages, setExistingImages] = useState<string[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [initialLoading, setInitialLoading] = useState(isEditMode);
    const [autoFillText, setAutoFillText] = useState('');

    const set = (field: string, value: string | number) => setForm(prev => ({ ...prev, [field]: value }));

    const handleGenerateDescription = async () => {
        const orSettings = settings?.openrouter_settings;
        if (!orSettings?.api_key || !orSettings?.is_enabled) {
            setGeneratingError('OpenRouter is not configured or disabled in settings.');
            return;
        }

        if (!form.make || !form.model) {
            setGeneratingError('Please select both a make and model before generating.');
            return;
        }

        setIsGeneratingDesc(true);
        setGeneratingError(null);

        try {
            const systemPrompt = `You are a professional automotive copywriter at "New Maharashtra Motors", a premier automotive dealership and service provider in Kolhapur, Maharashtra, India.
Your goal is to write a premium, compelling marketing description (100-150 words) for a vehicle listing.
Focus on key benefits, drive quality, condition, pre-owned value, and sign off professionally.
Do NOT use placeholders like "[Dealer Name]" or "[Your Name]" - refer to us as "New Maharashtra Motors".
Do NOT write conversational introductions. Respond with the listing text directly.`;

            const userPrompt = `Write a listing description for:
Make: ${form.make}
Model: ${form.model}
Variant: ${form.variant || 'Standard'}
Year: ${form.year}
Price: ${form.price ? `₹${(Number(form.price) / 100000).toFixed(2)} Lakh` : 'Competitive pricing'}
Transmission: ${form.transmission}
Fuel Type: ${form.fuel_type}
Mileage: ${form.mileage ? `${Number(form.mileage).toLocaleString()} km` : 'Low mileage'}
Ownership: ${form.ownership} Owner(s)
Condition: ${form.condition}`;

            const apiKey = orSettings.api_key;
            const model = orSettings.default_model === 'custom' 
                ? orSettings.custom_model 
                : orSettings.default_model;

            const response = await generateOpenRouterCompletion({
                apiKey,
                model,
                systemPrompt,
                userPrompt
            });
            
            set('description', response);
        } catch (err: any) {
            console.error('Description generation failed:', err);
            setGeneratingError(err.message || 'Failed to generate description.');
        } finally {
            setIsGeneratingDesc(false);
        }
    };

    // ─── Load data if Edit Mode ─────────────────────────────────────────────
    useEffect(() => {
        const fetchCar = async () => {
            if (!id) return;
            const { data, error } = await supabase.from('inventory').select('*').eq('id', id).single();
            if (error || !data) {
                setError('Car not found.');
                setInitialLoading(false);
                return;
            }
            // Populate form
            setForm({
                make: data.make || '',
                model: data.model || '',
                variant: data.variant || '',
                year: data.year || new Date().getFullYear(),
                price: data.price ? String(data.price) : '',
                original_price: data.original_price ? String(data.original_price) : '',
                fuel_type: data.fuel_type || 'Petrol',
                transmission: data.transmission || 'Manual',
                mileage: data.mileage ? String(data.mileage) : '',
                color: data.color || '',
                body_type: data.body_type || '',
                registration_no: data.registration_no || '',
                ownership: data.ownership ? String(data.ownership) : '1',
                condition: data.condition || 'used',
                status: data.status || 'available',
                insurance: data.insurance || '',
                video_url: data.video_url || '',
                description: data.description || '',
            });
            // Populate source fields
            setSource(data.source || 'purchased');
            setPurchaseCost(data.purchase_cost ? String(data.purchase_cost) : '');
            
            setConsignmentOwnerName(data.consignment_owner_name || '');
            setConsignmentOwnerPhone(data.consignment_owner_phone || '');
            setConsignmentAgreedPrice(data.consignment_agreed_price ? String(data.consignment_agreed_price) : '');
            setConsignmentFeeType(data.consignment_fee_type || 'fixed');
            setConsignmentFeeValue(data.consignment_fee_value ? String(data.consignment_fee_value) : '');
            setConsignmentStartDate(data.consignment_start_date || '');
            setConsignmentEndDate(data.consignment_end_date || '');

            setDealerId(data.dealer_id || '');
            setDealerAskingPrice(data.dealer_asking_price ? String(data.dealer_asking_price) : '');
            setOurMargin(data.our_margin ? String(data.our_margin) : '');
            setDealerCommission(data.dealer_commission ? String(data.dealer_commission) : '');
            if (data.images) {
                setExistingImages(data.images);
            }
            setInitialLoading(false);
        };
        fetchCar();
    }, [id]);

    // ─── Image selection ─────────────────────────────────────────────────────
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length === 0) return;
        const totalCount = existingImages.length + selectedFiles.length + files.length;
        if (totalCount > 20) {
            alert('Cannot select more than 20 photos total.');
            return;
        }

        setUploading(true);
        try {
            const options = {
                maxSizeMB: 0.5, // Target max size 500KB
                maxWidthOrHeight: 1920,
                useWebWorker: true,
                initialQuality: 0.8
            };

            const compressedFiles = await Promise.all(
                files.map(async (file) => {
                    try {
                        const compressedBlob = await imageCompression(file, options);
                        return new File([compressedBlob], file.name, {
                            type: compressedBlob.type,
                            lastModified: Date.now(),
                        });
                    } catch (err) {
                        console.error('Image compression failed for', file.name, err);
                        return file; // use original if compression fails
                    }
                })
            );

            const combined = [...selectedFiles, ...compressedFiles];
            setSelectedFiles(combined);
            setPreviews(combined.map(f => URL.createObjectURL(f)));
        } catch (error) {
            console.error('Error handling file selection:', error);
            alert('An error occurred while compiling your images.');
        } finally {
            setUploading(false);
        }

        // Reset the input value so the same files can be selected again
        if (e.target) {
            e.target.value = '';
        }
    };

    const removeNewImage = (index: number) => {
        const newFiles = selectedFiles.filter((_, i) => i !== index);
        setSelectedFiles(newFiles);
        setPreviews(newFiles.map(f => URL.createObjectURL(f)));
    };

    const removeExistingImage = (index: number) => {
        setExistingImages(prev => prev.filter((_, i) => i !== index));
    };

    const getImageUrl = (img: string) => {
        if (img.startsWith('http')) return img;
        return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/car-images/${img}`;
    };

    // ─── Smart Auto Fill ──────────────────────────────────────────────────────
    const handleAutoFill = () => {
        if (!autoFillText.trim()) return;

        const data = { ...form };

        // ── Helpers ──────────────────────────────────────────────────────────
        // Strip emojis/symbols but keep ₹ and useful punctuation
        const cleanText = autoFillText
            .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
            .replace(/[\u2600-\u27BF]/gu, '')
            .replace(/[*•·|]/g, ' ');

        const lines = cleanText.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
        const fullText = cleanText;
        const lower = fullText.toLowerCase();

        const parseIndianNumber = (s: string) =>
            s.replace(/,/g, '').replace(/\/-$/, '').trim();

        // ── 1. Registration Number ────────────────────────────────────────────
        // Handles: MH09AB1234 / MH09 EK 2958 / MH48 AW 2578 / MH46 W 0261
        const regMatch = fullText.match(/\b([A-Z]{2}[\s\-]?\d{1,2}[\s\-]?[A-Z]{1,3}[\s\-]?\d{1,4})\b/i);
        if (regMatch) {
            const raw = regMatch[1].replace(/[\s\-]/g, '').toUpperCase();
            if (/\d/.test(raw) && raw.length >= 4) data.registration_no = raw;
        }

        // ── 2. Make ───────────────────────────────────────────────────────────
        const makeAliases: Record<string, string> = {
            'maruti suzuki': 'Maruti Suzuki',
            'maruti': 'Maruti Suzuki',
            'suzuki': 'Maruti Suzuki',
            'hyundai': 'Hyundai',
            'tata': 'Tata',
            'honda': 'Honda',
            'toyota': 'Toyota',
            'kia': 'Kia',
            'mahindra': 'Mahindra',
            'volkswagen': 'Volkswagen',
            'vw': 'Volkswagen',
            'skoda': 'Skoda',
            'renault': 'Renault',
            'nissan': 'Nissan',
            'ford': 'Ford',
            'jeep': 'Jeep',
            'mercedes-benz': 'Mercedes-Benz',
            'mercedes': 'Mercedes-Benz',
            'bmw': 'BMW',
            'audi': 'Audi',
            'citroen': 'Citroën',
            'citroën': 'Citroën',
            'byd': 'BYD',
            'volvo': 'Volvo',
            'land rover': 'Land Rover',
            'jaguar': 'Jaguar',
            'lexus': 'Lexus',
            'porsche': 'Porsche',
            'mini': 'Mini',
            'force': 'Force Motors',
            'isuzu': 'Isuzu',
            'datsun': 'Datsun',
            'chevrolet': 'Chevrolet',
            'chevy': 'Chevrolet',
            'fiat': 'Fiat',
            'mitsubishi': 'Mitsubishi',
            'lamborghini': 'Lamborghini',
            'ferrari': 'Ferrari',
            'bentley': 'Bentley',
            'rolls royce': 'Rolls-Royce',
            'rolls-royce': 'Rolls-Royce',
            'ashok leyland': 'Ashok Leyland',
            'leyland': 'Ashok Leyland',
        };
        const sortedAliases = Object.keys(makeAliases).sort((a, b) => b.length - a.length);
        for (const alias of sortedAliases) {
            if (lower.includes(alias)) {
                data.make = makeAliases[alias];
                break;
            }
        }

        // ── 3. Model + Variant ────────────────────────────────────────────────
        const modelsByMake: Record<string, string[]> = {
            'Maruti Suzuki': ['Swift Dzire', 'Dzire', 'Alto K10', 'Alto 800', 'Alto', 'Baleno', 'Vitara Brezza', 'Brezza', 'Grand Vitara', 'Ertiga', 'WagonR', 'Wagon R', 'Celerio', 'Ignis', 'S-Cross', 'Ciaz', 'Eeco', 'Omni', 'Jimny', 'Fronx', 'Invicto', 'Swift'],
            'Hyundai': ['Grand i10 Nios', 'Grand i10', 'Creta', 'Venue', 'i20 Active', 'i20', 'i10', 'Verna', 'Tucson', 'Alcazar', 'Aura', 'Santro', 'Exter', 'Ioniq'],
            'Tata': ['Nexon EV', 'Nexon', 'Harrier', 'Safari', 'Tiago EV', 'Tiago', 'Tigor', 'Punch', 'Altroz', 'Hexa', 'Indica', 'Indigo', 'Nano', 'Zest', 'Bolt'],
            'Honda': ['City Hybrid', 'City', 'Amaze', 'Jazz', 'WR-V', 'BR-V', 'CR-V', 'HR-V', 'Accord', 'Civic', 'Brio', 'Mobilio', 'Elevate'],
            'Toyota': ['Innova Crysta', 'Innova HyCross', 'Innova', 'Fortuner Legender', 'Fortuner', 'Glanza', 'Urban Cruiser', 'Hyryder', 'Camry', 'Etios Liva', 'Etios Cross', 'Etios', 'Liva', 'Corolla', 'Rumion'],
            'Kia': ['Seltos', 'Sonet', 'Carnival', 'Carens', 'EV6'],
            'MG': ['Hector Plus', 'Hector', 'Astor', 'Gloster', 'ZS EV', 'Comet'],
            'Mahindra': ['XUV 3XO', 'XUV700', 'XUV400', 'XUV300', 'Scorpio N', 'Scorpio Classic', 'Scorpio', 'Thar', 'Bolero Neo', 'Bolero', 'KUV100', 'Marazzo', 'BE6'],
            'Volkswagen': ['Polo Cross', 'Polo', 'Vento', 'Taigun', 'Tiguan Allspace', 'Tiguan', 'Virtus'],
            'Skoda': ['Rapid', 'Kushaq', 'Octavia', 'Superb', 'Kodiaq', 'Slavia'],
            'Renault': ['Duster', 'Kwid', 'Triber', 'Kiger'],
            'Nissan': ['Magnite', 'Kicks', 'Terrano', 'Micra'],
            'Ford': ['EcoSport', 'Figo Aspire', 'Figo', 'Endeavour', 'Freestyle', 'Aspire'],
            'Jeep': ['Grand Cherokee', 'Compass', 'Meridian', 'Wrangler'],
            'Mercedes-Benz': ['GLE', 'GLS', 'GLC', 'C-Class', 'E-Class', 'S-Class', 'A-Class'],
            'BMW': ['X1', 'X3', 'X5', '3 Series', '5 Series', '7 Series'],
            'Audi': ['A4', 'A6', 'Q3', 'Q5', 'Q7'],
            'Citroën': ['C3', 'eC3', 'C3 Aircross', 'C5 Aircross'],
            'BYD': ['Atto 3', 'Seal', 'e6'],
            'Volvo': ['XC40', 'XC60', 'XC90', 'S90', 'C40'],
            'Land Rover': ['Defender', 'Range Rover', 'Discovery', 'Evoque', 'Velar'],
            'Jaguar': ['F-Pace', 'I-Pace', 'XF'],
            'Lexus': ['ES', 'RX', 'NX', 'LX'],
            'Porsche': ['Cayenne', 'Macan', 'Panamera', '911', 'Taycan'],
            'Mini': ['Cooper', 'Countryman'],
            'Force Motors': ['Gurkha'],
            'Isuzu': ['D-Max', 'V-Cross', 'MU-X'],
            'Datsun': ['Go', 'Go+', 'Redi-Go'],
            'Chevrolet': ['Beat', 'Cruze', 'Sail', 'Tavera', 'Spark', 'Captiva'],
            'Fiat': ['Punto', 'Linea', 'Avventura', 'Palio'],
            'Mitsubishi': ['Pajero', 'Lancer', 'Outlander', 'Montero'],
            'Lamborghini': ['Urus', 'Huracan', 'Aventador'],
            'Ferrari': ['Roma', '296 GTB', 'Portofino', 'F8 Tributo'],
            'Bentley': ['Continental GT', 'Flying Spur', 'Bentayga'],
            'Rolls-Royce': ['Ghost', 'Phantom', 'Cullinan'],
            'Ashok Leyland': ['Dost', 'Stile', 'Bada Dost'],
        };

        const noiseWords = new Set([
            'petrol', 'diesel', 'cng', 'lpg', 'electric', 'ev', 'hybrid', 'owner', 'ownership',
            'price', 'km', 'kms', 'rs', 'inr', 'lakh', 'negotiable', 'nigotiable',
            'insurance', 'inssurance', 'driven', 'running', 'genuine', 'condition',
            'single', 'double', 'key', 'keys', 'contact', 'registration', 'model',
            'make', 'fuel', 'color', 'colour', 'white', 'black', 'silver', 'grey',
            'gray', 'red', 'blue', 'green', 'yellow', 'orange', 'brown', 'maroon',
            'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
            'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september',
            'october', 'november', 'december', 'saptember', 'valid', 'expire', 'expired',
            'company', 'maintained', 'showroom', 'pure', 'and',
        ]);

        const knownModels = data.make ? (modelsByMake[data.make] || []) : Object.values(modelsByMake).flat();
        const sortedModels = [...knownModels].sort((a, b) => b.length - a.length);

        let detectedModel = '';
        for (const model of sortedModels) {
            if (lower.includes(model.toLowerCase())) {
                detectedModel = model;
                data.model = model;
                break;
            }
        }

        // Extract variant from the line containing the model
        if (detectedModel) {
            const modelLower = detectedModel.toLowerCase();
            const makeLower = (data.make || '').toLowerCase();
            for (const line of lines) {
                const lineLower = line.toLowerCase();
                if (lineLower.includes(modelLower)) {
                    let remainder = line
                        .replace(new RegExp(makeLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
                        .replace(/maruti/gi, '')
                        .replace(/suzuki/gi, '')
                        .replace(new RegExp(modelLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
                        .trim();

                    const tokens = remainder.split(/[\s,\/\u2013\-]+/).filter((t: string) => {
                        const tl = t.toLowerCase();
                        return (
                            t.length > 1 &&
                            !noiseWords.has(tl) &&
                            !/^\d{4}$/.test(t) &&
                            !/^\d{2,6}(km|kms)?$/i.test(t)
                        );
                    });

                    if (tokens.length > 0) data.variant = tokens.join(' ');
                    break;
                }
            }
        }

        // ── 4. Year ───────────────────────────────────────────────────────────
        // Handles: "2017", "2017/june", "2017/saptember", "Model 2017/june"
        const yearPatterns = [
            /(20\d{2}|19\d{2})[\s\/\-](?:jan|feb|mar|apr|may|jun|jul|aug|sep|sap|oct|nov|dec)/i,
            /model\s*[:\-]?\s*(20\d{2}|19\d{2})/i,
            /\b(20\d{2}|19\d{2})\b/,
        ];
        for (const pat of yearPatterns) {
            const m = fullText.match(pat);
            if (m) {
                // The year is in capture group 1 for patterns 2&3, and group 0 start for pattern 1
                const yearStr = m[1] || m[0].match(/\d{4}/)?.[0];
                if (yearStr) { data.year = Number(yearStr); break; }
            }
        }

        // ── 5. Price ──────────────────────────────────────────────────────────
        // Handles: "Price ₹11,50,000/-", "Price 7,75,000", "₹3,60,000"
        const pricePatterns = [
            /price\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+)\s*\/-?/i,
            /price\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+)/i,
            /(?:rs\.?|inr|₹)\s*([\d,]+)\s*\/-?/i,
            /(?:rs\.?|inr|₹)\s*([\d,]+)/i,
        ];
        for (const pat of pricePatterns) {
            const m = fullText.match(pat);
            if (m) {
                const num = parseIndianNumber(m[1]);
                if (num.length >= 4) { data.price = num; break; }
            }
        }

        // ── 6. Mileage ────────────────────────────────────────────────────────
        // Handles: "80,000 km", "118000 km", "72000 kk" (typo)
        const milMatch = fullText.match(/([\d,]+)\s*(?:km|kms|kk)\b/i);
        if (milMatch) {
            const val = parseIndianNumber(milMatch[1]);
            if (val.length >= 4 && !/^(20|19)\d{2}$/.test(val)) data.mileage = val;
        }

        // ── 7. Fuel Type ──────────────────────────────────────────────────────
        // Handles combinations like: "Petrol + CNG", "Petrol + Electric", "Petrol + LPG"
        const hasCNG = /\bcng\b/i.test(fullText);
        const hasPetrol = /\bpetrol\b/i.test(fullText);
        const hasDiesel = /\bdiesel\b/i.test(fullText);
        const hasElectric = /\belectric\b|\bev\b/i.test(fullText);
        const hasHybrid = /\bhybrid\b/i.test(fullText);
        const hasLPG = /\blpg\b/i.test(fullText);

        if (hasPetrol && hasCNG) data.fuel_type = 'Petrol + CNG';
        else if (hasPetrol && hasElectric) data.fuel_type = 'Petrol + Electric';
        else if (hasPetrol && hasLPG) data.fuel_type = 'Petrol + LPG';
        else if (hasCNG) data.fuel_type = 'CNG';
        else if (hasDiesel) data.fuel_type = 'Diesel';
        else if (hasElectric) data.fuel_type = 'Electric';
        else if (hasHybrid) data.fuel_type = 'Hybrid';
        else if (hasPetrol) data.fuel_type = 'Petrol';

        // ── 8. Ownership ──────────────────────────────────────────────────────
        // Handles: "1st Owner", "Owner 1", "single owner", "Owner 2"
        const ownerWordMap: Record<string, string> = {
            first: '1', single: '1', '1st': '1', '1': '1',
            second: '2', '2nd': '2', '2': '2',
            third: '3', '3rd': '3', '3': '3',
            fourth: '4', '4th': '4', '4': '4',
        };
        const ownerPatterns = [
            /(?:owner|ownership)\s*[:\-]?\s*(\d)/i,
            /(\d)\s*(?:st|nd|rd|th)?\s*owner/i,
            /\b(first|1st|single)\s*owner/i,
            /\b(second|2nd)\s*owner/i,
            /\b(third|3rd)\s*owner/i,
            /\b(fourth|4th)\s*owner/i,
        ];
        for (const pat of ownerPatterns) {
            const m = lower.match(pat);
            if (m) {
                const raw = m[1].toLowerCase();
                data.ownership = ownerWordMap[raw] || raw;
                break;
            }
        }

        // ── 9. Color ──────────────────────────────────────────────────────────
        const colorMap: Record<string, string> = {
            'pearl white': 'Pearl White', 'arctic white': 'Arctic White',
            'polar white': 'Polar White', white: 'White', black: 'Black',
            silver: 'Silver', grey: 'Grey', gray: 'Grey', red: 'Red',
            blue: 'Blue', green: 'Green', yellow: 'Yellow', orange: 'Orange',
            brown: 'Brown', maroon: 'Maroon', beige: 'Beige', golden: 'Golden',
            gold: 'Golden', bronze: 'Bronze', purple: 'Purple', pink: 'Pink',
        };
        const colorLabelMatch = fullText.match(/colou?r\s*[:\-]\s*([\w\s]+)/i);
        if (colorLabelMatch) {
            const candidate = colorLabelMatch[1].trim().toLowerCase();
            const matched = Object.keys(colorMap).sort((a, b) => b.length - a.length).find(k => candidate.startsWith(k));
            if (matched) data.color = colorMap[matched];
        }
        if (!data.color) {
            const colorKeys = Object.keys(colorMap).sort((a, b) => b.length - a.length);
            for (const key of colorKeys) {
                if (lower.includes(key)) { data.color = colorMap[key]; break; }
            }
        }

        // ── 10. Transmission ─────────────────────────────────────────────────
        if (/\bautomatic\b|\bauto\b/i.test(fullText)) data.transmission = 'Automatic';
        else if (/\bcvt\b/i.test(fullText)) data.transmission = 'CVT';
        else if (/\bmanual\b/i.test(fullText)) data.transmission = 'Manual';

        // ── 11. Insurance ─────────────────────────────────────────────────────
        const insPatterns = [
            /ins(?:urance)?\s*[:\-]?\s*(valid|comprehensive|third party|zero dep|expired|nil dep|3rd party[^\n]*|[^\n,;·|]*\d{4})/i,
            /(comprehensive|third party|zero dep|nil dep|3rd party)\s*ins(?:urance)?/i,
        ];
        for (const pat of insPatterns) {
            const m = fullText.match(pat);
            if (m) {
                let val = (m[1] || m[0]).trim();
                val = val.charAt(0).toUpperCase() + val.slice(1);
                data.insurance = val;
                break;
            }
        }

        // ── 12. Video Walkthrough URL ─────────────────────────────────────────
        const videoMatch = fullText.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|instagram\.com|facebook\.com|fb\.watch)\/[^\s]+/i);
        if (videoMatch) {
            data.video_url = videoMatch[0];
        }

        setForm(data);
        setAutoFillText('');
    };


    // ─── Upload images to Supabase Storage ───────────────────────────────────
    const uploadImages = async (): Promise<string[]> => {
        if (selectedFiles.length === 0) return [];
        setUploading(true);
        const urls: string[] = [];
        const failed: string[] = [];

        for (const file of selectedFiles) {
            const ext = file.name.split('.').pop() || 'jpg';
            const path = `cars/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('car-images')
                .upload(path, file, { cacheControl: '3600', upsert: false });

            if (uploadError) {
                console.error('Upload error for', file.name, uploadError.message);
                failed.push(file.name);
                continue;
            }

            const { data: urlData } = supabase.storage.from('car-images').getPublicUrl(path);
            if (urlData?.publicUrl) urls.push(urlData.publicUrl);
        }

        setUploading(false);

        // Surface any failures so the user knows what happened
        if (failed.length > 0) {
            throw new Error(`These photos failed to upload: ${failed.join(', ')}. Please try again.`);
        }

        return urls;
    };

    // ─── Submit ──────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent, isDraft = false) => {
        e.preventDefault();
        setError('');

        if (!canManage) {
            setError('You do not have permission to manage inventory.');
            return;
        }

        if (!form.make || !form.model || !form.price) {
            setError('Make, Model, and Price are required fields.');
            return;
        }

        // Normalize Registration Number
        const normalizedRegNo = form.registration_no?.trim().replace(/[\s\-]/g, '').toUpperCase() || null;

        setSaving(true);
        try {
            // Check for Duplicate Registration Number
            if (normalizedRegNo) {
                let query = supabase.from('inventory').select('id, make, model').eq('registration_no', normalizedRegNo);
                if (isEditMode && id) {
                    query = query.neq('id', id);
                }
                const { data: duplicateData, error: dupError } = await query;
                if (dupError) throw dupError;

                if (duplicateData && duplicateData.length > 0) {
                    const dup = duplicateData[0];
                    setError(`Duplicate Alert: A vehicle with registration number ${normalizedRegNo} already exists in the inventory (${dup.make} ${dup.model}). Please verify the details.`);
                    setSaving(false);
                    return;
                }
            }

            const newImageUrls = await uploadImages();
            const allImages = [...existingImages, ...newImageUrls];
            const thumbnail = allImages.length > 0 ? allImages[0] : null;

            const payload: any = {
                make: form.make,
                model: form.model,
                variant: form.variant || null,
                year: Number(form.year),
                price: Number(form.price),
                original_price: form.original_price ? Number(form.original_price) : null,
                fuel_type: form.fuel_type,
                transmission: form.transmission,
                mileage: form.mileage ? Number(form.mileage) : null,
                color: form.color || null,
                body_type: form.body_type || null,
                registration_no: normalizedRegNo,
                ownership: Number(form.ownership),
                condition: form.condition,
                status: isDraft ? 'pending' : form.status,
                insurance: form.insurance || null,
                video_url: form.video_url || null,
                description: form.description || null,
                images: allImages.length > 0 ? allImages : null,
                thumbnail,
                // Source fields
                source,
                purchase_cost: source === 'purchased' && purchaseCost ? Number(purchaseCost) : null,
                consignment_owner_name: source === 'consignment' ? (consignmentOwnerName || null) : null,
                consignment_owner_phone: source === 'consignment' ? (consignmentOwnerPhone || null) : null,
                consignment_agreed_price: source === 'consignment' && consignmentAgreedPrice ? Number(consignmentAgreedPrice) : null,
                consignment_fee_type: source === 'consignment' ? consignmentFeeType : null,
                consignment_fee_value: source === 'consignment' && consignmentFeeValue ? Number(consignmentFeeValue) : null,
                consignment_start_date: source === 'consignment' ? (consignmentStartDate || null) : null,
                consignment_end_date: source === 'consignment' ? (consignmentEndDate || null) : null,
                dealer_id: source === 'dealer' ? (dealerId || null) : null,
                dealer_asking_price: source === 'dealer' && dealerAskingPrice ? Number(dealerAskingPrice) : null,
                our_margin: source === 'dealer' && ourMargin ? Number(ourMargin) : null,
                dealer_commission: source === 'dealer' && dealerCommission ? Number(dealerCommission) : null,
            };

            if (isEditMode) {
                const { error: updateError } = await supabase.from('inventory').update(payload).eq('id', id);
                if (updateError) throw updateError;
            } else {
                payload.added_by = user?.id ?? null;
                const { error: insertError } = await supabase.from('inventory').insert(payload);
                if (insertError) throw insertError;
            }

            if (refreshData) {
                await refreshData();
            }
            navigate('/admin/inventory');
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (initialLoading) {
        return <div className="py-20 text-center text-slate-400 font-medium">Loading inventory details...</div>;
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">{isEditMode ? 'Edit Car' : 'Add New Car'}</h1>
                    <p className="text-slate-500 text-sm">Fill in the vehicle details to {isEditMode ? 'update the' : 'create a live'} listing.</p>
                </div>
                <Link to="/admin/inventory" className="text-sm font-semibold text-slate-500 hover:text-primary flex items-center gap-1 transition-colors">
                    <span className="material-symbols-outlined text-lg">arrow_back</span> Back to Inventory
                </Link>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg shrink-0">error</span>
                    {error}
                </div>
            )}

            {/* Smart Auto Fill */}
            {!isEditMode && (
                <div className="bg-accent/10 border border-accent/20 rounded-2xl p-5 mb-6">
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-accent text-xl shrink-0 mt-0.5">auto_awesome</span>
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-primary mb-1">Smart Auto-Fill</h3>
                            <p className="text-xs text-slate-500 mb-3">
                                Paste any WhatsApp/text listing — emojis, mixed case, typos — and we'll extract the details automatically.
                                Detects: make, model, variant, year, price, mileage, registration, fuel type, ownership, color &amp; transmission.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <textarea
                                    value={autoFillText}
                                    onChange={e => setAutoFillText(e.target.value)}
                                    rows={5}
                                    placeholder={`Paste car listing here. Examples:\n🚗 Mahindra Scorpio S10 M-Hawk – 2017\nMH48 AW 2578 | Maruti Ertiga VXI Green CNG | 2017/June | Owner 1 | 1,18,000 km | Price 7,75,000\nMH09 EK 2958, Swift VXI, Petrol, 2017/june, Owner 2, 72000 km, Price 5,60,000`}
                                    className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 resize-y bg-white font-mono text-xs leading-relaxed"
                                />
                                <button
                                    type="button"
                                    onClick={handleAutoFill}
                                    disabled={!autoFillText.trim()}
                                    className="h-11 px-6 bg-primary text-white font-bold rounded-xl text-sm shrink-0 self-start hover:bg-primary-light transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-base">bolt</span>
                                    Extract Data
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Vehicle Identity & Pricing */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                    <h2 className="text-lg font-bold text-primary font-display mb-5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-accent">directions_car</span> Vehicle Identity & Pricing
                    </h2>

                    {/* Source Toggle (Purchased / Consignment / Dealer) */}
                    <div className="mb-5">
                        <label className="text-sm font-medium text-slate-700 mb-2 block">Car Source <span className="text-xs text-slate-400">(internal — not shown to customers)</span></label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setSource('purchased')}
                                className={`flex-1 h-10 rounded-xl text-sm font-bold border flex items-center justify-center gap-2 transition-all ${
                                    source === 'purchased'
                                        ? 'bg-primary text-white border-primary shadow-sm'
                                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                <span className="material-symbols-outlined text-base">home</span> Purchased
                            </button>
                            <button
                                type="button"
                                onClick={() => setSource('consignment')}
                                className={`flex-1 h-10 rounded-xl text-sm font-bold border flex items-center justify-center gap-2 transition-all ${
                                    source === 'consignment'
                                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                <span className="material-symbols-outlined text-base">handshake</span> Consignment
                            </button>
                            <button
                                type="button"
                                onClick={() => setSource('dealer')}
                                className={`flex-1 h-10 rounded-xl text-sm font-bold border flex items-center justify-center gap-2 transition-all ${
                                    source === 'dealer'
                                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                <span className="material-symbols-outlined text-base">store</span> Dealer Car
                            </button>
                        </div>
                    </div>

                    {/* Source-specific sections */}
                    {source === 'purchased' && (
                        <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-4 mb-5">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-primary text-lg">payments</span>
                                <p className="text-sm font-bold text-primary">Purchase Details</p>
                            </div>
                            <div className="w-1/2 pr-2">
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Purchase Cost (₹)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                                    <input
                                        type="number"
                                        value={purchaseCost}
                                        onChange={e => setPurchaseCost(e.target.value)}
                                        placeholder="What we paid"
                                        className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-7 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {source === 'consignment' && (
                        <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-4 mb-5 space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-purple-600 text-lg">handshake</span>
                                <p className="text-sm font-bold text-purple-800">Consignment Details <span className="text-xs font-normal text-purple-600">(selling on behalf of owner)</span></p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Owner Name <span className="text-red-400">*</span></label>
                                    <input
                                        type="text"
                                        value={consignmentOwnerName}
                                        onChange={e => setConsignmentOwnerName(e.target.value)}
                                        placeholder="e.g. Rahul Sharma"
                                        className="w-full h-11 bg-white border border-purple-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-purple-300"
                                        required={source === 'consignment'}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Owner Phone</label>
                                    <input
                                        type="text"
                                        value={consignmentOwnerPhone}
                                        onChange={e => setConsignmentOwnerPhone(e.target.value)}
                                        placeholder="e.g. +91 9876543210"
                                        className="w-full h-11 bg-white border border-purple-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-purple-300"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Agreed Minimum Price (₹)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                                        <input
                                            type="number"
                                            value={consignmentAgreedPrice}
                                            onChange={e => setConsignmentAgreedPrice(e.target.value)}
                                            placeholder="e.g., 400000"
                                            className="w-full h-11 bg-white border border-purple-200 rounded-xl pl-7 pr-3 text-sm outline-none focus:ring-2 focus:ring-purple-300"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-1.5 block">Fee Type</label>
                                        <select
                                            value={consignmentFeeType}
                                            onChange={e => setConsignmentFeeType(e.target.value as 'fixed' | 'percentage')}
                                            className="w-full h-11 bg-white border border-purple-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-purple-300"
                                        >
                                            <option value="fixed">Fixed (₹)</option>
                                            <option value="percentage">Percentage (%)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-1.5 block">Our Fee</label>
                                        <div className="relative">
                                            {consignmentFeeType === 'fixed' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>}
                                            {consignmentFeeType === 'percentage' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>}
                                            <input
                                                type="number"
                                                value={consignmentFeeValue}
                                                onChange={e => setConsignmentFeeValue(e.target.value)}
                                                placeholder={consignmentFeeType === 'fixed' ? "e.g. 10000" : "e.g. 2.5"}
                                                className={`w-full h-11 bg-white border border-purple-200 rounded-xl ${consignmentFeeType === 'fixed' ? 'pl-7 pr-3' : 'pl-3 pr-7'} text-sm outline-none focus:ring-2 focus:ring-purple-300`}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Listing Start Date</label>
                                    <input
                                        type="date"
                                        value={consignmentStartDate}
                                        onChange={e => setConsignmentStartDate(e.target.value)}
                                        className="w-full h-11 bg-white border border-purple-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-purple-300"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Listing End Date (Expiry)</label>
                                    <input
                                        type="date"
                                        value={consignmentEndDate}
                                        onChange={e => setConsignmentEndDate(e.target.value)}
                                        className="w-full h-11 bg-white border border-purple-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-purple-300"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {source === 'dealer' && (
                        <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-4 mb-5 space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="material-symbols-outlined text-amber-500 text-lg">store</span>
                                <p className="text-sm font-bold text-amber-800">Dealer Details <span className="text-xs font-normal text-amber-600">(visible to admin only — never public)</span></p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Select Dealer</label>

                                {/* ── Searchable dealer combobox ── */}
                                <div className="relative" onBlur={e => {
                                    // Close dropdown only when focus leaves the entire container
                                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                        setDealerDropdownOpen(false);
                                    }
                                }}>
                                    {/* Search / display input */}
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 text-[18px] pointer-events-none">search</span>
                                        <input
                                            ref={dealerInputRef}
                                            type="text"
                                            placeholder="Search by dealer code or name…"
                                            value={dealerSearch}
                                            onFocus={() => setDealerDropdownOpen(true)}
                                            onChange={e => {
                                                setDealerSearch(e.target.value);
                                                setDealerDropdownOpen(true);
                                                // Clear selected dealer if user is modifying the text
                                                if (dealerId) setDealerId('');
                                            }}
                                            className="w-full h-11 bg-white border border-amber-200 rounded-xl pl-9 pr-10 text-sm outline-none focus:ring-2 focus:ring-amber-200 placeholder-slate-400"
                                        />
                                        {/* Clear button */}
                                        {dealerSearch && (
                                            <button
                                                type="button"
                                                onClick={() => { setDealerSearch(''); setDealerId(''); dealerInputRef.current?.focus(); }}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                tabIndex={-1}
                                            >
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Dropdown results */}
                                    {dealerDropdownOpen && (
                                        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-amber-100 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                                            {(() => {
                                                const q = dealerSearch.toLowerCase().trim();
                                                const filtered = dealers.filter(d =>
                                                    !q ||
                                                    d.dealer_code.toLowerCase().includes(q) ||
                                                    d.name.toLowerCase().includes(q)
                                                );
                                                if (filtered.length === 0) return (
                                                    <div className="px-4 py-3 text-sm text-slate-400 italic">
                                                        No dealers match "{dealerSearch}".
                                                        <a href="/admin/dealers" className="ml-1 underline font-semibold text-amber-600">Add one →</a>
                                                    </div>
                                                );
                                                return filtered.map(d => (
                                                    <button
                                                        key={d.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setDealerId(d.id);
                                                            setDealerSearch(`${d.dealer_code} — ${d.name}`);
                                                            setDealerDropdownOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors flex items-center gap-3 ${
                                                            dealerId === d.id ? 'bg-amber-50 font-semibold text-amber-800' : 'text-slate-700'
                                                        }`}
                                                    >
                                                        <span className="font-mono text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold shrink-0">{d.dealer_code}</span>
                                                        <span className="truncate">{d.name}</span>
                                                        {dealerId === d.id && <span className="material-symbols-outlined text-amber-500 text-base ml-auto shrink-0">check_circle</span>}
                                                    </button>
                                                ));
                                            })()}
                                        </div>
                                    )}
                                </div>

                                {dealers.length === 0 && (
                                    <p className="text-xs text-amber-600 mt-1">
                                        No active dealers found. <a href="/admin/dealers" className="underline font-semibold">Add a dealer first →</a>
                                    </p>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Dealer's Cost (₹)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                                        <input
                                            type="number"
                                            value={dealerAskingPrice}
                                            onChange={e => setDealerAskingPrice(e.target.value)}
                                            placeholder="e.g., 380000"
                                            className="w-full h-11 bg-white border border-amber-200 rounded-xl pl-7 pr-3 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Our Margin (₹)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                                        <input
                                            type="number"
                                            value={ourMargin}
                                            onChange={e => setOurMargin(e.target.value)}
                                            placeholder="e.g., 20000"
                                            className="w-full h-11 bg-white border border-amber-200 rounded-xl pl-7 pr-3 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Commission (₹)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                                        <input
                                            type="number"
                                            value={dealerCommission}
                                            onChange={e => setDealerCommission(e.target.value)}
                                            placeholder="e.g., 5000"
                                            className="w-full h-11 bg-white border border-amber-200 rounded-xl pl-7 pr-3 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Make <span className="text-red-400">*</span></label>
                            <select value={form.make} onChange={e => set('make', e.target.value)} className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" required>
                                <option value="">Select Make</option>
                                {MAKES.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Model <span className="text-red-400">*</span></label>
                            <input type="text" value={form.model} onChange={e => set('model', e.target.value)} placeholder="e.g., Creta" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" required />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Year</label>
                            <select value={form.year} onChange={e => set('year', Number(e.target.value))} className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm outline-none">
                                {Array.from({ length: 51 }, (_, i) => 2030 - i).map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Variant</label>
                            <input type="text" value={form.variant} onChange={e => set('variant', e.target.value)} placeholder="e.g., SX 1.5 Turbo" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Asking Price (₹) <span className="text-red-400">*</span></label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">₹</span>
                                <input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="e.g., 1450000" className="w-full h-11 border border-slate-200 rounded-xl pl-8 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" required />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Original Price (₹) <span className="text-xs text-slate-400">(optional, shows strikethrough)</span></label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">₹</span>
                                <input type="number" value={form.original_price} onChange={e => set('original_price', e.target.value)} placeholder="e.g., 1700000" className="w-full h-11 border border-slate-200 rounded-xl pl-8 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Registration No.</label>
                            <input type="text" value={form.registration_no} onChange={e => set('registration_no', e.target.value.toUpperCase())} placeholder="MH09 AB 1234" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 font-mono" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Ownership</label>
                            <select value={form.ownership} onChange={e => set('ownership', e.target.value)} className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm outline-none">
                                {['1', '2', '3', '4'].map(o => <option key={o} value={o}>{o === '1' ? '1st Owner' : o === '2' ? '2nd Owner' : o === '3' ? '3rd Owner' : '4th+ Owner'}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Insurance</label>
                            <input type="text" value={form.insurance} onChange={e => set('insurance', e.target.value)} placeholder="e.g. Valid, Comprehensive until Dec 2026, etc." className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                        </div>
                    </div>
                </div>

                {/* Technical Specs */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                    <h2 className="text-lg font-bold text-primary font-display mb-5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-accent">engineering</span> Technical Specifications
                    </h2>
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Fuel Type</label>
                            <select value={form.fuel_type} onChange={e => set('fuel_type', e.target.value)} className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm outline-none">
                                {['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid', 'Petrol + CNG', 'Petrol + Electric', 'Petrol + LPG'].map(f => <option key={f}>{f}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Transmission</label>
                            <select value={form.transmission} onChange={e => set('transmission', e.target.value)} className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm outline-none">
                                {['Manual', 'Automatic', 'CVT'].map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Mileage (km)</label>
                            <input type="number" value={form.mileage} onChange={e => set('mileage', e.target.value)} placeholder="e.g., 24000" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Color</label>
                            <input type="text" value={form.color} onChange={e => set('color', e.target.value)} placeholder="e.g., Polar White" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Body Type</label>
                            <select value={form.body_type} onChange={e => set('body_type', e.target.value)} className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm outline-none">
                                <option value="">Select body type</option>
                                {['Hatchback', 'Sedan', 'SUV', 'MUV', 'Crossover', 'Coupe', 'Convertible', 'Pickup Truck'].map(b => <option key={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Condition</label>
                            <select value={form.condition} onChange={e => set('condition', e.target.value)} className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm outline-none">
                                <option value="used">Used</option>
                                <option value="certified">Certified Pre-Owned</option>
                                <option value="new">New</option>
                            </select>
                        </div>
                    </div>
                    <div className="mt-5">
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-sm font-medium text-slate-700 block">Description</label>
                            
                            {!settings?.openrouter_settings?.is_enabled || !settings?.openrouter_settings?.api_key ? (
                                <Link 
                                    to="/admin/settings#openrouter"
                                    className="text-[10px] text-slate-400 hover:text-primary transition-colors flex items-center gap-1 font-semibold"
                                >
                                    <span className="material-symbols-outlined text-[12px]">smart_toy</span>
                                    Enable AI generation in Settings
                                </Link>
                            ) : !settings?.openrouter_settings?.features?.car_description_generator ? (
                                <Link 
                                    to="/admin/settings#openrouter"
                                    className="text-[10px] text-slate-400 hover:text-primary transition-colors flex items-center gap-1 font-semibold"
                                >
                                    <span className="material-symbols-outlined text-[12px]">toggle_off</span>
                                    Enable AI Writer feature in Settings
                                </Link>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleGenerateDescription}
                                    disabled={isGeneratingDesc}
                                    className="text-[11px] text-primary hover:text-primary-light transition-colors flex items-center gap-1 font-bold disabled:opacity-50 animate-pulse-once"
                                >
                                    <span className={`material-symbols-outlined text-[14px] ${isGeneratingDesc ? 'animate-spin' : ''}`}>
                                        {isGeneratingDesc ? 'sync' : 'auto_awesome'}
                                    </span>
                                    {isGeneratingDesc ? 'Writing Description...' : 'Write with AI'}
                                </button>
                            )}
                        </div>
                        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="Highlight key features, service history, accident-free status, etc." className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 resize-y" />
                        
                        {generatingError && (
                            <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">error</span>
                                {generatingError}
                            </p>
                        )}
                    </div>
                    <div className="mt-5 pt-5 border-t border-slate-100 space-y-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Walkthrough Video URL</label>
                            <input 
                                type="text" 
                                value={form.video_url} 
                                onChange={e => set('video_url', e.target.value)} 
                                placeholder="Paste YouTube, Instagram Reel, or Facebook video URL" 
                                className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" 
                            />
                            <p className="text-xs text-slate-400 mt-1">Accepts YouTube watch/shorts links, Instagram Reels/Posts, or Facebook video URLs.</p>
                        </div>
                        {form.video_url && (
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm text-accent">play_circle</span>
                                    Live Video Preview
                                </p>
                                <div className="max-w-xl mx-auto">
                                    <VideoPlayer url={form.video_url} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Status */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                    <h2 className="text-lg font-bold text-primary font-display mb-5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-accent">inventory_2</span> Listing Status
                    </h2>
                    <div className="flex gap-3 flex-wrap">
                        {[
                            { val: 'available', label: 'Available', icon: 'check_circle', cls: 'bg-green-50 border-green-200 text-green-700' },
                            { val: 'reserved', label: 'Reserved', icon: 'schedule', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
                            { val: 'sold', label: 'Sold', icon: 'sell', cls: 'bg-slate-100 border-slate-200 text-slate-600' },
                            { val: 'pending', label: 'Pending', icon: 'pending', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
                        ].map(s => (
                            <button key={s.val} type="button" onClick={() => set('status', s.val)}
                                className={`flex-1 min-w-[120px] h-11 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center gap-2 ${form.status === s.val ? `${s.cls} shadow-sm` : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                            >
                                <span className="material-symbols-outlined text-lg">{s.icon}</span>{s.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Image Upload */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                    <h2 className="text-lg font-bold text-primary font-display mb-1 flex items-center gap-2">
                        <span className="material-symbols-outlined text-accent">image</span> Car Photos
                    </h2>
                    <p className="text-xs text-slate-500 mb-5">Photos upload to Supabase Storage. First photo becomes the thumbnail. Supports JPG, PNG, WebP.</p>

                    <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden" />

                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 hover:border-primary/30 transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">cloud_upload</span>
                        <p className="text-sm font-medium text-slate-600 mb-1">Click to browse photos</p>
                        <p className="text-xs text-slate-400">JPG, PNG, WebP · Max 20 photos</p>
                    </div>

                    {(existingImages.length > 0 || previews.length > 0) && (
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mt-4">
                            {/* Existing Images */}
                            {existingImages.map((src, i) => (
                                <div key={`ex-${i}`} className="relative group">
                                    <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                                        <img src={getImageUrl(src)} alt={`Existing ${i}`} className="w-full h-full object-cover" />
                                    </div>
                                    {i === 0 && (
                                        <span className="absolute bottom-1 left-1 bg-primary text-white text-[8px] font-bold px-1.5 py-0.5 rounded">THUMB</span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeExistingImage(i)}
                                        className="absolute top-1 right-1 size-5 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md"
                                    >
                                        <span className="material-symbols-outlined text-[12px]">delete</span>
                                    </button>
                                </div>
                            ))}

                            {/* New Previews */}
                            {previews.map((src, i) => (
                                <div key={`new-${i}`} className="relative group">
                                    <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 ring-2 ring-accent">
                                        <img src={src} alt={`Preview ${i + 1}`} className="w-full h-full object-cover opacity-80" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="bg-black/50 text-white text-[9px] font-bold px-2 py-0.5 rounded backdrop-blur-sm">NEW</span>
                                        </div>
                                    </div>
                                    {existingImages.length === 0 && i === 0 && (
                                        <span className="absolute bottom-1 left-1 bg-primary text-white text-[8px] font-bold px-1.5 py-0.5 rounded">THUMB</span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeNewImage(i)}
                                        className="absolute top-1 right-1 size-5 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md"
                                    >
                                        <span className="material-symbols-outlined text-[12px]">close</span>
                                    </button>
                                </div>
                            ))}

                            <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-primary/30 hover:text-primary transition-colors cursor-pointer">
                                <span className="material-symbols-outlined text-xl">add</span>
                                <span className="text-[10px] font-medium">Add</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Tip */}
                <div className="bg-accent/5 border border-accent/20 rounded-2xl p-5 flex items-start gap-3">
                    <span className="material-symbols-outlined text-accent text-xl shrink-0">lightbulb</span>
                    <div>
                        <p className="text-sm font-bold text-primary mb-1">Premium Listing Quality</p>
                        <p className="text-xs text-slate-600">Listings with 12+ photos, complete specs, and a good description get 3x more enquiries. Include exterior, interior, engine bay, and dashboard shots.</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-8 sticky bottom-0 bg-white p-4 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] rounded-t-xl -mx-4 px-4 sm:mx-0 sm:px-6">
                    <button
                        type="button"
                        onClick={e => handleSubmit(e as any, true)}
                        disabled={saving || !canManage}
                        className="h-11 px-6 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        Save as Draft
                    </button>
                    <button
                        type="submit"
                        disabled={saving || uploading || !canManage}
                        className="h-11 px-6 bg-accent text-primary font-bold rounded-xl text-sm hover:bg-accent-hover transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 min-w-[160px] justify-center"
                    >
                        {saving || uploading ? (
                            <>
                                <span className="size-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                {uploading ? 'Uploading photos…' : isEditMode ? 'Updating…' : 'Publishing…'}
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-lg">{isEditMode ? 'save' : 'publish'}</span>
                                {isEditMode ? 'Save Changes' : 'Confirm & Publish'}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default InventoryForm;
