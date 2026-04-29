// ==================== VARIABLES GLOBALES ====================
let carrito = [];
let vendedorActual = null;

// Elementos DOM
const codigoInput = document.getElementById('codigoProducto');
const btnAgregar = document.getElementById('btnAgregar');
const carritoBody = document.getElementById('carritoBody');
const totalCarritoSpan = document.getElementById('totalCarrito');
const efectivoInput = document.getElementById('efectivoRecibido');
const cambioInput = document.getElementById('cambio');
const btnVender = document.getElementById('btnVender');
const btnCancelarVenta = document.getElementById('btnCancelarVenta');
const btnAdmin = document.getElementById('btnAdmin');
const nombreVendedorSpan = document.getElementById('nombreVendedor');
const modalNotificacion = document.getElementById('modalNotificacion');
const mensajeNotificacion = document.getElementById('mensajeNotificacion');
const cerrarNotificacion = document.getElementById('cerrarNotificacion');
const nombreClienteInput = document.getElementById('nombreCliente');

// Elementos del modal de contraseña
const modalPassword = document.getElementById('modalPasswordAdmin');
const passwordInput = document.getElementById('passwordAdminInput');
const btnConfirmar = document.getElementById('btnConfirmarPassword');
const btnCancelar = document.getElementById('btnCancelarPassword');

// ==================== FUNCIONES DE INVENTARIO ====================
function obtenerInventario() {
    return JSON.parse(localStorage.getItem('inventario') || '[]');
}

function guardarInventario(inventario) {
    localStorage.setItem('inventario', JSON.stringify(inventario));
}

function obtenerUnidadesMedida() {
    return JSON.parse(localStorage.getItem('unidadesMedida') || '[{"nombre":"Unidad","equivalencia":1},{"nombre":"Caja","equivalencia":12}]');
}

function calcularStockTotalUnidades(producto) {
    const unidadesMedida = obtenerUnidadesMedida();
    const unidad = unidadesMedida.find(u => u.nombre === producto.unidadMedida) || { equivalencia: 1 };
    const cajas = producto.stockCajas || 0;
    const unidades = producto.stockUnidades || 0;
    return (cajas * unidad.equivalencia) + unidades;
}

function obtenerPrecioVenta(producto) {
    if (producto.precioUnitarioCF && producto.precioUnitarioCF > 0) return producto.precioUnitarioCF;
    if (producto.precioMayorista && producto.precioMayorista > 0) return producto.precioMayorista;
    if (producto.precioCompra && producto.precioCompra > 0) return producto.precioCompra;
    return 0;
}

function buscarProducto(termino) {
    const inventario = obtenerInventario();
    termino = termino.trim().toLowerCase();
    let producto = inventario.find(p => p.id === termino || p.id.toLowerCase().endsWith(termino));
    if (!producto) producto = inventario.find(p => p.nombre.toLowerCase().includes(termino));
    return producto;
}

// ==================== CARRITO CON VALIDACIÓN DE STOCK ====================
function obtenerStockReal(productoId) {
    const inventario = obtenerInventario();
    const prod = inventario.find(p => p.id === productoId);
    if (!prod) return 0;
    return calcularStockTotalUnidades(prod);
}

function obtenerCantidadReservada(productoId) {
    const item = carrito.find(i => i.id === productoId);
    if (!item) return 0;
    return item.cantidad * item.equivalencia;
}

function puedeAgregar(productoOriginal, cantidadUnidadesAdicionales) {
    const stockReal = calcularStockTotalUnidades(productoOriginal);
    const reservado = obtenerCantidadReservada(productoOriginal.id);
    const disponible = stockReal - reservado;
    return cantidadUnidadesAdicionales <= disponible;
}

function agregarAlCarrito(productoOriginal, cantidad = 1) {
    const unidadesMedida = obtenerUnidadesMedida();
    const unidadProducto = productoOriginal.unidadMedida || 'Unidad';
    const equivalencia = (unidadesMedida.find(u => u.nombre === unidadProducto) || { equivalencia: 1 }).equivalencia;
    const precioUnitario = obtenerPrecioVenta(productoOriginal);
    
    if (precioUnitario <= 0) {
        alert('Este producto no tiene precio de venta definido');
        return false;
    }
    
    const cantidadUnidadesSolicitadas = cantidad * equivalencia;
    
    if (!puedeAgregar(productoOriginal, cantidadUnidadesSolicitadas)) {
        const stockReal = calcularStockTotalUnidades(productoOriginal);
        const reservado = obtenerCantidadReservada(productoOriginal.id);
        const disponible = stockReal - reservado;
        alert(`Stock insuficiente. Solo puedes agregar ${Math.floor(disponible / equivalencia)} ${unidadProducto}(s) más (${disponible} unidades disponibles).`);
        return false;
    }
    
    const itemExistente = carrito.find(item => item.id === productoOriginal.id);
    if (itemExistente) {
        itemExistente.cantidad += cantidad;
    } else {
        carrito.push({
            id: productoOriginal.id,
            nombre: productoOriginal.nombre,
            precioUnitario: precioUnitario,
            cantidad: cantidad,
            unidad: unidadProducto,
            equivalencia: equivalencia,
            productoOriginal: productoOriginal
        });
    }
    renderizarCarrito();
    return true;
}

