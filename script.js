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
    pagamentos: [],
    viewMonth: new Date().getMonth(),
    viewYear: new Date().getFullYear()
};

// Carregar dados iniciais do Supabase
async function loadData() {
    console.log("Chamando loadData()...");
    if (!db) {
        console.error("loadData() cancelado: Cliente Supabase (db) não inicializado.");
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

    const applyCPFMask = (input) => {
        let value = input.value.replace(/\D/g, "");
        if (value.length > 11) value = value.slice(0, 11);

        let formatted = "";
        if (value.length > 0) formatted += value.slice(0, 3);
        if (value.length > 3) formatted += "." + value.slice(3, 6);
        if (value.length > 6) formatted += "." + value.slice(6, 9);
        if (value.length > 9) formatted += "-" + value.slice(9, 11);

        input.value = formatted;
    };

    const applyPhoneMask = (input) => {
        let value = input.value.replace(/\D/g, "");
        if (value.length > 11) value = value.slice(0, 11);

        let formatted = "";
        if (value.length > 0) {
            formatted = "(" + value.slice(0, 2);
            if (value.length > 2) {
                formatted += ") " + value.slice(2, 7);
                if (value.length > 7) {
                    formatted += "-" + value.slice(7, 11);
                }
            }
        }
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
        if (e.target.matches('#tenant-cpf')) {
            applyCPFMask(e.target);
        }
    });
}

// Global Navigation Function
// Global Navigation Function
window.navigateTo = function (target) {
    console.log("Navegando programaticamente para:", target);

    // Atualizar classes 'active' em todos os menus (Sidebar e Bottom Nav)
    document.querySelectorAll('.nav-item').forEach(i => {
        if (i.getAttribute('data-target') === target) {
            i.classList.add('active');
        } else {
            i.classList.remove('active');
        }
    });

    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const targetSection = document.getElementById(target);
    if (targetSection) targetSection.classList.add('active');

    // Atualizar título da página
    const activeItem = document.querySelector(`.nav-item[data-target="${target}"]`);
    if (activeItem) {
        const label = activeItem.querySelector('.nav-label')?.innerText || activeItem.innerText.split(' ')[1] || activeItem.innerText;
        document.getElementById('page-title').innerText = label;
    }

    renderSection(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Navigation
console.log("Configurando navegação...");
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const target = item.getAttribute('data-target');
        navigateTo(target);
    });
});

// Utility
function formatCurrency(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }

function getStatusPagamento(inquilino) {
    const hoje = new Date();

    let entryDate;
    if (inquilino.entry_date) {
        // Parse manual para evitar que "2026-03-01" vire "2026-02-28" por causa de fuso horário/UTC
        const parts = inquilino.entry_date.split('-');
        entryDate = new Date(parts[0], parts[1] - 1, parts[2] || 1);
    } else {
        entryDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    }

    let totalDebtMonths = [];

    // Iterar do mês de entrada até o mês atual
    // Usar dia 1 para evitar problemas de fuso/DST/dias 31
    let current = new Date(entryDate.getFullYear(), entryDate.getMonth(), 1);
    const stopYear = hoje.getFullYear();
    const stopMonth = hoje.getMonth();

    // Segurança: não deixar o loop rodar infinitamente se a data for inválida
    let maxIter = 100;

    while (maxIter > 0) {
        const m = current.getMonth();
        const y = current.getFullYear();

        // Se passamos do mês atual, paramos
        if (y > stopYear || (y === stopYear && m > stopMonth)) break;

        const pago = state.pagamentos.find(p => p.inquilino_id === inquilino.id && p.mes === m && p.ano === y);

        if (!pago) {
            // Se for o mês atual, só conta como dívida se já passou o dia de vencimento
            if (y === stopYear && m === stopMonth) {
                if (hoje.getDate() > (inquilino.due_day || 31)) {
                    totalDebtMonths.push({ mes: m, ano: y });
                }
            } else {
                totalDebtMonths.push({ mes: m, ano: y });
            }
        }

        // Incrementar mês de forma segura
        current = new Date(y, m + 1, 1);
        maxIter--;
    }

    if (totalDebtMonths.length > 0) {
        return {
            label: 'EM ATRASO',
            class: 'atrasado',
            months: totalDebtMonths
        };
    }

    // Se chegou aqui e não tem dívidas pendentes, mas o mês atual ainda não foi pago nem venceu
    const pagoMensal = state.pagamentos.find(p => p.inquilino_id === inquilino.id && p.mes === hoje.getMonth() && p.ano === hoje.getFullYear());
    if (pagoMensal) return { label: 'PAGO', class: 'pago' };

    return { label: 'PENDENTE', class: 'pendente' };
}

