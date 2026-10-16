fetch("/api/me", {
    credentials: "same-origin"
})
.then((response) => {
    if (response.ok) {
        return response.json();
    }
    return null;
})
.then((user) => {
    const status = document.getElementById("status");
    const blocoAutenticacao = document.getElementById("bloco-autenticacao");
    const painelClima = document.getElementById("painel-clima");
    const formSair = document.getElementById("form-sair");

    if (user) {
        status.textContent = `Sessão de ${user.email ?? user.displayName}.`;
        
        // Fluxo logado: Esconde botões de login, mostra o painel de clima e o botão sair
        if (blocoAutenticacao) blocoAutenticacao.style.display = "none";
        if (painelClima) painelClima.style.display = "block";
        if (formSair) formSair.style.display = "block";

        // Configura o evento do botão de buscar clima
        configurarBuscaClima();
    } else {
        status.textContent = "Nenhuma sessão neste navegador.";
        if (blocoAutenticacao) blocoAutenticacao.style.display = "block";
    }
})
.catch(() => {
    const status = document.getElementById("status");
    status.textContent = "Não foi possível verificar a sessão.";
});

// Vincula o botão e o "Enter" ao input de busca
function configurarBuscaClima() {
    const btnBuscar = document.getElementById("btn-buscar");
    const inputCidade = document.getElementById("input-cidade");

    if (btnBuscar && inputCidade) {
        btnBuscar.addEventListener("click", () => {
            if (inputCidade.value.trim() !== "") {
                buscarClima(inputCidade.value.trim());
            }
        });

        inputCidade.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && inputCidade.value.trim() !== "") {
                buscarClima(inputCidade.value.trim());
            }
        });
    }
}

// Faz a requisição segura para a Function do Cloudflare
async function buscarClima(cidade) {
    try {
        const response = await fetch(`/clima?cidade=${encodeURIComponent(cidade)}`);
        const dados = await response.json();
        
        if (response.ok) {
            console.log("Dados recebidos com segurança:", dados);
            
            const elementoCidade = document.getElementById("clima-cidade");
            const elementoTemp = document.getElementById("clima-temperatura");
            const elementoDesc = document.getElementById("clima-descricao");
            const elementoIcone = document.getElementById("clima-icone");

            if (elementoCidade) elementoCidade.textContent = dados.name;
            if (elementoTemp) elementoTemp.textContent = `${Math.round(dados.main.temp)}°C`;
            if (elementoDesc) elementoDesc.textContent = dados.weather[0].description; // Ajustado para ler o array do OpenWeather
            
            if (elementoIcone && dados.weather[0].icon) {
                const codigoIcone = dados.weather[0].icon;
                elementoIcone.src = `https://openweathermap.org{codigoIcone}@2x.png`;
                elementoIcone.alt = dados.weather[0].description;
                elementoIcone.style.display = "block";
            }
        } else {
            console.error("Erro da API:", dados.error);
            alert("Não foi possível encontrar a cidade informada.");
        }
    } catch (erro) {
        console.error("Erro na requisição:", erro);
    }
}