function eliminarDelCarrito(id) {
    carrito = carrito.filter(item => item.id !== id);
    renderizarCarrito();
}

function renderizarCarrito() {
    carritoBody.innerHTML = '';
    let total = 0;
    carrito.forEach(item => {
        const subtotal = item.precioUnitario * item.cantidad;
        total += subtotal;
        const row = carritoBody.insertRow();
        row.insertCell(0).textContent = item.nombre;
        row.insertCell(1).textContent = `${item.cantidad} ${item.unidad}`;
        row.insertCell(2).textContent = `Q${item.precioUnitario.toFixed(2)}`;
        row.insertCell(3).textContent = `Q${subtotal.toFixed(2)}`;
        const btnEliminar = document.createElement('button');
        btnEliminar.textContent = '❌';
        btnEliminar.style.background = 'none';
        btnEliminar.style.border = 'none';
        btnEliminar.style.cursor = 'pointer';
        btnEliminar.onclick = () => eliminarDelCarrito(item.id);
        row.insertCell(4).appendChild(btnEliminar);
    });
    totalCarritoSpan.textContent = total.toFixed(2);
    efectivoInput.value = '';
    cambioInput.value = '';
}

// ==================== AGREGAR PRODUCTO DESDE INPUT ====================
function agregarProductoPorTermino() {
    const termino = codigoInput.value.trim();
    if (!termino) return;
    const producto = buscarProducto(termino);
    if (!producto) {
        alert('❌ Producto no encontrado');
        codigoInput.value = '';
        codigoInput.focus();
        return;
    }
    const stockReal = calcularStockTotalUnidades(producto);
    if (stockReal <= 0) {
        alert(`⚠️ Producto "${producto.nombre}" sin stock disponible.`);
        codigoInput.value = '';
        codigoInput.focus();
        return;
    }
    agregarAlCarrito(producto);
    codigoInput.value = '';
    codigoInput.focus();
}

btnAgregar.addEventListener('click', agregarProductoPorTermino);
codigoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        agregarProductoPorTermino();
    }
});

// Calcular cambio
efectivoInput.addEventListener('input', () => {
    const total = parseFloat(totalCarritoSpan.textContent);
    const efectivo = parseFloat(efectivoInput.value);
    if (!isNaN(efectivo) && efectivo >= total) {
        cambioInput.value = `Q${(efectivo - total).toFixed(2)}`;
    } else {
        cambioInput.value = '';
    }
});

