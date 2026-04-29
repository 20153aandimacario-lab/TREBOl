// ==================== VERIFICAR ACCESO ====================
function verificarAcceso() {
    const session = localStorage.getItem('sessionActual');
    if (!session) {
        alert('No hay sesión activa');
        window.location.href = '../../index.html';
        return false;
    }
    const sessionData = JSON.parse(session);
    if (sessionData.rol !== 'admin') {
        alert('Acceso denegado. Solo administradores.');
        window.location.href = '../../index.html';
        return false;
    }
    return true;
}

// ==================== OBTENER DATOS ====================
function obtenerVentas() { return JSON.parse(localStorage.getItem('historialVentas') || '[]'); }
function obtenerInventario() { return JSON.parse(localStorage.getItem('inventario') || '[]'); }
function obtenerUnidadesMedida() { return JSON.parse(localStorage.getItem('unidadesMedida') || '[{"nombre":"Unidad","equivalencia":1}]'); }
function obtenerPerdidas() { return JSON.parse(localStorage.getItem('productosDanados') || '[]'); }
function obtenerVendedores() { return JSON.parse(localStorage.getItem('vendedores') || '[]'); }

// ==================== UTILIDADES ====================
function calcularStockTotalUnidades(producto) {
    const unidades = obtenerUnidadesMedida();
    const unidad = unidades.find(u => u.nombre === producto.unidadMedida) || { equivalencia: 1 };
    const stockCajas = producto.stockCajas || 0;
    const stockUnidades = producto.stockUnidades || 0;
    return (stockCajas * unidad.equivalencia) + stockUnidades;
}

function formatearFecha(fechaIso) { return new Date(fechaIso).toLocaleDateString(); }

// Obtener ventas filtradas por fechas y vendedor
function filtrarVentas(ventas, desde, hasta, vendedor) {
    let filtradas = [...ventas];
    if (desde) filtradas = filtradas.filter(v => new Date(v.fecha) >= new Date(desde));
    if (hasta) filtradas = filtradas.filter(v => new Date(v.fecha) <= new Date(hasta));
    if (vendedor) filtradas = filtradas.filter(v => v.vendedor === vendedor);
    return filtradas;
}

// ==================== ACTUALIZAR DASHBOARD ====================
let chartVentas = null;
let chartTop = null;

