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
function obtenerInventario() { return JSON.parse(localStorage.getItem('inventario') || '[]'); }
function guardarInventario(inventario) { localStorage.setItem('inventario', JSON.stringify(inventario)); }
function obtenerPerdidas() { return JSON.parse(localStorage.getItem('productosDanados') || '[]'); }
function guardarPerdidas(perdidas) { localStorage.setItem('productosDanados', JSON.stringify(perdidas)); }
function obtenerUnidadesMedida() { return JSON.parse(localStorage.getItem('unidadesMedida') || '[{"nombre":"Unidad","equivalencia":1}]'); }

// ==================== UTILIDADES ====================
function obtenerEquivalencia(producto) {
    const u = obtenerUnidadesMedida().find(u => u.nombre === producto.unidadMedida);
    return u ? u.equivalencia : 1;
}
function calcularStockTotalUnidades(producto) {
    const eq = obtenerEquivalencia(producto);
    return (producto.stockCajas || 0) * eq + (producto.stockUnidades || 0);
}
function obtenerPrecioCostoUnitario(producto) {
    if (producto.precioUnitarioCF && producto.precioUnitarioCF > 0) return producto.precioUnitarioCF;
    if (producto.precioCompra && producto.precioCompra > 0) return producto.precioCompra / obtenerEquivalencia(producto);
    if (producto.precioMayorista && producto.precioMayorista > 0) return producto.precioMayorista / obtenerEquivalencia(producto);
    return 0;
}
function calcularValorPerdida(producto, cajas, unidades) {
    const eq = obtenerEquivalencia(producto);
    let precioUnd = obtenerPrecioCostoUnitario(producto);
    if (precioUnd === 0) return 0;
    let costoCaja = precioUnd * eq;
    return (cajas * costoCaja) + (unidades * precioUnd);
}
function actualizarValorPerdida() {
    const productoId = document.getElementById('productoId').value;
    if (!productoId) return;
    const producto = obtenerInventario().find(p => p.id === productoId);
    if (!producto) return;
    const cajas = parseInt(document.getElementById('cajasPerdidas').value) || 0;
    const unidades = parseInt(document.getElementById('unidadesPerdidas').value) || 0;
    const valor = calcularValorPerdida(producto, cajas, unidades);
    document.getElementById('valorPerdida').value = valor.toFixed(2);
}

// ==================== BUSCAR PRODUCTO POR ESCÁNER ====================
function buscarProductoPorScanner() {
    const input = document.getElementById('scannerProducto');
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const termino = input.value.trim();
            if (!termino) return;
            const inventario = obtenerInventario();
            const producto = inventario.find(p => p.id === termino || p.nombre.toLowerCase().includes(termino.toLowerCase()));
            if (!producto) {
                alert('❌ Producto no encontrado');
                input.value = '';
                input.focus();
                return;
            }
            document.getElementById('productoId').value = producto.id;
            document.getElementById('productoNombre').value = producto.nombre;
            document.getElementById('productoCodigo').value = producto.id;
            const eq = obtenerEquivalencia(producto);
            const stockUnds = calcularStockTotalUnidades(producto);
            document.getElementById('stockActual').value = `${stockUnds} unidades (${producto.stockCajas || 0} ${producto.unidadMedida} + ${producto.stockUnidades || 0} unds)`;
            document.getElementById('unidadMedida').value = `${producto.unidadMedida} (1 ${producto.unidadMedida} = ${eq} unds)`;
            document.getElementById('btnRegistrar').disabled = false;
            document.getElementById('cajasPerdidas').value = 0;
            document.getElementById('unidadesPerdidas').value = 0;
            actualizarValorPerdida();
            input.value = '';
            input.blur();
            document.getElementById('cajasPerdidas').focus();
        }
    });
}
function limpiarProductoSeleccionado() {
    document.getElementById('productoId').value = '';
    document.getElementById('productoNombre').value = '';
    document.getElementById('productoCodigo').value = '';
    document.getElementById('stockActual').value = '';
    document.getElementById('unidadMedida').value = '';
    document.getElementById('cajasPerdidas').value = 0;
    document.getElementById('unidadesPerdidas').value = 0;
    document.getElementById('valorPerdida').value = '';
    document.getElementById('btnRegistrar').disabled = true;
    document.getElementById('scannerProducto').value = '';
    document.getElementById('scannerProducto').focus();
}

