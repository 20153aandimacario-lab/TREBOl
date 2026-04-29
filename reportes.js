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
function guardarVentas(ventas) { localStorage.setItem('historialVentas', JSON.stringify(ventas)); }
function obtenerInventario() { return JSON.parse(localStorage.getItem('inventario') || '[]'); }
function obtenerUnidadesMedida() { return JSON.parse(localStorage.getItem('unidadesMedida') || '[{"nombre":"Unidad","equivalencia":1},{"nombre":"Caja","equivalencia":12}]'); }
function obtenerHistorialMovimientos() { return JSON.parse(localStorage.getItem('historialMovimientos') || '[]'); }

// ==================== CÁLCULOS DE COSTO CON PRECIOS ACTUALES ====================
function obtenerEquivalencia(producto) {
    const unidades = obtenerUnidadesMedida();
    const u = unidades.find(u => u.nombre === producto.unidadMedida);
    return u ? u.equivalencia : 1;
}

function obtenerPrecioCostoCaja(producto) {
    if (producto.precioCompra && producto.precioCompra > 0) return producto.precioCompra;
    if (producto.precioMayorista && producto.precioMayorista > 0) return producto.precioMayorista;
    if (producto.precioUnitarioCF && producto.precioUnitarioCF > 0) return producto.precioUnitarioCF;
    return 0;
}

function calcularCostoProducto(producto, cajas, unidades) {
    const equivalencia = obtenerEquivalencia(producto);
    let costoCaja = obtenerPrecioCostoCaja(producto);
    let precioUnitario = 0;
    
    if (equivalencia === 1) {
        // Unidad simple: el precio de caja y unidad es el mismo
        precioUnitario = costoCaja;
    } else {
        // Para unidades con equivalencia > 1 (caja, pack, etc.)
        if (costoCaja > 0) {
            precioUnitario = costoCaja / equivalencia;
        } else {
            // Fallback
            costoCaja = 0;
            precioUnitario = 0;
        }
    }
    const costo = (cajas * costoCaja) + (unidades * precioUnitario);
    return { totalUnidades: (cajas * equivalencia) + unidades, costo, costoCaja, precioUnitario };
}

// ==================== LIMPIAR HISTORIAL DE VENTAS ====================
function limpiarHistorialVentas() {
    if (confirm('⚠️ ¿Eliminar TODO el historial de ventas? Esta acción no se puede deshacer.')) {
        guardarVentas([]);
        alert('✅ Historial de ventas eliminado.');
        cargarVentas();
    }
}

