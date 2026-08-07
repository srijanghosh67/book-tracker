# Personal Book Tracker

A private, multi-user web app to track books you have read (or want to read) with personal reviews and notes.

**Stack:** HTML + CSS + JavaScript (frontend) · Node.js + Express · MySQL

Designed strictly for personal use — every user’s library is private and isolated.

## Features

- User registration & login (session-based)
- Add / edit / delete books
- Status: Want to Read · Currently Reading · Finished
- Star rating (1–5)
- Full review + private notes
- Optional cover image URL
- Search across title, author, genre, review
- Filter by status & sort options
- Reading stats dashboard (total, read, avg rating, pages…)

## Setup

### 1. Prerequisites
- Node.js 18+
- MySQL 8+ (or MariaDB)

### 2. Database
```bash
mysql -u root -p < sql/schema.sql
```
Or run the contents of `sql/schema.sql` in your MySQL client.

### 3. Environment
Copy the example and edit:
```bash
cp .env.example .env
```

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=book_tracker
SESSION_SECRET=change-this-to-a-long-random-string
PORT=3000
```

### 4. Install & Run
```bash
cd book-tracker
npm install
npm start
```

Open http://localhost:3000

Create an account and start tracking your books.

## Security notes (personal use)

- Passwords are hashed with bcrypt
- All book queries are scoped to the logged-in user (`user_id`)
- Sessions last 7 days
- Change `SESSION_SECRET` in production
- For true privacy, run it only on localhost or behind a VPN / private network

## Project structure

```
book-tracker/
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── sql/schema.sql
├── server.js
├── package.json
├── .env.example
└── README.md
```
