// OpenRouter Integration Helper for CRM AI Features

export interface ValidateResponse {
    success: boolean;
    label?: string;
    limit?: number;
    limit_remaining?: number;
    is_free_tier?: boolean;
    error?: string;
}

/**
 * Validates an OpenRouter API key against the auth info endpoint.
 * @param apiKey OpenRouter API Key
 */
export async function validateOpenRouterKey(apiKey: string): Promise<ValidateResponse> {
    if (!apiKey) {
        return { success: false, error: 'API key cannot be empty' };
    }
    
    try {
        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            }
        });
        
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            return {
                success: false,
                error: errBody.error?.message || `HTTP error ${res.status}: ${res.statusText}`
            };
        }
        
        const body = await res.json();
        if (body && body.data) {
            return {
                success: true,
                label: body.data.label || 'Unnamed Key',
                limit: body.data.limit,
                limit_remaining: body.data.limit_remaining,
                is_free_tier: body.data.is_free_tier ?? false
            };
        }
        return { success: false, error: 'Malformed response structure from OpenRouter API' };
    } catch (error: any) {
        return { success: false, error: error.message || 'Network error occurred during validation' };
    }
}

interface GenerateParams {
    apiKey: string;
    model: string;
    systemPrompt: string;
    userPrompt: string;
}

/**
 * Sends a chat completion request to OpenRouter.
 */
export async function generateOpenRouterCompletion({
    apiKey,
    model,
    systemPrompt,
    userPrompt
}: GenerateParams): Promise<string> {
    if (!apiKey) {
        throw new Error('OpenRouter API key is not configured');
    }
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': 'New Maharashtra Motors CRM',
        },
        body: JSON.stringify({
            model: model || 'google/gemini-2.5-flash',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 1000,
        })
    });
    
    if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error?.message || `HTTP error ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
        throw new Error('Empty response returned from OpenRouter API');
    }
    return text.trim();
}
