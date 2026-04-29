// ==================== DATOS GLOBALES ====================
let inventario = [];
let productosFactura = [];
let ultimoProductoEncontrado = null;
let productoAjusteActual = null;
let historialMovimientos = [];
let scannerActivo = false;
let tempInput = null;
let feedbackDiv = null;

let unidadesMedida = [
    { nombre: 'Unidad', equivalencia: 1 },
    { nombre: 'Caja', equivalencia: 12 },
    { nombre: 'Fardo', equivalencia: 15 },
    { nombre: 'Pack', equivalencia: 6 },
    { nombre: 'Docena', equivalencia: 12 }
];

let categorias = ['Abarrotes', 'Lácteos', 'Bebidas', 'Limpieza', 'Carnes', 'Verduras', 'Frutas', 'Panadería'];

// ==================== INICIALIZACIÓN ====================
function inicializarInventario() {
    const categoriasGuardadas = localStorage.getItem('categorias');
    if (categoriasGuardadas) {
        categorias = JSON.parse(categoriasGuardadas);
    } else {
        localStorage.setItem('categorias', JSON.stringify(categorias));
    }
    
    const unidadesGuardadas = localStorage.getItem('unidadesMedida');
    if (unidadesGuardadas) {
        unidadesMedida = JSON.parse(unidadesGuardadas);
    } else {
        localStorage.setItem('unidadesMedida', JSON.stringify(unidadesMedida));
    }
    
    const datosGuardados = localStorage.getItem('inventario');
    if (datosGuardados) {
        inventario = JSON.parse(datosGuardados);
    } else {
        inventario = [];
        guardarInventario();
    }
    
    const historialGuardado = localStorage.getItem('historialMovimientos');
    if (historialGuardado) {
        historialMovimientos = JSON.parse(historialGuardado);
    } else {
        historialMovimientos = [];
        localStorage.setItem('historialMovimientos', JSON.stringify(historialMovimientos));
    }
    
    actualizarSelectCategorias();
    actualizarSelectUnidades();
    renderizarTabla();
    actualizarEstadisticas();
    inicializarScannerBusqueda();
}

function guardarInventario() {
    localStorage.setItem('inventario', JSON.stringify(inventario));
}

function guardarHistorial(movimiento) {
    historialMovimientos.unshift(movimiento);
    if (historialMovimientos.length > 1000) historialMovimientos.pop();
    localStorage.setItem('historialMovimientos', JSON.stringify(historialMovimientos));
}

// ==================== CÁLCULOS CON PRIORIDAD DE PRECIOS ====================
function obtenerEquivalencia(producto) {
    const unidad = unidadesMedida.find(u => u.nombre === producto.unidadMedida);
    return unidad ? unidad.equivalencia : 1;
}

function obtenerPrecioCostoCaja(producto) {
    if (producto.precioCompra && producto.precioCompra > 0) return producto.precioCompra;
    if (producto.precioMayorista && producto.precioMayorista > 0) return producto.precioMayorista;
    if (producto.precioUnitarioCF && producto.precioUnitarioCF > 0) return producto.precioUnitarioCF;
    return 0;
}

function obtenerPrecioCostoUnitario(producto) {
    const costoCaja = obtenerPrecioCostoCaja(producto);
    const equivalencia = obtenerEquivalencia(producto);
    return costoCaja / equivalencia;
}

function calcularPrecioUnitarioCompra(producto) {
    return obtenerPrecioCostoUnitario(producto);
}

function calcularStockTotal(producto) {
    const equivalencia = obtenerEquivalencia(producto);
    return (producto.stockCajas || 0) * equivalencia + (producto.stockUnidades || 0);
}

function calcularValorInventario(producto) {
    const costoCaja = obtenerPrecioCostoCaja(producto);
    const precioUnitario = costoCaja / obtenerEquivalencia(producto);
    const valorCajas = (producto.stockCajas || 0) * costoCaja;
    const valorUnidades = (producto.stockUnidades || 0) * precioUnitario;
    return valorCajas + valorUnidades;
}