// ==================== PESTAÑA 1: INVENTARIO POR FACTURA (usando precios actuales) ====================
function cargarInventarioPorFactura() {
    const inventario = obtenerInventario();
    // Mapa de stock actual en unidades
    const stockActual = new Map();
    for (const prod of inventario) {
        const equivalencia = obtenerEquivalencia(prod);
        const stockUnds = (prod.stockCajas || 0) * equivalencia + (prod.stockUnidades || 0);
        if (stockUnds > 0) {
            stockActual.set(prod.id, { 
                nombre: prod.nombre, 
                unidadMedida: prod.unidadMedida, 
                unidades: stockUnds,
                precioCompra: prod.precioCompra,
                precioMayorista: prod.precioMayorista,
                precioUnitarioCF: prod.precioUnitarioCF,
                equivalencia: equivalencia
            });
        }
    }
    
    if (stockActual.size === 0) {
        document.getElementById('inventarioFacturaBody').innerHTML = '<tr><td colspan="7">No hay stock actual</td></tr>';
        document.getElementById('inventarioFacturaFoot').innerHTML = '';
        return;
    }
    
    // Obtener todas las compras con factura ordenadas por fecha (las más antiguas primero)
    let movimientos = obtenerHistorialMovimientos();
    let compras = movimientos
        .filter(m => m.tipo === 'compra_factura' && m.factura)
        .map(m => {
            const prod = inventario.find(p => p.nombre === m.producto);
            return {
                factura: m.factura,
                fecha: new Date(m.fecha),
                productoId: prod ? prod.id : null,
                productoNombre: m.producto,
                cajas: m.cajas || 0,
                unidades: m.unidades || 0,
            };
        })
        .filter(m => m.productoId !== null)
        .sort((a,b) => a.fecha - b.fecha);
    
    // FIFO: asignar stock disponible a las compras más antiguas
    const asignaciones = [];
    const copiaStock = new Map();
    for (let [id, info] of stockActual.entries()) {
        copiaStock.set(id, { ...info, unidades: info.unidades });
    }
    
    for (const compra of compras) {
        const prodId = compra.productoId;
        if (!copiaStock.has(prodId)) continue;
        const prodInfo = copiaStock.get(prodId);
        if (prodInfo.unidades <= 0) continue;
        
        const equivalencia = prodInfo.equivalencia;
        const unidadesCompradas = compra.cajas * equivalencia + compra.unidades;
        let unidadesAsignar = Math.min(prodInfo.unidades, unidadesCompradas);
        if (unidadesAsignar <= 0) continue;
        
        let cajasAsignar = Math.floor(unidadesAsignar / equivalencia);
        let unidadesSueltas = unidadesAsignar % equivalencia;
        
        // Crear objeto producto temporal para calcular costo con precios actuales
        const productoActual = {
            precioCompra: prodInfo.precioCompra,
            precioMayorista: prodInfo.precioMayorista,
            precioUnitarioCF: prodInfo.precioUnitarioCF,
            unidadMedida: prodInfo.unidadMedida
        };
        const { costoCaja, precioUnitario, costo } = calcularCostoProducto(productoActual, cajasAsignar, unidadesSueltas);
        
        asignaciones.push({
            factura: compra.factura,
            productoNombre: compra.productoNombre,
            cajas: cajasAsignar,
            unidades: unidadesSueltas,
            costoCaja,
            precioUnitario,
            costo
        });
        prodInfo.unidades -= unidadesAsignar;
    }
    
    // Agrupar por factura
    const facturasMap = new Map();
    for (const item of asignaciones) {
        if (!facturasMap.has(item.factura)) {
            facturasMap.set(item.factura, { factura: item.factura, productos: [], totalFactura: 0 });
        }
        const fact = facturasMap.get(item.factura);
        fact.productos.push(item);
        fact.totalFactura += item.costo;
    }
    
    const facturas = Array.from(facturasMap.values());
    const tbody = document.getElementById('inventarioFacturaBody');
    const tfoot = document.getElementById('inventarioFacturaFoot');
    tbody.innerHTML = '';
    
    if (facturas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No hay asignaciones (stock actual no vinculable a facturas históricas)</td></tr>';
        tfoot.innerHTML = '';
        return;
    }
    
    let granTotal = 0;
    for (const fact of facturas) {
        for (const prod of fact.productos) {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = fact.factura;
            row.insertCell(1).textContent = prod.productoNombre;
            row.insertCell(2).textContent = prod.cajas;
            row.insertCell(3).textContent = prod.unidades;
            row.insertCell(4).textContent = `Q${prod.costoCaja.toFixed(2)}`;
            row.insertCell(5).textContent = `Q${prod.precioUnitario.toFixed(2)}`;
            row.insertCell(6).textContent = `Q${prod.costo.toFixed(2)}`;
        }
        const subtotalRow = tbody.insertRow();
        subtotalRow.style.backgroundColor = '#f0f0f0';
        subtotalRow.insertCell(0).innerHTML = `<strong>Subtotal ${fact.factura}</strong>`;
        subtotalRow.insertCell(1).innerHTML = '';
        subtotalRow.insertCell(2).innerHTML = '';
        subtotalRow.insertCell(3).innerHTML = '';
        subtotalRow.insertCell(4).innerHTML = '';
        subtotalRow.insertCell(5).innerHTML = '';
        subtotalRow.insertCell(6).innerHTML = `<strong>Q${fact.totalFactura.toFixed(2)}</strong>`;
        granTotal += fact.totalFactura;
    }
    
    tfoot.innerHTML = `<tr style="background:#eef2ff"><td colspan="6"><strong>VALOR TOTAL DEL INVENTARIO ACTUAL</strong></td><td><strong>Q${granTotal.toFixed(2)}</strong></td></tr>`;
}

