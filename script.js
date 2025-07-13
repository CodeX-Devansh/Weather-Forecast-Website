const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const locationBtn = document.getElementById('locationBtn');
const unitToggle = document.getElementById('unitToggle');

const weatherAppContainer = document.getElementById('weatherAppContainer');
const mainWeatherCard = document.getElementById('mainWeatherCard');
const weatherDisplayContent = document.getElementById('weatherDisplayContent');

const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');

// Location Alert
const locationAlert = document.getElementById('locationAlert');
const closeAlertBtn = locationAlert.querySelector('.close-alert');

// Current Weather Elements
const currentDateTimeEl = document.getElementById('currentDateTime');
const locationNameEl = document.getElementById('locationName');
const countryCodeEl = document.getElementById('countryCode');
const currentTempEl = document.getElementById('currentTemp');
const currentWeatherIconEl = document.getElementById('currentWeatherIcon'); 
const currentWeatherDescriptionSummaryEl = document.getElementById('currentWeatherDescriptionSummary'); // Corrected in HTML
const feelsLikeTempEl = document.getElementById('feelsLikeTempSummary'); 
const windBriefSummaryEl = document.getElementById('windBriefSummary');

// Current Details Elements
const windSpeedEl = document.getElementById('windSpeed');
const windDirectionEl = document.getElementById('windDirection');
const pressureEl = document.getElementById('pressure');
const humidityEl = document.getElementById('humidity');
const uvIndexEl = document.getElementById('uvIndex');
const dewPointEl = document.getElementById('dewPoint');
const visibilityEl = document.getElementById('visibility');

// Map Elements
const weatherMapContainer = document.getElementById('weatherMap');

// Precipitation Timeline Placeholders
const nowTimeEl = document.getElementById('nowTime');
const time15minEl = document.getElementById('time15min');
const time30minEl = document.getElementById('time30min');
const time45minEl = document.getElementById('time45min');
const time60minEl = document.getElementById('time60min');

// Forecast Elements
const hourlyForecastList = document.getElementById('hourlyForecastList');
const dailyForecastList = document.getElementById('dailyForecastList');

// Backend URL
const BACKEND_URL = 'http://localhost:3000';

// State for units (true = Celsius, false = Fahrenheit)
let isCelsius = true;
let currentWeatherData = null;

let loadingHideTimeout;

// Leaflet Map Variables
let map;
let currentMarker;

// --- Map Initialization ---
function initializeMap() {
    if (!map) {
        map = L.map('weatherMap', { zoomControl: false }).setView([0, 0], 2);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: ' '
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Disable map interaction initially for aesthetics, enable on data load if desired
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
        if (map.tap) map.tap.disable();
        weatherMapContainer.style.cursor = 'default';
    }
}

// --- Event Listeners ---
searchBtn.addEventListener('click', () => getWeather(cityInput.value.trim()));
cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        getWeather(cityInput.value.trim());
    }
});
locationBtn.addEventListener('click', getWeatherByGeolocation);
unitToggle.addEventListener('click', toggleUnits);
closeAlertBtn.addEventListener('click', () => locationAlert.style.display = 'none');

// --- Core Function to Fetch Weather Data ---
async function getWeather(query, isGeolocation = false) {
    if (!query) {
        showError('Please enter a city name or enable geolocation.');
        return;
    }

    showLoading(true);
    hideError();
    locationAlert.style.display = 'none';
    resetContentAnimations();

    try {
        let apiUrl = `${BACKEND_URL}/api/weather?`;
        if (isGeolocation) {
            apiUrl += `lat=${query.latitude}&lon=${query.longitude}`;
            console.log("Frontend: Attempting geolocation fetch to backend:", apiUrl);
        } else {
            apiUrl += `city=${encodeURIComponent(query)}`;
            console.log("Frontend: Attempting city search fetch to backend:", apiUrl);
        }

        const response = await fetch(apiUrl);
        console.log("Frontend: Received response from backend, status:", response.status);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Frontend: Successfully parsed JSON data:", data);

        currentWeatherData = data;
        updateWeatherDisplay();

        setTimeout(() => {
            weatherDisplayContent.classList.add('active');
            document.querySelectorAll('.module').forEach(module => {
                module.classList.add('fade-in', 'slide-up');
            });
        }, 50);

        setDynamicBodyBackground(data.current);
    } catch (error) {
        console.error('Frontend: Error fetching weather:', error);
        let errorMessage = `Error: ${error.message}`;
        if (error.message.includes('city not found')) {
            errorMessage = `City "${isGeolocation ? 'your location' : query}" not found. Please check the spelling.`;
        } else if (error.message.includes('401')) {
            errorMessage = 'Backend API Key issue. Please check your OpenWeatherMap API key on the server.';
        } else if (error.message.includes('Failed to fetch')) {
             errorMessage = 'Network error. Could not connect to the backend server. Is it running?';
        }
        showError(errorMessage);
        if (isGeolocation) {
            locationAlert.style.display = 'flex';
        }
    } finally {
        showLoading(false);
        console.log("Frontend: getWeather function finished.");
    }
}