// ==================== REGISTRAR PÉRDIDA ====================
function registrarPerdida(e) {
    e.preventDefault();
    const productoId = document.getElementById('productoId').value;
    if (!productoId) { alert('Seleccione un producto primero'); return; }
    let inventario = obtenerInventario();
    const producto = inventario.find(p => p.id === productoId);
    if (!producto) { alert('Producto no encontrado'); return; }
    const cajas = parseInt(document.getElementById('cajasPerdidas').value) || 0;
    const unidades = parseInt(document.getElementById('unidadesPerdidas').value) || 0;
    const tipo = document.getElementById('tipoPerdida').value;
    const observaciones = document.getElementById('observaciones').value.trim();
    if (cajas === 0 && unidades === 0) { alert('Ingrese al menos una caja o unidad'); return; }
    const eq = obtenerEquivalencia(producto);
    const totalUnidades = (cajas * eq) + unidades;
    const stockActualUnds = calcularStockTotalUnidades(producto);
    if (totalUnidades > stockActualUnds) { alert(`Stock insuficiente. Solo hay ${stockActualUnds} unidades.`); return; }
    const valor = calcularValorPerdida(producto, cajas, unidades);

    // Actualizar stock
    let unidadesRestantes = totalUnidades;
    let unidsADeducir = Math.min(producto.stockUnidades, unidadesRestantes);
    producto.stockUnidades -= unidsADeducir;
    unidadesRestantes -= unidsADeducir;
    if (unidadesRestantes > 0) {
        let cajasADeducir = Math.ceil(unidadesRestantes / eq);
        producto.stockCajas -= cajasADeducir;
        let nuevasUnidades = (producto.stockCajas * eq) + producto.stockUnidades - (cajasADeducir * eq - unidadesRestantes);
        if (nuevasUnidades < 0) nuevasUnidades = 0;
        producto.stockCajas = Math.floor(nuevasUnidades / eq);
        producto.stockUnidades = nuevasUnidades % eq;
    }
    guardarInventario(inventario);

    const nuevaPerdida = {
        id: Date.now(), producto: producto.nombre, productoId: producto.id, cajas, unidades,
        total: totalUnidades, tipo, valor, observaciones, fecha: new Date().toISOString()
    };
    let perdidas = obtenerPerdidas();
    perdidas.unshift(nuevaPerdida);
    guardarPerdidas(perdidas);

    alert(`Pérdida registrada: ${totalUnidades} unidades. Valor: Q${valor.toFixed(2)}`);
    limpiarProductoSeleccionado();
    cargarHistorial();
}

// ==================== ELIMINAR UNA PÉRDIDA ====================
function eliminarPerdida(id) {
    if (!confirm('¿Eliminar este registro? No se restaurará el stock automáticamente.')) return;
    let perdidas = obtenerPerdidas().filter(p => p.id !== id);
    guardarPerdidas(perdidas);
    cargarHistorial();
}

// ==================== LIMPIAR TODA LA TABLA ====================
function limpiarTodaLaTabla() {
    if (confirm('⚠️ ¿Está seguro de eliminar TODOS los registros de pérdidas? Esta acción no se puede deshacer.')) {
        guardarPerdidas([]);
        cargarHistorial();
        alert('✅ Historial de pérdidas eliminado completamente.');
    }
}

