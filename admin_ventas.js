// ==================== CONSTANTES ====================
const MONEDA = 'Q';

// ==================== OBTENER DATOS ====================
function obtenerVentas() {
    return JSON.parse(localStorage.getItem('historialVentas') || '[]');
}

function guardarVentas(ventas) {
    localStorage.setItem('historialVentas', JSON.stringify(ventas));
}

function obtenerInventario() {
    return JSON.parse(localStorage.getItem('inventario') || '[]');
}

function guardarInventario(inventario) {
    localStorage.setItem('inventario', JSON.stringify(inventario));
}

function obtenerVendedores() {
    return JSON.parse(localStorage.getItem('vendedores') || '[]');
}

function obtenerUnidadesMedida() {
    return JSON.parse(localStorage.getItem('unidadesMedida') || '[{"nombre":"Unidad","equivalencia":1},{"nombre":"Caja","equivalencia":12}]');
}

// ==================== DEVOLVER STOCK DE UNA VENTA ====================
function devolverStockVenta(venta) {
    let inventario = obtenerInventario();
    const unidadesMedida = obtenerUnidadesMedida();
    
    for (const item of venta.items) {
        const producto = inventario.find(p => p.id == item.id);
        if (producto) {
            const unidadProd = producto.unidadMedida || 'Unidad';
            const equivalencia = (unidadesMedida.find(u => u.nombre === unidadProd) || { equivalencia: 1 }).equivalencia;
            let totalUnidadesDevueltas = item.cantidad * equivalencia;
            let nuevasUnidades = (producto.stockUnidades || 0) + totalUnidadesDevueltas;
            producto.stockCajas = (producto.stockCajas || 0) + Math.floor(nuevasUnidades / equivalencia);
            producto.stockUnidades = nuevasUnidades % equivalencia;
        }
    }
    guardarInventario(inventario);
}

// ==================== CANCELAR VENTA ====================
function cancelarVenta(idVenta) {
    if (!confirm('¿Cancelar esta venta? Se devolverá el stock y se eliminará del historial.')) return false;
    
    let ventas = obtenerVentas();
    const ventaIndex = ventas.findIndex(v => v.id == idVenta);
    if (ventaIndex === -1) {
        alert('Venta no encontrada');
        return false;
    }
    const venta = ventas[ventaIndex];
    devolverStockVenta(venta);
    ventas.splice(ventaIndex, 1);
    guardarVentas(ventas);
    alert('Venta cancelada y stock restaurado correctamente');
    return true;
}

// ==================== CERRAR DÍA ====================
function obtenerVentasDelDia() {
    const hoy = new Date().toISOString().slice(0,10);
    const ventas = obtenerVentas();
    return ventas.filter(v => v.fecha.startsWith(hoy));
}

