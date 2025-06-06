
import { BACKEND_URL } from '../constants';
import { NotificationType, Product, MercadoLivreTokenResponse } from '../types';

type SetNotificationCallback = (message: string, type: NotificationType) => void;

export const NETLIFY_REDIRECT_URI_ERROR_PLACEHOLDER = "ERRO_COPIE_A_URL_HTTPS_DA_APP_NETLIFY_AQUI";

export class MercadoLivreAPI {
  private clientId: string;
  private accessToken: string | null;
  private refreshToken: string | null;
  private userId: string | null;
  private setNotification: SetNotificationCallback;

  constructor(clientId: string, setNotification: SetNotificationCallback) {
    this.clientId = clientId;
    this.setNotification = setNotification;
    this.accessToken = localStorage.getItem('ml_access_token');
    this.refreshToken = localStorage.getItem('ml_refresh_token');
    this.userId = localStorage.getItem('ml_user_id');
    console.log("[API Constructor] Client ID recebido:", clientId);
  }

  public isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  public getRedirectUri(): string {
    const origin = window.location.origin;
    
    if (!origin || origin === "null" || origin.startsWith('blob:')) {
      console.error("[API getRedirectUri] Invalid origin detected:", origin, ". Falling back to placeholder. Configure manually in Mercado Livre using your Netlify app's base URL (e.g., https://your-app.netlify.app/).");
      return NETLIFY_REDIRECT_URI_ERROR_PLACEHOLDER;
    }

    let redirectUri = origin;
    if (!redirectUri.endsWith('/')) {
      redirectUri += '/';
    }

    // Ensure HTTPS unless it's localhost (ML allows http for localhost redirect URIs)
    if (!origin.startsWith('http://localhost') && redirectUri.startsWith('http:')) {
      redirectUri = 'https:' + redirectUri.substring(5);
    }
    
    console.log("[API getRedirectUri] URI de Redirecionamento (Netlify optimized):", redirectUri);
    return redirectUri;
  }

  public authenticate(): void {
    if (!this.clientId) {
      console.error("[API Authenticate] ERRO: Client ID está em falta ou é inválido na instância da API.");
      this.setNotification("Client ID em falta na API. Verifique a configuração.", NotificationType.ERROR);
      return;
    }
    const redirectUri = this.getRedirectUri();

    if (redirectUri === NETLIFY_REDIRECT_URI_ERROR_PLACEHOLDER) {
        this.setNotification("ERRO CRÍTICO: A URI de redirecionamento não pôde ser determinada. Verifique a consola e configure a URL correta (a URL base da sua aplicação Netlify) no Mercado Livre.", NotificationType.ERROR);
        console.error(`[API Authenticate] A URI de redirecionamento é inválida: ${redirectUri}. Configure-a manualmente no Mercado Livre.`);
        return;
    }

    const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    console.log("[API Authenticate] A tentar redirecionar para URL de autenticação:", authUrl);
    this.setNotification('A redirecionar para o Mercado Livre para autorização...', NotificationType.INFO);
    try {
      const authWindow = window.open(authUrl, '_blank', 'width=600,height=700,noopener,noreferrer');
      if (!authWindow || authWindow.closed || typeof authWindow.closed === 'undefined') {
        console.warn("[API Authenticate] Abertura da janela de autenticação pode ter sido bloqueada pelo navegador.");
        this.setNotification("A janela de autenticação pode ter sido bloqueada. Verifique as permissões de pop-up do seu navegador.", NotificationType.ERROR);
      }
    } catch (error: any) {
        console.error("[API Authenticate] Erro ao tentar abrir a janela de autenticação:", error);
        this.setNotification(`Erro ao abrir janela de autenticação: ${error.message}`, NotificationType.ERROR);
    }
  }