// ==================== CARGAR HISTORIAL (sin filtros) ====================
function cargarHistorial() {
    let perdidas = obtenerPerdidas();
    const tbody = document.getElementById('perdidasBody');
    tbody.innerHTML = '';
    perdidas.forEach(p => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = new Date(p.fecha).toLocaleString();
        row.insertCell(1).textContent = p.producto;
        row.insertCell(2).textContent = p.cajas;
        row.insertCell(3).textContent = p.unidades;
        row.insertCell(4).textContent = p.total;
        row.insertCell(5).textContent = p.tipo;
        row.insertCell(6).textContent = `Q${(p.valor || 0).toFixed(2)}`;
        row.insertCell(7).textContent = p.observaciones || '—';
        const btnEliminar = document.createElement('button');
        btnEliminar.textContent = '🗑️';
        btnEliminar.className = 'btn-eliminar';
        btnEliminar.onclick = () => eliminarPerdida(p.id);
        row.insertCell(8).appendChild(btnEliminar);
    });
    // Actualizar resumen
    const totalUnidades = perdidas.reduce((s,p) => s + (p.total || 0), 0);
    const totalValor = perdidas.reduce((s,p) => s + (p.valor || 0), 0);
    document.getElementById('totalUnidadesPerdidas').innerText = totalUnidades;
    document.getElementById('totalValorPerdido').innerText = `Q${totalValor.toFixed(2)}`;
    document.getElementById('totalRegistros').innerText = perdidas.length;
}

// ==================== EXPORTAR A CSV ====================
function exportarCSV() {
    const perdidas = obtenerPerdidas();
    if (perdidas.length === 0) { alert('No hay datos para exportar'); return; }
    let csv = "Fecha;Producto;Cajas;Unidades;Total Unds;Tipo;Valor (Q);Observaciones\n";
    perdidas.forEach(p => {
        csv += `${new Date(p.fecha).toLocaleString()};${p.producto};${p.cajas};${p.unidades};${p.total};${p.tipo};${(p.valor || 0).toFixed(2)};${p.observaciones || ''}\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `perdidas_${new Date().toISOString().slice(0,19)}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href);
}

// ==================== EXPORTAR A PDF ====================
function exportarPDF() {
    const perdidas = obtenerPerdidas();
    if (perdidas.length === 0) { alert('No hay datos para exportar'); return; }
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte de Pérdidas</title><style>body{font-family:Arial;margin:20px;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #000;padding:8px;}th{background:#667eea;color:white;}</style></head><body><h1>Reporte de Daños y Pérdidas</h1><table><thead><tr><th>Fecha</th><th>Producto</th><th>Cajas</th><th>Unidades</th><th>Total Unds</th><th>Tipo</th><th>Valor (Q)</th><th>Observaciones</th></tr></thead><tbody>`;
    perdidas.forEach(p => {
        html += `<tr><td>${new Date(p.fecha).toLocaleString()}</td><td>${p.producto}</td><td>${p.cajas}</td><td>${p.unidades}</td><td>${p.total}</td><td>${p.tipo}</td><td>${(p.valor || 0).toFixed(2)}</td><td>${p.observaciones || ''}</td></tr>`;
    });
    html += `</tbody></table><p>Generado el ${new Date().toLocaleString()}</p></body></html>`;
    const ventana = window.open('', '_blank');
    ventana.document.write(html);
    ventana.document.close();
    ventana.print();
    ventana.close();
}

// ==================== INICIALIZAR ====================
document.addEventListener('DOMContentLoaded', () => {
    if (!verificarAcceso()) return;
    buscarProductoPorScanner();
    document.getElementById('btnLimpiarProducto').addEventListener('click', limpiarProductoSeleccionado);
    document.getElementById('btnLimpiarFormulario').addEventListener('click', () => { limpiarProductoSeleccionado(); document.getElementById('observaciones').value = ''; document.getElementById('tipoPerdida').value = 'Dañado'; });
    document.getElementById('cajasPerdidas').addEventListener('input', actualizarValorPerdida);
    document.getElementById('unidadesPerdidas').addEventListener('input', actualizarValorPerdida);
    document.getElementById('formPerdida').addEventListener('submit', registrarPerdida);
    document.getElementById('btnExportarCSV').addEventListener('click', exportarCSV);
    document.getElementById('btnExportarPDF').addEventListener('click', exportarPDF);
    document.getElementById('btnLimpiarTabla').addEventListener('click', limpiarTodaLaTabla);
    document.getElementById('btnCerrar').addEventListener('click', () => window.close());
    cargarHistorial();
});