// ==================== RENDERIZAR TABLA ====================
function renderizarTabla() {
    const tbody = document.getElementById('tablaBody');
    const categoriaFilter = document.getElementById('categoriaFilter')?.value || '';
    
    let filtrados = inventario;
    if (categoriaFilter) filtrados = filtrados.filter(p => p.categoria === categoriaFilter);
    
    tbody.innerHTML = '';
    filtrados.forEach(prod => {
        const unidad = unidadesMedida.find(u => u.nombre === prod.unidadMedida) || { nombre: 'Unidad', equivalencia: 1 };
        const stockTotal = calcularStockTotal(prod);
        const valorInventario = calcularValorInventario(prod);
        const precioUnitarioCompra = calcularPrecioUnitarioCompra(prod);
        const stockCajas = prod.stockCajas || 0;
        const stockUnidades = prod.stockUnidades || 0;
        
        const row = tbody.insertRow();
        row.setAttribute('data-codigo', prod.id);
        row.insertCell(0).innerHTML = `<code>${prod.id}</code>`;
        row.insertCell(1).innerHTML = `<strong>${prod.nombre}</strong>`;
        row.insertCell(2).innerHTML = prod.categoria;
        row.insertCell(3).innerHTML = `${unidad.nombre} (${unidad.equivalencia})`;
        row.insertCell(4).innerHTML = `Q${prod.precioCompra?.toFixed(2) || '0.00'}`;
        row.insertCell(5).innerHTML = `Q${precioUnitarioCompra.toFixed(2)}`;
        row.insertCell(6).innerHTML = `Q${prod.precioMayorista?.toFixed(2) || '0.00'}`;
        row.insertCell(7).innerHTML = `Q${prod.precioUnitarioCF?.toFixed(2) || '0.00'}`;
        row.insertCell(8).innerHTML = `<span class="stock-cajas">${stockCajas} ${unidad.nombre}</span> + <span class="stock-unidades">${stockUnidades} unds</span>`;
        row.insertCell(9).innerHTML = `<strong>${stockTotal}</strong> <span class="unidad-tag">unds</span>`;
        row.insertCell(10).innerHTML = `Q${valorInventario.toFixed(2)}`;
        row.insertCell(11).innerHTML = `<div class="action-icons"><span class="edit-icon" onclick="editarProducto('${prod.id}')">✏️</span><span class="delete-icon" onclick="eliminarProducto('${prod.id}')">🗑️</span></div>`;
    });
}

function filtrarPorCategoria() { renderizarTabla(); }

// ==================== ESCÁNER ====================
function inicializarScannerBusqueda() {
    const btnScanner = document.getElementById('btnScannerBusqueda');
    if (!btnScanner) return;
    const nuevoBtn = btnScanner.cloneNode(true);
    btnScanner.parentNode.replaceChild(nuevoBtn, btnScanner);
    nuevoBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (scannerActivo) desactivarModoScanner();
        else iniciarModoScanner();
    });
}

function iniciarModoScanner() {
    scannerActivo = true;
    feedbackDiv = document.createElement('div');
    feedbackDiv.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#667eea; color:white; padding:15px; border-radius:8px; z-index:9999;';
    feedbackDiv.innerHTML = '🎯 Modo escáner activado<br>Presiona ESC para salir';
    document.body.appendChild(feedbackDiv);
    tempInput = document.createElement('input');
    tempInput.type = 'text';
    tempInput.style.position = 'fixed';
    tempInput.style.top = '-100px';
    tempInput.style.left = '-100px';
    tempInput.style.opacity = '0';
    document.body.appendChild(tempInput);
    tempInput.focus();
    
    let buffer = '', timeout = null;
    tempInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (buffer.length > 2) { buscarPorCodigo(buffer); buffer = ''; }
            if (timeout) clearTimeout(timeout);
            setTimeout(() => tempInput.focus(), 100);
        } else if (e.key === 'Escape') desactivarModoScanner();
        else { buffer += e.key; if (timeout) clearTimeout(timeout); timeout = setTimeout(() => buffer = '', 200); }
    });
}

function desactivarModoScanner() { if (!scannerActivo) return; scannerActivo = false; if (tempInput) tempInput.remove(); if (feedbackDiv) feedbackDiv.remove(); }

