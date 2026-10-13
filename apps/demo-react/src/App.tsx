import { useState, type FormEvent } from 'react';
import { TrainingHelp } from '@seventeen-training/react';

interface Client {
  name: string;
  rfc: string;
  email: string;
  type: 'Moral' | 'Física';
  status: 'Activo' | 'Prospecto' | 'Inactivo';
}

// Fictitious data, kept in memory.
const initial: Client[] = [
  { name: 'Comercializadora Aurora S.A. de C.V.', rfc: 'CAU190312AB1', email: 'contacto@aurora.example', type: 'Moral', status: 'Activo' },
  { name: 'Lucía Fernández Ortiz', rfc: 'FEOL850704QW2', email: 'lucia.fernandez@correo.example', type: 'Física', status: 'Activo' },
  { name: 'Grupo Logístico Norte S.A.', rfc: 'GLN170221KJ8', email: 'compras@glnorte.example', type: 'Moral', status: 'Prospecto' },
  { name: 'Panadería La Espiga', rfc: 'PES200915HT3', email: 'pedidos@laespiga.example', type: 'Moral', status: 'Activo' },
  { name: 'Mario Gutiérrez Salas', rfc: 'GUSM790118LP5', email: 'mario.gs@correo.example', type: 'Física', status: 'Inactivo' },
  { name: 'Servicios Médicos Alba', rfc: 'SMA161103RT6', email: 'admin@medicosalba.example', type: 'Moral', status: 'Prospecto' },
];

/** In a real app these come from YOUR session/server, never from the kit. */
const APP_VERSION = '1.2.0';

export function App() {
  const [clients, setClients] = useState(initial);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [toast, setToast] = useState('');

  const q = query.trim().toLowerCase();
  const list = clients.filter((c) => (!status || c.status === status) && (!q || `${c.name} ${c.rfc}`.toLowerCase().includes(q)));

  function save(c: Client) {
    setClients((cs) => [c, ...cs]);
    setFormOpen(false);
    setToast(`Cliente "${c.name}" registrado (demo: solo en memoria).`);
    setTimeout(() => setToast(''), 3500);
  }

  return (
    <>
      <header className="topbar">
        <div className="brand"><span className="logo">S</span> Demo CRM <span className="pill">React · datos ficticios</span></div>
        <nav aria-label="Principal">
          <a href="#" aria-disabled="true">Inicio</a>
          <a href="#" aria-current="page">Clientes</a>
          <a href="#" aria-disabled="true">Ventas</a>
        </nav>
        <div className="user">Usuario demo</div>
      </header>

      <main>
        <div className="page-head">
          <div>
            <h1>Clientes</h1>
            <p className="muted">Administra la cartera de clientes de tu empresa.</p>
          </div>
          <div className="actions">
            <TrainingHelp
              manifest="/training/manifest.json"
              module="clientes"
              appVersion={APP_VERSION}
              label="Ayuda del módulo"
              onTourEnd={(r) => console.info('[demo-react] recorrido terminado', r)}
              onError={(m) => console.warn('[demo-react] capacitación', m)}
            />
            <button type="button" className="btn primary" data-training="client-create" onClick={() => setFormOpen(true)}>
              + Nuevo cliente
            </button>
          </div>
        </div>

        <div className="toolbar">
          <label className="search">
            <span className="sr-only">Buscar cliente</span>
            <input type="search" data-training="client-search" placeholder="Buscar por nombre o RFC" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label>
            <span className="sr-only">Estado</span>
            <select data-training="client-filter" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="Activo">Activos</option>
              <option value="Prospecto">Prospectos</option>
              <option value="Inactivo">Inactivos</option>
            </select>
          </label>
        </div>

        <section className="card" aria-label="Listado de clientes">
          <table data-training="client-table">
            <thead>
              <tr><th>Nombre o razón social</th><th>RFC</th><th>Correo</th><th>Tipo</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.rfc}>
                  <td>{c.name}</td><td>{c.rfc}</td><td>{c.email}</td><td>{c.type}</td>
                  <td><span className={`status ${c.status.toLowerCase()}`}>{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="muted empty">No hay clientes que coincidan con la búsqueda.</p>}
        </section>
      </main>

      {formOpen && <ClientForm onSave={save} onClose={() => setFormOpen(false)} />}
      <div id="toast" role="status" aria-live="polite" className={toast ? 'show' : ''}>{toast}</div>
    </>
  );
}

function ClientForm({ onSave, onClose }: { onSave: (c: Client) => void; onClose: () => void }) {
  const [error, setError] = useState('');
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      setError('Revisa los campos marcados: todos son obligatorios y el RFC debe tener 12 o 13 caracteres.');
      return;
    }
    const d = new FormData(form);
    onSave({ name: String(d.get('name')), rfc: String(d.get('rfc')), email: String(d.get('email')), type: d.get('type') as Client['type'], status: 'Prospecto' });
  }
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <form noValidate onSubmit={submit}>
          <header>
            <h2 id="form-title">Nuevo cliente</h2>
            <button type="button" className="icon" aria-label="Cerrar" onClick={onClose}>✕</button>
          </header>
          <label>Nombre o razón social
            <input name="name" required minLength={3} data-training="client-name" autoComplete="off" autoFocus />
          </label>
          <label>RFC
            <input name="rfc" required pattern="[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}" maxLength={13} data-training="client-rfc" autoComplete="off"
              placeholder="12 o 13 caracteres" onInput={(e) => (e.currentTarget.value = e.currentTarget.value.toUpperCase())} />
            <small className="muted">Personas morales: 12 caracteres. Personas físicas: 13.</small>
          </label>
          <label>Correo electrónico
            <input name="email" type="email" required data-training="client-email" autoComplete="off" />
          </label>
          <label>Tipo de persona
            <select name="type" data-training="client-type"><option>Moral</option><option>Física</option></select>
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <footer>
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn primary" data-training="client-save">Guardar cliente</button>
          </footer>
        </form>
      </aside>
    </>
  );
}
