
/**
 * API Service for Wanzz PPOB
 * Centralizes all fetch calls with auth headers.
 */

const API_BASE_URL = '/api';

export function getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            // Auto logout on auth error
            localStorage.removeItem('auth_token');
            // We can't redirect with useNavigate here as this is not a hook, 
            // but the app state will react to the token removal if needed.
        }
        throw new Error(data.message || 'Terjadi kesalahan sistem');
    }

    return data;
}

export const api = {
    auth: {
        me: () => request<any>('/auth/me'),
        getHistory: () => request<any>('/auth/history'),
        login: (body: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
        register: (body: any) => request<any>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
        updateProfile: (body: any) => request<any>('/auth/update', { method: 'POST', body: JSON.stringify(body) }),
    },
    transaction: {
        getProducts: () => request<any>('/transaction/products'),
        getDepositMethods: () => request<any>('/transaction/deposit-methods'),
        create: (body: any) => request<any>('/transaction/create', { method: 'POST', body: JSON.stringify(body) }),
        createDeposit: (body: any) => request<any>('/deposit/create', { method: 'POST', body: JSON.stringify(body) }),
        syncTransaction: (id: string) => request<any>(`/transaction/${id}/sync`),
        syncDeposit: (id: string) => request<any>(`/deposit/${id}/sync`),
        cancelDeposit: (deposit_id: string) => request<any>('/deposit/cancel', { method: 'POST', body: JSON.stringify({ deposit_id }) }),
    },
    messages: {
        getAll: () => request<any>('/messages'),
        send: (text: string) => request<any>('/messages', { method: 'POST', body: JSON.stringify({ text }) }),
    },
    admin: {
        getUsers: () => request<any>('/admin/users'),
        getTransactions: () => request<any>('/admin/transactions'),
        getDeposits: () => request<any>('/admin/deposits'),
        getSettings: () => request<any>('/admin/settings'),
        updateMaintenance: (enabled: boolean) => request<any>('/admin/maintenance', { method: 'POST', body: JSON.stringify({ enabled }) }),
        updateDepositMethod: (method: string) => request<any>('/admin/settings/deposit-method', { method: 'POST', body: JSON.stringify({ method }) }),
        updateProfitMargin: (percent: number) => request<any>('/admin/settings/profit-margin', { method: 'POST', body: JSON.stringify({ percent }) }),
        getMessageHistory: (userId: string) => request<any>(`/admin/messages/${userId}`),
    },
    system: {
        getMaintenance: () => request<any>('/settings/maintenance'),
    }
};