function buscarPorCodigo(codigo) {
    const inputCodigo = document.getElementById('codigoBusqueda');
    const productoEncontrado = inventario.find(p => p.id === codigo || p.id.endsWith(codigo));
    if (productoEncontrado) {
        if (inputCodigo) inputCodigo.value = codigo;
        const filtrados = inventario.filter(p => p.id.endsWith(codigo));
        const tbody = document.getElementById('tablaBody');
        tbody.innerHTML = '';
        filtrados.forEach(prod => {
            const unidad = unidadesMedida.find(u => u.nombre === prod.unidadMedida) || { nombre: 'Unidad', equivalencia: 1 };
            const stockTotal = calcularStockTotal(prod);
            const valorInventario = calcularValorInventario(prod);
            const precioUnitarioCompra = calcularPrecioUnitarioCompra(prod);
            const row = tbody.insertRow();
            row.setAttribute('data-codigo', prod.id);
            row.insertCell(0).innerHTML = `<code>${prod.id}</code>`;
            row.insertCell(1).innerHTML = `<strong>${prod.nombre}</strong>`;
            row.insertCell(2).innerHTML = prod.categoria;
            row.insertCell(3).innerHTML = `${unidad.nombre} (${unidad.equivalencia})`;
            row.insertCell(4).innerHTML = `Q${prod.precioCompra?.toFixed(2) || '0.00'}`;
            row.insertCell(5).innerHTML = `Q${precioUnitarioCompra.toFixed(2)}`;
            row.insertCell(6).innerHTML = `Q${prod.precioMayorista?.toFixed(2) || '0.00'}`;
            row.insertCell(7).innerHTML = `Q${prod.precioUnitarioCF?.toFixed(2) || '0.00'}`;
            row.insertCell(8).innerHTML = `<span class="stock-cajas">${prod.stockCajas || 0} ${unidad.nombre}</span> + <span class="stock-unidades">${prod.stockUnidades || 0} unds</span>`;
            row.insertCell(9).innerHTML = `<strong>${stockTotal}</strong> <span class="unidad-tag">unds</span>`;
            row.insertCell(10).innerHTML = `Q${valorInventario.toFixed(2)}`;
            row.insertCell(11).innerHTML = `<div class="action-icons"><span class="edit-icon" onclick="editarProducto('${prod.id}')">✏️</span><span class="delete-icon" onclick="eliminarProducto('${prod.id}')">🗑️</span></div>`;
        });
        if (feedbackDiv) { feedbackDiv.innerHTML = `✅ ${productoEncontrado.nombre}`; feedbackDiv.style.background = '#4caf50'; setTimeout(() => { if (feedbackDiv && scannerActivo) { feedbackDiv.innerHTML = '🎯 Modo escáner activado<br>Presiona ESC para salir'; feedbackDiv.style.background = '#667eea'; } }, 1500); }
    } else {
        if (feedbackDiv) { feedbackDiv.innerHTML = `⚠️ Código ${codigo} no encontrado`; feedbackDiv.style.background = '#f44336'; setTimeout(() => { if (feedbackDiv && scannerActivo) { feedbackDiv.innerHTML = '🎯 Modo escáner activado<br>Presiona ESC para salir'; feedbackDiv.style.background = '#667eea'; } }, 1500); }
        if (inputCodigo) inputCodigo.value = codigo;
    }
}

// ==================== CATEGORÍAS ====================
function actualizarSelectCategorias() {
    const selectCategoria = document.getElementById('categoria');
    const selectFiltro = document.getElementById('categoriaFilter');
    if (selectCategoria) {
        selectCategoria.innerHTML = '';
        categorias.forEach(cat => { const option = document.createElement('option'); option.value = cat; option.textContent = cat; selectCategoria.appendChild(option); });
    }
    if (selectFiltro) {
        const valorActual = selectFiltro.value;
        selectFiltro.innerHTML = '<option value="">📋 Todas las categorías</option>';
        categorias.forEach(cat => { const option = document.createElement('option'); option.value = cat; option.textContent = cat; selectFiltro.appendChild(option); });
        if (valorActual && categorias.includes(valorActual)) selectFiltro.value = valorActual;
    }
}

