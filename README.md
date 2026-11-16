# Weather Dashboard

A lightweight, zero-build weather dashboard built with vanilla HTML, CSS, and JavaScript. Search for cities to see real-time conditions and a 3-day forecast, all in a responsive, themeable grid.

## Features

- Search any city via OpenWeatherMap
- "My location" button using browser geolocation and reverse geocoding
- Multi-city grid with add/remove cards
- °C / °F unit toggle
- Light / dark theme (follows system by default, manual override)
- 3-day forecast for every city
- Skeleton loaders, per-card error states with retry, and an empty state
- Persists cities, unit, and theme in `localStorage`
- Responsive layout with accessibility touches (ARIA labels, live status, reduced-motion support)

## Tech Stack

- Plain HTML/CSS/JS — no framework, no build step
- [Axios](https://cdn.jsdelivr.net/npm/axios@1.7.9/dist/axios.min.js) loaded from a CDN
- OpenWeatherMap REST API (Current Weather, 5-day Forecast, Geocoding)

## Project Structure

```
weather-dashboard/
├── index.html   # Markup and layout
├── styles.css   # Design tokens, light/dark themes, components
├── app.js       # State, API calls, rendering, events
└── config.js    # API key, endpoints, default cities
```

## Getting Started

### Prerequisites

- A free [OpenWeatherMap](https://openweathermap.org/api) API key

### Setup

1. Open `config.js` and set your key:

   ```js
   const CONFIG = {
     API_KEY: "your-api-key-here",
     // ...
   };
   ```

2. Run the app in one of these ways:
   - Open `index.html` directly in a browser, **or**
   - Serve it locally (recommended — geolocation requires `http://localhost` or HTTPS):

     ```bash
     python -m http.server 8000
     # or
     npx serve
     ```

3. Visit `http://localhost:8000` (or the URL printed by `npx serve`).

The dashboard starts with the cities listed in `DEFAULT_CITIES` (`Cairo`, `London`, `Tokyo`).

## Configuration

All settings live in `config.js`:

| Key               | Description                                  |
| ----------------- | -------------------------------------------- |
| `API_KEY`         | Your OpenWeatherMap API key                  |
| `BASE_URL`        | OpenWeatherMap data API base URL             |
| `GEO_URL`         | OpenWeatherMap geocoding API base URL        |
| `ICON_URL`        | Base URL for weather icons                   |
| `DEFAULT_CITIES`  | Cities shown on first load                   |
| `REQUEST_TIMEOUT` | Request timeout in milliseconds              |

## Usage

- **Search** — type a city name and press Enter or click **Search**.
- **My location** — click **📍 My location** and allow the browser prompt.
- **Units** — switch between **°C** and **°F** in the header.
- **Theme** — use the sun/moon button to toggle light and dark mode.
- **Remove a city** — click the **✕** on any card.

## Security Note

The API key is stored in `config.js`, which is served to the browser and therefore public. This is fine for local development, but for production you should proxy requests through a backend or restrict the key. If you commit a real key, rotate it and consider adding `config.js` to `.gitignore`.

## License

MIT

---

Data by [OpenWeatherMap](https://openweathermap.org/).
