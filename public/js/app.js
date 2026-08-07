// Personal Book Tracker - Frontend
const API = '';

let currentUser = null;
let booksCache = [];
let editingId = null;
let viewingId = null;

// ========== DOM ==========
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const bookList = document.getElementById('book-list');
const emptyState = document.getElementById('empty-state');
const bookModal = document.getElementById('book-modal');
const viewModal = document.getElementById('view-modal');
const bookForm = document.getElementById('book-form');

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', async () => {
  // Tabs
  document.querySelectorAll('.auth-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin = tab.dataset.tab === 'login';
      loginForm.classList.toggle('hidden', !isLogin);
      registerForm.classList.toggle('hidden', isLogin);
    });
  });

  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);
  document.getElementById('btn-logout').addEventListener('click', handleLogout);
  document.getElementById('btn-add-book').addEventListener('click', () => openBookModal());
  document.getElementById('modal-close').addEventListener('click', closeBookModal);
  document.getElementById('btn-cancel').addEventListener('click', closeBookModal);
  document.querySelector('#book-modal .modal-backdrop').addEventListener('click', closeBookModal);
  bookForm.addEventListener('submit', handleSaveBook);

  document.getElementById('view-close').addEventListener('click', closeViewModal);
  document.querySelector('#view-modal .modal-backdrop').addEventListener('click', closeViewModal);
  document.getElementById('view-edit').addEventListener('click', () => {
    closeViewModal();
    openBookModal(viewingId);
  });
  document.getElementById('view-delete').addEventListener('click', handleDeleteFromView);

  // Filters
  document.getElementById('search-input').addEventListener('input', debounce(loadBooks, 300));
  document.getElementById('filter-status').addEventListener('change', loadBooks);
  document.getElementById('sort-by').addEventListener('change', loadBooks);

  // Check session
  await checkAuth();
});

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ========== AUTH ==========
async function checkAuth() {
  try {
    const res = await fetch(`${API}/api/me`, { credentials: 'include' });
    const data = await res.json();
    if (data.loggedIn) {
      currentUser = data;
      showApp();
    } else {
      showAuth();
    }
  } catch (e) {
    showAuth();
  }
}

function showAuth() {
  authScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
}

function showApp() {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  document.getElementById('welcome-user').textContent = `Hi, ${currentUser.username}`;
  loadStats();
  loadBooks();
}

