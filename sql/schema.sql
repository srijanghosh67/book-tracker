-- Personal Book Tracker Database Schema
-- Run this in MySQL after creating the database

CREATE DATABASE IF NOT EXISTS book_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE book_tracker;

-- Users table (for personal multi-user support with private libraries)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Books table - each book belongs to one user
CREATE TABLE IF NOT EXISTS books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    genre VARCHAR(100) DEFAULT NULL,
    pages INT DEFAULT NULL,
    status ENUM('want_to_read', 'reading', 'read') DEFAULT 'want_to_read',
    rating TINYINT DEFAULT NULL,
    date_started DATE DEFAULT NULL,
    date_finished DATE DEFAULT NULL,
    review TEXT DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    cover_url VARCHAR(500) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status),
    INDEX idx_user_title (user_id, title)
) ENGINE=InnoDB;
