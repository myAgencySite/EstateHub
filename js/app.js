const API_URL = 'http://localhost:3000/api';
const STORAGE_KEYS = {
  properties: 'estatehub_properties',
  requests: 'estatehub_requests'
};

function setupNavigation() {
  const toggle = document.querySelector('.menu-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
  }
  const page = document.body.dataset.page;
  document.querySelectorAll('.nav-links a').forEach((link) => {
    if (link.dataset.page === page) link.classList.add('active');
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error('Помилка запиту');
  return response.json();
}

async function loadSeedProperties() {
  const local = localStorage.getItem(STORAGE_KEYS.properties);
  if (local) return JSON.parse(local);
  const seed = await fetchJson('data/properties.json');
  localStorage.setItem(STORAGE_KEYS.properties, JSON.stringify(seed));
  return seed;
}

async function getProperties() {
  try {
    return await fetchJson(`${API_URL}/properties`);
  } catch (error) {
    return loadSeedProperties();
  }
}

async function saveProperty(property) {
  try {
    return await fetchJson(`${API_URL}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(property)
    });
  } catch (error) {
    const properties = await loadSeedProperties();
    const id = property.id || Date.now();
    const next = property.id
      ? properties.map((item) => item.id === Number(property.id) ? { ...property, id: Number(property.id) } : item)
      : [{ ...property, id, createdAt: new Date().toISOString().slice(0, 10) }, ...properties];
    localStorage.setItem(STORAGE_KEYS.properties, JSON.stringify(next));
    return { ...property, id };
  }
}

async function deleteProperty(id) {
  try {
    await fetchJson(`${API_URL}/properties/${id}`, { method: 'DELETE' });
  } catch (error) {
    const properties = await loadSeedProperties();
    const next = properties.filter((item) => item.id !== Number(id));
    localStorage.setItem(STORAGE_KEYS.properties, JSON.stringify(next));
  }
}

async function saveRequest(request) {
  try {
    return await fetchJson(`${API_URL}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
  } catch (error) {
    const requests = JSON.parse(localStorage.getItem(STORAGE_KEYS.requests) || '[]');
    const next = [{ ...request, id: Date.now(), createdAt: new Date().toISOString() }, ...requests];
    localStorage.setItem(STORAGE_KEYS.requests, JSON.stringify(next));
    return next[0];
  }
}

function formatPrice(item) {
  return `${Number(item.price).toLocaleString('uk-UA')} ${item.currency || 'USD'}`;
}

function mainImage(item) {
  return Array.isArray(item.images) ? item.images[0] : item.image;
}

function propertyCard(item) {
  const rooms = Number(item.rooms) > 0 ? `${item.rooms} кімн.` : 'без кімнат';
  return `
    <article class="card property-card">
      <img src="${mainImage(item)}" alt="${item.title}" loading="lazy">
      <div class="property-body">
        <div class="badges">
          <span class="badge">${item.type}</span>
          <span class="badge">${item.operation}</span>
        </div>
        <h3>${item.title}</h3>
        <div class="price">${formatPrice(item)}</div>
        <div class="meta">
          <span>📍 ${item.district || item.city}</span>
          <span>📐 ${item.area} м²</span>
          <span>🚪 ${rooms}</span>
        </div>
        <p class="muted">${item.description.slice(0, 92)}...</p>
        <a class="btn" href="property.html?id=${item.id}">Детальніше</a>
      </div>
    </article>
  `;
}

function getFilters() {
  return {
    q: (document.querySelector('#q')?.value || '').trim().toLowerCase(),
    type: document.querySelector('#type')?.value || '',
    operation: document.querySelector('#operation')?.value || '',
    rooms: document.querySelector('#rooms')?.value || '',
    priceMin: Number(document.querySelector('#priceMin')?.value || 0),
    priceMax: Number(document.querySelector('#priceMax')?.value || 0),
    sort: document.querySelector('#sort')?.value || 'newest'
  };
}

function applyFilters(properties, filters) {
  let result = [...properties].filter((item) => {
    const searchString = `${item.title} ${item.city} ${item.district} ${item.address} ${item.type}`.toLowerCase();
    const matchQ = !filters.q || searchString.includes(filters.q);
    const matchType = !filters.type || item.type === filters.type;
    const matchOperation = !filters.operation || item.operation === filters.operation;
    const matchRooms = !filters.rooms || String(item.rooms) === filters.rooms;
    const matchMin = !filters.priceMin || Number(item.price) >= filters.priceMin;
    const matchMax = !filters.priceMax || Number(item.price) <= filters.priceMax;
    return matchQ && matchType && matchOperation && matchRooms && matchMin && matchMax;
  });

  if (filters.sort === 'priceAsc') result.sort((a, b) => a.price - b.price);
  if (filters.sort === 'priceDesc') result.sort((a, b) => b.price - a.price);
  if (filters.sort === 'newest') result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return result;
}

async function initHome() {
  const box = document.querySelector('#featuredProperties');
  if (!box) return;
  const properties = await getProperties();
  box.innerHTML = properties.slice(0, 3).map(propertyCard).join('');
  const homeSearch = document.querySelector('#homeSearch');
  if (homeSearch) {
    homeSearch.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(homeSearch);
      const params = new URLSearchParams();
      for (const [key, value] of form.entries()) if (value) params.set(key, value);
      location.href = `catalog.html?${params.toString()}`;
    });
  }
}

async function initCatalog() {
  const grid = document.querySelector('#catalogGrid');
  if (!grid) return;
  const params = new URLSearchParams(location.search);
  ['q', 'type', 'operation'].forEach((key) => {
    const input = document.querySelector(`#${key}`);
    if (input && params.get(key)) input.value = params.get(key);
  });
  const properties = await getProperties();
  const count = document.querySelector('#resultCount');
  const render = () => {
    const filtered = applyFilters(properties, getFilters());
    count.textContent = `${filtered.length} об’єктів знайдено`;
    grid.innerHTML = filtered.length ? filtered.map(propertyCard).join('') : '<div class="card empty">За вашим запитом об’єкти не знайдено.</div>';
  };
  document.querySelectorAll('#q, #type, #operation, #rooms, #priceMin, #priceMax, #sort').forEach((el) => {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });
  document.querySelector('#resetFilters')?.addEventListener('click', () => {
    document.querySelectorAll('#q, #type, #operation, #rooms, #priceMin, #priceMax').forEach((el) => el.value = '');
    document.querySelector('#sort').value = 'newest';
    render();
  });
  render();
}

async function initPropertyPage() {
  const root = document.querySelector('#propertyDetails');
  if (!root) return;
  const id = Number(new URLSearchParams(location.search).get('id'));
  const properties = await getProperties();
  const property = properties.find((item) => item.id === id) || properties[0];
  if (!property) {
    root.innerHTML = '<div class="card empty">Об’єкт не знайдено.</div>';
    return;
  }
  const images = Array.isArray(property.images) ? property.images : [property.image];
  root.innerHTML = `
    <div class="gallery-main card">
      <img id="mainPhoto" src="${images[0]}" alt="${property.title}">
      <div class="thumbs">
        ${images.map((src, index) => `<img class="${index === 0 ? 'active' : ''}" src="${src}" alt="Фото ${index + 1}" data-src="${src}">`).join('')}
      </div>
    </div>
    <aside class="card">
      <div class="badges"><span class="badge">${property.type}</span><span class="badge">${property.operation}</span><span class="badge">${property.status}</span></div>
      <h1 style="font-size:2rem">${property.title}</h1>
      <div class="price">${formatPrice(property)}</div>
      <p class="muted">${property.description}</p>
      <div class="info-list">
        <div class="info-item"><span>Місто</span><strong>${property.city}</strong></div>
        <div class="info-item"><span>Район</span><strong>${property.district}</strong></div>
        <div class="info-item"><span>Площа</span><strong>${property.area} м²</strong></div>
        <div class="info-item"><span>Кімнати</span><strong>${property.rooms || '—'}</strong></div>
        <div class="info-item"><span>Адреса</span><strong>${property.address}</strong></div>
        <div class="info-item"><span>Дата</span><strong>${property.createdAt}</strong></div>
      </div>
      <hr style="border:0;border-top:1px solid var(--border);margin:20px 0">
      <h3>Заявка на консультацію</h3>
      <form id="requestForm">
        <div class="form-row"><input class="input" name="name" placeholder="Ваше ім’я" required></div>
        <div class="form-row"><input class="input" name="phone" placeholder="Телефон" required></div>
        <div class="form-row"><input class="input" name="email" type="email" placeholder="Email"></div>
        <div class="form-row"><textarea name="message" rows="3" placeholder="Коментар">Цікавить об’єкт: ${property.title}</textarea></div>
        <button class="btn" type="submit">Надіслати заявку</button>
        <div id="requestNotice" class="notice"></div>
      </form>
    </aside>
  `;
  document.querySelectorAll('.thumbs img').forEach((img) => img.addEventListener('click', () => {
    document.querySelector('#mainPhoto').src = img.dataset.src;
    document.querySelectorAll('.thumbs img').forEach((item) => item.classList.remove('active'));
    img.classList.add('active');
  }));
  document.querySelector('#requestForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    await saveRequest({ ...data, propertyId: property.id, propertyTitle: property.title });
    const notice = document.querySelector('#requestNotice');
    notice.textContent = 'Заявку збережено. Менеджер агентства зв’яжеться з клієнтом.';
    notice.className = 'notice success show';
    event.target.reset();
  });
}

