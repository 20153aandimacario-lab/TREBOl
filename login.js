// ==================== CLASES Y ESTRUCTURA DATOS ====================
class UsuarioVentas {
    constructor(username, password) {
        this.username = username;
        this.password = password;
        this.rol = 'ventas';
        this.fechaCreacion = new Date().toISOString();
    }
}

// ==================== INICIALIZAR BASE DE DATOS ====================
function inicializarDB() {
    // Usuarios de ventas (máximo 3)
    if (!localStorage.getItem('usuariosVentas')) {
        localStorage.setItem('usuariosVentas', JSON.stringify([]));
    }
    
    // Inventario de productos
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
    
    // Productos dañados o perdidos
    if (!localStorage.getItem('productosDanados')) {
        localStorage.setItem('productosDanados', JSON.stringify([]));
    }
    
    // Historial de ventas
    if (!localStorage.getItem('historialVentas')) {
        localStorage.setItem('historialVentas', JSON.stringify([]));
    }
}

// ==================== OBTENER DATOS ====================
function obtenerUsuariosVentas() {
    return JSON.parse(localStorage.getItem('usuariosVentas')) || [];
}

function guardarUsuariosVentas(usuarios) {
    localStorage.setItem('usuariosVentas', JSON.stringify(usuarios));
}

// ==================== VALIDAR CREDENCIALES ====================
function validarAdmin(username, password) {
    return (username === 'admin' && password === 'Martektrebol');
}

function validarVendedor(username, password) {
    const usuarios = obtenerUsuariosVentas();
    return usuarios.find(u => u.username === username && u.password === password);
}

// ==================== CREAR SESIÓN ====================
function crearSesion(username, rol) {
    const session = {
        username: username,
        rol: rol,
        timestamp: Date.now(),
        expiraEn: 8 * 60 * 60 * 1000 // 8 horas
    };
    localStorage.setItem('sessionActual', JSON.stringify(session));
    return session;
}

// ==================== REALIZAR LOGIN ====================
function realizarLogin(username, password) {
    console.log('Intentando login con:', username);
    
    // Validar ADMIN
    if (validarAdmin(username, password)) {
        console.log('✅ Login exitoso como ADMIN');
        crearSesion('admin', 'admin');
        return { 
            success: true, 
            rol: 'admin', 
            redirect: 'admin.html',
            message: 'Bienvenido Administrador'
        };
    }
    
   
   // Validar VENDEDOR (desde nueva lista)
const vendedores = JSON.parse(localStorage.getItem('vendedores') || '[]');
const vendedor = vendedores.find(v => v.username === username && v.password === password);
if (vendedor) {
    localStorage.setItem('sessionActual', JSON.stringify({
        username: vendedor.username,
        rol: 'ventas',
        timestamp: Date.now()
    }));
    return { success: true, redirect: 'pos.html' };
}
}

// ==================== VERIFICAR SESIÓN ACTIVA ====================
function verificarSesionActiva() {
    const sessionJSON = localStorage.getItem('sessionActual');
    if (!sessionJSON) return null;
    
    try {
        const session = JSON.parse(sessionJSON);
        const tiempoTranscurrido = Date.now() - session.timestamp;
        const tiempoExpiracion = session.expiraEn || 8 * 60 * 60 * 1000;
        
        if (tiempoTranscurrido < tiempoExpiracion) {
            console.log('Sesión activa encontrada para:', session.username);
            return session;
        } else {
            console.log('Sesión expirada');
            localStorage.removeItem('sessionActual');
            return null;
        }
    } catch (error) {
        console.error('Error al verificar sesión:', error);
        localStorage.removeItem('sessionActual');
        return null;
    }
}

// ==================== REDIRIGIR POR SESIÓN ACTIVA ====================
function redirigirPorSesionActiva() {
    const session = verificarSesionActiva();
    if (session) {
        const destino = session.rol === 'admin' ? 'admin.html' : 'pos.html';
        console.log('Redirigiendo a:', destino);
        window.location.href = destino;
        return true;
    }
    return false;
}

