export async function onRequest(context) {
  // 1. Pega os parâmetros enviados pelo seu frontend (ex: ?cidade=Curitiba)
  const { searchParams } = new URL(context.request.url);
  const cidade = searchParams.get('cidade');

  if (!cidade) {
    return new Response(JSON.stringify({ error: "Cidade não informada" }), { status: 400 });
  }

  // 2. Recupera a API Key das Secrets do Cloudflare com segurança
  const apiKey = context.env.OPENWEATHER_KEY; 

  // 3. Faz a requisição segura para o OpenWeather
  const url = `https://openweathermap.org{encodeURIComponent(cidade)}&appid=${apiKey}&units=metric&lang=pt_br`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    // 4. Retorna o resultado para o seu frontend
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Erro ao buscar dados do clima" }), { status: 500 });
  }
}