// --- Display Weather Data (updates based on currentWeatherData and isCelsius) ---
function updateWeatherDisplay() {
    if (!currentWeatherData) return;

    const current = currentWeatherData.current;
    const forecast = currentWeatherData.forecast;

    // Common conversions
    const temp = isCelsius ? current.main.temp : (current.main.temp * 9/5) + 32;
    const feelsLike = isCelsius ? current.main.feels_like : (current.main.feels_like * 9/5) + 32;
    const tempUnitSymbol = isCelsius ? '°C' : '°F';
    const windSpeed = current.wind.speed.toFixed(1);
    const visibilityKm = (current.visibility / 1000).toFixed(1);
    const precipitationProb = forecast.list[0]?.pop ? (forecast.list[0].pop * 100).toFixed(0) : '--';

    // Wind direction
    const windDirection = getWindDirection(current.wind.deg);
    const windBriefText = current.wind.speed > 0.5 ? `${windSpeed}m/s ${windDirection} breeze` : 'Calm';

    // Dew Point (approximate calculation if not provided by API directly)
    let dewPoint = '--';
    if (current.main.temp && current.main.humidity) {
        const a = 17.27;
        const b = 237.7;
        const alpha = ((a * current.main.temp) / (b + current.main.temp)) + Math.log(current.main.humidity / 100);
        dewPoint = (b * alpha) / (a - alpha);
        dewPoint = isCelsius ? dewPoint.toFixed(1) : ((dewPoint * 9/5) + 32).toFixed(1);
    }

    // Update Header Date & Time (using current.dt and current.timezone)
    const currentUTC = new Date(current.dt * 1000);
    const cityLocalTime = new Date(currentUTC.getTime() + (current.timezone * 1000));
    currentDateTimeEl.textContent = cityLocalTime.toLocaleDateString('en-GB', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    }).replace(',', '');


    // Current Weather Card
    locationNameEl.textContent = `${current.name}, ${current.sys.country}`;
    currentTempEl.textContent = temp.toFixed(0);
    unitToggle.textContent = tempUnitSymbol;
    currentWeatherIconEl.src = `http://openweathermap.org/img/wn/${current.weather[0].icon}@4x.png`;
    currentWeatherIconEl.alt = current.weather[0].description;
    currentWeatherDescriptionSummaryEl.textContent = current.weather[0].description.charAt(0).toUpperCase() + current.weather[0].description.slice(1);
    feelsLikeTempEl.textContent = `Feels like: ${feelsLike.toFixed(1)}${tempUnitSymbol}`;

    // Current Details Grid
    humidityEl.textContent = `${current.main.humidity}%`;
    windSpeedEl.textContent = `${windSpeed}m/s`;
    windDirectionEl.textContent = windDirection;
    pressureEl.textContent = `${current.main.pressure}hPa`;
    uvIndexEl.textContent = '--';
    visibilityEl.textContent = `${visibilityKm}km`;
    dewPointEl.textContent = `${dewPoint}${tempUnitSymbol}`;

    // --- Update Map ---
    if (map) {
        const lat = current.coord.lat;
        const lon = current.coord.lon;
        map.setView([lat, lon], 10);

        if (currentMarker) {
            map.removeLayer(currentMarker);
        }
        currentMarker = L.marker([lat, lon]).addTo(map)
            .bindPopup(`<b>${current.name}</b><br>${current.weather[0].description}`).openPopup();
    }


    // Precipitation Timeline (using current browser time for local comparison)
    const nowBrowserTime = new Date();
    const commonTimeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    nowTimeEl.textContent = nowBrowserTime.toLocaleTimeString('en-US', commonTimeOptions);
    time15minEl.textContent = new Date(nowBrowserTime.getTime() + 15 * 60 * 1000).toLocaleTimeString('en-US', commonTimeOptions);
    time30minEl.textContent = new Date(nowBrowserTime.getTime() + 30 * 60 * 1000).toLocaleTimeString('en-US', commonTimeOptions);
    time45minEl.textContent = new Date(nowBrowserTime.getTime() + 45 * 60 * 1000).toLocaleTimeString('en-US', commonTimeOptions);
    time60minEl.textContent = new Date(nowBrowserTime.getTime() + 60 * 60 * 1000).toLocaleTimeString('en-US', commonTimeOptions);


    // Hourly Forecast
    displayHourlyForecast(forecast, isCelsius);

    // Daily Forecast
    displayDailyForecast(forecast, isCelsius);
}


