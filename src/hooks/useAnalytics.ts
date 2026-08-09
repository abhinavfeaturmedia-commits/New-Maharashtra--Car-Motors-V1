import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useAnalytics - High-performance non-blocking hook to track website telemetry.
 */
export const useAnalytics = (
    eventType: 'page_view' | 'search' | 'form_start' | 'form_abandon' | 'whatsapp_click' | 'form_submit',
    params?: { vehicleId?: string; searchQuery?: string }
) => {
    useEffect(() => {
        // Prevent tracking on admin routes or local development if needed, but here we track everything for testing.
        const trackEvent = async () => {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            try {
                // Fire and forget, no await to prevent blocking UI
                supabase.from('website_events').insert({
                    event_type: eventType,
                    device_type: isMobile ? 'mobile' : 'desktop',
                    vehicle_id: params?.vehicleId || null,
                    search_query: params?.searchQuery || null
                }).then();
            } catch (err) {
                // Ignore analytics failures
            }
        };

        trackEvent();
    }, [eventType, params?.vehicleId, params?.searchQuery]);
};
