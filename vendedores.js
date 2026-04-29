// ==================== CONSTANTES ====================
const MAX_VENDEDORES = 3;
const TAREAS_POS_KEY = 'tareasPos'; // clave en localStorage para tareas enviadas al POS

// ==================== VERIFICAR SESIÓN (solo admin) ====================
function verificarAcceso() {
    const session = localStorage.getItem('sessionActual');
    if (!session) {
        alert('No hay sesión activa. Redirigiendo al login...');
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

// ==================== VENDEDORES CRUD ====================
function obtenerVendedores() {
    return JSON.parse(localStorage.getItem('vendedores') || '[]');
}

function guardarVendedores(vendedores) {
    localStorage.setItem('vendedores', JSON.stringify(vendedores));
}

function renderizarTabla() {
    const tbody = document.getElementById('tablaBody');
    const vendedores = obtenerVendedores();
    const mensajeDiv = document.getElementById('mensajeLimite');

    tbody.innerHTML = '';
    if (vendedores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">No hay vendedores registrados.</td></tr>';
    } else {
        vendedores.forEach(v => {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = v.username;
            row.insertCell(1).textContent = v.tareas || '—';
            const cellAcc = row.insertCell(2);
            cellAcc.innerHTML = `
                <button class="btn-editar" onclick="editarVendedor(${v.id})">✏️ Editar</button>
                <button class="btn-eliminar" onclick="eliminarVendedor(${v.id})">🗑️ Eliminar</button>
            `;
        });
    }

    if (vendedores.length >= MAX_VENDEDORES) {
        mensajeDiv.textContent = `⚠️ Máximo alcanzado (${MAX_VENDEDORES} vendedores). Elimine uno para agregar otro.`;
        mensajeDiv.style.color = '#e67e22';
    } else {
        mensajeDiv.textContent = `✅ Puede agregar hasta ${MAX_VENDEDORES - vendedores.length} vendedor(es) más.`;
        mensajeDiv.style.color = '#2c3e50';
    }
}

function resetForm() {
    document.getElementById('formVendedor').reset();
    document.getElementById('vendedorId').value = '';
}

function editarVendedor(id) {
    const vendedores = obtenerVendedores();
    const v = vendedores.find(v => v.id === id);
    if (v) {
        document.getElementById('vendedorId').value = v.id;
        document.getElementById('username').value = v.username;
        document.getElementById('password').value = v.password;
        document.getElementById('tareas').value = v.tareas || '';
    }
}

function eliminarVendedor(id) {
    if (!confirm('¿Eliminar este vendedor permanentemente?')) return;
    let vendedores = obtenerVendedores();
    const nuevoListado = vendedores.filter(v => v.id !== id);
    guardarVendedores(nuevoListado);
    renderizarTabla();
    resetForm();
}

function guardarVendedor(event) {
    event.preventDefault();

    const id = document.getElementById('vendedorId').value;
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const tareas = document.getElementById('tareas').value.trim();

    if (!username || !password) {
        alert('Usuario y contraseña son obligatorios');
        return;
    }

    let vendedores = obtenerVendedores();

    if (!id && vendedores.length >= MAX_VENDEDORES) {
        alert(`Máximo ${MAX_VENDEDORES} vendedores permitidos.`);
        return;
    }

    if (vendedores.some(v => v.username === username && (id == '' || v.id != id))) {
        alert('Ya existe un vendedor con ese nombre de usuario');
        return;
    }

    const vendedorData = { username, password, tareas };

    if (id) {
        const index = vendedores.findIndex(v => v.id == id);
        if (index !== -1) {
            vendedores[index] = { ...vendedores[index], ...vendedorData };
        }
    } else {
        vendedorData.id = Date.now();
        vendedores.push(vendedorData);
    }

    guardarVendedores(vendedores);
    renderizarTabla();
    resetForm();
}

// ==================== FUNCIONES PARA ENVIAR TAREAS AL POS ====================
function obtenerTareasPos() {
    return JSON.parse(localStorage.getItem(TAREAS_POS_KEY) || '[]');
}

function guardarTareasPos(tareas) {
    localStorage.setItem(TAREAS_POS_KEY, JSON.stringify(tareas));
}

function enviarTareaAVendedor(usernameVendedor, mensaje) {
    if (!usernameVendedor || !mensaje) return false;
    
    const tareas = obtenerTareasPos();
    const nuevaTarea = {
        id: Date.now(),
        username: usernameVendedor,
        mensaje: mensaje,
        fecha: new Date().toLocaleString(),
        leida: false
    };
    tareas.push(nuevaTarea);
    guardarTareasPos(tareas);
    return true;
}

// Cargar el combo de vendedores en el select de tareas
function cargarSelectVendedores() {
    const select = document.getElementById('selectVendedorTarea');
    if (!select) return;
    
    const vendedores = obtenerVendedores();
    select.innerHTML = '<option value="">-- Seleccionar --</option>';
    vendedores.forEach(v => {
        const option = document.createElement('option');
        option.value = v.username;
        option.textContent = v.username;
        select.appendChild(option);
    });
}

// Evento para enviar tarea
function configurarEnvioTarea() {
    const btn = document.getElementById('btnEnviarTarea');
    if (!btn) return;
    
    btn.addEventListener('click', () => {
        const select = document.getElementById('selectVendedorTarea');
        const textoInput = document.getElementById('textoTarea');
        const username = select.value;
        const mensaje = textoInput.value.trim();
        
        if (!username) {
            alert('Seleccione un vendedor');
            return;
        }
        if (!mensaje) {
            alert('Escriba un mensaje o tarea');
            return;
        }
        
        if (enviarTareaAVendedor(username, mensaje)) {
            const msgDiv = document.getElementById('mensajeEnvio');
            msgDiv.style.display = 'block';
            textoInput.value = '';
            setTimeout(() => {
                msgDiv.style.display = 'none';
            }, 2000);
        } else {
            alert('Error al enviar la tarea');
        }
    });
}

// ==================== CERRAR VENTANA ====================
function cerrarVentana() {
    window.close();
}

// ==================== INICIALIZAR ====================
document.addEventListener('DOMContentLoaded', () => {
    if (!verificarAcceso()) return;

    renderizarTabla();
    cargarSelectVendedores();
    configurarEnvioTarea();

    const form = document.getElementById('formVendedor');
    if (form) {
        form.addEventListener('submit', guardarVendedor);
    }
});