  public async handleCallback(code: string): Promise<boolean> {
    try {
      const redirectUri = this.getRedirectUri();
      console.log("[Frontend] A enviar código para o backend:", code, "com redirect_uri:", redirectUri);
      
      if (redirectUri === NETLIFY_REDIRECT_URI_ERROR_PLACEHOLDER) {
        this.setNotification("ERRO CRÍTICO no callback: A URI de redirecionamento é inválida. A autenticação falhará.", NotificationType.ERROR);
        console.error(`[API handleCallback] A URI de redirecionamento é inválida: ${redirectUri}.`);
        return false;
      }

      const response = await fetch(`${BACKEND_URL}/api/mercadolivre/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      });

      const data: MercadoLivreTokenResponse = await response.json();
      console.log("[Frontend] Resposta do backend (handleCallback):", data);

      if (response.ok && data.access_token) {
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        this.userId = String(data.user_id);

        localStorage.setItem('ml_access_token', this.accessToken);
        localStorage.setItem('ml_refresh_token', this.refreshToken);
        localStorage.setItem('ml_user_id', String(this.userId));
        this.setNotification('Conectado com sucesso ao Mercado Livre!', NotificationType.SUCCESS);
        return true;
      } else {
        const errorMsg = data.details?.error_description || data.error || data.message || 'Falha na autenticação via backend.';
        console.error('Erro na autenticação via backend:', data);
        this.setNotification(`Erro de autenticação: ${errorMsg}`, NotificationType.ERROR);
        return false;
      }
    } catch (error: any) {
      console.error('Erro na comunicação com o backend (handleCallback):', error);
      this.setNotification(`Erro de comunicação: ${error.message}`, NotificationType.ERROR);
      return false;
    }
  }

  public async refreshTokenFlow(): Promise<boolean> {
    if (!this.refreshToken) {
      this.setNotification("Sessão expirada. Refresh token não encontrado.", NotificationType.ERROR);
      this.logout();
      return false;
    }
    console.log("[Frontend] Tentando atualizar token...");
    try {
      const redirectUri = this.getRedirectUri();
      if (redirectUri === NETLIFY_REDIRECT_URI_ERROR_PLACEHOLDER) {
        this.setNotification("ERRO CRÍTICO no refresh: A URI de redirecionamento é inválida.", NotificationType.ERROR);
        this.logout();
        return false;
      }

      const response = await fetch(`${BACKEND_URL}/api/mercadolivre/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.clientId, 
          redirect_uri: redirectUri 
        }),
      });
      const data: MercadoLivreTokenResponse = await response.json();
      console.log("[Frontend] Resposta do backend (refreshTokenFlow):", data);

      if (response.ok && data.access_token) {
        this.accessToken = data.access_token;
        if (data.refresh_token) this.refreshToken = data.refresh_token; 
        this.userId = String(data.user_id);

        localStorage.setItem('ml_access_token', this.accessToken);
        if (data.refresh_token) localStorage.setItem('ml_refresh_token', this.refreshToken);
        localStorage.setItem('ml_user_id', String(this.userId));
        this.setNotification('Sessão atualizada com sucesso.', NotificationType.SUCCESS);
        return true;
      } else {
        const errorMsg = data.details?.error_description || data.error || data.message || 'Falha ao atualizar token.';
        this.setNotification(`Erro ao atualizar sessão: ${errorMsg}. Por favor, conecte-se novamente.`, NotificationType.ERROR);
        this.logout();
        return false;
      }
    } catch (error: any) {
      this.setNotification(`Erro na atualização da sessão: ${error.message}`, NotificationType.ERROR);
      this.logout();
      return false;
    }
  }

  private async makeRequest<T,>(url: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) {
      this.setNotification('Token de acesso não disponível. Tente reconectar.', NotificationType.ERROR);
      throw new Error('Token de acesso não disponível.');
    }
    try {
      let response = await fetch(url, {
        ...options,
        headers: { ...options.headers, 'Authorization': `Bearer ${this.accessToken}`, 'Accept': 'application/json' },
      });

      if (response.status === 401) { 
        this.setNotification('Sessão expirada. Tentando renovar...', NotificationType.INFO);
        const refreshed = await this.refreshTokenFlow();
        if (refreshed) {
          response = await fetch(url, { 
            ...options,
            headers: { ...options.headers, 'Authorization': `Bearer ${this.accessToken}`, 'Accept': 'application/json' },
          });
        } else {
          throw new Error('Falha ao atualizar token. Faça login novamente.');
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Erro HTTP ${response.status}` }));
        const errorMsg = errorData.message || JSON.stringify(errorData);
        throw new Error(errorMsg);
      }
      return await response.json() as T;
    } catch (error: any) {
      console.error(`Erro em makeRequest para ${url}:`, error);
      throw error;
    }
  }

  public async getMyProducts(): Promise<Product[]> {
    if (!this.userId) {
        this.setNotification("User ID não encontrado. Tentando renovar sessão...", NotificationType.INFO);
        const refreshed = await this.refreshTokenFlow();
        if (!refreshed || !this.userId) {
            this.setNotification("Não foi possível obter User ID. Por favor, reconecte.", NotificationType.ERROR);
            return [];
        }
    }
    try {
      const itemsResponse = await this.makeRequest<{ results: string[] }>(`https://api.mercadolibre.com/users/${this.userId}/items/search?limit=50&orders=start_time_desc`);
      const itemIds = itemsResponse.results || [];
      if (itemIds.length === 0) return [];

      const limitedIds = itemIds.slice(0, 15); 
      
      const productsPromises = limitedIds.map(async (itemId) => {
        try {
          const item = await this.makeRequest<any>(`https://api.mercadolibre.com/items/${itemId}`);
          return {
            id: item.id,
            title: item.title,
            price: item.price,
            currentStock: item.available_quantity,
            thumbnail: item.thumbnail || `https://http2.mlstatic.com/D_NQ_NP_${item.id}-F.jpg`,
            category: item.category_id,
            status: item.status,
            condition: item.condition,
            sold_quantity: item.sold_quantity || 0,
            avgDailySales: Math.max(0.05, (item.sold_quantity || 0) / (item.status === 'active' ? 30 : 90)),
            minStock: Math.max(1, Math.ceil((item.sold_quantity || 0) / 30 * 7)), 
            lastRestock: new Date().toISOString().split('T')[0], 
          };
        } catch (error: any) {
          console.error(`Erro ao buscar detalhes do produto ${itemId}:`, error.message);
          return null; 
        }
      });

      const products = (await Promise.all(productsPromises)).filter(product => product !== null) as Product[];
      if (products.length === 0 && itemIds.length > 0) {
         this.setNotification('Não foi possível carregar detalhes dos produtos. Alguns pedidos podem ter falhado.', NotificationType.ERROR);
      }
      return products;
    } catch (error: any) {
      this.setNotification(`Erro geral ao buscar produtos: ${error.message}.`, NotificationType.ERROR);
      return [];
    }
  }

  public logout(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.userId = null;
    localStorage.removeItem('ml_access_token');
    localStorage.removeItem('ml_refresh_token');
    localStorage.removeItem('ml_user_id');
  }

  public getInternalClientId(): string | null { 
    return this.clientId;
  }
}