function displayHourlyForecast(forecast, isCelsius) {
    hourlyForecastList.innerHTML = '';
    const tempUnit = isCelsius ? '°C' : '°F';
    const commonHourOptions = { hour: 'numeric', hour12: true };

    let count = 0;
    const now = Date.now();
    for (const item of forecast.list) {
        if (item.dt * 1000 < now - (3600 * 1000)) continue;

        const date = new Date(item.dt * 1000);
        const formattedHour = date.toLocaleTimeString('en-US', commonHourOptions).replace(' ', '');

        const temp = isCelsius ? item.main.temp : (item.main.temp * 9/5) + 32;
        const iconCode = item.weather[0].icon;
        const iconUrl = `http://openweathermap.org/img/wn/${iconCode}.png`;
        const conditionText = item.weather[0].description;

        const hourlyItemHtml = `
            <div class="hourly-item">
                <div class="time">${formattedHour}</div>
                <img src="${iconUrl}" alt="${conditionText}">
                <div class="temp">${temp.toFixed(0)}${tempUnit}</div>
            </div>
        `;
        hourlyForecastList.innerHTML += hourlyItemHtml;
        count++;
        if (count >= 10) break;
    }
}

function displayDailyForecast(forecast, isCelsius) {
    dailyForecastList.innerHTML = '';

    const dailyForecasts = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    forecast.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dayKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        if (!dailyForecasts[dayKey]) {
            dailyForecasts[dayKey] = {
                minTemp: item.main.temp,
                maxTemp: item.main.temp,
                representativeItem: item,
                timestamp: item.dt * 1000
            };
        } else {
            dailyForecasts[dayKey].minTemp = Math.min(dailyForecasts[dayKey].minTemp, item.main.temp);
            dailyForecasts[dayKey].maxTemp = Math.max(dailyForecasts[dayKey].maxTemp, item.main.temp);
            const currentRepHour = new Date(dailyForecasts[dayKey].representativeItem.dt * 1000).getHours();
            const newItemHour = date.getHours();
            if (Math.abs(newItemHour - 12) < Math.abs(currentRepHour - 12)) {
                 dailyForecasts[dayKey].representativeItem = item;
            }
        }
    });

    const sortedDailyForecasts = Object.values(dailyForecasts).sort((a, b) => a.timestamp - b.timestamp);

    let count = 0;
    for (const dailyData of sortedDailyForecasts) {
        if (count >= 8) break;
        const item = dailyData.representativeItem;

        const date = new Date(item.dt * 1000);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const tempUnit = isCelsius ? '°C' : '°F';
        const tempMin = isCelsius ? dailyData.minTemp : (dailyData.minTemp * 9/5) + 32;
        const tempMax = isCelsius ? dailyData.maxTemp : (dailyData.maxTemp * 9/5) + 32;
        const iconCode = item.weather[0].icon;
        const iconUrl = `http://openweathermap.org/img/wn/${iconCode}.png`;
        const description = item.weather[0].description;
        const shortDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });


        const dailyItemHtml = `
            <div class="daily-item">
                <div class="day-info">
                    <div class="day-name">${dayName}</div>
                    <div class="date-short">${shortDate}</div>
                </div>
                <img src="${iconUrl}" alt="${description}">
                <div class="temps">
                    <span class="temp-high">${tempMax.toFixed(0)}${tempUnit}</span> /
                    <span class="temp-low">${tempMin.toFixed(0)}${tempUnit}</span>
                </div>
                <div class="description">${description}</div>
                <i class="fas fa-chevron-down arrow-icon"></i>
            </div>
        `;
        dailyForecastList.innerHTML += dailyItemHtml;
        count++;
    }
}

