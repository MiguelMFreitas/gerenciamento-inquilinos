console.log("Iniciando script.js...");

const SUPABASE_URL = "https://obvhpzlirwsuymbiencv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9idmhwemxpcndzdXltYmllbmN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzY3OTcsImV4cCI6MjA4ODIxMjc5N30.Ru1JG7hCUSVHpomRFUMDrzgkjAnLoiK8cI-wGRf8CTM";

let db; // Renomeado de 'supabase' para 'db' para evitar conflito com a global da biblioteca

function initSupabase() {
    try {
        console.log("Tentando inicializar o cliente Supabase...");
        // A biblioteca CDN pode estar em window.supabase ou apenas no global 'supabase'
        const supabaseLib = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);

        if (supabaseLib && supabaseLib.createClient) {
            db = supabaseLib.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log("Cliente Supabase (db) pronto!");
            return true;
        } else {
            console.error("Erro crítico: Biblioteca Supabase não encontrada. Verifique os scripts no HTML.");
            return false;
        }
    } catch (e) {
        console.error("Exceção ao inicializar Supabase:", e);
        return false;
    }
}

// State management (Now as a cache of the DB)
let state = {
    predios: [],
    unidades: [],
    inquilinos: [],
    pagamentos: []
};

// Carregar dados iniciais do Supabase
async function loadData() {
    console.log("Chamando loadData()...");
    if (!supabase) {
        console.error("loadData() cancelado: Supabase não inicializado.");
        return;
    }
    try {
        console.log("Buscando dados no Supabase...");
        const [p, u, i, pays] = await Promise.all([
            db.from('predios').select('*').order('nome'),
            db.from('unidades').select('*'),
            db.from('inquilinos').select('*'),
            db.from('pagamentos').select('*')
        ]);

        console.log("Dados recebidos:", {
            predios: p.data?.length,
            unidades: u.data?.length,
            inquilinos: i.data?.length,
            pagamentos: pays.data?.length
        });

        if (p.error || u.error || i.error || pays.error) {
            console.error("Erros nas consultas:", { p: p.error, u: u.error, i: i.error, pays: pays.error });
        }

        state.predios = p.data || [];
        state.unidades = u.data || [];
        state.inquilinos = i.data || [];
        state.pagamentos = pays.data || [];

        updateDashboard();
        // Se estiver na tela atual, re-renderiza
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav) renderSection(activeNav.getAttribute('data-target'));
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    }
}

// A função save() agora apenas atualiza o dashboard localmente (é chamada após operações de DB)
function save() {
    updateDashboard();
}

// Keyboard Blocking / Input Filters
function setupInputFilters() {

    const numberFilter = (e) => {
        if (!/[0-9]/.test(e.key) && !['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete'].includes(e.key)) {
            e.preventDefault();
        }
    };

    const phoneFilter = (e) => {
        if (!/[0-9]/.test(e.key) && !['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', '(', ')', '-', ' '].includes(e.key)) {
            e.preventDefault();
        }
    };

    const applyPhoneMask = (input) => {
        let value = input.value.replace(/\D/g, "");
        if (value.length > 11) value = value.slice(0, 11);

        let formatted = "";
        if (value.length > 0) formatted += "(" + value.slice(0, 2);
        if (value.length > 2) formatted += ") " + value.slice(2, 7);
        if (value.length > 7) formatted += "-" + value.slice(7, 11);

        input.value = formatted;
    };

    document.addEventListener('keydown', (e) => {
        const target = e.target;
        if (target.matches('#tenant-cpf, #tenant-due-day')) numberFilter(e);
        if (target.matches('#tenant-phone, .ref-phone')) phoneFilter(e);
    });

    document.addEventListener('input', (e) => {
        if (e.target.matches('#tenant-phone, .ref-phone')) {
            applyPhoneMask(e.target);
        }
    });
}

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const target = item.getAttribute('data-target');
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(target).classList.add('active');
        document.getElementById('page-title').innerText = item.innerText.split(' ')[1];
        renderSection(target);
    });
});

