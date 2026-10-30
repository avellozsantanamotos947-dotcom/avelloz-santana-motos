/**
 * Integração CRM nortee & Análise de Crédito
 * Avelloz Santana Motos
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
    apiEndpoint: 'https://api.nortee.com.br/v1/leads/webhook', 
    whatsappNumber: '5577981034163', // Telefone da concessionária
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

      if (!hasErrors) {
        leadPayload = {
          nome: data.nome,
          cpf: rawCPF,
          telefone: rawTel,
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
      const rawTelContato = data.telefone_contato ? data.telefone_contato.replace(/\D/g, '') : '';

      if (nomeContatoInput && !data.nome_contato.trim()) {
        showError(nomeContatoInput, 'O nome é obrigatório.');
        hasErrors = true;
      }
      if (telContatoInput && rawTelContato.length < 10) {
        showError(telContatoInput, 'Por favor, insira um telefone válido.');
        hasErrors = true;
      }
      if (emailInput && !data.email.trim()) {
        showError(emailInput, 'O e-mail é obrigatório.');
        hasErrors = true;
      }

      if (!hasErrors) {
        leadPayload = {
          nome: data.nome_contato,
          telefone: rawTelContato,
          email: data.email,
          mensagem: data.mensagem,
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
      const response = await fetch(CRM_CONFIG.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(leadPayload)
      });

      if (!response.ok) throw new Error('Falha no envio para o CRM');

      const resData = await response.json();
      handleSuccess(leadPayload, resData.mensagem_whatsapp || null);

    } catch (error) {
      console.error('Erro de envio:', error);
      salvarLeadOffline(leadPayload);
      handleSuccess(leadPayload, null, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;
    }
  });

  // --- 5. COMPONENTES AUXILIARES ---

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

  function handleSuccess(lead, customWppMsg = null, isFallback = false) {
    if (typeof fbq === 'function') {
      // Advanced Matching: telefone no formato E.164 sem "+" (55 + DDD + número).
      // O próprio pixel aplica SHA-256 antes de enviar — o Meta nunca recebe o número em texto puro.
      const digits = (lead.telefone || '').replace(/\D/g, '');
      const ph = digits.length >= 10 ? (digits.startsWith('55') && digits.length >= 12 ? digits : '55' + digits) : '';
      if (ph) fbq('init', '1850502926298813', { ph });
      fbq('track', lead.tipo === 'simulacao' ? 'Lead' : 'Contact', { content_name: lead.modelo || 'Contato' });
    }

    let whatsappUrl = '';
    const wppNumber = CRM_CONFIG.whatsappNumber;

    if (lead.tipo === 'simulacao') {
      const wppText = customWppMsg || `Olá! Acabei de enviar minha simulação de financiamento para a moto Avelloz ${lead.modelo || ''}.\nNome: ${lead.nome}\nCPF: ${lead.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4')}\nWhatsApp: ${lead.telefone}`;
      whatsappUrl = `https://wa.me/${wppNumber}?text=${encodeURIComponent(wppText)}`;
    } else {
      const wppText = `Olá! Enviei uma dúvida pelo site.\nNome: ${lead.nome}\nContato: ${lead.telefone}\nAssunto: ${lead.mensagem || 'Contato Geral'}`;
      whatsappUrl = `https://wa.me/${wppNumber}?text=${encodeURIComponent(wppText)}`;
    }

    if (successDiv) {
      successDiv.classList.add('show');
      successDiv.style.display = 'block';
      
      let htmlContent = `
        <div class="success-card" style="text-align: center; padding: 24px; border-radius: 12px; background: rgba(16, 185, 129, 0.08); border: 1.5px solid #10b981;">
          <h4 style="color: #065f46; margin-bottom: 8px; font-size: 18px; font-weight: 800;">✓ Proposta Enviada com Sucesso!</h4>
          <p style="color: #065f46; font-size: 0.95rem; margin-bottom: 20px; line-height: 1.5;">
            Olá, <strong>${lead.nome}</strong>. Seus dados foram salvos no nosso sistema. 
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
  function salvarLeadOffline(lead) {
    try {
      let leads = JSON.parse(localStorage.getItem('nortee_pending_leads') || '[]');
      leads.push(lead);
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
      for (let i = 0; i < leads.length; i++) {
        await fetch(CRM_CONFIG.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leads[i])
        });
      }
      localStorage.removeItem('nortee_pending_leads');
      console.log('Sincronização concluída com sucesso.');
    } catch (e) {
      console.error('Erro na sincronização automática:', e);
    }
  }

  if (navigator.onLine) sincronizarLeadsPendentes();
});
