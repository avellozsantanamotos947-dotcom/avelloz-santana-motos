/**
 * Integração CRM nortee & Análise de Crédito
 * Avelloz Santana Motos
 *
 * Os formulários do site (home e contato) enviam para o formulário nortee
 * "nrt_form_d38a00d09cfd43a0993239ca438f092c". Campos que o nortee espera:
 *   n = nome · t = telefone · e = e-mail · c = cidade (roteamento por loja)
 *   campo_5 = campo livre (usamos para CPF, modelo, renda e mensagem)
 *   company_website = honeypot anti-spam (fica vazio; se um robô preencher, o nortee descarta)
 * Enviando como JSON o nortee responde 204 (sucesso) ou 400 {"error":"invalid_input"}.
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#lead-form');
  if (!form) return;

  // Seletores principais
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const formTypeInput = document.querySelector('#form-type');
  const submitBtn = form.querySelector('button[type="submit"]');
  const submitBtnText = submitBtn ? submitBtn.querySelector('.btn-text') : null;
  const successDiv = document.querySelector('#form-success');

  // Configurações da API do CRM nortee
  const CRM_CONFIG = {
    apiEndpoint: 'https://api.nortee.com.br/v1/forms/nrt_form_d38a00d09cfd43a0993239ca438f092c/submit',
    whatsappNumber: '5577981034163', // Telefone da concessionária (matriz) — usado quando não há cidade
  };

  // WhatsApp de cada loja — o botão da tela de sucesso leva para a cidade escolhida.
  // Mesmos números da árvore de links (links.html).
  const WHATSAPP_POR_CIDADE = {
    'Vitória da Conquista': '5577981034163',
    'Ilhéus': '5573998036678',
    'Itabuna': '5573981081989',
    'Jequié': '5573982138376',
    'Itapetinga': '5577988284748',
  };

  // --- 1. CONTROLE DE ABAS (Tabs) ---
  if (tabButtons.length > 0) {
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Remover active de todos
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        // Ativar aba clicada
        btn.classList.add('active');
        const tabId = btn.dataset.tab;
        const targetContent = document.getElementById(`tab-${tabId}`);
        if (targetContent) targetContent.classList.add('active');

        // Atualizar tipo de formulário e botão
        if (formTypeInput) formTypeInput.value = tabId;
        if (submitBtnText) {
          submitBtnText.textContent = tabId === 'simulation'
            ? 'Consultar Crédito & Simular'
            : 'Enviar Mensagem';
        }

        // Limpar erros ao alternar abas
        form.querySelectorAll('.error-feedback').forEach(el => el.remove());
        form.querySelectorAll('.invalid-field').forEach(el => el.classList.remove('invalid-field'));
      });
    });
  }

  // --- 2. MÁSCARAS DE ENTRADA (Masking) ---
  const applyTelMask = (input) => {
    if (!input) return;
    input.addEventListener('input', (e) => {
      let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
      e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
    });
  };

  const applyCpfMask = (input) => {
    if (!input) return;
    input.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 11) value = value.slice(0, 11);

      let formatted = '';
      if (value.length > 0) formatted += value.slice(0, 3);
      if (value.length > 3) formatted += '.' + value.slice(3, 6);
      if (value.length > 6) formatted += '.' + value.slice(6, 9);
      if (value.length > 9) formatted += '-' + value.slice(9, 11);
      e.target.value = formatted;
    });
  };

  // Aplicar máscaras nos inputs de simulação
  applyTelMask(form.querySelector('#telefone'));
  applyCpfMask(form.querySelector('#cpf'));

  // Aplicar máscaras nos inputs de contato geral
  applyTelMask(form.querySelector('#telefone_contato'));

  // --- 3. VALIDAÇÃO DE CPF (Algoritmo Oficial) ---
  function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf === '' || cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    let add = 0;
    for (let i = 0; i < 9; i++) add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(9))) return false;

    add = 0;
    for (let i = 0; i < 10; i++) add += parseInt(cpf.charAt(i)) * (11 - i);
    let rev2 = 11 - (add % 11);
    if (rev2 === 10 || rev2 === 11) rev2 = 0;
    if (rev2 !== parseInt(cpf.charAt(10))) return false;

    return true;
  }

  const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || '').trim());
  const formatarCPF = (digits) => digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

  // --- 4. SUBMISSÃO E VALIDAÇÃO CONDICIONAL ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Limpar feedbacks anteriores
    form.querySelectorAll('.error-feedback').forEach(el => el.remove());
    form.querySelectorAll('.invalid-field').forEach(el => el.classList.remove('invalid-field'));

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const currentTab = data.form_type || 'simulation';

    let hasErrors = false;
    let leadPayload = {};

    if (currentTab === 'simulation') {
      // Campos de Simulação
      const nomeInput = form.querySelector('#nome');
      const cpfInput = form.querySelector('#cpf');
      const telInput = form.querySelector('#telefone');
      const emailSimInput = form.querySelector('#email_sim');
      const cidadeInput = form.querySelector('#cidade');
      const rawCPF = data.cpf ? data.cpf.replace(/\D/g, '') : '';
      const rawTel = data.telefone ? data.telefone.replace(/\D/g, '') : '';

      if (nomeInput && !data.nome.trim()) {
        showError(nomeInput, 'O nome completo é obrigatório.');
        hasErrors = true;
      }
      if (cpfInput && !validarCPF(rawCPF)) {
        showError(cpfInput, 'Por favor, insira um CPF válido para análise.');
        hasErrors = true;
      }
      if (telInput && rawTel.length < 10) {
        showError(telInput, 'Por favor, insira um WhatsApp válido.');
        hasErrors = true;
      }
      if (emailSimInput && !validarEmail(data.email_sim)) {
        showError(emailSimInput, 'Por favor, insira um e-mail válido.');
        hasErrors = true;
      }
      if (cidadeInput && !(data.cidade || '').trim()) {
        showError(cidadeInput, 'Selecione a cidade da loja mais próxima.');
        hasErrors = true;
      }

      if (!hasErrors) {
        leadPayload = {
          nome: data.nome.trim(),
          cpf: rawCPF,
          telefone: rawTel,
          email: data.email_sim.trim(),
          cidade: data.cidade,
          modelo: data.modelo,
          renda: data.renda,
          tipo: 'simulacao',
          origem: 'Simulação - Avelloz Santana Motos',
          data_cadastro: new Date().toISOString()
        };
      }

    } else {
      // Campos de Contato Geral
      const nomeContatoInput = form.querySelector('#nome_contato');
      const telContatoInput = form.querySelector('#telefone_contato');
      const emailInput = form.querySelector('#email');
      const cidadeContatoInput = form.querySelector('#cidade_contato');
      const rawTelContato = data.telefone_contato ? data.telefone_contato.replace(/\D/g, '') : '';

      if (nomeContatoInput && !data.nome_contato.trim()) {
        showError(nomeContatoInput, 'O nome é obrigatório.');
        hasErrors = true;
      }
      if (telContatoInput && rawTelContato.length < 10) {
        showError(telContatoInput, 'Por favor, insira um telefone válido.');
        hasErrors = true;
      }
      if (emailInput && !validarEmail(data.email)) {
        showError(emailInput, 'Por favor, insira um e-mail válido.');
        hasErrors = true;
      }
      if (cidadeContatoInput && !(data.cidade_contato || '').trim()) {
        showError(cidadeContatoInput, 'Selecione a cidade da loja mais próxima.');
        hasErrors = true;
      }

      if (!hasErrors) {
        leadPayload = {
          nome: data.nome_contato.trim(),
          telefone: rawTelContato,
          email: data.email.trim(),
          cidade: data.cidade_contato,
          mensagem: (data.mensagem || '').trim(),
          tipo: 'duvida',
          origem: 'Contato Geral - Avelloz Santana Motos',
          data_cadastro: new Date().toISOString()
        };
      }
    }

    if (hasErrors) {
      const firstError = form.querySelector('.invalid-field');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const norteePayload = montarPayloadNortee(leadPayload, data.company_website || '');

    // Carregamento (Loading State)
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="animation: spin 1s linear infinite; margin-right: 8px; display: inline-block;">
        <circle cx="12" cy="12" r="10" stroke-dasharray="42 20" stroke-linecap="round"></circle>
      </svg>
      Enviando proposta...
    `;

    try {
      await enviarParaNortee(norteePayload);
      handleSuccess(leadPayload);

    } catch (error) {
      console.error('Erro de envio:', error);
      salvarLeadOffline(norteePayload);
      handleSuccess(leadPayload, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;
    }
  });

  // --- 5. COMPONENTES AUXILIARES ---

  // Converte o lead do site para os campos do formulário nortee.
  // Tudo que não tem campo próprio no nortee (CPF, modelo, renda, mensagem) vai junto no campo_5.
  function montarPayloadNortee(lead, honeypot) {
    const detalhes = [];
    if (lead.tipo === 'simulacao') {
      detalhes.push('Simulação de financiamento');
      detalhes.push('Modelo: ' + (lead.modelo || 'Ainda não decidiu'));
      if (lead.renda) detalhes.push('Renda: ' + lead.renda);
      detalhes.push('CPF: ' + formatarCPF(lead.cpf));
    } else {
      detalhes.push('Dúvida / Contato');
      if (lead.mensagem) detalhes.push('Mensagem: ' + lead.mensagem);
    }
    detalhes.push('Origem: site (' + (location.pathname.replace(/^\//, '') || 'início') + ')');

    return {
      n: lead.nome,
      t: lead.telefone,
      e: lead.email,
      c: lead.cidade,
      campo_5: detalhes.join(' | '),
      company_website: honeypot,
    };
  }

  async function enviarParaNortee(payload) {
    const response = await fetch(CRM_CONFIG.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('nortee respondeu ' + response.status);
    return response;
  }

  function showError(inputElement, message) {
    inputElement.classList.add('invalid-field');
    const errorSpan = document.createElement('span');
    errorSpan.className = 'error-feedback';
    errorSpan.style.color = '#dc2626';
    errorSpan.style.fontSize = '0.85rem';
    errorSpan.style.marginTop = '4px';
    errorSpan.style.display = 'block';
    errorSpan.textContent = message;
    inputElement.parentNode.appendChild(errorSpan);
  }

  function handleSuccess(lead, isFallback = false) {
    if (typeof fbq === 'function') {
      // Advanced Matching: telefone no formato E.164 sem "+" (55 + DDD + número).
      // O próprio pixel aplica SHA-256 antes de enviar — o Meta nunca recebe o número em texto puro.
      const digits = (lead.telefone || '').replace(/\D/g, '');
      const ph = digits.length >= 10 ? (digits.startsWith('55') && digits.length >= 12 ? digits : '55' + digits) : '';
      if (ph) fbq('init', '1850502926298813', { ph });
      fbq('track', lead.tipo === 'simulacao' ? 'Lead' : 'Contact', { content_name: lead.modelo || 'Contato', content_category: lead.cidade || '' });
    }

    let whatsappUrl = '';
    const wppNumber = WHATSAPP_POR_CIDADE[lead.cidade] || CRM_CONFIG.whatsappNumber;

    if (lead.tipo === 'simulacao') {
      const wppText = `Olá! Acabei de enviar minha simulação de financiamento para a moto Avelloz ${lead.modelo || ''}.\nNome: ${lead.nome}\nCidade: ${lead.cidade}\nCPF: ${lead.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4')}\nWhatsApp: ${lead.telefone}`;
      whatsappUrl = `https://wa.me/${wppNumber}?text=${encodeURIComponent(wppText)}`;
    } else {
      const wppText = `Olá! Enviei uma dúvida pelo site.\nNome: ${lead.nome}\nCidade: ${lead.cidade}\nContato: ${lead.telefone}\nAssunto: ${lead.mensagem || 'Contato Geral'}`;
      whatsappUrl = `https://wa.me/${wppNumber}?text=${encodeURIComponent(wppText)}`;
    }

    if (successDiv) {
      successDiv.classList.add('show');
      successDiv.style.display = 'block';

      let htmlContent = `
        <div class="success-card" style="text-align: center; padding: 24px; border-radius: 12px; background: rgba(16, 185, 129, 0.08); border: 1.5px solid #10b981;">
          <h4 style="color: #065f46; margin-bottom: 8px; font-size: 18px; font-weight: 800;">✓ Proposta Enviada com Sucesso!</h4>
          <p style="color: #065f46; font-size: 0.95rem; margin-bottom: 20px; line-height: 1.5;">
            Olá, <strong>${lead.nome}</strong>. Seus dados foram enviados para a loja de <strong>${lead.cidade}</strong>.
            ${lead.tipo === 'simulacao' ? 'Nossos analistas vão simular o seu crédito junto aos bancos.' : 'Em breve um consultor responderá sua dúvida.'}
          </p>
      `;

      if (isFallback) {
        htmlContent += `
          <p style="color: #7c2d12; font-size: 0.85rem; margin-bottom: 20px; background: rgba(251, 146, 60, 0.1); padding: 10px; border-radius: 6px; line-height: 1.4;">
            Aviso: O processamento automático de crédito está em fila de espera. Fale diretamente com o consultor para aprovar na hora.
          </p>
        `;
      }

      htmlContent += `
          <a href="${whatsappUrl}" target="_blank" rel="noopener" class="btn btn-primary" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; background-color: #25D366; border-color: #25D366; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 15px; transition: background 0.2s ease;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3.5A10.5 10.5 0 0 0 3.6 17.2L2 22l4.9-1.6A10.4 10.4 0 0 0 12 22h.1a10.5 10.5 0 0 0 7.4-3 10.5 10.5 0 0 0 1-15.5zM12 20a8.7 8.7 0 0 1-4.4-1.2l-.3-.2-3 1 1-2.9-.2-.3a8.7 8.7 0 1 1 6.9 3.6zm5-6.5c-.3-.1-1.6-.8-1.9-.9-.3-.1-.4-.1-.6.2-.2.3-.7.9-.8 1.1-.2.2-.3.2-.6.1-1.7-.9-2.9-1.5-4-3.5-.3-.5.3-.5.9-1.5.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2 0 1.3.9 2.6 1.1 2.8.1.2 1.9 2.9 4.6 4.1 1.7.7 2.3.7 3.1.6.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.2.2-1.3-.1-.1-.2-.2-.5-.3z"/></svg>
            Falar no WhatsApp e Garantir Aprovação
          </a>
        </div>
      `;

      successDiv.innerHTML = htmlContent;
      form.reset();
      successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // --- 6. REDUNDÂNCIA OFFLINE (Local Storage) ---
  // Guarda o payload já no formato do nortee; a sincronização reenvia igual ao envio normal.
  function salvarLeadOffline(payload) {
    try {
      let leads = JSON.parse(localStorage.getItem('nortee_pending_leads') || '[]');
      leads.push(payload);
      localStorage.setItem('nortee_pending_leads', JSON.stringify(leads));
      console.log('Lead salvo localmente para sincronização futura.');
      window.addEventListener('online', sincronizarLeadsPendentes);
    } catch (e) {
      console.error('Falha ao salvar lead offline', e);
    }
  }

  async function sincronizarLeadsPendentes() {
    if (!navigator.onLine) return;
    try {
      let leads = JSON.parse(localStorage.getItem('nortee_pending_leads') || '[]');
      if (!leads.length) return;

      console.log(`Sincronizando ${leads.length} leads pendentes com o CRM nortee...`);
      const restantes = [];
      for (let i = 0; i < leads.length; i++) {
        // Entradas antigas (formato do webhook anterior, sem "n") são descartadas.
        if (!leads[i] || !leads[i].n) continue;
        try {
          await enviarParaNortee(leads[i]);
        } catch (err) {
          // 4xx = o nortee recusou o dado, reenviar não resolve; erro de rede fica para a próxima.
          if (!/respondeu 4\d\d/.test(String(err && err.message))) restantes.push(leads[i]);
        }
      }
      if (restantes.length) localStorage.setItem('nortee_pending_leads', JSON.stringify(restantes));
      else localStorage.removeItem('nortee_pending_leads');
      console.log('Sincronização concluída.');
    } catch (e) {
      console.error('Erro na sincronização automática:', e);
    }
  }

  if (navigator.onLine) sincronizarLeadsPendentes();
});