// ==================== MOSTRAR ERRORES ====================
function mostrarError(mensaje) {
    const errorDiv = document.getElementById('errorMessage');
    if (!errorDiv) return;
    
    errorDiv.textContent = mensaje;
    errorDiv.classList.add('show');
    
    // Auto-ocultar después de 3 segundos
    setTimeout(() => {
        errorDiv.classList.remove('show');
    }, 3000);
}

function limpiarError() {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.classList.remove('show');
        errorDiv.textContent = '';
    }
}

// ==================== LIMPIAR CAMPOS ====================
function limpiarCampos() {
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('username').focus();
}

// ==================== MOSTRAR MENSAJE DE BIENVENIDA (OPCIONAL) ====================
function mostrarMensajeBienvenida(mensaje) {
    // Crear toast temporal
    const toast = document.createElement('div');
    toast.textContent = mensaje;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Página de login cargada');
    
    // Inicializar base de datos
    inicializarDB();
    
    // Verificar si ya hay sesión activa
    if (redirigirPorSesionActiva()) return;
    
    // Obtener elementos del DOM
    const form = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    if (!form) {
        console.error('❌ No se encontró el formulario de login');
        return;
    }
    
    // Manejar envío del formulario
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        // Validaciones básicas
        if (!username) {
            mostrarError('⚠️ Por favor, ingrese su usuario');
            usernameInput.focus();
            return;
        }
        
        if (!password) {
            mostrarError('⚠️ Por favor, ingrese su contraseña');
            passwordInput.focus();
            return;
        }
        
        // Realizar login
        const resultado = realizarLogin(username, password);
        
        if (resultado.success) {
            console.log('Redirigiendo a:', resultado.redirect);
            // Mostrar mensaje de bienvenida antes de redirigir
            mostrarMensajeBienvenida(resultado.message);
            setTimeout(() => {
                window.location.href = resultado.redirect;
            }, 500);
        } else {
            mostrarError(resultado.message);
            limpiarCampos();
        }
    });
    
    // Limpiar error al escribir
    usernameInput.addEventListener('input', limpiarError);
    passwordInput.addEventListener('input', limpiarError);
    
    // Agregar estilos para animaciones del toast
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
});

// ==================== FUNCIONES DE UTILIDAD PARA DEBUG ====================
window.debug = {
    // Ver usuarios de ventas
    verUsuariosVentas: () => {
        const usuarios = obtenerUsuariosVentas();
        console.table(usuarios);
        return usuarios;
    },
    
    // Agregar vendedor de prueba
    agregarVendedorPrueba: () => {
        const usuarios = obtenerUsuariosVentas();
        if (usuarios.length < 3) {
            const nuevoVendedor = new UsuarioVentas('vendedor1', '1234');
            usuarios.push(nuevoVendedor);
            guardarUsuariosVentas(usuarios);
            console.log('✅ Vendedor de prueba creado: vendedor1 / 1234');
        } else {
            console.log('❌ Ya hay 3 vendedores, no se puede agregar más');
        }
        return obtenerUsuariosVentas();
    },
    
    // Limpiar toda la base de datos
    limpiarDB: () => {
        if (confirm('¿Eliminar todos los datos?')) {
            localStorage.clear();
            inicializarDB();
            console.log('✅ Base de datos reiniciada');
        }
    },
    
    // Ver sesión actual
    verSesion: () => {
        const session = localStorage.getItem('sessionActual');
        console.log('Sesión actual:', session ? JSON.parse(session) : 'No hay sesión activa');
        return session;
    },
    
    // Cerrar sesión manual
    cerrarSesion: () => {
        localStorage.removeItem('sessionActual');
        console.log('✅ Sesión cerrada');
        window.location.reload();
    }
};

console.log('📝 Funciones de debug disponibles:');
console.log('   debug.verUsuariosVentas() - Ver vendedores');
console.log('   debug.agregarVendedorPrueba() - Agregar vendedor de prueba');
console.log('   debug.verSesion() - Ver sesión actual');
console.log('   debug.cerrarSesion() - Cerrar sesión');
console.log('   debug.limpiarDB() - Reiniciar base de datos');