function getContractStatus(inquilino) {
    if (!inquilino.entry_date || !inquilino.contract_duration) return { label: 'ATIVO', class: 'pago' };

    const parts = inquilino.entry_date.split('-');
    const entryDate = new Date(parts[0], parts[1] - 1, parts[2] || 1);
    const expirationDate = new Date(entryDate.getFullYear(), entryDate.getMonth() + inquilino.contract_duration, entryDate.getDate());

    const hoje = new Date();
    if (hoje > expirationDate) {
        return { label: 'VENCIDO', class: 'atrasado' };
    }
    return { label: 'ATIVO', class: 'pago' };
}

// --- RENDERING ---

window.renderSection = function (name) {
    switch (name) {
        case 'dashboard': updateDashboard(); break;
        case 'inquilinos': renderTenants(); break;
        case 'imoveis': renderPropertiesManager(); break;
        case 'financeiro': renderPayments(); break;
    }
}

window.navigateTo = function (section) {
    // 1. Encontrar o item do menu correspondente
    const navItem = document.querySelector(`.nav-item[data-target="${section}"]`);
    if (!navItem) return;

    // 2. Simular o clique para disparar toda a lógica de UI existente
    // Se houver lógica de clique vinculada por addEventListener, o click() aciona ela.
    // Caso contrário, precisamos chamar manual.

    // Remover active de todos
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    // Adicionar active no alvo
    const allMatching = document.querySelectorAll(`.nav-item[data-target="${section}"]`);
    allMatching.forEach(i => i.classList.add('active'));

    // Esconder todas as seções
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    // Mostrar a alvo
    document.getElementById(section).classList.add('active');

    // Renderizar
    window.renderSection(section);
}