// ==================== VENDER (CON DOBLE VERIFICACIÓN) ====================
function registrarVenta() {
    if (carrito.length === 0) {
        alert('Carrito vacío');
        return false;
    }
    const total = parseFloat(totalCarritoSpan.textContent);
    const efectivo = parseFloat(efectivoInput.value);
    if (isNaN(efectivo) || efectivo < total) {
        alert('Efectivo insuficiente');
        return false;
    }
    
    // Volver a verificar stock contra inventario actual
    let inventarioActual = obtenerInventario();
    for (const item of carrito) {
        const prod = inventarioActual.find(p => p.id === item.id);
        if (!prod) {
            alert(`Producto ${item.nombre} ya no existe en inventario.`);
            return false;
        }
        const stockUnidades = calcularStockTotalUnidades(prod);
        const reservado = item.cantidad * item.equivalencia;
        if (stockUnidades < reservado) {
            alert(`Stock insuficiente para ${item.nombre}. Disponible: ${stockUnidades} unidades, solicitado: ${reservado}.`);
            return false;
        }
    }
    
    // Descontar stock
    for (const item of carrito) {
        const prodInventario = inventarioActual.find(p => p.id === item.id);
        if (prodInventario) {
            const unidadesMedida = obtenerUnidadesMedida();
            const equivalencia = (unidadesMedida.find(u => u.nombre === prodInventario.unidadMedida) || { equivalencia: 1 }).equivalencia;
            let totalUnidadesVendidas = item.cantidad * equivalencia;
            let unidadesRestantes = totalUnidadesVendidas;
            
            // Descontar de stockUnidades
            let unidsADeducir = Math.min(prodInventario.stockUnidades || 0, unidadesRestantes);
            prodInventario.stockUnidades -= unidsADeducir;
            unidadesRestantes -= unidsADeducir;
            
            // Descontar de stockCajas
            if (unidadesRestantes > 0) {
                let cajasADeducir = Math.ceil(unidadesRestantes / equivalencia);
                prodInventario.stockCajas -= cajasADeducir;
                let totalUnidades = (prodInventario.stockCajas * equivalencia) + (prodInventario.stockUnidades || 0);
                if (totalUnidades < 0) totalUnidades = 0;
                prodInventario.stockCajas = Math.floor(totalUnidades / equivalencia);
                prodInventario.stockUnidades = totalUnidades % equivalencia;
            }
        }
    }
    guardarInventario(inventarioActual);
    
    // Obtener nombre del cliente
    const nombreCliente = nombreClienteInput.value.trim() || 'Consumidor final';
    
    // Guardar venta en historial
    const venta = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        vendedor: vendedorActual,
        cliente: nombreCliente,
        total: total,
        items: carrito.map(i => ({
            id: i.id,
            nombre: i.nombre,
            cantidad: i.cantidad,
            unidad: i.unidad,
            precioUnitario: i.precioUnitario,
            subtotal: i.precioUnitario * i.cantidad
        }))
    };
    const historial = JSON.parse(localStorage.getItem('historialVentas') || '[]');
    historial.push(venta);
    localStorage.setItem('historialVentas', JSON.stringify(historial));
    
    // Mostrar ticket
    let ticket = `--- TICKET DE VENTA ---\nVendedor: ${vendedorActual}\nCliente: ${nombreCliente}\nFecha: ${new Date().toLocaleString()}\n\n`;
    venta.items.forEach(i => {
        ticket += `${i.cantidad} ${i.unidad} de ${i.nombre} = Q${i.subtotal.toFixed(2)}\n`;
    });
    ticket += `\nTotal: Q${total.toFixed(2)}\nEfectivo: Q${efectivo.toFixed(2)}\nCambio: Q${(efectivo - total).toFixed(2)}\n¡Gracias por su compra!`;
    alert(ticket);
    
    carrito = [];
    renderizarCarrito();
    nombreClienteInput.value = '';
    return true;
}

btnVender.addEventListener('click', () => {
    if (registrarVenta()) {
        codigoInput.focus();
    }
});

// ==================== CANCELAR VENTA ====================
function devolverStock(productoId, cantidad, unidadEquivalencia) {
    let inventarioActual = obtenerInventario();
    const prod = inventarioActual.find(p => p.id === productoId);
    if (prod) {
        const totalUnidades = cantidad * unidadEquivalencia;
        let nuevasUnidades = (prod.stockUnidades || 0) + totalUnidades;
        const unidadesMedida = obtenerUnidadesMedida();
        const equivalencia = (unidadesMedida.find(u => u.nombre === prod.unidadMedida) || { equivalencia: 1 }).equivalencia;
        prod.stockCajas = (prod.stockCajas || 0) + Math.floor(nuevasUnidades / equivalencia);
        prod.stockUnidades = nuevasUnidades % equivalencia;
        guardarInventario(inventarioActual);
    }
}

btnCancelarVenta.addEventListener('click', () => {
    if (carrito.length === 0) {
        alert('No hay venta activa');
        return;
    }
    if (confirm('¿Cancelar esta venta? Se devolverá el stock.')) {
        for (const item of carrito) {
            devolverStock(item.id, item.cantidad, item.equivalencia);
        }
        carrito = [];
        renderizarCarrito();
        alert('Venta cancelada. Stock restaurado.');
        codigoInput.focus();
    }
});

// ==================== BOTÓN ADMIN CON MODAL DE CONTRASEÑA ====================
function mostrarModalPassword() {
    modalPassword.style.display = 'flex';
    passwordInput.value = '';
    passwordInput.focus();
}

function ocultarModalPassword() {
    modalPassword.style.display = 'none';
}

function verificarPasswordAdmin() {
    const password = passwordInput.value;
    if (password === 'Martektrebol') { // para cambiar eder 
        ocultarModalPassword();
        window.open('admin_ventas.html', '_blank');
    } else {
        alert('❌ Contraseña incorrecta');
        passwordInput.value = '';
        passwordInput.focus();
    }
}

