
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Search, Package, AlertTriangle, TrendingDown, Clock, PackageCheck, Send, LogIn, Loader, RefreshCw, Info, XCircle, CheckCircle } from 'lucide-react';
import { MercadoLivreAPI, NETLIFY_REDIRECT_URI_ERROR_PLACEHOLDER } from '../services/mercadolivre';
import { MOCK_PRODUCTS_DATA } from '../constants';
import { Product, StockMetrics, NotificationMessage, NotificationType, RiskLevel, StockHistoryEntry, ChartConfig, MetricDisplayConfig, PieChartEntry } from '../types';
import Notification from './Notification';

const IntegratedStockDashboard: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockHistory, setStockHistory] = useState<StockHistoryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('30'); // days as string
  
  const [authLoading, setAuthLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [chartsLoading, setChartsLoading] = useState(false);
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mlAPI, setMlAPI] = useState<MercadoLivreAPI | null>(null);
  const [authCode, setAuthCode] = useState<string | null>(null); // Store code from URL
  const [clientId, setClientId] = useState<string>(localStorage.getItem('ml_app_id') || '');
  const [showAuthScreen, setShowAuthScreen] = useState(true);

  const [notification, setNotificationState] = useState<NotificationMessage>({ id: null, message: '', type: '' });

  const setNotification = useCallback((message: string, type: NotificationType) => {
    console.log(`[SET NOTIFICATION] Mensagem: ${message}, Tipo: ${type}`);
    setNotificationState({ id: Date.now(), message, type });
  }, []);
  
  const handleCloseNotification = useCallback(() => {
    setNotificationState(prev => ({ ...prev, message: '', id: null }));
  }, []);

  const loadRealProducts = useCallback(async (apiInstance?: MercadoLivreAPI) => {
    const currentApi = apiInstance || mlAPI;
    if (!currentApi || !currentApi.isAuthenticated()) {
      setNotification('Não autenticado. Conecte-se para ver produtos reais.', NotificationType.INFO);
      setProducts(MOCK_PRODUCTS_DATA);
      setIsAuthenticated(false);
      setShowAuthScreen(true); 
      return;
    }
    setProductsLoading(true);
    setNotification('A carregar produtos da sua conta...', NotificationType.INFO);
    const realProducts = await currentApi.getMyProducts();
    
    if (realProducts && realProducts.length > 0) {
      setProducts(realProducts);
      setNotification(`Foram carregados ${realProducts.length} produtos.`, NotificationType.SUCCESS);
    } else if (realProducts) { 
      setProducts(MOCK_PRODUCTS_DATA);
      if (currentApi.isAuthenticated()){ 
         setNotification('Nenhum produto encontrado na sua conta. A exibir dados simulados.', NotificationType.INFO);
      }
    } else { 
      setProducts(MOCK_PRODUCTS_DATA); 
    }
    setProductsLoading(false);
  }, [mlAPI, setNotification, setIsAuthenticated, setShowAuthScreen, setProductsLoading, setProducts]);


  const handleFinalizeAuth = useCallback(async () => {
    if (mlAPI && authCode) {
      setAuthLoading(true);
      const success = await mlAPI.handleCallback(authCode);
      if (success) {
        setIsAuthenticated(true);
        setShowAuthScreen(false);
        setAuthCode(null); 
        await loadRealProducts(mlAPI); 
      } else {
        setAuthCode(null); 
        setProducts(MOCK_PRODUCTS_DATA);
        setShowAuthScreen(true);
      }
      setAuthLoading(false);
    } else {
        if (!mlAPI) console.error("[handleFinalizeAuth] ERRO: mlAPI não está definido.");
        if (!authCode) console.error("[handleFinalizeAuth] ERRO: authCode não está definido.");
        setNotification("Erro ao finalizar autenticação: API ou código em falta.", NotificationType.ERROR);
    }
  }, [mlAPI, authCode, setIsAuthenticated, setShowAuthScreen, setAuthLoading, loadRealProducts, setNotification, setProducts]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');

    if (codeFromUrl) {
      setAuthCode(codeFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (clientId) {
      const api = new MercadoLivreAPI(clientId, setNotification);
      setMlAPI(api); 
    } else {
      setMlAPI(null);
      setProducts(MOCK_PRODUCTS_DATA);
      setIsAuthenticated(false);
      setShowAuthScreen(true); 
    }
  }, [clientId, setNotification]); 

  useEffect(() => {
    if (mlAPI) {
      if (mlAPI.isAuthenticated()) {
        setIsAuthenticated(true);
        setShowAuthScreen(false);
        if (!authCode) { 
            loadRealProducts(mlAPI);
        }
      } else if (!authCode) { 
        setProducts(MOCK_PRODUCTS_DATA);
        setIsAuthenticated(false);
        setShowAuthScreen(true);
      }
    }
  }, [mlAPI, isAuthenticated, authCode, loadRealProducts, setIsAuthenticated, setShowAuthScreen, setProducts]);

  useEffect(() => {
    if (authCode && mlAPI && !isAuthenticated && !authLoading) {
      handleFinalizeAuth();
    }
  }, [authCode, mlAPI, isAuthenticated, authLoading, handleFinalizeAuth]);


  const handleClientIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newClientIdValue = e.target.value;
    setClientId(newClientIdValue);
    localStorage.setItem('ml_app_id', newClientIdValue);
  };

  const handleStartAuth = () => {
    if (!clientId) {
      setNotification('Por favor, insira o seu Client ID (App ID).', NotificationType.ERROR);
      return;
    }
    const currentApi = new MercadoLivreAPI(clientId, setNotification);
    setMlAPI(currentApi); 
    
    const redirectUriForLog = currentApi.getRedirectUri();
    const authUrlForLog = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUriForLog)}`;
    console.log("[handleStartAuth] URL de autenticação que será aberta:", authUrlForLog);

    currentApi.authenticate(); 
  };
  
  const handleLogout = () => {
    if (mlAPI) mlAPI.logout();
    setIsAuthenticated(false);
    setShowAuthScreen(true);
    setProducts(MOCK_PRODUCTS_DATA);
    setSelectedProduct(null);
    setNotification('Desconectado com sucesso.', NotificationType.INFO);
  };
  
  const calculateStockMetrics = useCallback((product: Product | null): StockMetrics => {
    if (!product || typeof product.currentStock === 'undefined' || typeof product.avgDailySales === 'undefined') {
      return { daysUntilEmpty: 0, monthlyDemand: 0, recommendedRestock: 0, riskLevel: RiskLevel.LOW, displayDaysUntilEmpty: 'N/D' };
    }
    const daysUntilEmpty = product.avgDailySales > 0 ? Math.ceil(product.currentStock / product.avgDailySales) : Infinity;
    const monthlyDemand = Math.ceil(product.avgDailySales * 30);
    const safetyStock = product.minStock; 
    const recommendedRestock = Math.max(0, monthlyDemand + safetyStock - product.currentStock);
    
    let riskLevel = RiskLevel.LOW;
    if (product.currentStock <= product.minStock) riskLevel = RiskLevel.HIGH;
    else if (product.currentStock <= product.minStock * 1.5) riskLevel = RiskLevel.MEDIUM;
    
    const displayDaysUntilEmpty = daysUntilEmpty === Infinity ? '∞' : String(daysUntilEmpty);
    return { daysUntilEmpty, monthlyDemand, recommendedRestock, riskLevel, displayDaysUntilEmpty };
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      setChartsLoading(true);
      const history: StockHistoryEntry[] = [];
      let currentStockVal = selectedProduct.currentStock;
      for (let i = 0; i < parseInt(dateRange); i++) {
        const date = new Date();
        date.setDate(date.getDate() + i); 
        let salesToday = 0;
        if (i > 0) { 
          salesToday = Math.round(selectedProduct.avgDailySales + (Math.random() - 0.5) * (selectedProduct.avgDailySales * 0.2)); 
          currentStockVal = Math.max(0, currentStockVal - salesToday);
        }
        history.push({
          date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          estoque: currentStockVal, 
          vendas: i === 0 ? 0 : salesToday, 
          estoqueMinimo: selectedProduct.minStock,
        });
      }
      setStockHistory(history);
      setChartsLoading(false);
    }
  }, [selectedProduct, dateRange]);

  const filteredProducts = useMemo(() => 
    products.filter(p => p.title && p.title.toLowerCase().includes(searchTerm.toLowerCase())),
    [products, searchTerm]
  );
  
  const criticalStockProducts = useMemo(() =>
    products.filter(p => calculateStockMetrics(p).riskLevel === RiskLevel.HIGH),
    [products, calculateStockMetrics]
  );

  const getStockStatusClasses = useCallback((product: Product): string => {
    const { riskLevel } = calculateStockMetrics(product);
    if (riskLevel === RiskLevel.HIGH) return 'border-red-500 bg-red-50 text-red-700';
    if (riskLevel === RiskLevel.MEDIUM) return 'border-yellow-500 bg-yellow-50 text-yellow-700';
    return 'border-green-500 bg-green-50 text-green-700';
  }, [calculateStockMetrics]);

  const getStockStatusText = useCallback((product: Product): string => {
    const { riskLevel } = calculateStockMetrics(product);
    if (riskLevel === RiskLevel.HIGH) return 'CRÍTICO';
    if (riskLevel === RiskLevel.MEDIUM) return 'ATENÇÃO';
    return 'NORMAL';
  }, [calculateStockMetrics]);

  const pieData: PieChartEntry[] = useMemo(() => {
    if (productsLoading || products.length === 0) return []; 
    const distribution = products.reduce((acc, product) => {
      const { riskLevel } = calculateStockMetrics(product);
      acc[riskLevel] = (acc[riskLevel] || 0) + 1;
      return acc;
    }, { [RiskLevel.HIGH]: 0, [RiskLevel.MEDIUM]: 0, [RiskLevel.LOW]: 0 });
    
    return [
      { name: 'Crítico', value: distribution[RiskLevel.HIGH], color: '#ef4444' }, 
      { name: 'Atenção', value: distribution[RiskLevel.MEDIUM], color: '#f59e0b' }, 
      { name: 'Normal', value: distribution[RiskLevel.LOW], color: '#10b981' } 
    ];
  }, [products, calculateStockMetrics, productsLoading]);

  if (showAuthScreen && !isAuthenticated) {
    let currentRedirectUriDisplay = "Aguardando Client ID...";
    if (clientId) { // Only attempt to get URI if client ID is present
        try {
            const tempApiForUri = mlAPI || new MercadoLivreAPI(clientId, () => {});
            currentRedirectUriDisplay = tempApiForUri.getRedirectUri();
        } catch(e) { 
            console.error("Erro ao gerar currentRedirectUri para exibição na tela de Auth:", e);
            currentRedirectUriDisplay = NETLIFY_REDIRECT_URI_ERROR_PLACEHOLDER;
        }
    } else if (mlAPI) { // mlAPI might exist from previous state but clientId is now empty
        currentRedirectUriDisplay = mlAPI.getRedirectUri(); // This might return error placeholder if origin is bad
    }
    
    const isErrorUri = currentRedirectUriDisplay === NETLIFY_REDIRECT_URI_ERROR_PLACEHOLDER;
    const displayMessageForUri = isErrorUri 
        ? "ERRO: Não foi possível determinar a URI. Configure manualmente no Mercado Livre: a URL base da sua aplicação (ex: https://seu-site.netlify.app/)."
        : currentRedirectUriDisplay;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4 text-white font-sans">
        <Notification notification={notification} onClose={handleCloseNotification} />
        <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-md rounded-xl shadow-2xl p-8 space-y-6 transform transition-all duration-500">
          <div className="text-center">
            <PackageCheck size={56} className="mx-auto text-yellow-400 mb-4" />
            <h1 className="text-3xl font-bold text-yellow-400">Controlo de Stock Pro</h1>
            <p className="text-slate-300 mt-2">
              {authCode && !authLoading ? "A finalizar conexão..." : authCode && authLoading ? "A processar..." : "Conecte a sua conta do Mercado Livre para começar."}
            </p>
          </div>
          <div>
            <label htmlFor="clientIdInput" className="block text-sm font-medium text-slate-300 mb-1">
              Client ID (App ID da sua aplicação no Mercado Livre)
            </label>
            <input
              id="clientIdInput" type="text"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all text-slate-100 placeholder-slate-400"
              placeholder="Cole o seu App ID aqui" value={clientId} onChange={handleClientIdChange} disabled={authLoading || !!authCode}
            />
          </div>
          <div className="space-y-4">
            {!authCode ? (
              <button
                onClick={handleStartAuth} disabled={!clientId || authLoading}
                className="w-full bg-yellow-400 text-slate-900 font-semibold py-3 px-4 rounded-lg hover:bg-yellow-500 disabled:bg-slate-600 disabled:text-slate-400 flex items-center justify-center gap-2 transition-colors shadow-md hover:shadow-lg"
              >
                {authLoading && !authCode ? <Loader size={20} className="animate-spin" /> : <LogIn size={20} />}
                Conectar com Mercado Livre
              </button>
            ) : (
              <button
                onClick={handleFinalizeAuth} disabled={authLoading || !mlAPI}
                className="w-full bg-green-500 text-white font-semibold py-3 px-4 rounded-lg hover:bg-green-600 disabled:bg-slate-600 flex items-center justify-center gap-2 transition-colors shadow-md hover:shadow-lg"
              >
                {authLoading && authCode ? <Loader size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                Finalizar Conexão
              </button>
            )}
            <button
              onClick={() => { setShowAuthScreen(false); setIsAuthenticated(false); setProducts(MOCK_PRODUCTS_DATA); setSelectedProduct(null); setNotification('A usar dados simulados.', NotificationType.INFO); }}
              className="w-full bg-slate-600 text-slate-200 font-semibold py-3 px-4 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Usar Dados Simulados
            </button>
          </div>
          <div className="mt-6 p-4 bg-slate-700/60 rounded-lg border border-slate-600 text-xs">
            <h3 className="text-sm font-medium text-yellow-400 mb-2 flex items-center"><Info size={16} className="mr-2"/>Instruções Importantes:</h3>
            <ol className="text-slate-300 list-decimal list-inside space-y-1.5">
              <li>Aceda a <a href="https://developers.mercadolivre.com.br/devcenter" target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-300">Central de Desenvolvedores do Mercado Livre</a>.</li>
              <li>Vá em "As suas Aplicações" e crie uma nova ou selecione uma existente.</li>
              <li>Copie o "APP ID" (este é o seu Client ID) e cole acima.</li>
              <li>Na secção "Detalhes da Aplicação", em "URI de Redirect", adicione <strong className="text-yellow-300">exatamente</strong>:
                <code className={`block bg-slate-900/80 text-slate-200 p-2 rounded text-xs mt-1 break-all select-all ${isErrorUri ? 'text-red-400' : ''}`}>
                  {displayMessageForUri}
                </code>
                 { isErrorUri && 
                    <p className="text-red-300 mt-1 text-[11px]">Atenção: A URI acima não pôde ser determinada automaticamente. Por favor, copie a URL HTTPS correta da sua aplicação (ex: https://seu-site.netlify.app/) e cole-a no painel do Mercado Livre.</p>
                 }
              </li>
               <li>O seu <strong className="text-yellow-300">Client Secret</strong> deve estar configurado apenas no seu servidor backend (não nesta aplicação frontend).</li>
            </ol>
          </div>
        </div>
        <footer className="absolute bottom-4 text-center text-xs text-slate-500">
            Dashboard de Controlo de Stock © {new Date().getFullYear()}
        </footer>
      </div>
    );
  }

  const chartConfigs: ChartConfig[] = [
    { title: 'Projeção de Stock', type: 'line', dataKey: 'estoque', color: '#2563eb', yAxisLabel: 'Stock', secondaryKey: 'estoqueMinimo', secondaryColor: '#ef4444', secondaryName: 'Nível Mínimo' },
    { title: 'Vendas Diárias Estimadas', type: 'bar', dataKey: 'vendas', color: '#16a34a', yAxisLabel: 'Vendas' }
  ];

  const metricDisplayConfigs: MetricDisplayConfig[] = selectedProduct ? [
    { icon: Package, label: 'Stock Atual', value: selectedProduct.currentStock, unit: 'un.', color: 'blue' },
    { icon: Clock, label: 'Acaba em (dias)', value: calculateStockMetrics(selectedProduct).displayDaysUntilEmpty, unit: '', color: 'red' },
    { icon: TrendingDown, label: 'Demanda Mensal', value: calculateStockMetrics(selectedProduct).monthlyDemand, unit: 'un.', color: 'amber' },
    { icon: Send, label: 'Reposição Ideal', value: calculateStockMetrics(selectedProduct).recommendedRestock, unit: 'un.', color: 'green' },
  ] : [];

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 font-sans">
      <Notification notification={notification} onClose={handleCloseNotification} />
      <div className="max-w-screen-xl mx-auto">
        <header className="mb-6 md:mb-8 pb-4 border-b border-slate-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 flex items-center">
                <PackageCheck size={32} className="mr-3 text-blue-600" /> Dashboard de Stock
              </h1>
              <p className="text-slate-600 text-sm mt-1">
                {isAuthenticated ? `Conectado com App ID: ${mlAPI?.getInternalClientId() || 'Desconhecido'}` : 'Visão geral com dados simulados'}
                {isAuthenticated && <span className="ml-2 py-0.5 px-1.5 bg-green-100 text-green-700 text-xs rounded-md font-medium">✓ Online</span>}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {isAuthenticated && mlAPI && (
                <button
                  onClick={() => loadRealProducts()} disabled={productsLoading}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-slate-400 flex items-center gap-2 text-sm font-medium shadow-sm hover:shadow-md transition-all"
                >
                  {productsLoading ? <Loader size={18} className="animate-spin" /> : <RefreshCw size={18} />} Atualizar Produtos
                </button>
              )}
              <button
                onClick={isAuthenticated ? handleLogout : () => { setShowAuthScreen(true);}}
                className={`${ isAuthenticated ? 'bg-red-500 hover:bg-red-600' : 'bg-yellow-500 hover:bg-yellow-600 text-slate-900' } text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm hover:shadow-md transition-all`}
              >
                {isAuthenticated ? 'Desconectar' : 'Conectar ao ML'}
              </button>
            </div>
          </div>
        </header>

        {productsLoading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-3 text-blue-800 animate-pulse">
            <Loader size={20} className="animate-spin" /> A carregar produtos da sua conta do Mercado Livre...
          </div>
        )}
        {criticalStockProducts.length > 0 && isAuthenticated && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg shadow-md">
            <div className="flex items-start">
              <AlertTriangle size={24} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="ml-3">
                <h3 className="text-base font-semibold text-red-800"> Alerta: {criticalStockProducts.length} produto(s) com stock crítico! </h3>
                <div className="mt-1 text-xs text-red-700 space-y-0.5">
                  {criticalStockProducts.slice(0,3).map(p => <div key={p.id}>› <strong>{p.title}</strong> (Stock: {p.currentStock})</div>)}
                  {criticalStockProducts.length > 3 && <div className="italic">...e mais {criticalStockProducts.length - 3}.</div>}
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-5">
            <div className="relative flex-grow w-full sm:w-auto">
              <Search size={18} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text" placeholder="Buscar por nome do produto..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-sm shadow-sm"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="w-full sm:w-auto px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm bg-white"
              value={dateRange} onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="7">Projeção para 7 dias</option>
              <option value="30">Projeção para 30 dias</option>
              <option value="60">Projeção para 60 dias</option>
              <option value="90">Projeção para 90 dias</option>
            </select>
          </div>
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredProducts.map((product) => {
                const metrics = calculateStockMetrics(product);
                const statusClasses = getStockStatusClasses(product);
                return (
                  <div
                    key={product.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ease-in-out hover:shadow-xl hover:scale-[1.02] ${ selectedProduct?.id === product.id ? 'ring-2 ring-blue-500 shadow-xl scale-[1.02]' : 'hover:border-slate-300' } ${statusClasses}`}
                    onClick={() => setSelectedProduct(product)}
                  >
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3 min-w-0"> 
                             {product.thumbnail && <img src={product.thumbnail} alt={product.title} className="w-12 h-12 rounded object-cover border border-slate-200 flex-shrink-0"/>}
                            <h3 className="font-semibold text-sm line-clamp-2 flex-grow"> {product.title} </h3>
                        </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ml-2 whitespace-nowrap ${statusClasses.replace('bg-', 'text-').replace('-50', '-700')} border ${statusClasses.replace('bg-','border-')} flex-shrink-0`}>
                        {getStockStatusText(product)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-3 truncate">{product.id}</p>
                    <div className="space-y-1.5 text-xs">
                       <div className="flex justify-between"><span className="text-slate-600">Stock Atual:</span> <span className="font-bold">{product.currentStock} un.</span></div>
                       <div className="flex justify-between"><span className="text-slate-600">Acaba em:</span> <span className={`font-bold ${metrics.riskLevel === RiskLevel.HIGH ? 'text-red-600' : ''}`}>{metrics.displayDaysUntilEmpty} dias</span></div>
                       <div className="flex justify-between"><span className="text-slate-600">Reposição Sug.:</span> <span className="font-bold text-blue-600">{metrics.recommendedRestock} un.</span></div>
                       {product.price != null && <div className="flex justify-between"><span className="text-slate-600">Preço:</span> <span className="font-bold text-green-700">R$ {Number(product.price).toFixed(2)}</span></div>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Package size={48} className="mx-auto mb-3 text-slate-400" />
              <p className="text-lg">Nenhum produto encontrado.</p>
              {products.length > 0 && <p className="text-sm">Tente um termo de busca diferente.</p>}
              {!isAuthenticated && !productsLoading && <p className="text-sm mt-2">Conecte a sua conta do Mercado Livre para visualizar os seus produtos.</p>}
            </div>
          )}
        </div>
        {selectedProduct && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
              {metricDisplayConfigs.map(metric => (
                <div key={metric.label} className={`bg-white rounded-xl shadow-lg p-5 flex items-center`}>
                  <div className={`p-3 bg-${metric.color}-100 rounded-lg mr-4`}> 
                    <metric.icon size={24} className={`text-${metric.color}-600`} /> 
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{metric.label}</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {metric.value} <span className="text-sm font-normal text-slate-600">{metric.unit}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {chartConfigs.map(chart => (
                <div key={chart.title} className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">{chart.title}</h3>
                  <p className="text-xs text-slate-500 mb-4">Estimativa para os próximos {dateRange} dias.</p>
                  {chartsLoading ? <div className="h-72 flex items-center justify-center"><Loader size={32} className="animate-spin text-blue-600" /></div> :
                    <ResponsiveContainer width="100%" height={280}>
                      {chart.type === 'line' ? (
                        <LineChart data={stockHistory}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={{ stroke: '#cbd5e1' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={{ stroke: '#cbd5e1' }} label={{ value: chart.yAxisLabel, angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b', offset: -2 }}/>
                          <Tooltip contentStyle={{backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '0.5rem', borderColor: '#e2e8f0'}} itemStyle={{color: '#1e293b'}} labelStyle={{color: '#334155', fontWeight: 'bold'}} formatter={(value: number, name: string) => [value, name === 'estoque' ? 'Stock Projetado' : name === 'estoqueMinimo' ? chart.secondaryName : name]} />
                          <Legend wrapperStyle={{ fontSize: "12px", color: "#334155" }} />
                          <Line type="monotone" dataKey={chart.dataKey as string} stroke={chart.color} strokeWidth={2.5} dot={{ r: 3, fill: chart.color }} activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff' }} name="Stock Projetado"/>
                          {chart.secondaryKey && <Line type="monotone" dataKey={chart.secondaryKey as string} stroke={chart.secondaryColor} strokeWidth={2} strokeDasharray="5 5" name={chart.secondaryName} dot={false}/>}
                        </LineChart>
                      ) : (
                        <BarChart data={stockHistory.filter(d => d.vendas > 0)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={{ stroke: '#cbd5e1' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={{ stroke: '#cbd5e1' }} label={{ value: chart.yAxisLabel, angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b', offset: -2 }}/>
                          <Tooltip contentStyle={{backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '0.5rem', borderColor: '#e2e8f0'}} itemStyle={{color: '#1e293b'}} labelStyle={{color: '#334155', fontWeight: 'bold'}} formatter={(value: number) => [`${value} un.`, "Vendas Estimadas"]}/>
                          <Legend wrapperStyle={{ fontSize: "12px", color: "#334155" }} />
                          <Bar dataKey={chart.dataKey as string} fill={chart.color} name="Vendas Estimadas" barSize={20} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  }
                </div>
              ))}
            </div>
          </>
        )}
        {products.length > 0 && !productsLoading && (
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Distribuição de Risco do Stock</h3>
            <p className="text-xs text-slate-500 mb-4">Visão geral do estado dos seus produtos.</p>
            {pieData.every(p => p.value === 0) ? 
                <p className="text-slate-500 text-center py-10 h-72 flex items-center justify-center">Sem dados suficientes para o gráfico de risco ou todos os produtos têm risco não calculado.</p> :
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                    <Pie
                        data={pieData} cx="50%" cy="50%" labelLine={false}
                        label={({ name, percent, value }) => value > 0 ? `${name}: ${value} (${(percent * 100).toFixed(0)}%)` : null }
                        outerRadius={100} fill="#8884d8" dataKey="value"
                        stroke="#fff"
                        
                    >
                        {pieData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color} /> ))}
                    </Pie>
                    <Tooltip contentStyle={{backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '0.5rem', borderColor: '#e2e8f0'}} itemStyle={{color: '#1e293b'}} labelStyle={{color: '#334155', fontWeight: 'bold'}} formatter={(value: number, name: string) => [`${value} produto(s)`, name]}/>
                    <Legend wrapperStyle={{ fontSize: "12px", color: "#334155" }} />
                    </PieChart>
                </ResponsiveContainer>
            }
            </div>
        )}
      </div>
       <footer className="text-center mt-12 py-6 border-t border-slate-200 text-xs text-slate-500">
            Dashboard de Controlo de Stock. Desenvolvido com React e Tailwind CSS.
            { isAuthenticated && mlAPI &&
                <p className="mt-1">Lembre-se: a sua URI de Redirect na aplicação do Mercado Livre deve ser <code className="bg-slate-200 p-1 rounded select-all">{mlAPI.getRedirectUri() === NETLIFY_REDIRECT_URI_ERROR_PLACEHOLDER ? "ERRO - Verifique console" : mlAPI.getRedirectUri()}</code></p>
            }
      </footer>
    </div>
  );
};

export default IntegratedStockDashboard;