async function actualizarDashboard() {
    const periodo = document.getElementById('periodo').value;
    let desde = null, hasta = null;
    const hoy = new Date();
    if (periodo === 'hoy') {
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);
    } else if (periodo === 'semana') {
        desde = new Date(hoy);
        desde.setDate(hoy.getDate() - 7);
        desde.setHours(0,0,0,0);
        hasta = new Date(hoy);
        hasta.setHours(23,59,59,999);
    } else if (periodo === 'mes') {
        desde = new Date(hoy);
        desde.setDate(hoy.getDate() - 30);
        desde.setHours(0,0,0,0);
        hasta = new Date(hoy);
        hasta.setHours(23,59,59,999);
    } else if (periodo === 'personalizado') {
        desde = document.getElementById('fechaDesde').value;
        hasta = document.getElementById('fechaHasta').value;
        if (!desde || !hasta) {
            alert('Selecciona ambas fechas');
            return;
        }
        desde = new Date(desde); desde.setHours(0,0,0,0);
        hasta = new Date(hasta); hasta.setHours(23,59,59,999);
    }
    const vendedor = document.getElementById('filtroVendedor').value;
    const ventas = obtenerVentas();
    const ventasFiltradas = filtrarVentas(ventas, desde, hasta, vendedor);
    
    // KPIs
    const totalVentas = ventasFiltradas.reduce((s, v) => s + v.total, 0);
    const numVentas = ventasFiltradas.length;
    const productosVendidos = ventasFiltradas.reduce((sum, v) => sum + v.items.reduce((s, i) => s + i.cantidad, 0), 0);
    document.getElementById('totalVentasPeriodo').innerText = `Q${totalVentas.toFixed(2)}`;
    document.getElementById('numVentasPeriodo').innerText = numVentas;
    document.getElementById('productosVendidosPeriodo').innerText = productosVendidos;

    // Stock bajo
    const inventario = obtenerInventario();
    const stockBajo = inventario.filter(p => calcularStockTotalUnidades(p) < 5);
    document.getElementById('stockBajoCount').innerText = stockBajo.length;
    // Valor inventario
    function obtenerPrecioCostoCaja(p) { return p.precioCompra || p.precioMayorista || p.precioUnitarioCF || 0; }
    const valorInventario = inventario.reduce((sum, p) => {
        const unidad = obtenerUnidadesMedida().find(u => u.nombre === p.unidadMedida) || { equivalencia: 1 };
        const stockUnds = calcularStockTotalUnidades(p);
        const costoCaja = obtenerPrecioCostoCaja(p);
        const precioUnd = p.precioUnitarioCF && p.precioUnitarioCF > 0 ? p.precioUnitarioCF : (costoCaja / unidad.equivalencia);
        const costo = Math.floor(stockUnds / unidad.equivalencia) * costoCaja + (stockUnds % unidad.equivalencia) * precioUnd;
        return sum + (isNaN(costo) ? 0 : costo);
    }, 0);
    document.getElementById('valorInventarioTotal').innerText = `Q${valorInventario.toFixed(2)}`;

    // Pérdidas en el período
    const perdidas = obtenerPerdidas();
    const perdidasFiltradas = perdidas.filter(p => {
        const fechaP = new Date(p.fecha);
        return (!desde || fechaP >= desde) && (!hasta || fechaP <= hasta);
    });
    const totalPerdidasValor = perdidasFiltradas.reduce((sum, p) => sum + (p.total || 0) * 5, 0); // placeholder valor
    document.getElementById('perdidasPeriodo').innerText = `Q${totalPerdidasValor.toFixed(2)}`;

    // Gráfico ventas diarias
    const ventasPorDia = {};
    ventasFiltradas.forEach(v => {
        const dia = new Date(v.fecha).toISOString().slice(0,10);
        ventasPorDia[dia] = (ventasPorDia[dia] || 0) + v.total;
    });
    const etiquetas = Object.keys(ventasPorDia).sort();
    const datos = etiquetas.map(d => ventasPorDia[d]);
    const ctx = document.getElementById('ventasDiariasChart').getContext('2d');
    if (chartVentas) chartVentas.destroy();
    chartVentas = new Chart(ctx, {
        type: 'bar',
        data: { labels: etiquetas, datasets: [{ label: 'Ventas (Q)', data: datos, backgroundColor: '#667eea' }] },
        options: { responsive: true, maintainAspectRatio: true, scales: { y: { beginAtZero: true, ticks: { callback: val => 'Q'+val } } } }
    });

    // Top 5 productos más vendidos
    const prodMap = {};
    ventasFiltradas.forEach(v => {
        v.items.forEach(item => {
            if (!prodMap[item.nombre]) prodMap[item.nombre] = 0;
            prodMap[item.nombre] += item.cantidad;
        });
    });
    const top = Object.entries(prodMap).sort((a,b) => b[1] - a[1]).slice(0,5);
    const ctxTop = document.getElementById('topProductosChart').getContext('2d');
    if (chartTop) chartTop.destroy();
    chartTop = new Chart(ctxTop, {
        type: 'bar',
        data: { labels: top.map(t => t[0]), datasets: [{ label: 'Cantidad vendida', data: top.map(t => t[1]), backgroundColor: '#ff9800' }] },
        options: { responsive: true, maintainAspectRatio: true, scales: { y: { beginAtZero: true } } }
    });

    // Tabla stock bajo
    const stockBody = document.getElementById('stockBajoBody');
    stockBody.innerHTML = '';
    stockBajo.forEach(p => {
        const row = stockBody.insertRow();
        row.insertCell(0).textContent = p.nombre;
        row.insertCell(1).textContent = calcularStockTotalUnidades(p);
        row.insertCell(2).textContent = p.id;
    });
    // Tabla pérdidas recientes (últimas 10)
    const perdidasBody = document.getElementById('perdidasBody');
    perdidasBody.innerHTML = '';
    perdidas.slice(0,10).forEach(p => {
        const row = perdidasBody.insertRow();
        row.insertCell(0).textContent = p.producto;
        row.insertCell(1).textContent = p.total || 0;
        row.insertCell(2).textContent = p.tipo || 'Dañado';
        row.insertCell(3).textContent = new Date(p.fecha).toLocaleString();
    });
    // Tabla ventas por vendedor
    const vendedoresMap = {};
    ventasFiltradas.forEach(v => {
        if (!vendedoresMap[v.vendedor]) vendedoresMap[v.vendedor] = { count: 0, total: 0 };
        vendedoresMap[v.vendedor].count++;
        vendedoresMap[v.vendedor].total += v.total;
    });
    const vendedoresBody = document.getElementById('vendedoresBody');
    vendedoresBody.innerHTML = '';
    for (const [v, datos] of Object.entries(vendedoresMap)) {
        const row = vendedoresBody.insertRow();
        row.insertCell(0).textContent = v;
        row.insertCell(1).textContent = datos.count;
        row.insertCell(2).textContent = `Q${datos.total.toFixed(2)}`;
    }
}

// ==================== POBLAR FILTROS ====================
function cargarFiltros() {
    const vendedores = obtenerVendedores();
    const select = document.getElementById('filtroVendedor');
    select.innerHTML = '<option value="">Todos</option>';
    vendedores.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.username;
        opt.textContent = v.username;
        select.appendChild(opt);
    });
}

function mostrarOcultarFechas() {
    const periodo = document.getElementById('periodo').value;
    const divFechas = document.getElementById('fechasPersonalizado');
    divFechas.style.display = periodo === 'personalizado' ? 'flex' : 'none';
}

// ==================== INICIALIZAR ====================
document.addEventListener('DOMContentLoaded', () => {
    if (!verificarAcceso()) return;
    cargarFiltros();
    mostrarOcultarFechas();
    actualizarDashboard();
    document.getElementById('periodo').addEventListener('change', mostrarOcultarFechas);
    document.getElementById('btnActualizar').addEventListener('click', actualizarDashboard);
    document.getElementById('btnCerrar').addEventListener('click', () => window.close());
});