function abrirModalCategorias() { const modal = document.getElementById('modalCategorias'); renderizarListaCategorias(); modal.style.display = 'block'; }
function renderizarListaCategorias() { const lista = document.getElementById('listaCategorias'); lista.innerHTML = ''; categorias.forEach((cat, idx) => { const li = document.createElement('li'); li.innerHTML = `<span>📁 ${cat}</span><div><button class="btn btn-small" onclick="editarCategoria(${idx})">✏️</button><button class="btn btn-small btn-danger" onclick="eliminarCategoria(${idx})">🗑️</button></div>`; lista.appendChild(li); }); }
function agregarCategoria() { const nueva = document.getElementById('nuevaCategoria').value.trim(); if (!nueva || categorias.includes(nueva)) return; categorias.push(nueva); localStorage.setItem('categorias', JSON.stringify(categorias)); actualizarSelectCategorias(); renderizarListaCategorias(); document.getElementById('nuevaCategoria').value = ''; }
function editarCategoria(idx) { const nuevoNombre = prompt('Nuevo nombre:', categorias[idx]); if (nuevoNombre && nuevoNombre.trim()) { const viejo = categorias[idx]; categorias[idx] = nuevoNombre.trim(); localStorage.setItem('categorias', JSON.stringify(categorias)); inventario.forEach(p => { if (p.categoria === viejo) p.categoria = nuevoNombre.trim(); }); guardarInventario(); actualizarSelectCategorias(); renderizarListaCategorias(); renderizarTabla(); } }
function eliminarCategoria(idx) { if (categorias.length <= 1) return; if (confirm(`¿Eliminar categoría "${categorias[idx]}"?`)) { categorias.splice(idx, 1); localStorage.setItem('categorias', JSON.stringify(categorias)); actualizarSelectCategorias(); renderizarListaCategorias(); renderizarTabla(); } }
function cerrarModalCategorias() { document.getElementById('modalCategorias').style.display = 'none'; }

// ==================== UNIDADES ====================
function actualizarSelectUnidades() {
    const selectUnidad = document.getElementById('unidadMedida');
    if (!selectUnidad) return;
    selectUnidad.innerHTML = '';
    unidadesMedida.forEach(u => { const option = document.createElement('option'); option.value = u.nombre; option.textContent = `${u.nombre} (${u.equivalencia} unds)`; selectUnidad.appendChild(option); });
}
function abrirModalUnidades() { const modal = document.getElementById('modalUnidades'); renderizarListaUnidades(); modal.style.display = 'block'; }
function renderizarListaUnidades() { const lista = document.getElementById('listaUnidades'); lista.innerHTML = ''; unidadesMedida.forEach((u, idx) => { const li = document.createElement('li'); li.innerHTML = `<span>📦 ${u.nombre} = ${u.equivalencia} unidades</span><div><button class="btn btn-small" onclick="editarUnidad(${idx})">✏️</button><button class="btn btn-small btn-danger" onclick="eliminarUnidad(${idx})">🗑️</button></div>`; lista.appendChild(li); }); }
function agregarUnidad() { const nombre = document.getElementById('nuevaUnidadNombre').value.trim(); const equivalencia = parseInt(document.getElementById('nuevaUnidadEq').value); if (!nombre || isNaN(equivalencia) || equivalencia < 1) return; if (unidadesMedida.find(u => u.nombre === nombre)) return; unidadesMedida.push({ nombre, equivalencia }); localStorage.setItem('unidadesMedida', JSON.stringify(unidadesMedida)); actualizarSelectUnidades(); renderizarListaUnidades(); document.getElementById('nuevaUnidadNombre').value = ''; document.getElementById('nuevaUnidadEq').value = '1'; }
function editarUnidad(idx) { const u = unidadesMedida[idx]; const nuevoNombre = prompt('Nuevo nombre:', u.nombre); if (!nuevoNombre) return; const nuevaEq = parseInt(prompt('Nueva equivalencia:', u.equivalencia)); if (isNaN(nuevaEq) || nuevaEq < 1) return; unidadesMedida[idx] = { nombre: nuevoNombre, equivalencia: nuevaEq }; localStorage.setItem('unidadesMedida', JSON.stringify(unidadesMedida)); actualizarSelectUnidades(); renderizarListaUnidades(); }
function eliminarUnidad(idx) { if (unidadesMedida.length <= 1) return; if (confirm(`¿Eliminar "${unidadesMedida[idx].nombre}"?`)) { unidadesMedida.splice(idx, 1); localStorage.setItem('unidadesMedida', JSON.stringify(unidadesMedida)); actualizarSelectUnidades(); renderizarListaUnidades(); } }
function cerrarModalUnidades() { document.getElementById('modalUnidades').style.display = 'none'; }