function updateDashboard() {
    const hoje = new Date();
    const atualMes = hoje.getMonth();
    const atualAno = hoje.getFullYear();

    // 1. Previsão Total (Soma de todos os aluguéis de quem está OCUPANDO uma unidade)
    const expectedRevenue = state.inquilinos
        .filter(t => t.unidade_id)
        .reduce((acc, t) => acc + parseFloat(t.rent_value || 0), 0);

    // 2. Receita Recebida (Somente o que foi pago NO MÊS ATUAL)
    const paidRevenue = state.pagamentos
        .filter(p => p.mes === atualMes && p.ano === atualAno && p.status === 'pago')
        .reduce((acc, p) => {
            const tenant = state.inquilinos.find(t => t.id === p.inquilino_id);
            return acc + parseFloat(tenant ? tenant.rent_value : 0);
        }, 0);

    // 3. Inquilinos em Atraso (Status 'EM ATRASO' somente para quem tem unidade)
    let pendingCount = 0;
    state.inquilinos.forEach(t => {
        if (t.unidade_id && getStatusPagamento(t).label === 'EM ATRASO') pendingCount++;
    });

    // 4. Unidades Ocupadas
    const occupiedCount = state.unidades.filter(u => u.status === 'ocupado').length;
    const occupancyRate = state.unidades.length > 0 ? (occupiedCount / state.unidades.length) * 100 : 0;

    // Atualizar UI
    const elExpected = document.getElementById('stats-revenue-expected');
    const elPaid = document.getElementById('stats-revenue-paid');
    const elPending = document.getElementById('stats-pending');
    const elOccupied = document.getElementById('stats-occupied');

    if (elExpected) elExpected.innerText = formatCurrency(expectedRevenue);
    if (elPaid) elPaid.innerText = formatCurrency(paidRevenue);
    if (elPending) elPending.innerText = pendingCount;
    if (elOccupied) elOccupied.innerText = `${occupancyRate.toFixed(0)}%`;

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
                            <th>Contrato</th>
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
                                    <td>${t.nome}</td>
                                    <td>${t.contract_duration ? t.contract_duration + ' meses' : '-'}</td>
                                    <td>${(() => {
                    const pays = state.pagamentos.filter(p => p.inquilino_id === t.id);
                    if (pays.length === 0) return '---';
                    const latest = pays.reduce((prev, curr) => {
                        if (curr.ano > prev.ano) return curr;
                        if (curr.ano === prev.ano && curr.mes > prev.mes) return curr;
                        return prev;
                    });
                    const mesNome = new Date(latest.ano, latest.mes).toLocaleString('pt-BR', { month: 'short' });
                    return `${mesNome.toUpperCase()} / ${latest.ano}`;
                })()}</td>
                                    <td>${formatCurrency(t.rent_value)}</td>
                                    <td>Dia ${t.due_day}</td>
                                    <td>
                                        <div style="display:flex; flex-direction:column; gap:4px;">
                                            <span class="badge ${status.class}">${status.label}</span>
                                            ${(() => {
                    const cStatus = getContractStatus(t);
                    return cStatus.label === 'VENCIDO' ? `<span class="badge atrasado" style="font-size: 10px; padding: 2px 4px; display:inline-block;">CONTRATO VENCIDO</span>` : '';
                })()}
                                        </div>
                                    </td>
                                    <td>
                                        <div style="display:flex; gap: 0.5rem; align-items:center;">
                                            <button class="btn" style="background:#0ea5e9; padding:0.4rem 0.8rem;" onclick="editTenant('${t.id}')">Editar</button>
                                            <button class="btn" style="background:#ef4444; padding:0.4rem 0.8rem;" onclick="deleteTenant('${t.id}')">Desocupar</button>
                                            ${t.observations ? `<button class="btn" style="background:#6366f1; padding:0.4rem 0.8rem;" title="Ver Observações" onclick="alert('Observações de ${t.nome}:\\n\\n${t.observations}')">Obs</button>` : ''}
                                        </div>
                                    </td>
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
            const purePhone = t.phone.replace(/\D/g, '');
            const status = getStatusPagamento(t);

            // Gerar nomes dos meses devidos com ano para evitar confusão de repetição
            const mesesExtenso = status.months.map(m => {
                const data = new Date(m.ano, m.mes);
                const mesNome = data.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
                // Se a dívida for de outro ano, mostra o ano
                return m.ano !== new Date().getFullYear() ? `${mesNome}/${m.ano}` : mesNome;
            }).join(', ');

            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: 8px; margin-bottom: 0.5rem; border: 1px solid rgba(239, 68, 68, 0.2);">
                    <div style="flex:1">
                        <strong>${t.nome || 'Inquilino s/ nome'}</strong> <br>
                        <small style="font-weight:bold;">Apto: ${unit ? unit.numero : 'Apto não encontrado'}</small><br>
                        <small style="color:#ef4444; font-weight:bold;">Atrasado: ${mesesExtenso}</small><br>
                        <small>${predio ? predio.nome : (unit ? 'Local não vinculado' : '')}</small>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <a href="tel:${purePhone}" class="btn" style="background: #2563eb; text-decoration: none; display: flex; align-items: center; gap: 5px; padding: 0.4rem 0.8rem;">
                            📞 Ligar
                        </a>
                        <button class="btn" style="background: var(--primary);" onclick="window.navigateTo('financeiro'); setTimeout(() => document.getElementById('table-payments').scrollIntoView({behavior:'smooth'}), 100);">Ver</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 2. Renderizar Tabela Geral
    const mesDisplay = new Date(state.viewYear, state.viewMonth).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const labelEl = document.getElementById('current-month-display');
    if (labelEl) labelEl.innerText = mesDisplay.charAt(0).toUpperCase() + mesDisplay.slice(1);

    tbody.innerHTML = state.inquilinos.map(t => {
        // Agora o status é relativo ao mês que estamos VENDO
        const pago = state.pagamentos.find(p => p.inquilino_id === t.id && p.mes === state.viewMonth && p.ano === state.viewYear);
        const unit = state.unidades.find(u => u.id === t.unidade_id);
        const predio = unit ? state.predios.find(p => p.id === unit.predio_id) : null;

        let statusLabel = 'PENDENTE';
        let statusClass = 'pendente';

        if (pago) {
            statusLabel = 'PAGO';
            statusClass = 'pago';
        } else {
            const hoje = new Date();
            const diaVencimento = t.due_day;
            // Se o mês visualizado for passado ou atual e já venceu
            const isPastMonth = state.viewYear < hoje.getFullYear() || (state.viewYear === hoje.getFullYear() && state.viewMonth < hoje.getMonth());
            const isCurrentMonth = state.viewYear === hoje.getFullYear() && state.viewMonth === hoje.getMonth();

            if (isPastMonth || (isCurrentMonth && hoje.getDate() > diaVencimento)) {
                statusLabel = 'EM ATRASO';
                statusClass = 'atrasado';
            }
        }

        return `
            <tr>
                <td>${mesNome.toUpperCase()} / ${state.viewYear}</td>
                <td><strong>Apto ${unit ? unit.numero : '?'}</strong><br><small>${predio ? predio.nome : 'N/A'}</small></td>
                <td>${formatCurrency(t.rent_value)}</td>
                <td><span class="badge ${statusClass}">${statusLabel}</span></td>
                <td>${statusLabel !== 'PAGO' ? `<button class="btn" onclick="registerPaymentForMonth('${t.id}', ${state.viewMonth}, ${state.viewYear})">Registrar</button>` : '✅'}</td>
            </tr>
        `;
    }).join('');
}