// ==================== PESTAÑA 2: INVENTARIO TOTAL ====================
function cargarInventario() {
    const inventario = obtenerInventario();
    const unidades = obtenerUnidadesMedida();
    const tbody = document.getElementById('inventarioBody');
    const tfoot = document.getElementById('inventarioFoot');
    tbody.innerHTML = '';
    
    if (inventario.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">No hay productos en el inventario</td></tr>';
        tfoot.innerHTML = '';
        return;
    }
    
    let valorTotal = 0;
    for (const prod of inventario) {
        const unidad = unidades.find(u => u.nombre === prod.unidadMedida) || { equivalencia: 1 };
        const stockCajas = prod.stockCajas || 0;
        const stockUnidades = prod.stockUnidades || 0;
        const stockTotalUnds = (stockCajas * unidad.equivalencia) + stockUnidades;
        const costoCaja = obtenerPrecioCostoCaja(prod);
        let precioUnidad = 0;
        
        if (unidad.equivalencia === 1) {
            precioUnidad = costoCaja;
        } else {
            precioUnidad = costoCaja / unidad.equivalencia;
        }
        
        const valor = (stockCajas * costoCaja) + (stockUnidades * precioUnidad);
        valorTotal += valor;
        
        const row = tbody.insertRow();
        row.insertCell(0).textContent = prod.id;
        row.insertCell(1).textContent = prod.nombre;
        row.insertCell(2).textContent = prod.categoria;
        row.insertCell(3).textContent = prod.unidadMedida;
        row.insertCell(4).textContent = stockCajas;
        row.insertCell(5).textContent = stockUnidades;
        row.insertCell(6).textContent = stockTotalUnds;
        row.insertCell(7).textContent = `Q${valor.toFixed(2)}`;
    }
    tfoot.innerHTML = `<tr><td colspan="7"><strong>VALOR TOTAL DEL INVENTARIO</strong></td><td><strong>Q${valorTotal.toFixed(2)}</strong></td></tr>`;
}

// ==================== PESTAÑA 3: VENTAS ====================
function cargarVentas() {
    const ventas = obtenerVentas();
    const tbody = document.getElementById('ventasBody');
    const tfoot = document.getElementById('ventasFoot');
    tbody.innerHTML = '';
    
    if (ventas.length === 0) {
        tbody.innerHTML = '</tr><td colspan="6" style="text-align:center">No hay ventas registradas</td></tr>';
        tfoot.innerHTML = '';
        return;
    }
    
    let totalGeneral = 0;
    for (const v of ventas) {
        totalGeneral += v.total;
        const row = tbody.insertRow();
        row.insertCell(0).textContent = v.id;
        row.insertCell(1).textContent = new Date(v.fecha).toLocaleString();
        row.insertCell(2).textContent = v.vendedor;
        row.insertCell(3).textContent = v.cliente || 'Consumidor final';
        row.insertCell(4).textContent = `Q${v.total.toFixed(2)}`;
        row.insertCell(5).textContent = v.items.map(i => `${i.cantidad} ${i.unidad} ${i.nombre}`).join(', ');
    }
    tfoot.innerHTML = `<tr><td colspan="4"><strong>TOTAL VENDIDO</strong></td><td colspan="2"><strong>Q${totalGeneral.toFixed(2)}</strong></td></tr>`;
}