// ==================== CRUD ====================
function abrirModalAgregar() { document.getElementById('modalTitulo').innerText = 'Agregar Producto'; document.getElementById('productoForm').reset(); document.getElementById('codigo').readOnly = false; document.getElementById('stockCajas').value = 0; document.getElementById('stockUnidades').value = 0; document.getElementById('modalProducto').style.display = 'block'; document.getElementById('codigo').focus(); }
function editarProducto(id) { const prod = inventario.find(p => p.id === id); if (!prod) return; document.getElementById('modalTitulo').innerText = 'Editar Producto'; document.getElementById('codigo').value = prod.id; document.getElementById('codigo').readOnly = true; document.getElementById('nombre').value = prod.nombre; document.getElementById('categoria').value = prod.categoria; document.getElementById('unidadMedida').value = prod.unidadMedida; document.getElementById('precioCompra').value = prod.precioCompra; document.getElementById('precioMayorista').value = prod.precioMayorista; document.getElementById('precioUnitarioCF').value = prod.precioUnitarioCF; document.getElementById('stockCajas').value = prod.stockCajas || 0; document.getElementById('stockUnidades').value = prod.stockUnidades || 0; document.getElementById('modalProducto').style.display = 'block'; }
function eliminarProducto(id) { if (confirm('¿Eliminar este producto?')) { inventario = inventario.filter(p => p.id !== id); guardarInventario(); renderizarTabla(); actualizarEstadisticas(); alert('Producto eliminado'); } }
function guardarProducto(e) { e.preventDefault(); const id = document.getElementById('codigo').value.trim(); const nombre = document.getElementById('nombre').value.trim(); const categoria = document.getElementById('categoria').value; const unidadMedida = document.getElementById('unidadMedida').value; const precioCompra = parseFloat(document.getElementById('precioCompra').value); const precioMayorista = parseFloat(document.getElementById('precioMayorista').value); const precioUnitarioCF = parseFloat(document.getElementById('precioUnitarioCF').value); const stockCajas = parseInt(document.getElementById('stockCajas').value) || 0; const stockUnidades = parseInt(document.getElementById('stockUnidades').value) || 0; const unidadConfig = unidadesMedida.find(u => u.nombre === unidadMedida); if (!unidadConfig) { alert('Unidad de medida no válida'); return; } if (!id || !nombre || isNaN(precioCompra) || isNaN(precioMayorista) || isNaN(precioUnitarioCF)) { alert('Complete todos los campos'); return; } const existe = inventario.find(p => p.id === id); if (existe && document.getElementById('modalTitulo').innerText === 'Agregar Producto') { alert('Ya existe un producto con ese código'); return; } const nuevoProducto = { id, nombre, categoria, unidadMedida, precioCompra, precioMayorista, precioUnitarioCF, stockCajas, stockUnidades }; if (existe) Object.assign(existe, nuevoProducto); else inventario.push(nuevoProducto); guardarInventario(); renderizarTabla(); actualizarEstadisticas(); cerrarModalProducto(); alert(`Producto "${nombre}" guardado`); }
function cerrarModalProducto() { document.getElementById('modalProducto').style.display = 'none'; document.getElementById('codigo').readOnly = false; }