// Utility
function formatCurrency(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }

function getStatusPagamento(inquilino) {
    const hoje = new Date();
    const diaAtual = hoje.getDate();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const pago = state.pagamentos.find(p => p.inquilino_id === inquilino.id && p.mes === mesAtual && p.ano === anoAtual);
    if (pago) return { label: 'PAGO', class: 'pago' };
    if (diaAtual > inquilino.due_day) return { label: 'EM ATRASO', class: 'atrasado' };
    return { label: 'PENDENTE', class: 'pendente' };
}

// --- RENDERING ---

function renderSection(name) {
    switch (name) {
        case 'dashboard': updateDashboard(); break;
        case 'inquilinos': renderTenants(); break;
        case 'imoveis': renderPropertiesManager(); break;
        case 'financeiro': renderPayments(); break;
    }
}

function updateDashboard() {
    const totalRevenue = state.inquilinos.reduce((acc, t) => acc + parseFloat(t.rent_value || 0), 0);
    let pendingCount = 0;
    state.inquilinos.forEach(t => { if (getStatusPagamento(t).label !== 'PAGO') pendingCount++; });

    document.getElementById('stats-revenue').innerText = formatCurrency(totalRevenue);
    document.getElementById('stats-tenants').innerText = state.inquilinos.length;
    document.getElementById('stats-occupied').innerText = state.unidades.length > 0 ?
        `${Math.round((state.unidades.filter(u => u.status === 'ocupado').length / state.unidades.length) * 100)}%` : '0%';
    document.getElementById('stats-pending').innerText = pendingCount;
    renderUpcoming();
}