async function handleLogin(e) {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    currentUser = { username: data.username };
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const errEl = document.getElementById('register-error');
  errEl.textContent = '';
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  try {
    const res = await fetch(`${API}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    currentUser = { username: data.username };
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
  }
}

async function handleLogout() {
  await fetch(`${API}/api/logout`, { method: 'POST', credentials: 'include' });
  currentUser = null;
  showAuth();
}

// ========== BOOKS ==========
async function loadBooks() {
  const search = document.getElementById('search-input').value.trim();
  const status = document.getElementById('filter-status').value;
  const sort = document.getElementById('sort-by').value;

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (sort) params.set('sort', sort);

  try {
    const res = await fetch(`${API}/api/books?${params}`, { credentials: 'include' });
    if (res.status === 401) return showAuth();
    booksCache = await res.json();
    renderBooks(booksCache);
  } catch (e) {
    console.error(e);
  }
}

async function loadStats() {
  try {
    const res = await fetch(`${API}/api/stats`, { credentials: 'include' });
    if (!res.ok) return;
    const s = await res.json();
    document.getElementById('stat-total').textContent = s.total || 0;
    document.getElementById('stat-read').textContent = s.read_count || 0;
    document.getElementById('stat-reading').textContent = s.reading_count || 0;
    document.getElementById('stat-want').textContent = s.want_count || 0;
    document.getElementById('stat-rating').textContent =
      s.avg_rating ? Number(s.avg_rating).toFixed(1) : '–';
    document.getElementById('stat-pages').textContent = s.total_pages || 0;
  } catch (e) { /* ignore */ }
}

function renderBooks(books) {
  bookList.innerHTML = '';
  if (!books.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  books.forEach(book => {
    const card = document.createElement('article');
    card.className = 'book-card';
    card.dataset.id = book.id;

    const stars = book.rating
      ? '★'.repeat(book.rating) + '☆'.repeat(5 - book.rating)
      : '';

    const statusLabel = {
      want_to_read: 'Want',
      reading: 'Reading',
      read: 'Read'
    }[book.status] || book.status;

    const coverHtml = book.cover_url
      ? `<img src="${escapeHtml(book.cover_url)}" alt="" onerror="this.parentElement.innerHTML='📖'" />`
      : '📖';

    card.innerHTML = `
      <div class="book-cover">
        ${coverHtml}
        <span class="status-badge status-${book.status}">${statusLabel}</span>
      </div>
      <div class="book-body">
        <h3 class="book-title">${escapeHtml(book.title)}</h3>
        <p class="book-author">${escapeHtml(book.author)}</p>
        <div class="book-meta">
          ${book.genre ? `<span>${escapeHtml(book.genre)}</span>` : ''}
          ${book.pages ? `<span>${book.pages} p.</span>` : ''}
          ${stars ? `<span class="book-rating">${stars}</span>` : ''}
        </div>
        ${book.review ? `<p class="book-review-preview">${escapeHtml(book.review)}</p>` : ''}
      </div>
    `;
    card.addEventListener('click', () => openViewModal(book.id));
    bookList.appendChild(card);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ========== MODALS ==========
function openBookModal(id = null) {
  editingId = id;
  document.getElementById('form-error').textContent = '';
  bookForm.reset();
  document.getElementById('book-id').value = '';

  if (id) {
    document.getElementById('modal-title').textContent = 'Edit Book';
    const book = booksCache.find(b => b.id == id);
    if (book) {
      document.getElementById('book-id').value = book.id;
      document.getElementById('book-title').value = book.title || '';
      document.getElementById('book-author').value = book.author || '';
      document.getElementById('book-genre').value = book.genre || '';
      document.getElementById('book-pages').value = book.pages || '';
      document.getElementById('book-status').value = book.status || 'want_to_read';
      document.getElementById('book-rating').value = book.rating || '';
      document.getElementById('book-started').value = book.date_started ? book.date_started.slice(0, 10) : '';
      document.getElementById('book-finished').value = book.date_finished ? book.date_finished.slice(0, 10) : '';
      document.getElementById('book-review').value = book.review || '';
      document.getElementById('book-notes').value = book.notes || '';
      document.getElementById('book-cover').value = book.cover_url || '';
    }
  } else {
    document.getElementById('modal-title').textContent = 'Add Book';
  }
  bookModal.classList.remove('hidden');
}

function closeBookModal() {
  bookModal.classList.add('hidden');
  editingId = null;
}

async function handleSaveBook(e) {
  e.preventDefault();
  const errEl = document.getElementById('form-error');
  errEl.textContent = '';

  const payload = {
    title: document.getElementById('book-title').value.trim(),
    author: document.getElementById('book-author').value.trim(),
    genre: document.getElementById('book-genre').value.trim() || null,
    pages: document.getElementById('book-pages').value || null,
    status: document.getElementById('book-status').value,
    rating: document.getElementById('book-rating').value || null,
    date_started: document.getElementById('book-started').value || null,
    date_finished: document.getElementById('book-finished').value || null,
    review: document.getElementById('book-review').value.trim() || null,
    notes: document.getElementById('book-notes').value.trim() || null,
    cover_url: document.getElementById('book-cover').value.trim() || null
  };

  try {
    const id = document.getElementById('book-id').value;
    const url = id ? `${API}/api/books/${id}` : `${API}/api/books`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');

    closeBookModal();
    loadBooks();
    loadStats();
  } catch (err) {
    errEl.textContent = err.message;
  }
}

async function openViewModal(id) {
  viewingId = id;
  try {
    const res = await fetch(`${API}/api/books/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Not found');
    const book = await res.json();

    document.getElementById('view-title').textContent = book.title;

    const statusLabel = {
      want_to_read: 'Want to Read',
      reading: 'Currently Reading',
      read: 'Finished'
    }[book.status] || book.status;

    const stars = book.rating
      ? '★'.repeat(book.rating) + '☆'.repeat(5 - book.rating)
      : 'Not rated';

    let html = `
      <p style="color:var(--text-muted);margin-bottom:0.75rem;">by ${escapeHtml(book.author)}</p>
      <dl class="view-meta">
        <dt>Status</dt><dd>${statusLabel}</dd>
        <dt>Rating</dt><dd class="view-rating">${stars}</dd>
        ${book.genre ? `<dt>Genre</dt><dd>${escapeHtml(book.genre)}</dd>` : ''}
        ${book.pages ? `<dt>Pages</dt><dd>${book.pages}</dd>` : ''}
        ${book.date_started ? `<dt>Started</dt><dd>${book.date_started.slice(0,10)}</dd>` : ''}
        ${book.date_finished ? `<dt>Finished</dt><dd>${book.date_finished.slice(0,10)}</dd>` : ''}
      </dl>
    `;
    if (book.review) {
      html += `<h4 style="margin-top:1rem;margin-bottom:0.4rem;font-size:0.85rem;color:var(--text-muted);">Review</h4>
               <div class="view-review">${escapeHtml(book.review)}</div>`;
    }
    if (book.notes) {
      html += `<h4 style="margin-top:1rem;margin-bottom:0.4rem;font-size:0.85rem;color:var(--text-muted);">Notes</h4>
               <div class="view-review">${escapeHtml(book.notes)}</div>`;
    }

    document.getElementById('view-body').innerHTML = html;
    viewModal.classList.remove('hidden');
  } catch (e) {
    console.error(e);
  }
}

function closeViewModal() {
  viewModal.classList.add('hidden');
  viewingId = null;
}

async function handleDeleteFromView() {
  if (!viewingId) return;
  if (!confirm('Delete this book permanently?')) return;

  try {
    const res = await fetch(`${API}/api/books/${viewingId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Delete failed');
    closeViewModal();
    loadBooks();
    loadStats();
  } catch (e) {
    alert(e.message);
  }
}