window.changeMonth = function (delta) {
    let newMonth = state.viewMonth + delta;
    let newYear = state.viewYear;

    if (newMonth > 11) {
        newMonth = 0;
        newYear++;
    } else if (newMonth < 0) {
        newMonth = 11;
        newYear--;
    }

    state.viewMonth = newMonth;
    state.viewYear = newYear;
    renderPayments();
}

// Helper to register payment for a specific month
window.registerPaymentForMonth = async function (tenantId, month, year) {
    window.openPaymentModal(tenantId);
    // Overwrite standard submit to use selected month/year
    const originalSubmit = document.getElementById('form-confirm-payment').onsubmit;
    document.getElementById('form-confirm-payment').onsubmit = async (e) => {
        e.preventDefault();
        const method = document.getElementById('payment-method').value;
        const datetime = document.getElementById('cash-datetime').value;
        const pixFile = document.getElementById('pix-file').files[0];

        const details = {
            method: method,
            timestamp: method === 'dinheiro' ? datetime : new Date().toISOString(),
            receipt: method === 'pix' ? (pixFile ? pixFile.name : 'Arquivo anexado') : 'Pagamento em espécie'
        };

        const newPayment = {
            inquilino_id: tenantId,
            mes: month,
            ano: year,
            status: 'pago',
            details
        };

        const { error } = await db.from('pagamentos').insert([newPayment]);
        if (error) alert("Erro ao registrar pagamento: " + error.message);
        else {
            await loadData();
            closePaymentModal();
            alert('Pagamento registrado com sucesso!');
            // Restore original submit if needed (though it's usually current month)
            document.getElementById('form-confirm-payment').onsubmit = originalSubmit;
        }
    };
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



// Unidades
document.getElementById('form-unidade').onsubmit = async (e) => {
    e.preventDefault();
    const predio_id = document.getElementById('unit-select-building').value;
    const numero = document.getElementById('unit-number').value;

    const { error } = await db.from('unidades').insert([{ predio_id, numero, status: 'vago' }]);
    if (error) alert("Erro ao salvar unidade: " + error.message);
    else { await loadData(); renderPropertiesManager(); e.target.reset(); }
};

window.deleteBuilding = async function (id) {
    if (!confirm('Isso excluirá o prédio e todas as suas unidades. Continuar?')) return;
    const { error } = await db.from('predios').delete().eq('id', id);
    if (error) alert("Erro ao excluir: " + error.message);
    else await loadData();
}

window.deleteUnit = async function (id) {
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
window.updateUnitOptions = async function (buildId) {
    const unitSelect = document.getElementById('tenant-select-unit');
    if (!buildId) {
        unitSelect.innerHTML = '<option value="">Selecione o Prédio primeiro...</option>';
        unitSelect.disabled = true;
        return;
    }

    const units = state.unidades.filter(u => u.predio_id === buildId && u.status === 'vago');
    unitSelect.innerHTML = '<option value="" style="font-weight:bold; font-size:1.1rem;">Selecione a Unidade (Apto)...</option>' + units.map(u => `<option value="${u.id}" style="font-size:1.1rem; padding:5px;">Apto ${u.numero}</option>`).join('');
    unitSelect.disabled = false;
};

document.getElementById('tenant-select-building').onchange = (e) => window.updateUnitOptions(e.target.value);

// Toggle de Inquilino Novo vs Antigo
document.querySelectorAll('input[name="tenant-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const isOld = e.target.value === 'old';
        document.getElementById('old-tenant-fields').style.display = isOld ? 'grid' : 'none';

        // Se for antigo, as referências não são obrigatórias
        document.querySelectorAll('.ref-name, .ref-phone, .ref-kinship').forEach(input => {
            input.required = !isOld;
        });
    });
});