// ==================== EXPORTACIONES ====================
function exportarTablaToCSV(tableId, fileName) {
    const table = document.getElementById(tableId);
    if (!table) return;
    let csv = "";
    for (const row of table.querySelectorAll("tr")) {
        const cells = row.querySelectorAll("th, td");
        const rowData = [];
        for (const cell of cells) rowData.push(cell.innerText.trim());
        csv += rowData.join(";") + "\n";
    }
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}_${new Date().toISOString().slice(0,19)}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href);
}

function exportarTablaToPDF(tabName) {
    let html = '';
    if (tabName === 'inventario') {
        html = generarHTMLDesdeTabla(document.getElementById('tablaInventario'), 'Inventario Total');
    } else if (tabName === 'ventas') {
        html = generarHTMLDesdeTabla(document.getElementById('tablaVentas'), 'Detalle de Ventas');
    }
    if (!html) return;
    const win = window.open('', '_blank');
    win.document.write(html); win.document.close(); win.print(); win.close();
}

function generarHTMLDesdeTabla(table, titulo) {
    if (!table || table.querySelectorAll('tbody tr').length === 0) { 
        alert(`No hay datos en ${titulo}`); 
        return null; 
    }
    return `<html><head><title>${titulo}</title><style>body{font-family:Arial;margin:20px;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #000;padding:8px;}th{background:#667eea;color:white;}</style></head><body><h1>${titulo}</h1>${table.outerHTML}<p>Generado el ${new Date().toLocaleString()}</p></body></html>`;
}

function exportarInventarioFacturaToCSV() {
    const table = document.getElementById('tablaInventarioFactura');
    if (!table) return;
    let csv = "";
    for (const row of table.querySelectorAll("tr")) {
        const cells = row.querySelectorAll("th, td");
        const rowData = [];
        for (const cell of cells) rowData.push(cell.innerText.trim());
        csv += rowData.join(";") + "\n";
    }
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `inventario_por_factura_${new Date().toISOString().slice(0,19)}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href);
}

function exportarInventarioFacturaToPDF() {
    const table = document.getElementById('tablaInventarioFactura');
    if (!table || table.querySelectorAll('tbody tr').length === 0) { 
        alert('No hay datos para exportar'); 
        return; 
    }
    let html = `<html><head><title>Inventario por Factura</title><style>body{font-family:Arial;margin:20px;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #000;padding:8px;}th{background:#667eea;color:white;}</style></head><body><h1>Inventario Actual Desglosado por Factura</h1>${table.outerHTML}<p>Generado el ${new Date().toLocaleString()}</p></body></html>`;
    const win = window.open('', '_blank');
    win.document.write(html); win.document.close(); win.print(); win.close();
}

// ==================== ACTUALIZAR TODOS LOS REPORTES ====================
function generarReportes() {
    cargarInventarioPorFactura();
    cargarInventario();
    cargarVentas();
    alert('✅ Reportes actualizados con los datos más recientes.');
}

// ==================== PESTAÑAS ====================
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            contents.forEach(c => c.classList.remove('active'));
            document.getElementById(`tab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`).classList.add('active');
            if (tabId === 'inventarioFactura') cargarInventarioPorFactura();
            else if (tabId === 'inventario') cargarInventario();
            else if (tabId === 'ventas') cargarVentas();
        });
    });
}

// ==================== INICIALIZAR ====================
document.addEventListener('DOMContentLoaded', () => {
    if (!verificarAcceso()) return;
    initTabs();
    generarReportes();
    document.getElementById('btnActualizar').addEventListener('click', generarReportes);
    document.getElementById('btnCerrar').addEventListener('click', () => window.close());
    const btnLimpiar = document.getElementById('btnLimpiarVentas');
    if (btnLimpiar) btnLimpiar.addEventListener('click', limpiarHistorialVentas);
});

// Exportar funciones globales
window.exportarTablaToCSV = exportarTablaToCSV;
window.exportarTablaToPDF = exportarTablaToPDF;
window.exportarInventarioFacturaToCSV = exportarInventarioFacturaToCSV;
window.exportarInventarioFacturaToPDF = exportarInventarioFacturaToPDF;