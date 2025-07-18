document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById('form');
  const jurosField = document.getElementById('juros');
  const tipoJurosRadios = document.querySelectorAll('input[name="tipoJuros"]');
  const percentualCDIInput = document.getElementById('percentualCDI');

  function updateJurosInputState(tipo) {
    if (tipo === "selic") {
      jurosField.disabled = true;
      percentualCDIInput.disabled = true;
      fetchTaxaSelic();
    } else if (tipo === "cdi") {
      jurosField.disabled = true;
      percentualCDIInput.disabled = false;
      fetchTaxaCDI();
    } else {
      jurosField.disabled = false;
      percentualCDIInput.disabled = true;
    }
  }
  function resetResultados() {
    document.getElementById('valorFinal').innerText = '';
    document.getElementById('totalAportado').innerText = '';
    const graficoDiv = document.getElementById('grafico');
    if (graficoDiv) {
      graficoDiv.innerHTML = ''; // limpa o gráfico
    }
  }

  // Campos que disparam o reset
  const camposParaReset = [
    'capital', 'aporte', 'juros', 'periodo', 'percentualCDI'
  ];

  camposParaReset.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', resetResultados);
    }
  });

  // Radios (tipo de juros)
  tipoJurosRadios.forEach(radio => {
    radio.addEventListener('change', resetResultados);
  });

  // Busca SELIC anual (série 1178)
  async function fetchTaxaSelic() {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.1178/dados/ultimos/1?formato=json`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data && data.length > 0) {
        const taxaAnual = parseFloat(data[0].valor); // %
        jurosField.value = taxaAnual.toFixed(2);
      }
    } catch (error) {
      console.error("Erro ao buscar taxa Selic:", error);
      jurosField.value = "";
    }
  }

  // Busca CDI diário (série 12) e converte para anual equivalente composta
  async function fetchTaxaCDI() {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data && data.length > 0) {
        const percentualCDI = parseFloat(percentualCDIInput.value || 100);
        const cdiDiarioPercentual = parseFloat(data[0].valor); // ex: 0.045
        const cdiDiarioDecimal = cdiDiarioPercentual / 100;

        // Converte para anual equivalente composta (252 dias úteis/ano)
        const taxaAnual = (Math.pow(1 + cdiDiarioDecimal, 252) - 1) * (percentualCDI / 100);

        jurosField.value = (taxaAnual * 100).toFixed(2); // exibe como percentual
      }
    } catch (error) {
      console.error("Erro ao buscar taxa CDI:", error);
      jurosField.value = "";
    }
  }

  // Atualiza taxa CDI ao mudar percentual
  percentualCDIInput.addEventListener('input', () => {
    const tipo = document.querySelector('input[name="tipoJuros"]:checked').value;
    if (tipo === "cdi") fetchTaxaCDI();
  });

  tipoJurosRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const tipo = document.querySelector('input[name="tipoJuros"]:checked').value;
      updateJurosInputState(tipo);
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const capital = parseFloat(document.getElementById('capital').value);
    const aporte = parseFloat(document.getElementById('aporte').value);
    const jurosInput = parseFloat(document.getElementById('juros').value) / 100;
    const tipoJuros = document.querySelector('input[name="tipoJuros"]:checked').value;
    const periodo = parseInt(document.getElementById('periodo').value);
  
    let patrimonio = [];
    let aportesSemJuros = [];
    let acumulado = capital;
    let totalAportado = capital;

    // Usar juros ANUAL e aporte ANUAL se tipo for anual, selic ou cdi
    const usarTaxaAnual = (tipoJuros === "anual" || tipoJuros === "selic" || tipoJuros === "cdi");
    const juros = usarTaxaAnual ? jurosInput : jurosInput; // já está em base correta

    for (let t = 0; t <= periodo; t++) {
      if (t > 0) {
        acumulado = acumulado * (1 + juros) + aporte;
        totalAportado += aporte;
      }
      patrimonio.push(acumulado);
      aportesSemJuros.push(totalAportado);
    }


    const hoje = new Date();
    let labelsX = [];

    for (let i = 0; i <= periodo; i++) {
      const data = new Date(hoje);
      if (tipoJuros === 'anual' || tipoJuros === 'selic' || tipoJuros === 'cdi') {
        data.setFullYear(data.getFullYear() + i);
        labelsX.push(data.getFullYear().toString());
      } else {
        data.setMonth(data.getMonth() + i);
        const mes = data.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
        labelsX.push(`${mes}/${data.getFullYear()}`);
      }
    }

    document.getElementById('valorFinal').innerText = patrimonio[periodo].toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

    document.getElementById('totalAportado').innerText = aportesSemJuros[periodo].toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

    const trace1 = {
      x: labelsX,
      y: patrimonio,
      type: 'scatter',
      name: 'Investidos',
      line: { color: 'green' },
      hovertemplate: '%{x}<br>R$ %{y:,.2f}<extra></extra>'
    };

    const trace2 = {
      x: labelsX,
      y: aportesSemJuros,
      type: 'scatter',
      name: 'Não investidos',
      line: { color: 'red', dash: 'solid' },
      hovertemplate: '%{x}<br>R$ %{y:,.2f}<extra></extra>'
    };

    const yMax = Math.max(...patrimonio);
    const step = yMax / 10;
    const tickvals = [];
    const ticktext = [];

    for (let i = 0; i <= 10; i++) {
      const valor = i * step;
      tickvals.push(valor);
      ticktext.push(valor.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }));
    }

    const layout = {
      title: {
        text: 'Evolução do Patrimônio',
        font: { size: 20 },
        xref: 'paper',
        x: 0.5,
        xanchor: 'center',
        y: 0.95,
        yanchor: 'top'
      },
      xaxis: {
        tickfont: { size: 12 },
        tickangle: -45,
        tickmode: 'auto',
        nticks: 10
      },
      yaxis: {
        title: 'Valor Acumulado (R$)',
        tickvals: tickvals,
        ticktext: ticktext,
        tickfont: { size: 14 }
      },
      plot_bgcolor: '#f0f8ff',
      paper_bgcolor: '#f0f8ff',
      legend: {
        orientation: 'h',
        x: 0.5,
        xanchor: 'center',
        y: 1.05,
        yanchor: 'bottom',
        bgcolor: 'rgba(255,255,255,0.6)',
        bordercolor: '#ccc',
        borderwidth: 1,
        font: { size: 12 }
      },
      margin: { t: 100, l: 100, r: 20, b: 50 }
    };

    Plotly.newPlot('grafico', [trace1, trace2], layout, { responsive: true }).then(() => {
      Plotly.Plots.resize('grafico');
    });
  });

  // Inicializa o estado da taxa juros conforme o radio selecionado ao carregar
  const initialTipo = document.querySelector('input[name="tipoJuros"]:checked').value;
  updateJurosInputState(initialTipo);
});