btnAdmin.addEventListener('click', mostrarModalPassword);
btnConfirmar.addEventListener('click', verificarPasswordAdmin);
btnCancelar.addEventListener('click', ocultarModalPassword);

// Cerrar modal si se hace clic fuera del contenido
modalPassword.addEventListener('click', (e) => {
    if (e.target === modalPassword) ocultarModalPassword();
});

// Permitir presionar Enter en el campo de contraseña
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        verificarPasswordAdmin();
    }
});

// ==================== SESIÓN ====================
function obtenerSesion() {
    const session = localStorage.getItem('sessionActual');
    if (!session) return null;
    try {
        return JSON.parse(session);
    } catch { return null; }
}

function verificarSesionVendedor() {
    const sesion = obtenerSesion();
    if (!sesion || sesion.rol !== 'ventas') {
        alert('Debe iniciar sesión como vendedor');
        window.location.href = '../../index.html';
        return false;
    }
    vendedorActual = sesion.username;
    nombreVendedorSpan.textContent = `Vendedor: ${vendedorActual}`;
    return true;
}

// ==================== NOTIFICACIONES DE TAREAS (TOAST con límite 3 cada 5 min) ====================
let colaTareas = [];
let mostrandoNotificacion = false;
let historialNotificaciones = []; // Guarda timestamps de las últimas notificaciones mostradas
const LIMITE_NOTIFICACIONES = 3;
const VENTANA_TIEMPO = 5 * 60 * 1000; // 5 minutos en milisegundos

function obtenerTareasPosVendedor(username) {
    const todas = JSON.parse(localStorage.getItem('tareasPos') || '[]');
    return todas.filter(t => t.username === username && !t.leida);
}

function marcarTareaComoLeida(idTarea) {
    let tareas = JSON.parse(localStorage.getItem('tareasPos') || '[]');
    const index = tareas.findIndex(t => t.id === idTarea);
    if (index !== -1) {
        tareas[index].leida = true;
        localStorage.setItem('tareasPos', JSON.stringify(tareas));
    }
}

function limpiarHistorialAntiguo() {
    const ahora = Date.now();
    historialNotificaciones = historialNotificaciones.filter(ts => (ahora - ts) < VENTANA_TIEMPO);
}

function sePuedeMostrarNotificacion() {
    limpiarHistorialAntiguo();
    return historialNotificaciones.length < LIMITE_NOTIFICACIONES;
}

function registrarNotificacionMostrada() {
    historialNotificaciones.push(Date.now());
}

function mostrarToast(mensaje, duracion = 5000) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `
        <div class="toast-icon">📢</div>
        <div class="toast-content">
            <strong>Nueva tarea</strong>
            <p>${mensaje}</p>
        </div>
        <button class="toast-close">✖</button>
    `;
    
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    });
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }
    }, duracion);
}

function procesarColaTareas() {
    if (colaTareas.length === 0) {
        mostrandoNotificacion = false;
        return;
    }
    if (mostrandoNotificacion) return;
    
    // Verificar si podemos mostrar otra notificación ahora
    if (!sePuedeMostrarNotificacion()) {
        // No podemos mostrar ahora, esperamos 1 minuto y reintentamos
        setTimeout(() => {
            procesarColaTareas();
        }, 60000);
        return;
    }
    
    mostrandoNotificacion = true;
    const tarea = colaTareas.shift();
    registrarNotificacionMostrada();
    mostrarToast(tarea.mensaje, 5000);
    marcarTareaComoLeida(tarea.id);
    
    // Esperar a que termine la animación y luego procesar siguiente
    setTimeout(() => {
        mostrandoNotificacion = false;
        procesarColaTareas();
    }, 5500);
}

function revisarTareas() {
    if (!vendedorActual) return;
    const tareasNuevas = obtenerTareasPosVendedor(vendedorActual);
    if (tareasNuevas.length > 0) {
        for (const tarea of tareasNuevas) {
            // Evitar duplicados en cola
            if (!colaTareas.some(t => t.id === tarea.id)) {
                colaTareas.push(tarea);
            }
        }
        procesarColaTareas();
    }
}

// Revisar cada 30 segundos (puedes cambiar a 60s si lo prefieres)
setInterval(revisarTareas, 30000);
// ==================== CERRAR SESIÓN ====================
document.getElementById('btnCerrarSesion').addEventListener('click', () => {
    localStorage.removeItem('sessionActual');
    window.location.href = '../../index.html';
});

// ==================== INICIALIZAR ====================
document.addEventListener('DOMContentLoaded', () => {
    if (!verificarSesionVendedor()) return;
    codigoInput.focus();
});