// ==================== FACTURA ====================
function abrirModalFactura() {
    productosFactura = []; renderizarFactura(); document.getElementById('numeroFactura').value = ''; document.getElementById('scanFeedback').innerHTML = ''; document.getElementById('modalFactura').style.display = 'block';
    const scannerInput = document.getElementById('facturaScanner'); let buffer = ''; let timeout = null; const nuevoScanner = scannerInput.cloneNode(true); scannerInput.parentNode.replaceChild(nuevoScanner, scannerInput);
    nuevoScanner.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); if (buffer.length > 2) { const producto = inventario.find(p => p.id === buffer || p.id.endsWith(buffer)); const feedback = document.getElementById('scanFeedback'); if (producto) { const existente = productosFactura.find(p => p.id === producto.id); if (existente) existente.cajas++; else productosFactura.push({ ...producto, cajas: 1, unidades: 0 }); renderizarFactura(); feedback.innerHTML = `✅ ${producto.nombre} agregado`; feedback.className = 'scan-feedback success'; } else { feedback.innerHTML = `⚠️ Código ${buffer} no encontrado`; feedback.className = 'scan-feedback error'; } setTimeout(() => feedback.innerHTML = '', 1500); buffer = ''; nuevoScanner.value = ''; } if (timeout) clearTimeout(timeout); } else { buffer += e.key; if (timeout) clearTimeout(timeout); timeout = setTimeout(() => { buffer = ''; }, 100); }
    });
    nuevoScanner.focus();
}
function renderizarFactura() { const tbody = document.getElementById('facturaBody'); tbody.innerHTML = ''; productosFactura.forEach((p, idx) => { const equivalencia = obtenerEquivalencia(p); const totalUnidades = (p.cajas * equivalencia) + p.unidades; const row = tbody.insertRow(); row.insertCell(0).innerHTML = `<code>${p.id}</code>`; row.insertCell(1).innerHTML = p.nombre; row.insertCell(2).innerHTML = `<button onclick="cambiarCantidadFactura(${idx}, 'cajas', -1)">-</button> ${p.cajas} <button onclick="cambiarCantidadFactura(${idx}, 'cajas', 1)">+</button>`; row.insertCell(3).innerHTML = `<button onclick="cambiarCantidadFactura(${idx}, 'unidades', -1)">-</button> ${p.unidades} <button onclick="cambiarCantidadFactura(${idx}, 'unidades', 1)">+</button>`; row.insertCell(4).innerHTML = totalUnidades; row.insertCell(5).innerHTML = `<button onclick="eliminarDeFactura(${idx})">🗑️</button>`; }); }
function cambiarCantidadFactura(idx, tipo, delta) { const producto = productosFactura[idx]; const equivalencia = obtenerEquivalencia(producto); if (tipo === 'cajas') { const nuevo = producto.cajas + delta; if (nuevo >= 0) producto.cajas = nuevo; if (nuevo === 0 && producto.unidades === 0) productosFactura.splice(idx, 1); } else { const nuevo = producto.unidades + delta; if (nuevo >= 0 && nuevo < equivalencia) producto.unidades = nuevo; if (producto.cajas === 0 && nuevo === 0) productosFactura.splice(idx, 1); } renderizarFactura(); }
function eliminarDeFactura(idx) { productosFactura.splice(idx, 1); renderizarFactura(); }
function guardarFactura() { const numeroFactura = document.getElementById('numeroFactura').value.trim(); if (!numeroFactura) { alert('Ingrese el número de factura'); return; } if (productosFactura.length === 0) { alert('No hay productos'); return; } for (const item of productosFactura) { const prod = inventario.find(p => p.id === item.id); if (prod) { const equivalencia = obtenerEquivalencia(prod); const totalUnidades = (item.cajas * equivalencia) + item.unidades; let nuevasUnidades = prod.stockUnidades + totalUnidades; const nuevasCajas = prod.stockCajas + Math.floor(nuevasUnidades / equivalencia); prod.stockUnidades = nuevasUnidades % equivalencia; prod.stockCajas = nuevasCajas; guardarHistorial({ tipo: 'compra_factura', factura: numeroFactura, producto: prod.nombre, cajas: item.cajas, unidades: item.unidades, totalUnidades: totalUnidades, fecha: new Date().toLocaleString() }); } } guardarInventario(); renderizarTabla(); actualizarEstadisticas(); cerrarModalFactura(); alert(`Factura ${numeroFactura} guardada`); }
function cerrarModalFactura() { document.getElementById('modalFactura').style.display = 'none'; productosFactura = []; }

