// Demo-only client module. Fictitious data, kept in memory; nothing is sent to any server.
const clients = [
  { name: 'Comercializadora Aurora S.A. de C.V.', rfc: 'CAU190312AB1', email: 'contacto@aurora.example', type: 'Moral', status: 'Activo' },
  { name: 'Lucía Fernández Ortiz', rfc: 'FEOL850704QW2', email: 'lucia.fernandez@correo.example', type: 'Física', status: 'Activo' },
  { name: 'Grupo Logístico Norte S.A.', rfc: 'GLN170221KJ8', email: 'compras@glnorte.example', type: 'Moral', status: 'Prospecto' },
  { name: 'Panadería La Espiga', rfc: 'PES200915HT3', email: 'pedidos@laespiga.example', type: 'Moral', status: 'Activo' },
  { name: 'Mario Gutiérrez Salas', rfc: 'GUSM790118LP5', email: 'mario.gs@correo.example', type: 'Física', status: 'Inactivo' },
  { name: 'Servicios Médicos Alba', rfc: 'SMA161103RT6', email: 'admin@medicosalba.example', type: 'Moral', status: 'Prospecto' },
];

const $ = (s) => document.querySelector(s);
const rows = $('#rows');

function render() {
  const q = $('#search').value.trim().toLowerCase();
  const st = $('#status-filter').value;
  const list = clients.filter((c) => (!st || c.status === st) && (!q || `${c.name} ${c.rfc}`.toLowerCase().includes(q)));
  rows.replaceChildren(
    ...list.map((c) => {
      const tr = document.createElement('tr');
      for (const v of [c.name, c.rfc, c.email, c.type]) tr.append(Object.assign(document.createElement('td'), { textContent: v }));
      const badge = Object.assign(document.createElement('span'), { className: `status ${c.status.toLowerCase()}`, textContent: c.status });
      const td = document.createElement('td');
      td.append(badge);
      tr.append(td);
      return tr;
    }),
  );
  $('#empty').hidden = list.length > 0;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 3500);
}

// The form is created on demand, so tours must wait for its fields (dynamic page).
function openForm() {
  if ($('#client-form')) return;
  const root = $('#drawer-root');
  root.innerHTML = `
    <div class="drawer-backdrop"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="form-title">
      <form id="client-form" novalidate>
        <header><h2 id="form-title">Nuevo cliente</h2><button type="button" class="icon" data-close aria-label="Cerrar">✕</button></header>
        <label>Nombre o razón social
          <input name="name" required minlength="3" data-training="client-name" autocomplete="off" />
        </label>
        <label>RFC
          <input name="rfc" required pattern="[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}" maxlength="13" data-training="client-rfc" autocomplete="off" placeholder="12 o 13 caracteres" />
          <small class="muted">Personas morales: 12 caracteres. Personas físicas: 13.</small>
        </label>
        <label>Correo electrónico
          <input name="email" type="email" required data-training="client-email" autocomplete="off" />
        </label>
        <label>Tipo de persona
          <select name="type" data-training="client-type">
            <option>Moral</option>
            <option>Física</option>
          </select>
        </label>
        <p class="error" id="form-error" role="alert" hidden></p>
        <footer>
          <button type="button" class="btn" data-close>Cancelar</button>
          <button type="submit" class="btn primary" data-training="client-save">Guardar cliente</button>
        </footer>
      </form>
    </aside>`;
  root.querySelectorAll('[data-close], .drawer-backdrop').forEach((el) => el.addEventListener('click', closeForm));
  const form = $('#client-form');
  form.rfc.addEventListener('input', () => (form.rfc.value = form.rfc.value.toUpperCase()));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('#form-error');
    if (!form.checkValidity()) {
      err.textContent = 'Revisa los campos marcados: todos son obligatorios y el RFC debe tener 12 o 13 caracteres.';
      err.hidden = false;
      form.querySelector(':invalid')?.focus();
      return;
    }
    const d = Object.fromEntries(new FormData(form));
    clients.unshift({ name: d.name, rfc: d.rfc, email: d.email, type: d.type, status: 'Prospecto' });
    closeForm();
    render();
    toast(`Cliente "${d.name}" registrado (demo: solo en memoria).`);
  });
  form.name.focus();
}

function closeForm() {
  $('#drawer-root').replaceChildren();
  $('#new-client').focus();
}

document.addEventListener('keydown', (e) => e.key === 'Escape' && $('#client-form') && !document.body.classList.contains('driver-active') && closeForm());
$('#new-client').addEventListener('click', openForm);
$('#search').addEventListener('input', render);
$('#status-filter').addEventListener('change', render);

// Optional: listen to training events for the host's own (anonymous) analytics.
document.addEventListener('training-tour-end', (e) => console.info('[demo] recorrido terminado', e.detail));
document.addEventListener('training-error', (e) => console.warn('[demo] capacitación', e.detail.message));

render();
