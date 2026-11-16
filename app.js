(() => {
  "use strict";

  const STORAGE = {
    cities: "weatherdash.cities",
    unit: "weatherdash.unit",
    theme: "weatherdash.theme",
  };

  const state = {
    cities: [],
    unit: "metric",
    cards: new Map(),
    booting: true,
  };

  const el = {};

  /* ---------------- Storage ---------------- */
  function loadState() {
    state.unit = localStorage.getItem(STORAGE.unit) === "imperial" ? "imperial" : "metric";
    const raw = localStorage.getItem(STORAGE.cities);
    let restored = false;
    if (raw !== null) {
      try {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved)) {
          state.cities = saved.filter((c) => c && c.id && c.name);
          restored = true;
        }
      } catch (_) {
        /* corrupted storage → fall back to defaults */
      }
    }
    if (!restored) {
      state.cities = CONFIG.DEFAULT_CITIES.map((name) => ({
        id: name.toLowerCase(),
        name,
        country: "",
        local: false,
      }));
    }
  }

  const saveCities = () =>
    localStorage.setItem(STORAGE.cities, JSON.stringify(state.cities));
  const saveUnit = () => localStorage.setItem(STORAGE.unit, state.unit);

  /* ---------------- Theme ---------------- */
  const prefersDark = () =>
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const isDark = () => {
    const attr = document.documentElement.getAttribute("data-theme");
    return attr ? attr === "dark" : prefersDark();
  };

  function applyStoredTheme() {
    const saved = localStorage.getItem(STORAGE.theme);
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  }

  function toggleTheme() {
    const next = isDark() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE.theme, next);
  }

  /* ---------------- Helpers ---------------- */
  const unitSymbol = () => (state.unit === "metric" ? "°C" : "°F");
  const windUnit = () => (state.unit === "metric" ? "m/s" : "mph");

  function iconUrl(code) {
    return `${CONFIG.ICON_URL}/${code}@2x.png`;
  }

  function params(query) {
    return { appid: CONFIG.API_KEY, units: state.unit, ...query };
  }

  function apiGet(url, query) {
    return axios.get(url, {
      params: params(query),
      timeout: CONFIG.REQUEST_TIMEOUT,
    });
  }

  function describeError(err) {
    if (err.response) {
      const code = err.response.status;
      if (code === 401) return "API key unauthorized — check your key in config.js";
      if (code === 404) return "City not found";
      if (code === 429) return "Rate limit reached — try again shortly";
      return `API error (${code})`;
    }
    if (err.code === "ECONNABORTED") return "Request timed out";
    return "Network error — check your connection";
  }

  function setStatus(text, type = "") {
    el.status.textContent = text;
    el.status.className = `status${type ? " is-" + type : ""}`;
  }

  function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.classList.toggle("is-loading", loading);
  }

  /* ---------------- API fetches ---------------- */
  async function fetchCityData(city) {
    const q = city.lat != null ? { lat: city.lat, lon: city.lon } : { q: city.name };
    const [current, forecast] = await Promise.all([
      apiGet(`${CONFIG.BASE_URL}/weather`, q),
      apiGet(`${CONFIG.BASE_URL}/forecast`, q),
    ]);
    return {
      current: current.data,
      forecast: buildForecast(forecast.data.list),
    };
  }

  function buildForecast(list) {
    const byDay = new Map();
    for (const item of list) {
      const date = new Date(item.dt * 1000);
      const key = date.toDateString();
      let day = byDay.get(key);
      if (!day) {
        day = { date, min: Infinity, max: -Infinity, noonDist: Infinity, icon: null };
        byDay.set(key, day);
      }
      day.min = Math.min(day.min, item.main.temp_min);
      day.max = Math.max(day.max, item.main.temp_max);
      const dist = Math.abs(date.getHours() - 12);
      if (dist < day.noonDist) {
        day.noonDist = dist;
        day.icon = item.weather[0].icon;
      }
    }
    return [...byDay.values()].slice(0, 3).map((d, i) => ({
      label:
        i === 0
          ? "Today"
          : i === 1
          ? "Tmrw"
          : d.date.toLocaleDateString(undefined, { weekday: "short" }),
      icon: d.icon,
      min: Math.round(d.min),
      max: Math.round(d.max),
    }));
  }

  /* ---------------- Rendering ---------------- */
  function cardShell(city) {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.id = city.id;
    card.style.animationDelay = "0s";
    return card;
  }

  function renderSkeleton(city) {
    const card = cardShell(city);
    card.innerHTML = `
      <div class="sk sk-title sk-line"></div>
      <div class="sk sk-temp"></div>
      <div class="sk sk-line" style="width:70%"></div>
      <div class="sk sk-row" style="margin-top:14px"></div>
      <div class="sk sk-row" style="margin-top:10px;height:56px"></div>`;
    return card;
  }

  function renderCard(city, data) {
    const { current, forecast } = data;
    const card = cardShell(city);
    const country = current.sys.country || city.country || "";
    const temp = Math.round(current.main.temp);
    const feels = Math.round(current.main.feels_like);

    card.innerHTML = `
      <div class="card-top">
        <div>
          <h2 class="card-city">
            ${escapeHtml(current.name || city.name)}
            ${city.local ? '<span class="badge-local">Your location</span>' : ""}
          </h2>
          <span class="card-country">${escapeHtml(country)}</span>
        </div>
        <button class="card-remove" data-remove="${escapeHtml(city.id)}" aria-label="Remove ${escapeHtml(current.name || city.name)}" title="Remove city">✕</button>
      </div>

      <div class="card-now">
        <div>
          <div class="card-temp">${temp}${unitSymbol()}</div>
          <p class="card-cond">${escapeHtml(current.weather[0].description)}</p>
        </div>
        <img class="card-icon" src="${iconUrl(current.weather[0].icon)}" alt="${escapeHtml(current.weather[0].description)}" loading="lazy" />
      </div>

      <div class="card-metrics">
        <div class="metric">
          <span class="metric-value">${feels}${unitSymbol()}</span>
          <span class="metric-label">Feels like</span>
        </div>
        <div class="metric">
          <span class="metric-value">${current.main.humidity}%</span>
          <span class="metric-label">Humidity</span>
        </div>
        <div class="metric">
          <span class="metric-value">${Math.round(current.wind.speed)} ${windUnit()}</span>
          <span class="metric-label">Wind</span>
        </div>
      </div>

      <div class="forecast">
        ${forecast
          .map(
            (d) => `
          <div class="day">
            <div class="day-name">${d.label}</div>
            <img class="day-icon" src="${iconUrl(d.icon)}" alt="${d.label} forecast" loading="lazy" />
            <div class="day-temps">${d.max}${unitSymbol()} <span class="low">${d.min}${unitSymbol()}</span></div>
          </div>`
          )
          .join("")}
      </div>`;

    return card;
  }

  function renderErrorCard(city, message) {
    const card = cardShell(city);
    card.innerHTML = `
      <div class="card-error">
        <span class="err-icon" aria-hidden="true">⚠️</span>
        <strong>Couldn't load weather</strong>
        <p>${escapeHtml(message)}</p>
        <button class="btn btn-ghost" data-retry="${escapeHtml(city.id)}" style="margin-top:12px">Retry</button>
      </div>`;
    return card;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]);
  }

  function swapCard(cityId, node) {
    const old = state.cards.get(cityId);
    if (old && old.parentNode) old.parentNode.replaceChild(node, old);
    else el.grid.appendChild(node);
    state.cards.set(cityId, node);
    orderCards();
    updateEmptyState();
  }

  // Keep DOM order in sync with state.cities (e.g. geolocation card is prepended)
  function orderCards() {
    for (const city of state.cities) {
      const node = state.cards.get(city.id);
      if (node && node.parentNode === el.grid) el.grid.appendChild(node);
    }
  }

  function updateEmptyState() {
    const empty = state.cities.length === 0;
    el.empty.hidden = !empty || state.booting;
    el.grid.hidden = empty || state.booting;
  }

  /* ---------------- City lifecycle ---------------- */
  async function loadCity(city) {
    const skeleton = renderSkeleton(city);
    swapCard(city.id, skeleton);
    try {
      const data = await fetchCityData(city);
      swapCard(city.id, renderCard(city, data));
      return true;
    } catch (err) {
      const message = describeError(err);
      if (err.response && err.response.status === 401) setStatus(message, "error");
      swapCard(city.id, renderErrorCard(city, message));
      return false;
    }
  }

  async function refreshAll() {
    el.grid.innerHTML = "";
    state.cards.clear();
    updateEmptyState();
    await Promise.all(state.cities.map((city) => loadCity(city)));
  }

  async function addCity(rawName) {
    const name = rawName.trim();
    if (!name) return false;
    const id = name.toLowerCase();
    if (state.cities.some((c) => c.id === id)) {
      setStatus(`"${name}" is already on the dashboard`, "success");
      return false;
    }
    const city = { id, name, country: "", local: false };
    state.cities.push(city);
    saveCities();
    updateEmptyState();
    const ok = await loadCity(city);
    setStatus(
      ok ? `Added "${name}"` : `Couldn't load weather for "${name}"`,
      ok ? "success" : "error"
    );
    return ok;
  }

  function removeCity(id) {
    state.cities = state.cities.filter((c) => c.id !== id);
    saveCities();
    const node = state.cards.get(id);
    if (node) node.remove();
    state.cards.delete(id);
    updateEmptyState();
    setStatus("City removed");
  }

  /* ---------------- Geolocation ---------------- */
  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus("Geolocation is not supported by this browser", "error");
      return;
    }
    setLoading(el.locationBtn, true);
    setStatus("Getting your location…");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const geo = await apiGet(`${CONFIG.GEO_URL}/reverse`, { lat, lon, limit: 1 });
          const place = geo.data[0];
          if (!place) throw new Error("no-place");
          const id = `loc-${place.lat.toFixed(2)},${place.lon.toFixed(2)}`;
          state.cities = state.cities.filter((c) => !c.local);
          const city = {
            id,
            name: place.name,
            country: place.country || "",
            lat: place.lat,
            lon: place.lon,
            local: true,
          };
          state.cities.unshift(city);
          saveCities();
          updateEmptyState();
          await loadCity(city);
          setStatus(`Showing weather for your location: ${place.name}`, "success");
        } catch (err) {
          setStatus(describeError(err), "error");
        } finally {
          setLoading(el.locationBtn, false);
        }
      },
      (err) => {
        setLoading(el.locationBtn, false);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied"
            : err.code === err.POSITION_UNAVAILABLE
            ? "Location unavailable"
            : "Location request timed out";
        setStatus(msg, "error");
      },
      { timeout: 10000, maximumAge: 600000 }
    );
  }

  /* ---------------- Events ---------------- */
  function bindEvents() {
    el.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const value = el.input.value.trim();
      if (!value) return;
      el.input.value = "";
      setLoading(el.searchBtn, true);
      setStatus(`Searching for "${value}"…`);
      await addCity(value);
      setLoading(el.searchBtn, false);
    });

    el.locationBtn.addEventListener("click", useMyLocation);
    el.themeToggle.addEventListener("click", toggleTheme);

    document.querySelectorAll(".unit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const unit = btn.dataset.unit;
        if (unit === state.unit) return;
        state.unit = unit;
        saveUnit();
        document.querySelectorAll(".unit-btn").forEach((b) => {
          b.setAttribute("aria-pressed", String(b.dataset.unit === unit));
        });
        setStatus(`Switched to ${unitSymbol()}`);
        refreshAll();
      });
    });

    el.grid.addEventListener("click", (e) => {
      const rm = e.target.closest("[data-remove]");
      if (rm) return removeCity(rm.dataset.remove);
      const retry = e.target.closest("[data-retry]");
      if (retry) {
        const city = state.cities.find((c) => c.id === retry.dataset.retry);
        if (city) loadCity(city);
      }
    });
  }

  /* ---------------- Init ---------------- */
  async function init() {
    el.grid = document.getElementById("city-grid");
    el.empty = document.getElementById("empty-state");
    el.form = document.getElementById("search-form");
    el.input = document.getElementById("search-input");
    el.searchBtn = document.getElementById("search-btn");
    el.locationBtn = document.getElementById("location-btn");
    el.themeToggle = document.getElementById("theme-toggle");
    el.status = document.getElementById("status-message");
    el.loader = document.getElementById("initial-loader");

    applyStoredTheme();
    loadState();

    document.querySelectorAll(".unit-btn").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.unit === state.unit));
    });

    bindEvents();
    el.loader.hidden = false;
    updateEmptyState();
    await refreshAll();
    state.booting = false;
    el.loader.hidden = true;
    updateEmptyState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
