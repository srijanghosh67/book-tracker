// BOOK-MARKD — Frontend
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
      document.querySelectorAll('.auth-tabs .tab').forEach(t => {
        t.classList.remove('active', 'bg-paper-100', 'text-charcoal-950');
        t.classList.add('text-paper-100');
      });
      tab.classList.add('active', 'bg-paper-100', 'text-charcoal-950');
      tab.classList.remove('text-paper-100');
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

  // Open Library search
  document.getElementById('ol-search-btn').addEventListener('click', searchOpenLibrary);
  document.getElementById('ol-search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchOpenLibrary();
    }
  });

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
      ? `<img src="${escapeHtml(book.cover_url)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='📖'" />`
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

  // Clear Open Library search UI
  document.getElementById('ol-search-input').value = '';
  document.getElementById('ol-results').classList.add('hidden');
  document.getElementById('ol-results').innerHTML = '';
  document.getElementById('ol-status').textContent = '';
  document.getElementById('ol-status').classList.remove('error');

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
      <p class="text-muted text-sm mb-4">by ${escapeHtml(book.author)}</p>
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
      html += `<h4 class="font-mono text-[11px] uppercase tracking-widest text-muted mt-5 mb-2">Review</h4>
               <div class="view-review">${escapeHtml(book.review)}</div>`;
    }
    if (book.notes) {
      html += `<h4 class="font-mono text-[11px] uppercase tracking-widest text-muted mt-5 mb-2">Notes</h4>
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

// ========== OPEN LIBRARY API ==========
async function searchOpenLibrary() {
  const input = document.getElementById('ol-search-input');
  const query = input.value.trim();
  const resultsEl = document.getElementById('ol-results');
  const statusEl = document.getElementById('ol-status');

  if (!query) {
    statusEl.textContent = 'Please type a book title or ISBN';
    statusEl.classList.add('error');
    return;
  }

  statusEl.textContent = 'Searching Open Library…';
  statusEl.classList.remove('error');
  resultsEl.classList.add('hidden');
  resultsEl.innerHTML = '';

  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=key,title,author_name,first_publish_year,cover_i,number_of_pages_median,subject,isbn`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Search failed');

    const data = await res.json();
    const docs = data.docs || [];

    if (docs.length === 0) {
      statusEl.textContent = 'No books found. Try a different title or ISBN.';
      return;
    }

    statusEl.textContent = `Found ${docs.length} result${docs.length > 1 ? 's' : ''}. Click one to auto-fill.`;
    resultsEl.classList.remove('hidden');

    docs.forEach(doc => {
      const item = document.createElement('div');
      item.className = 'ol-result-item';

      const coverId = doc.cover_i;
      const coverUrl = coverId
        ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
        : '';

      const authors = (doc.author_name || []).slice(0, 2).join(', ') || 'Unknown author';
      const year = doc.first_publish_year || '';
      const pages = doc.number_of_pages_median || '';
      const subjects = (doc.subject || []).slice(0, 3).join(', ');

      item.innerHTML = `
        ${coverUrl
          ? `<img src="${coverUrl}" alt="" loading="lazy" onerror="this.style.display='none'" />`
          : `<div style="width:40px;height:60px;background:#1A1A1A;border:1px solid #2E2E2E;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">📖</div>`
        }
        <div class="ol-result-info min-w-0 flex-1">
          <div class="ol-result-title">${escapeHtml(doc.title || 'Untitled')}</div>
          <div class="ol-result-author">${escapeHtml(authors)}</div>
          ${year ? `<div class="ol-result-year">${year}${pages ? ' · ' + pages + ' pages' : ''}</div>` : ''}
        </div>
      `;

      item.addEventListener('click', () => {
        document.getElementById('book-title').value = doc.title || '';
        document.getElementById('book-author').value = authors !== 'Unknown author' ? authors : '';
        document.getElementById('book-pages').value = pages || '';
        document.getElementById('book-genre').value = subjects || '';
        document.getElementById('book-cover').value = coverUrl
          ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
          : '';

        resultsEl.classList.add('hidden');
        resultsEl.innerHTML = '';
        statusEl.textContent = '✓ Book details filled. You can still edit them.';
        input.value = '';
      });

      resultsEl.appendChild(item);
    });
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Could not reach Open Library. Check your internet connection.';
    statusEl.classList.add('error');
  }
}