// Gestão de Propriedades (Prédios e Unidades)
function renderPropertiesManager() {
    // Listar Prédios
    const listBuildings = document.getElementById('list-buildings');
    listBuildings.innerHTML = state.predios.map(p => `
        <li style="display:flex; justify-content:space-between; padding:0.5rem; border-bottom:1px solid var(--border)">
            <span><strong>${p.nome}</strong></span>
            <button class="btn" style="background:#ef4444; padding:0.2rem 0.5rem;" onclick="deleteBuilding('${p.id}')">Excluir</button>
        </li>
    `).join('');

    // Selects
    const selectBuildUnit = document.getElementById('unit-select-building');
    const selectBuildTenant = document.getElementById('tenant-select-building');
    const options = '<option value="">Selecione...</option>' + state.predios.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
    selectBuildUnit.innerHTML = options;
    selectBuildTenant.innerHTML = options;

    // Listar Unidades
    const listUnits = document.getElementById('units-by-building-list');
    listUnits.innerHTML = state.predios.map(p => `
        <div style="margin-bottom:1rem;">
            <h5 style="color:var(--primary)">${p.nome}</h5>
            <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:0.5rem;">
                ${state.unidades.filter(u => u.predio_id === p.id).map(u => `
                    <span class="badge ${u.status === 'ocupado' ? 'pago' : 'atrasado'}" style="cursor:help" title="${u.status}">
                        ${u.numero} 
                        <span style="margin-left:5px; cursor:pointer;" onclick="deleteUnit('${u.id}')">×</span>
                    </span>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// Inquilinos
function renderTenants() {
    const listDiv = document.getElementById('tenants-grouped-list');
    listDiv.innerHTML = state.predios.map(p => {
        const tenantsInBuild = state.inquilinos.filter(t => {
            const unit = state.unidades.find(u => u.id === t.unidade_id);
            return unit && unit.predio_id === p.id;
        });

        if (tenantsInBuild.length === 0) return '';

        return `
            <div style="margin-bottom: 2rem;">
                <h4 style="margin-bottom:1rem; color:var(--accent); border-bottom: 1px solid var(--border)">${p.nome}</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Apto</th>
                            <th>Inquilino</th>
                            <th>Aluguel</th>
                            <th>Vencimento</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tenantsInBuild.map(t => {
            const unit = state.unidades.find(u => u.id === t.unidade_id);
            const status = getStatusPagamento(t);
            return `
                                <tr>
                                    <td><strong>${unit ? unit.numero : 'N/A'}</strong></td>
                                    <td>${t.nome}<br><small>${t.phone}</small></td>
                                    <td>${formatCurrency(t.rent_value)}</td>
                                    <td>Dia ${t.due_day}</td>
                                    <td><span class="badge ${status.class}">${status.label}</span></td>
                                    <td><button class="btn" style="background:#ef4444; padding:0.4rem 0.8rem;" onclick="deleteTenant('${t.id}')">Desocupar</button></td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }).join('') || '<p style="text-align:center; color:var(--text-muted);">Nenhum inquilino cadastrado.</p>';
}

function renderPayments() {
    const listAtrasados = document.getElementById('atrasados-list');
    const tbody = document.querySelector('#table-payments tbody');

    // 1. Filtrar e Renderizar Atrasados
    const atrasados = state.inquilinos.filter(t => getStatusPagamento(t).label === 'EM ATRASO');

    if (atrasados.length === 0) {
        listAtrasados.innerHTML = '<p style="color: var(--text-muted); text-align: center;">🎉 Nenhum inquilino em atraso no momento.</p>';
    } else {
        listAtrasados.innerHTML = atrasados.map(t => {
            const unit = state.unidades.find(u => u.id === t.unidade_id);
            const predio = unit ? state.predios.find(p => p.id === unit.predio_id) : null;
            // Limpa o telefone para o link tel: (apenas números)
            const purePhone = t.phone.replace(/\D/g, '');

            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: 8px; margin-bottom: 0.5rem; border: 1px solid rgba(239, 68, 68, 0.2);">
                    <div>
                        <strong>${t.nome}</strong> (Apto ${unit ? unit.numero : '?'})<br>
                        <small>${predio ? predio.nome : 'N/A'} - Venceu dia ${t.due_day}</small>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <a href="tel:${purePhone}" class="btn" style="background: #2563eb; text-decoration: none; display: flex; align-items: center; gap: 5px;">
                            📞 Ligar
                        </a>
                        <button class="btn" onclick="registerPayment('${t.id}')">Registrar R$</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 2. Renderizar Tabela Geral
    tbody.innerHTML = state.inquilinos.map(t => {
        const status = getStatusPagamento(t);
        const unit = state.unidades.find(u => u.id === t.unidade_id);
        const predio = unit ? state.predios.find(p => p.id === unit.predio_id) : null;
        const mesNome = new Date().toLocaleString('pt-BR', { month: 'long' });
        return `
            <tr>
                <td>${mesNome.toUpperCase()} / ${new Date().getFullYear()}</td>
                <td><strong>Apto ${unit ? unit.numero : '?'}</strong><br><small>${predio ? predio.nome : 'N/A'}</small></td>
                <td>${formatCurrency(t.rent_value)}</td>
                <td><span class="badge ${status.class}">${status.label}</span></td>
                <td>${status.label !== 'PAGO' ? `<button class="btn" onclick="registerPayment('${t.id}')">Registrar</button>` : '✅'}</td>
            </tr>
        `;
    }).join('');
}

function renderUpcoming() {
    const tbody = document.querySelector('#table-upcoming tbody');
    const delayed = state.inquilinos.filter(t => getStatusPagamento(t).label === 'EM ATRASO');
    tbody.innerHTML = delayed.length ? delayed.map(t => {
        const unit = state.unidades.find(u => u.id === t.unidade_id);
        return `
            <tr style="background: rgba(239, 68, 68, 0.1);"><td>${t.nome}</td><td>Apto ${unit ? unit.numero : '?'}</td><td>${formatCurrency(t.rent_value)}</td><td>Dia ${t.due_day}</td><td><span class="badge atrasado">ATRASADO</span></td></tr>
        `;
    }).join('') : '<tr><td colspan="5" style="text-align:center">Nenhum atraso.</td></tr>';
}

// --- ACTIONS ---

// Prédios
document.getElementById('form-predio').onsubmit = async (e) => {
    e.preventDefault();
    const nome = document.getElementById('building-name').value;
    const { error } = await db.from('predios').insert([{ nome }]);
    if (error) alert("Erro ao salvar prédio: " + error.message);
    else { await loadData(); renderPropertiesManager(); e.target.reset(); }
};

async function deleteBuilding(id) {
    if (!confirm('Isso excluirá o prédio e todas as suas unidades. Continuar?')) return;
    const { error } = await db.from('predios').delete().eq('id', id);
    if (error) alert("Erro ao excluir: " + error.message);
    else await loadData();
}

// Unidades
document.getElementById('form-unidade').onsubmit = async (e) => {
    e.preventDefault();
    const predio_id = document.getElementById('unit-select-building').value;
    const numero = document.getElementById('unit-number').value;

    const { error } = await db.from('unidades').insert([{ predio_id, numero, status: 'vago' }]);
    if (error) alert("Erro ao salvar unidade: " + error.message);
    else { await loadData(); renderPropertiesManager(); e.target.reset(); }
};

async function deleteUnit(id) {
    if (!confirm('Excluir esta unidade?')) return;
    const { error } = await db.from('unidades').delete().eq('id', id);
    if (error) alert("Erro ao excluir: " + error.message);
    else await loadData();
}

// Utility: Force ,00 on blur for currency inputs
function setupCurrencyInputs() {
    ['tenant-rent-value', 'tenant-deposit'].forEach(id => {
        const input = document.getElementById(id);
        input.addEventListener('blur', (e) => {
            let val = parseFloat(e.target.value);
            if (!isNaN(val)) {
                // Formatting to 2 decimals with comma
                e.target.type = 'text'; // temporarily change to text to show comma if needed, or just keep as display
                e.target.value = val.toFixed(2).replace('.', ',');
            }
        });
        input.addEventListener('focus', (e) => {
            if (e.target.value.includes(',')) {
                e.target.value = e.target.value.replace(',', '.');
            }
            e.target.type = 'number';
        });
    });
}

// Inquilinos
document.getElementById('tenant-select-building').onchange = (e) => {
    const buildId = e.target.value;
    const unitSelect = document.getElementById('tenant-select-unit');
    if (!buildId) { unitSelect.disabled = true; return; }

    const units = state.unidades.filter(u => u.predio_id === buildId && u.status === 'vago');
    unitSelect.innerHTML = '<option value="" style="font-weight:bold; font-size:1.1rem;">Selecione a Unidade (Apto)...</option>' + units.map(u => `<option value="${u.id}" style="font-size:1.1rem; padding:5px;">Apto ${u.numero}</option>`).join('');
    unitSelect.disabled = false;
};

document.getElementById('form-inquilino').onsubmit = async (e) => {
    e.preventDefault();
    const unitId = document.getElementById('tenant-select-unit').value;

    // Coletar referências
    const refNames = Array.from(document.querySelectorAll('.ref-name')).map(i => i.value);
    const refPhones = Array.from(document.querySelectorAll('.ref-phone')).map(i => i.value);
    const refKinship = Array.from(document.querySelectorAll('.ref-kinship')).map(i => i.value);

    const relatedContacts = refNames.map((name, i) => ({
        name, phone: refPhones[i], kinship: refKinship[i]
    }));

    // Clean value before saving
    const rentVal = document.getElementById('tenant-rent-value').value.replace(',', '.');
    const depositVal = document.getElementById('tenant-deposit').value.replace(',', '.');

    const newTenant = {
        unidade_id: unitId,
        nome: document.getElementById('tenant-name').value,
        cpf: document.getElementById('tenant-cpf').value,
        phone: document.getElementById('tenant-phone').value,
        related_contacts: relatedContacts,
        due_day: parseInt(document.getElementById('tenant-due-day').value),
        rent_value: parseFloat(rentVal),
        deposit: parseFloat(depositVal)
    };

    try {
        // 1. Inserir Inquilino
        const { error: tError } = await db.from('inquilinos').insert([newTenant]);
        if (tError) throw tError;

        // 2. Atualizar Unidade para "ocupado"
        const { error: uError } = await db.from('unidades').update({ status: 'ocupado' }).eq('id', unitId);
        if (uError) throw uError;

        await loadData();
        e.target.reset();
        alert('Inquilino cadastrado com sucesso!');
    } catch (error) {
        console.error("Erro ao cadastrar:", error);
        alert("Erro ao cadastrar inquilino: " + error.message);
    }
};

async function deleteTenant(id) {
    const t = state.inquilinos.find(ten => ten.id === id);
    if (t) {
        const confirmName = prompt(`⚠️ ATENÇÃO: Para DESOCUPAR o imóvel e excluir o inquilino, digite o nome completo abaixo:\n\n👉 [ ${t.nome} ]`);

        if (confirmName === t.nome) {
            await db.from('unidades').update({ status: 'vago' }).eq('id', t.unidade_id);
            await db.from('inquilinos').delete().eq('id', id);
            await loadData();
            alert('Imóvel desocupado e inquilino removido com sucesso.');
        } else {
            alert('Confirmação incorreta. Ação cancelada.');
        }
    }
}

// Modal Pagamento Logic
function openPaymentModal(tenantId) {
    const tenant = state.inquilinos.find(t => t.id === tenantId);
    if (!tenant) return;

    document.getElementById('modal-tenant-id').value = tenantId;
    document.getElementById('modal-tenant-name').innerText = `Pagamento: ${tenant.nome}`;
    document.getElementById('payment-modal').style.display = 'flex';
}

function closePaymentModal() {
    document.getElementById('payment-modal').style.display = 'none';
    document.getElementById('form-confirm-payment').reset();
    togglePaymentFields();
}

function togglePaymentFields() {
    const method = document.getElementById('payment-method').value;
    document.getElementById('cash-fields').style.display = method === 'dinheiro' ? 'block' : 'none';
    document.getElementById('pix-fields').style.display = method === 'pix' ? 'block' : 'none';

    // Set required status
    document.getElementById('cash-datetime').required = method === 'dinheiro';
    document.getElementById('pix-file').required = method === 'pix';
}

document.getElementById('form-confirm-payment').onsubmit = async (e) => {
    e.preventDefault();
    const inquilino_id = document.getElementById('modal-tenant-id').value;
    const method = document.getElementById('payment-method').value;
    const datetime = document.getElementById('cash-datetime').value;
    const pixFile = document.getElementById('pix-file').files[0];

    const details = {
        method: method,
        timestamp: method === 'dinheiro' ? datetime : new Date().toISOString(),
        receipt: method === 'pix' ? (pixFile ? pixFile.name : 'Arquivo anexado') : 'Pagamento em espécie'
    };

    const hoje = new Date();
    const newPayment = {
        inquilino_id,
        mes: hoje.getMonth(),
        ano: hoje.getFullYear(),
        status: 'pago',
        details
    };

    const { error } = await db.from('pagamentos').insert([newPayment]);
    if (error) alert("Erro ao registrar pagamento: " + error.message);
    else {
        await loadData();
        closePaymentModal();
        alert('Pagamento registrado com sucesso!');
    }
};

function registerPayment(tenantId) {
    openPaymentModal(tenantId);
}

// Inicialização ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM carregado. Iniciando setup...");

    // Configurações iniciais
    setupCurrencyInputs();
    setupInputFilters();

    // Data atual
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        dateEl.innerText = new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Inicializar DB e Carregar Dados
    if (initSupabase()) {
        loadData().then(() => {
            console.log("Setup inicial e carregamento de dados concluídos.");
        }).catch(err => {
            console.error("Erro ao carregar dados iniciais:", err);
        });
    }
});