// ==================== AJUSTE ====================
function abrirModalAjuste() { productoAjusteActual = null; document.getElementById('ajusteForm').style.display = 'none'; document.getElementById('ajusteScanner').value = ''; document.getElementById('ajusteFeedback').innerHTML = ''; document.getElementById('modalAjuste').style.display = 'block'; const scanner = document.getElementById('ajusteScanner'); let buffer = ''; let timeout = null; const nuevoScanner = scanner.cloneNode(true); scanner.parentNode.replaceChild(nuevoScanner, scanner); nuevoScanner.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (buffer.length > 2) { const producto = inventario.find(p => p.id === buffer || p.id.endsWith(buffer)); if (producto) { productoAjusteActual = producto; document.getElementById('ajusteNombre').value = producto.nombre; document.getElementById('ajusteForm').style.display = 'block'; document.getElementById('ajusteFeedback').innerHTML = `✅ Producto: ${producto.nombre}`; document.getElementById('ajusteFeedback').className = 'ajuste-feedback success'; } else { document.getElementById('ajusteFeedback').innerHTML = `⚠️ Producto no encontrado`; document.getElementById('ajusteFeedback').className = 'ajuste-feedback error'; } buffer = ''; nuevoScanner.value = ''; } if (timeout) clearTimeout(timeout); } else { buffer += e.key; if (timeout) clearTimeout(timeout); timeout = setTimeout(() => { buffer = ''; }, 100); } }); nuevoScanner.focus(); }
function confirmarAjuste() { if (!productoAjusteActual) { alert('Escanee un producto'); return; } const cajas = parseInt(document.getElementById('ajusteCajas').value) || 0; const unidades = parseInt(document.getElementById('ajusteUnidades').value) || 0; const tipo = document.getElementById('ajusteTipo').value; let factura = null; if (cajas === 0 && unidades === 0) { alert('Agregue cantidad'); return; } if (tipo === 'conFactura') { factura = document.getElementById('ajusteNumeroFactura').value.trim(); if (!factura) { alert('Ingrese número de factura'); return; } } const equivalencia = obtenerEquivalencia(productoAjusteActual); const totalUnidades = (cajas * equivalencia) + unidades; let nuevasUnidades = productoAjusteActual.stockUnidades + totalUnidades; const nuevasCajas = productoAjusteActual.stockCajas + Math.floor(nuevasUnidades / equivalencia); productoAjusteActual.stockUnidades = nuevasUnidades % equivalencia; productoAjusteActual.stockCajas = nuevasCajas; guardarInventario(); guardarHistorial({ tipo: tipo === 'conFactura' ? 'ajuste_factura' : 'ajuste_sin_factura', factura, producto: productoAjusteActual.nombre, cajas, unidades, totalUnidades, fecha: new Date().toLocaleString() }); renderizarTabla(); actualizarEstadisticas(); cerrarModalAjuste(); alert(`Ajuste: +${cajas} cajas + ${unidades} unidades`); }
function cancelarAjuste() { productoAjusteActual = null; document.getElementById('ajusteForm').style.display = 'none'; document.getElementById('ajusteScanner').value = ''; }
function cerrarModalAjuste() { document.getElementById('modalAjuste').style.display = 'none'; }

// ==================== PÉRDIDAS ====================
function abrirModalPerdidas() { document.getElementById('perdidasForm').reset(); document.getElementById('modalPerdidas').style.display = 'block'; const input = document.getElementById('buscarPerdida'); let buffer = ''; let timeout = null; const nuevoInput = input.cloneNode(true); input.parentNode.replaceChild(nuevoInput, input); nuevoInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (buffer.length > 2) { const producto = inventario.find(p => p.id === buffer || p.id.endsWith(buffer)); const sugerencia = document.getElementById('productoSugerencia'); if (producto) { ultimoProductoEncontrado = producto; sugerencia.innerHTML = `✅ ${producto.nombre} (Stock: ${calcularStockTotal(producto)} unds)`; sugerencia.classList.add('show'); nuevoInput.value = ''; } else { sugerencia.innerHTML = `⚠️ Código ${buffer} no encontrado`; sugerencia.classList.add('show'); setTimeout(() => sugerencia.classList.remove('show'), 2000); nuevoInput.value = ''; } buffer = ''; } if (timeout) clearTimeout(timeout); } else { buffer += e.key; if (timeout) clearTimeout(timeout); timeout = setTimeout(() => { buffer = ''; }, 100); } }); nuevoInput.focus(); }
function registrarPerdida(e) { e.preventDefault(); if (!ultimoProductoEncontrado) { alert('Escanee un producto'); return; } const cajas = parseInt(document.getElementById('perdidaCajas').value) || 0; const unidades = parseInt(document.getElementById('perdidaUnidades').value) || 0; const tipo = document.getElementById('tipoPerdida').value; const equivalencia = obtenerEquivalencia(ultimoProductoEncontrado); const totalPerdidas = (cajas * equivalencia) + unidades; if (totalPerdidas === 0) { alert('Ingrese cantidad'); return; } const stockTotal = calcularStockTotal(ultimoProductoEncontrado); if (totalPerdidas > stockTotal) { alert('Stock insuficiente'); return; } let perdidasRestantes = totalPerdidas; let unidadesADeducir = Math.min(ultimoProductoEncontrado.stockUnidades, perdidasRestantes); ultimoProductoEncontrado.stockUnidades -= unidadesADeducir; perdidasRestantes -= unidadesADeducir; if (perdidasRestantes > 0) { let cajasADeducir = Math.ceil(perdidasRestantes / equivalencia); ultimoProductoEncontrado.stockCajas -= cajasADeducir; ultimoProductoEncontrado.stockUnidades = (ultimoProductoEncontrado.stockUnidades + (cajasADeducir * equivalencia)) - perdidasRestantes; if (ultimoProductoEncontrado.stockUnidades < 0) { ultimoProductoEncontrado.stockUnidades += equivalencia; ultimoProductoEncontrado.stockCajas--; } } guardarInventario(); guardarHistorial({ tipo: 'perdida', subtipo: tipo, producto: ultimoProductoEncontrado.nombre, cajas, unidades, total: totalPerdidas, fecha: new Date().toLocaleString() }); let perdidos = JSON.parse(localStorage.getItem('productosDanados') || '[]'); perdidos.push({ id: Date.now(), producto: ultimoProductoEncontrado.nombre, cajas, unidades, total: totalPerdidas, tipo, fecha: new Date().toLocaleString() }); localStorage.setItem('productosDanados', JSON.stringify(perdidos)); renderizarTabla(); actualizarEstadisticas(); cerrarModalPerdidas(); alert(`${totalPerdidas} unidades (${cajas} cajas + ${unidades} unds) registradas como ${tipo}`); }
function cerrarModalPerdidas() { document.getElementById('modalPerdidas').style.display = 'none'; ultimoProductoEncontrado = null; }

