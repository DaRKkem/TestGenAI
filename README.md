# TestGen AI

> Automatically generate unit tests from your source code using AI.

## Description

TestGen AI is a web application that allows developers to submit Python or JavaScript source code and instantly receive generated unit tests powered by a Large Language Model (LLM).

Built as a portfolio project at Holberton School (C28 — 2026).

## Features (MVP)

- User authentication (JWT)
- Code submission via paste or file upload
- Unit test generation via LLM (Mistral AI / Groq)
- Syntax-highlighted output with one-click copy
- Generation history per user
- Export tests as `.py` / `.js` file

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, SQLAlchemy |
| Database | SQLite |
| Frontend | HTML / CSS / Vanilla JS |
| Auth | JWT (python-jose) |
| LLM | Mistral AI, Groq (LLaMA 3) |

## Status

🚧 In development — MVP target: July 2026

## Author

Damien Rossi — [GitHub](https://github.com/DaRKkem)
