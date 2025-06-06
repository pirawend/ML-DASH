// netlify/functions/api/mercadolivre/token.js
const fetch = require('node-fetch'); // Para fazer requisições HTTP

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { ML_APP_ID, ML_CLIENT_SECRET } = process.env; // Pega do Netlify depois
  let requestBody;

  try {
    requestBody = JSON.parse(event.body);
  } catch (error) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Corpo da requisição inválido ou não é JSON.' }) };
  }

  const { grant_type, code, redirect_uri, refresh_token } = requestBody;

  if (!ML_APP_ID || !ML_CLIENT_SECRET) {
    console.error('ML_APP_ID ou ML_CLIENT_SECRET não configurados nas variáveis de ambiente do Netlify.');
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Erro de configuração do servidor: credenciais da API não encontradas.' }),
    };
  }
  
  if (!grant_type || (grant_type === 'authorization_code' && (!code || !redirect_uri)) || (grant_type === 'refresh_token' && !refresh_token)) {
      return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Parâmetros faltando na requisição para o backend.' }),
      };
  }

  const meliTokenUrl = 'https://api.mercadolibre.com/oauth/token';
  const params = new URLSearchParams();
  params.append('grant_type', grant_type);
  params.append('client_id', ML_APP_ID);
  params.append('client_secret', ML_CLIENT_SECRET);

  if (grant_type === 'authorization_code') {
    params.append('code', code);
    params.append('redirect_uri', redirect_uri);
  } else if (grant_type === 'refresh_token') {
    params.append('refresh_token', refresh_token);
    // O Mercado Livre não exige redirect_uri para refresh_token, mas se for enviado, deve ser o mesmo.
    // O frontend envia, então podemos incluir se necessário, ou omitir.
    // Para refresh_token, a documentação do ML não lista redirect_uri como obrigatório,
    // mas para consistência e evitar problemas, vamos manter se enviado.
    if (redirect_uri) {
        params.append('redirect_uri', redirect_uri);
    }
  }

  try {
    console.log('[Backend Function] Tentando obter token do Mercado Livre com grant_type:', grant_type);
    const meliResponse = await fetch(meliTokenUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const meliData = await meliResponse.json();
    console.log('[Backend Function] Resposta do Mercado Livre:', JSON.stringify(meliData));

    if (!meliResponse.ok) {
      // Tenta extrair uma mensagem de erro mais detalhada do Mercado Livre
      const errorDescription = meliData.message || meliData.error_description || meliData.error || 'Erro desconhecido do Mercado Livre.';
      console.error('[Backend Function] Erro do Mercado Livre:', errorDescription, 'Status:', meliResponse.status);
      return {
        statusCode: meliResponse.status, // Retorna o status de erro do ML
        body: JSON.stringify({ 
          message: `Erro ao comunicar com Mercado Livre: ${errorDescription}`,
          details: meliData // Inclui toda a resposta de erro do ML para depuração no frontend
        }),
      };
    }
    
    // Sucesso!
    return {
      statusCode: 200,
      body: JSON.stringify(meliData),
    };

  } catch (error) {
    console.error('[Backend Function] Erro interno na função:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Erro interno no servidor ao processar a requisição.', error: error.message }),
    };
  }
};