// ==================== ESTADÍSTICAS ====================
function actualizarEstadisticas() { document.getElementById('totalProductos').innerText = inventario.length; const valorTotal = inventario.reduce((s, p) => s + calcularValorInventario(p), 0); document.getElementById('valorInventario').innerText = `Q${valorTotal.toFixed(2)}`; const danados = JSON.parse(localStorage.getItem('productosDanados') || '[]'); document.getElementById('totalDanados').innerText = danados.reduce((s, d) => s + (d.total || 0), 0); document.getElementById('stockBajo').innerHTML = inventario.filter(p => calcularStockTotal(p) < 5).length; }

// ==================== BACKUP ====================
function exportarBackup() { const backup = { fecha: new Date().toISOString(), inventario, categorias, unidadesMedida, historialMovimientos, productosDanados: JSON.parse(localStorage.getItem('productosDanados') || '[]') }; const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`; a.click(); URL.revokeObjectURL(url); alert('Backup guardado'); }
function importarBackup() { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'; input.onchange = (e) => { const file = e.target.files[0]; const reader = new FileReader(); reader.onload = (event) => { try { const data = JSON.parse(event.target.result); if (data.inventario) inventario = data.inventario; if (data.categorias) categorias = data.categorias; if (data.unidadesMedida) unidadesMedida = data.unidadesMedida; if (data.historialMovimientos) historialMovimientos = data.historialMovimientos; guardarInventario(); localStorage.setItem('categorias', JSON.stringify(categorias)); localStorage.setItem('unidadesMedida', JSON.stringify(unidadesMedida)); localStorage.setItem('historialMovimientos', JSON.stringify(historialMovimientos)); if (data.productosDanados) localStorage.setItem('productosDanados', JSON.stringify(data.productosDanados)); actualizarSelectCategorias(); actualizarSelectUnidades(); renderizarTabla(); actualizarEstadisticas(); alert('Backup restaurado'); } catch (error) { alert('Error al leer archivo'); } }; reader.readAsText(file); }; input.click(); }
function cerrarVentana() { window.close(); }

// ==================== INICIALIZACIÓN COMPLETA ====================
document.addEventListener('DOMContentLoaded', () => {
    inicializarInventario();
    document.getElementById('productoForm')?.addEventListener('submit', guardarProducto);
    document.getElementById('perdidasForm')?.addEventListener('submit', registrarPerdida);
    const ajusteTipo = document.getElementById('ajusteTipo');
    if (ajusteTipo) { ajusteTipo.addEventListener('change', () => { const facturaInput = document.getElementById('ajusteFacturaInput'); if (facturaInput) facturaInput.style.display = ajusteTipo.value === 'conFactura' ? 'block' : 'none'; }); }
    const inputCodigoBusqueda = document.getElementById('codigoBusqueda');
    if (inputCodigoBusqueda) { inputCodigoBusqueda.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); const digitos = e.target.value.trim(); if (digitos === '') renderizarTabla(); else buscarPorUltimosDigitos(digitos); } }); }
    window.onclick = (event) => { if (event.target.classList.contains('modal')) event.target.style.display = 'none'; };
});