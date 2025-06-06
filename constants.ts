
// URL do backend - Certifique-se de que corresponde à porta do seu servidor Node.js
// Para deploy no Netlify, este URL precisará ser o URL do seu backend deployado (ex: Netlify Functions ou outro serviço).
export const BACKEND_URL = 'http://localhost:3001'; // Ou a sua URL de backend de produção

export const MOCK_PRODUCTS_DATA = [
  { id: 'MLB001', title: 'Produto Simulado A (Stock Alto)', price: 199.90, currentStock: 75, avgDailySales: 3, minStock: 21, thumbnail: 'https://picsum.photos/seed/MLB001/60/60' },
  { id: 'MLB002', title: 'Produto Simulado B (Stock Médio)', price: 49.50, currentStock: 25, avgDailySales: 1.5, minStock: 10, thumbnail: 'https://picsum.photos/seed/MLB002/60/60' },
  { id: 'MLB003', title: 'Produto Simulado C (Stock Baixo)', price: 89.00, currentStock: 8, avgDailySales: 1, minStock: 7, thumbnail: 'https://picsum.photos/seed/MLB003/60/60' },
  { id: 'MLB004', title: 'Produto Simulado D (Stock Crítico)', price: 320.00, currentStock: 3, avgDailySales: 0.8, minStock: 5, thumbnail: 'https://picsum.photos/seed/MLB004/60/60' },
];