document.getElementById('form-inquilino').onsubmit = async (e) => {
    e.preventDefault();
    const editId = document.getElementById('edit-tenant-id').value;
    const unitId = document.getElementById('tenant-select-unit').value;
    const type = document.querySelector('input[name="tenant-type"]:checked').value;

    // Coletar referências
    const refNames = Array.from(document.querySelectorAll('.ref-name')).map(i => i.value);
    const refPhones = Array.from(document.querySelectorAll('.ref-phone')).map(i => i.value);
    const refKinship = Array.from(document.querySelectorAll('.ref-kinship')).map(i => i.value);

    const relatedContacts = refNames.map((name, i) => ({
        name, phone: refPhones[i], kinship: refKinship[i]
    })).filter(c => c.name || c.phone); // Remove contatos vazios

    // Clean value before saving
    const rentVal = document.getElementById('tenant-rent-value').value.replace(',', '.');
    const depositVal = document.getElementById('tenant-deposit').value.replace(',', '.');

    const entryDateVal = document.getElementById('tenant-entry-date').value;
    const lastPaymentDateVal = document.getElementById('tenant-last-payment-date').value;

    const tenantData = {
        unidade_id: unitId || null,
        nome: document.getElementById('tenant-name').value,
        cpf: document.getElementById('tenant-cpf').value.replace(/\D/g, ""),
        phone: document.getElementById('tenant-phone').value,
        related_contacts: relatedContacts,
        due_day: parseInt(document.getElementById('tenant-due-day').value),
        rent_value: parseFloat(rentVal),
        deposit: parseFloat(depositVal) || 0,
        contract_duration: parseInt(document.getElementById('tenant-contract-duration').value),
        observations: document.getElementById('tenant-observations').value,
        entry_date: type === 'old' ? (entryDateVal || lastPaymentDateVal) : new Date().toISOString().split('T')[0]
    };

    try {
        if (editId) {
            // --- MODO EDIÇÃO ---
            const oldTenant = state.inquilinos.find(t => t.id === editId);
            const { error: tError } = await db.from('inquilinos').update(tenantData).eq('id', editId);
            if (tError) throw tError;

            // Se mudou de unidade
            if (oldTenant && oldTenant.unidade_id !== unitId) {
                if (oldTenant.unidade_id) await db.from('unidades').update({ status: 'vago' }).eq('id', oldTenant.unidade_id);
                if (unitId) await db.from('unidades').update({ status: 'ocupado' }).eq('id', unitId);
            }

            alert('Inquilino atualizado com sucesso!');
            cancelEdit();
        } else {
            // --- MODO CADASTRO ---
            const { data: tenantDataArray, error: tError } = await db.from('inquilinos').insert([tenantData]).select();
            if (tError) throw tError;
            const tenant = tenantDataArray[0];

            if (unitId) await db.from('unidades').update({ status: 'ocupado' }).eq('id', unitId);

            if (type === 'old' && lastPaymentDateVal) {
                const lastPayDate = new Date(lastPaymentDateVal);
                const historicalPayment = {
                    inquilino_id: tenant.id,
                    mes: lastPayDate.getMonth(),
                    ano: lastPayDate.getFullYear(),
                    status: 'pago',
                    details: { method: 'migracao', timestamp: lastPayDate.toISOString(), receipt: 'Pagamento migrado' }
                };
                await db.from('pagamentos').insert([historicalPayment]);
            }
            alert('Inquilino cadastrado com sucesso!');
            e.target.reset();
        }

        await loadData();
        document.getElementById('old-tenant-fields').style.display = 'none';
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar inquilino: " + error.message);
    }
};

