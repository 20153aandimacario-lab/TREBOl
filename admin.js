// ==================== VERIFICAR ACCESO ====================
function verificarAcceso() {
    const session = localStorage.getItem('sessionActual');
    if (!session) {
        console.log('No hay sesión activa, redirigiendo al login...');
        window.location.href = 'index.html';
        return false;
    }
    
    try {
        const sessionData = JSON.parse(session);
        const tiempoTranscurrido = Date.now() - sessionData.timestamp;
        const tiempoExpiracion = 8 * 60 * 60 * 1000;
        
        if (tiempoTranscurrido >= tiempoExpiracion) {
            console.log('Sesión expirada');
            localStorage.removeItem('sessionActual');
            window.location.href = 'index.html';
            return false;
        }
        
        if (sessionData.rol !== 'admin') {
            console.log('No es administrador');
            window.location.href = 'index.html';
            return false;
        }
        
        const usuarioSpan = document.getElementById('usuarioActual');
        if (usuarioSpan) usuarioSpan.textContent = sessionData.username;
        
        console.log('Acceso concedido a:', sessionData.username);
        return true;
    } catch (error) {
        console.error(error);
        window.location.href = 'index.html';
        return false;
    }
}

// ==================== ABRIR MÓDULO (directamente en raíz) ====================
function abrirModulo(modulo) {
    // Los archivos están en la misma carpeta que admin.html
    const url = `${modulo}.html`;
    console.log('Abriendo módulo:', url);
    window.open(url, '_blank');
}

// ==================== CERRAR SESIÓN ====================
function cerrarSesion() {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
        localStorage.removeItem('sessionActual');
        window.location.href = 'index.html';
    }
}

// ==================== INICIALIZAR DATOS ====================
function inicializarDatosAdmin() {
    if (!localStorage.getItem('inventario')) {
        const inventarioInicial = [
            { id: 1, codigo: '001', nombre: 'Arroz 1kg', precio: 1200, stock: 20, estado: 'activo' },
            { id: 2, codigo: '002', nombre: 'Leche 1L', precio: 950, stock: 15, estado: 'activo' },
            { id: 3, codigo: '003', nombre: 'Pan molde', precio: 1800, stock: 8, estado: 'activo' },
            { id: 4, codigo: '004', nombre: 'Azúcar 1kg', precio: 850, stock: 12, estado: 'activo' },
            { id: 5, codigo: '005', nombre: 'Café 500g', precio: 2500, stock: 10, estado: 'activo' }
        ];
        localStorage.setItem('inventario', JSON.stringify(inventarioInicial));
    }
    if (!localStorage.getItem('productosDanados')) localStorage.setItem('productosDanados', '[]');
    if (!localStorage.getItem('historialVentas')) localStorage.setItem('historialVentas', '[]');
    if (!localStorage.getItem('usuariosVentas')) localStorage.setItem('usuariosVentas', '[]');
}

// ==================== ACTUALIZAR ESTADÍSTICAS ====================
function actualizarEstadisticas() {
    const inventario = JSON.parse(localStorage.getItem('inventario') || '[]');
    const vendedores = JSON.parse(localStorage.getItem('usuariosVentas') || '[]');
    const ventas = JSON.parse(localStorage.getItem('historialVentas') || '[]');
    const danados = JSON.parse(localStorage.getItem('productosDanados') || '[]');
    
    const totalVentas = ventas.reduce((sum, v) => sum + (v.total || 0), 0);
    const totalDanados = danados.reduce((sum, d) => sum + (d.cantidad || 1), 0);
    
    const totalProductosElem = document.getElementById('totalProductos');
    const totalVendedoresElem = document.getElementById('totalVendedores');
    const totalVentasElem = document.getElementById('totalVentas');
    const totalDanadosElem = document.getElementById('totalDanados');
    
    if (totalProductosElem) totalProductosElem.textContent = inventario.length;
    if (totalVendedoresElem) totalVendedoresElem.textContent = vendedores.length;
    if (totalVentasElem) totalVentasElem.textContent = `$${totalVentas.toLocaleString()}`;
    if (totalDanadosElem) totalDanadosElem.textContent = totalDanados;
}

// ==================== CONFIGURAR TARJETAS ====================
function configurarTarjetas() {
    const cards = document.querySelectorAll('.module-card');
    cards.forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-module')) return;
            const modulo = card.getAttribute('data-modulo');
            if (modulo) abrirModulo(modulo);
        });
    });
}

// ==================== EVENTO PRINCIPAL ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Panel de Administración cargado');
    if (!verificarAcceso()) return;
    inicializarDatosAdmin();
    actualizarEstadisticas();
    configurarTarjetas();
    console.log('✅ Panel listo para usar');
});

// ==================== GLOBALES ====================
window.abrirModulo = abrirModulo;
window.cerrarSesion = cerrarSesion;

// ==================== DEBUG ====================
window.debugAdmin = {
    verSesion: () => {
        const session = localStorage.getItem('sessionActual');
        console.log('Sesión:', session ? JSON.parse(session) : 'No hay sesión');
        return session;
    },
    cerrarSesion: () => {
        localStorage.removeItem('sessionActual');
        window.location.href = 'index.html';
    },
    verDatos: () => {
        console.log('Inventario:', JSON.parse(localStorage.getItem('inventario')));
        console.log('Vendedores:', JSON.parse(localStorage.getItem('usuariosVentas')));
        console.log('Ventas:', JSON.parse(localStorage.getItem('historialVentas')));
        console.log('Dañados:', JSON.parse(localStorage.getItem('productosDanados')));
    }
};

console.log('📝 Debug disponible: debugAdmin.verSesion(), debugAdmin.verDatos()');