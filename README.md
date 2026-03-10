# Multi-Tool Hub

A web-based multi-tool application built with Next.js, React, and Tailwind CSS.

## Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v20 or later recommended)
- npm (comes with Node.js)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

### 3. Open in Browser

Navigate to **[http://localhost:3000](http://localhost:3000)**

The app supports hot-reload, so changes to your code will automatically update in the browser.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot-reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server (after build) |
| `npm run lint` | Run ESLint to check code quality |

## Project Structure

```
multi-tool-hub/
├── app/              # Next.js App Router pages
├── src/              # Source code (components, utilities, etc.)
├── public/           # Static assets
├── web/              # Web-specific code
└── Website/          # Additional website files
```

## Tech Stack

- **Framework:** Next.js 16
- **UI:** React 19, Tailwind CSS 4
- **Icons:** Lucide React
- **Language:** TypeScript

## Troubleshooting

**Port 3000 already in use?**  
Next.js will automatically use port 3001, or you can specify a custom port:

```bash
npm run dev -- -p 3001
```

**Build errors?**  
Clear the cache and reinstall:

```bash
rm -rf .next node_modules
npm install
npm run dev
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
# multitool