window.editTenant = async function (id) {
    const t = state.inquilinos.find(x => x.id === id);
    if (!t) return;

    // Preencher campos
    document.getElementById('edit-tenant-id').value = t.id;
    document.getElementById('tenant-name').value = t.nome;
    document.getElementById('tenant-cpf').value = t.cpf;
    document.getElementById('tenant-phone').value = t.phone || '';
    document.getElementById('tenant-rent-value').value = t.rent_value;
    document.getElementById('tenant-contract-duration').value = t.contract_duration || '';
    document.getElementById('tenant-deposit').value = t.deposit || '';
    document.getElementById('tenant-due-day').value = t.due_day;
    document.getElementById('tenant-observations').value = t.observations || '';

    // Lógica de Prédio/Unidade
    const unit = state.unidades.find(u => u.id === t.unidade_id);
    if (unit) {
        document.getElementById('tenant-select-building').value = unit.predio_id;
        await window.updateUnitOptions(unit.predio_id);
        document.getElementById('tenant-select-unit').value = t.unidade_id;
    }

    // Mudar UI do Botão
    const titleEl = document.getElementById('tenant-form-title');
    if (titleEl) titleEl.innerText = 'Editar Inquilino';

    document.getElementById('tenant-btn-submit').innerText = 'Salvar Alterações';
    document.getElementById('tenant-btn-cancel').style.display = 'block';

    // Scroll para o formulário
    document.getElementById('inquilinos').scrollIntoView({ behavior: 'smooth' });
}

window.cancelEdit = function () {
    document.getElementById('form-inquilino').reset();
    document.getElementById('edit-tenant-id').value = '';
    const titleEl = document.getElementById('tenant-form-title');
    if (titleEl) titleEl.innerText = 'Cadastro de Inquilino';
    document.getElementById('tenant-btn-submit').innerText = 'Cadastrar Inquilino';
    document.getElementById('tenant-btn-cancel').style.display = 'none';
    document.getElementById('old-tenant-fields').style.display = 'none';
}
window.deleteTenant = async function (id) {
    const t = state.inquilinos.find(ten => ten.id === id);
    if (!t) return;

    const confirmName = prompt(`⚠️ ATENÇÃO: Para DESOCUPAR o imóvel e excluir o inquilino, digite o nome completo abaixo:\n\n👉 [ ${t.nome} ]`);

    if (confirmName === t.nome) {
        try {
            if (t.unidade_id) {
                await supabase.from('unidades').update({ status: 'vago' }).eq('id', t.unidade_id);
            }
            const { error: delError } = await supabase.from('inquilinos').delete().eq('id', id);
            if (delError) throw delError;

            await loadData();
            alert('Imóvel desocupado e inquilino removido com sucesso.');
        } catch (error) {
            console.error("Erro ao deletar:", error);
            alert("Erro ao remover inquilino: " + error.message);
        }
    } else {
        alert('Confirmação incorreta. Ação cancelada.');
    }
}

// Modal Pagamento Logic
window.openPaymentModal = function (tenantId) {
    const tenant = state.inquilinos.find(t => t.id === tenantId);
    if (!tenant) return;

    document.getElementById('modal-tenant-id').value = tenantId;
    document.getElementById('modal-tenant-name').innerText = `Pagamento: ${tenant.nome}`;
    document.getElementById('payment-modal').style.display = 'flex';
}

window.closePaymentModal = function () {
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