function generarCSV(ventas, nombreArchivo) {
    let csv = "ID;Fecha;Vendedor;Cliente;Total;Productos\n";
    ventas.forEach(v => {
        const productosStr = v.items.map(i => `${i.cantidad} ${i.unidad} ${i.nombre} (Q${i.precioUnitario})`).join(" | ");
        csv += `${v.id};${new Date(v.fecha).toLocaleString()};${v.vendedor};${v.cliente || 'Consumidor final'};${v.total};${productosStr}\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute("download", nombreArchivo);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function generarResumenHTML(ventas) {
    const totalVentas = ventas.length;
    const totalMonto = ventas.reduce((sum, v) => sum + v.total, 0);
    const productosVendidos = ventas.reduce((sum, v) => sum + v.items.reduce((s, i) => s + i.cantidad, 0), 0);
    
    let detalleVendedores = {};
    ventas.forEach(v => {
        detalleVendedores[v.vendedor] = (detalleVendedores[v.vendedor] || 0) + v.total;
    });
    
    let html = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
            <h2 style="text-align: center;">📊 CIERRE DE DÍA</h2>
            <h3 style="text-align: center;">${new Date().toLocaleDateString()}</h3>
            <hr>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr><td style="padding: 8px;"><strong>Total de ventas:</strong></td><td>${totalVentas}</td></tr>
                <tr><td style="padding: 8px;"><strong>Monto total recaudado:</strong></td><td>${MONEDA}${totalMonto.toFixed(2)}</td></tr>
                <tr><td style="padding: 8px;"><strong>Productos vendidos (unidades):</strong></td><td>${productosVendidos}</td></tr>
            </table>
            <h4>💰 Por vendedor:</h4>
            <ul>
                ${Object.entries(detalleVendedores).map(([v, m]) => `<li>${v}: ${MONEDA}${m.toFixed(2)}</li>`).join('')}
            </ul>
            <hr>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead><tr style="background: #667eea; color: white;"><th>ID</th><th>Vendedor</th><th>Cliente</th><th>Total</th></tr></thead>
                <tbody>
                    ${ventas.map(v => `<tr><td>${v.id}</td><td>${v.vendedor}</td><td>${v.cliente || 'Consumidor final'}</td><td>${MONEDA}${v.total.toFixed(2)}</td></tr>`).join('')}
                </tbody>
            </table>
            <p style="text-align: center; margin-top: 30px;">Generado el ${new Date().toLocaleString()}</p>
        </div>
    `;
    return html;
}

function imprimirPDFConResumen(ventas) {
    const contenidoHTML = generarResumenHTML(ventas);
    const ventana = window.open('', '_blank');
    ventana.document.write(contenidoHTML);
    ventana.document.close();
    ventana.print();
    ventana.close();
}

function cerrarDia() {
    const password = prompt('🔒 Ingrese la contraseña de administrador para cerrar el día:');
    if (password !== 'admin123') {
        alert('Contraseña incorrecta');
        return;
    }
    
    const ventasHoy = obtenerVentasDelDia();
    if (ventasHoy.length === 0) {
        alert('No hay ventas registradas hoy para cerrar');
        return;
    }
    
    // Mostrar resumen y confirmar
    const totalMonto = ventasHoy.reduce((s,v) => s + v.total, 0);
    const confirmar = confirm(`📋 RESUMEN DEL DÍA\n\nVentas: ${ventasHoy.length}\nTotal recaudado: ${MONEDA}${totalMonto.toFixed(2)}\n\n¿Desea cerrar el día? Se generarán los reportes y se eliminarán las ventas del día.`);
    if (!confirmar) return;
    
    // Generar CSV y PDF con resumen
    generarCSV(ventasHoy, `ventas_${new Date().toISOString().slice(0,10)}.csv`);
    imprimirPDFConResumen(ventasHoy);
    
    // Eliminar ventas del día actual
    let todasVentas = obtenerVentas();
    const nuevasVentas = todasVentas.filter(v => !v.fecha.startsWith(new Date().toISOString().slice(0,10)));
    guardarVentas(nuevasVentas);
    
    alert('✅ Día cerrado correctamente. Las ventas han sido respaldadas y eliminadas del historial.');
    
    // Limpiar filtros y refrescar tabla
    document.getElementById('fechaDesde').value = '';
    document.getElementById('fechaHasta').value = '';
    document.getElementById('filtroVendedor').value = '';
    aplicarFiltros();
}

// ==================== CARGAR FILTROS Y MOSTRAR VENTAS MEJORADO ====================
function cargarFiltroVendedores() {
    const select = document.getElementById('filtroVendedor');
    const vendedores = obtenerVendedores();
    select.innerHTML = '<option value="">Todos</option>';
    vendedores.forEach(v => {
        const option = document.createElement('option');
        option.value = v.username;
        option.textContent = v.username;
        select.appendChild(option);
    });
}

function formatearFecha(fechaIso) {
    return new Date(fechaIso).toLocaleString();
}

function mostrarVentas(ventas) {
    const tbody = document.getElementById('tablaVentasBody');
    tbody.innerHTML = '';
    if (ventas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">No hay ventas en este período</td></td>';
        document.getElementById('totalVentas').textContent = `${MONEDA}0`;
        document.getElementById('numVentas').textContent = '0';
        return;
    }

    let totalGeneral = 0;
    ventas.forEach(venta => {
        totalGeneral += venta.total;
        const row = tbody.insertRow();
        row.insertCell(0).textContent = venta.id;
        row.insertCell(1).textContent = formatearFecha(venta.fecha);
        row.insertCell(2).textContent = venta.vendedor;
        row.insertCell(3).textContent = venta.cliente || 'Consumidor final';
        row.insertCell(4).textContent = `${MONEDA}${venta.total.toFixed(2)}`;
        
        const productosHtml = venta.items.map(i => 
            `<div>${i.cantidad} ${i.unidad} de ${i.nombre} @ Q${i.precioUnitario} = Q${i.subtotal.toFixed(2)}</div>`
        ).join('');
        row.insertCell(5).innerHTML = productosHtml;
        
        const cellAcc = row.insertCell(6);
        const btnCancelar = document.createElement('button');
        btnCancelar.textContent = '❌ Cancelar venta';
        btnCancelar.className = 'btn-cancelar-venta';
        btnCancelar.onclick = async () => {
            if (await cancelarVenta(venta.id)) {
                aplicarFiltros();
            }
        };
        const btnDetalle = document.createElement('button');
        btnDetalle.textContent = '📄 Ver detalle';
        btnDetalle.className = 'btn-ver-detalle';
        btnDetalle.onclick = () => mostrarDetalleVenta(venta);
        cellAcc.appendChild(btnCancelar);
        cellAcc.appendChild(btnDetalle);
    });

    document.getElementById('totalVentas').textContent = `${MONEDA}${totalGeneral.toFixed(2)}`;
    document.getElementById('numVentas').textContent = ventas.length;
}

function mostrarDetalleVenta(venta) {
    let detalle = `--- DETALLE VENTA ID: ${venta.id} ---\n`;
    detalle += `Vendedor: ${venta.vendedor}\n`;
    detalle += `Cliente: ${venta.cliente || 'Consumidor final'}\n`;
    detalle += `Fecha: ${formatearFecha(venta.fecha)}\n`;
    detalle += `Total: ${MONEDA}${venta.total.toFixed(2)}\n\nProductos:\n`;
    venta.items.forEach(i => {
        detalle += `${i.cantidad} ${i.unidad} de ${i.nombre} = ${MONEDA}${i.subtotal.toFixed(2)} (Q${i.precioUnitario} c/u)\n`;
    });
    alert(detalle);
}

function aplicarFiltros() {
    let ventas = obtenerVentas();
    const desde = document.getElementById('fechaDesde').value;
    const hasta = document.getElementById('fechaHasta').value;
    const vendedor = document.getElementById('filtroVendedor').value;

    if (desde) {
        const desdeDate = new Date(desde);
        desdeDate.setHours(0,0,0,0);
        ventas = ventas.filter(v => new Date(v.fecha) >= desdeDate);
    }
    if (hasta) {
        const hastaDate = new Date(hasta);
        hastaDate.setHours(23,59,59,999);
        ventas = ventas.filter(v => new Date(v.fecha) <= hastaDate);
    }
    if (vendedor) {
        ventas = ventas.filter(v => v.vendedor === vendedor);
    }

    let periodoTexto = '';
    if (desde && hasta) periodoTexto = `${desde} al ${hasta}`;
    else if (desde) periodoTexto = `Desde ${desde}`;
    else if (hasta) periodoTexto = `Hasta ${hasta}`;
    else periodoTexto = 'Todas las ventas';
    document.getElementById('periodo').textContent = periodoTexto;

    mostrarVentas(ventas);
}

// ==================== EVENTOS E INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    cargarFiltroVendedores();
    aplicarFiltros();
    
    document.getElementById('btnFiltrar').addEventListener('click', aplicarFiltros);
    document.getElementById('btnLimpiar').addEventListener('click', () => {
        document.getElementById('fechaDesde').value = '';
        document.getElementById('fechaHasta').value = '';
        document.getElementById('filtroVendedor').value = '';
        aplicarFiltros();
    });
    document.getElementById('btnCerrarDia').addEventListener('click', cerrarDia);
    document.getElementById('btnCerrar').addEventListener('click', () => window.close());

});