// --- Geolocation ---
function getWeatherByGeolocation() {
    showLoading(true);
    hideError();
    resetContentAnimations();

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                getWeather({ latitude: lat, longitude: lon }, true);
            },
            (error) => {
                showLoading(false);
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        showError("Geolocation permission denied. Please allow location access in your browser settings.");
                        break;
                    case error.POSITION_UNAVAILABLE:
                        showError("Location information is unavailable. Please try again later.");
                        break;
                    case error.TIMEOUT:
                        showError("The request to get user location timed out.");
                        break;
                    default:
                        showError("An unknown error occurred while getting your location.");
                        break;
                }
            }
        );
    } else {
        showLoading(false);
        showError("Geolocation is not supported by this browser.");
    }
}

// --- Unit Conversion ---
function toggleUnits() {
    isCelsius = !isCelsius;
    if (currentWeatherData) {
        updateWeatherDisplay();
    }
}

// --- Dynamic Body Background based on Weather ---
function setDynamicBodyBackground(currentWeather) {
    const weatherId = currentWeather.weather[0].id;
    const iconCode = currentWeather.weather[0].icon;

    let className = 'clear-sky-day';

    if (iconCode.endsWith('n')) {
        if (weatherId >= 200 && weatherId < 300) className = 'thunderstorm';
        else if (weatherId >= 300 && weatherId < 600) className = 'rain-night';
        else if (weatherId >= 600 && weatherId < 700) className = 'snow';
        else if (weatherId >= 700 && weatherId < 800) className = 'mist';
        else if (weatherId === 800) className = 'clear-sky-night';
        else if (weatherId > 800) className = 'clouds-night';
    } else {
        if (weatherId >= 200 && weatherId < 300) className = 'thunderstorm';
        else if (weatherId >= 300 && weatherId < 600) className = 'rain-day';
        else if (weatherId >= 600 && weatherId < 700) className = 'snow';
        else if (weatherId >= 700 && weatherId < 800) className = 'mist';
        else if (weatherId === 800) className = 'clear-sky-day';
        else if (weatherId > 800) className = 'clouds-day';
    }

    const currentClasses = Array.from(weatherAppContainer.classList).filter(cls =>
        !cls.endsWith('-day') && !cls.endsWith('-night') && cls !== 'thunderstorm' && cls !== 'snow' && cls !== 'mist'
    );
    weatherAppContainer.className = currentClasses.join(' ');
    weatherAppContainer.classList.add(className);
}

// --- Utility Functions ---
function showLoading(show) {
    if (show) {
        clearTimeout(loadingHideTimeout);
        loadingDiv.style.display = 'flex';
        setTimeout(() => {
            loadingDiv.classList.add('active');
        }, 10);
    } else {
        loadingDiv.classList.remove('active');
        loadingHideTimeout = setTimeout(() => {
            loadingDiv.style.display = 'none';
        }, 350);
    }
}

function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.add('active');
}

function hideError() {
    errorDiv.classList.remove('active');
    errorDiv.textContent = '';
}

// Helper to get cardinal wind direction from degrees
function getWindDirection(degree) {
    if (degree === undefined) return '';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degree / 45) % 8;
    return directions[index];
}

// Function to remove animation classes, preparing for a new animation cycle
function resetContentAnimations() {
    weatherDisplayContent.classList.remove('active');
    document.querySelectorAll('.module').forEach(module => {
        module.classList.remove('fade-in', 'slide-up');
        void module.offsetWidth; // Force reflow
    });
}

// Initial state: hide content animations until data is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeMap();
    resetContentAnimations();
    getWeatherByGeolocation();
});