async function initContactForm() {
  const form = document.querySelector('#contactForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    await saveRequest({ ...data, propertyId: null, propertyTitle: 'Загальна консультація' });
    const notice = document.querySelector('#contactNotice');
    notice.textContent = 'Повідомлення збережено. Це демонстрація роботи форми з мінімальним бекендом або локальним сховищем.';
    notice.className = 'notice success show';
    form.reset();
  });
}

async function initAdmin() {
  const login = document.querySelector('#adminLogin');
  const panel = document.querySelector('#adminPanel');
  if (!login || !panel) return;
  const form = document.querySelector('#propertyForm');
  const table = document.querySelector('#adminTable tbody');
  const notice = document.querySelector('#adminNotice');
  let properties = await getProperties();
  let editId = null;

  function renderTable() {
    table.innerHTML = properties.map((item) => `
      <tr>
        <td><strong>${item.title}</strong><br><span class="muted">${item.city}, ${item.district}</span></td>
        <td>${item.type}</td>
        <td>${item.operation}</td>
        <td>${formatPrice(item)}</td>
        <td class="admin-actions">
          <button class="btn small secondary" data-edit="${item.id}">Редагувати</button>
          <button class="btn small danger" data-delete="${item.id}">Видалити</button>
        </td>
      </tr>
    `).join('');
  }

  login.addEventListener('submit', (event) => {
    event.preventDefault();
    const password = new FormData(login).get('password');
    if (password === 'admin123') {
      login.classList.add('hidden');
      panel.classList.remove('hidden');
      renderTable();
    } else {
      document.querySelector('#loginNotice').textContent = 'Невірний пароль. Для демонстрації використайте admin123.';
      document.querySelector('#loginNotice').className = 'notice error show';
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const property = {
      id: editId,
      title: data.title,
      type: data.type,
      operation: data.operation,
      price: Number(data.price),
      currency: data.operation === 'Оренда' ? 'USD/міс' : 'USD',
      city: data.city,
      district: data.district,
      address: data.address,
      area: Number(data.area),
      rooms: Number(data.rooms),
      status: 'Доступно',
      description: data.description,
      images: data.images.split('\n').map((item) => item.trim()).filter(Boolean),
      createdAt: data.createdAt || new Date().toISOString().slice(0, 10)
    };
    await saveProperty(property);
    properties = await getProperties();
    renderTable();
    notice.textContent = editId ? 'Об’єкт оновлено.' : 'Об’єкт додано.';
    notice.className = 'notice success show';
    editId = null;
    form.reset();
  });

  table.addEventListener('click', async (event) => {
    const editButton = event.target.closest('[data-edit]');
    const deleteButton = event.target.closest('[data-delete]');
    if (editButton) {
      const item = properties.find((property) => property.id === Number(editButton.dataset.edit));
      if (!item) return;
      editId = item.id;
      Object.entries({
        title: item.title, type: item.type, operation: item.operation, price: item.price,
        city: item.city, district: item.district, address: item.address, area: item.area,
        rooms: item.rooms, description: item.description, images: (item.images || []).join('\n')
      }).forEach(([key, value]) => {
        const field = form.elements[key];
        if (field) field.value = value;
      });
      window.scrollTo({ top: form.offsetTop - 90, behavior: 'smooth' });
    }
    if (deleteButton) {
      const id = Number(deleteButton.dataset.delete);
      if (confirm('Видалити цей об’єкт?')) {
        await deleteProperty(id);
        properties = await getProperties();
        renderTable();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  initHome();
  initCatalog();
  initPropertyPage();
  initContactForm();
  initAdmin();
});
