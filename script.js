(function() {
    "use strict";

    // DOM elements
    const dateEl = document.getElementById('gmtDate');
    const newsTicker = document.getElementById('newsTicker');
    const calendarDays = document.getElementById('calendarDays');
    const calendarHeader = document.getElementById('calendarHeader');

    // Weather elements
    const weatherLocation = document.getElementById('weatherLocation');
    const currentTempEl = document.getElementById('currentTemp');
    const highTempEl = document.getElementById('highTemp');
    const lowTempEl = document.getElementById('lowTemp');
    const currentWeatherIcon = document.getElementById('currentWeatherIcon');
    const forecastContainer = document.getElementById('forecastContainer');

    // Clock elements
    const hour1 = document.getElementById('hour1');
    const hour2 = document.getElementById('hour2');
    const min1 = document.getElementById('min1');
    const min2 = document.getElementById('min2');
    const sec1 = document.getElementById('sec1');
    const sec2 = document.getElementById('sec2');
    
    const hourFirst = document.querySelector('.hours .first');
    const hourSecond = document.querySelector('.hours .second');
    const minFirst = document.querySelector('.minutes .first');
    const minSecond = document.querySelector('.minutes .second');
    const secFirst = document.querySelector('.seconds .first');
    const secSecond = document.querySelector('.seconds .second');
    
    const ticks = document.querySelectorAll('.tick');

    // Default config - will be overridden by config.txt
    let config = {
        TIMEZONE: 'GMT+0',
        LOCATION: 'CRAWLEY, WEST SUSSEX, ENGLAND',
        TEMPERATURE_UNIT: 'C',
        NEWSTICKER: '',
        CALENDAR1: '',
        CALENDARHEADER: 'MOLEYS AGENDA',
        CALENDAR_DAYS: 14,
        CALENDAR_REFRESH: 30,
        OPENWEATHER_API_KEY: '',
        POLITICS: 'politics',
        SPORT: 'sport',
        TRAVEL: 'travel',
        BREAKING: 'breaking',
        WEATHER: 'weather',
        BUSINESS: 'business',
        TRUMP: 'trump'
    };

    const CORS_PROXIES = [
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/',
        'https://thingproxy.freeboard.io/fetch/'
    ];
    
    let newsItems = [];
    let lastNewsFetch = null;

    // ----- SCROLLING CLOCK -----
    let last = new Date(0);
    last.setUTCHours(-1);
    
    let isAnimating = false;

    function updateTime() {
        var now = new Date();
        var offsetHours = getGMTOffset(config.TIMEZONE);
        var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        var timezoneTime = new Date(utc + (3600000 * offsetHours));

        var hours = timezoneTime.getUTCHours().toString().padStart(2, '0');
        var minutes = timezoneTime.getUTCMinutes().toString().padStart(2, '0');
        var seconds = timezoneTime.getUTCSeconds().toString().padStart(2, '0');

        if (last.getUTCHours() !== timezoneTime.getUTCHours()) {
            hour1.textContent = hours[0];
            hour2.textContent = hours[1];
        }

        if (last.getUTCMinutes() !== timezoneTime.getUTCMinutes()) {
            min1.textContent = minutes[0];
            min2.textContent = minutes[1];
            
            sec1.textContent = seconds[0];
            sec2.textContent = seconds[1];
            
            minFirst.classList.add('move');
            minSecond.classList.add('move');
            secFirst.classList.add('move');
            secSecond.classList.add('move');
            
            ticks.forEach(t => t.classList.add('tick-blink'));
            
            setTimeout(() => {
                minFirst.classList.remove('move');
                minSecond.classList.remove('move');
                secFirst.classList.remove('move');
                secSecond.classList.remove('move');
                ticks.forEach(t => t.classList.remove('tick-blink'));
            }, 280);
        }

        if (last.getUTCSeconds() !== timezoneTime.getUTCSeconds() && !isAnimating) {
            sec1.textContent = seconds[0];
            sec2.textContent = seconds[1];
        }

        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const weekday = weekdays[timezoneTime.getUTCDay()];
        const day = timezoneTime.getUTCDate().toString().padStart(2, '0');
        const month = months[timezoneTime.getUTCMonth()];
        const year = timezoneTime.getUTCFullYear();
        
        // Add GMT info after date
        dateEl.innerHTML = `${weekday}, ${day} ${month} ${year} <span>${config.TIMEZONE}</span>`;

        last = timezoneTime;
    }

    // ----- CALENDAR with iCal Parser - FILTERED BY DAYS -----
    async function fetchCalendar() {
        if (!config.CALENDAR1) {
            calendarDays.innerHTML = `<div class="calendar-error">ERROR: No calendar URL configured in config.txt</div>`;
            return;
        }

        try {
            calendarDays.innerHTML = '<div style="color: #888; text-align: center;">Loading calendar events...</div>';
            
            const response = await fetch('calendar-proxy.php');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const icalData = await response.text();
            
            // Parse iCal data
            const events = parseICal(icalData);
            
            if (events.length === 0) {
                calendarDays.innerHTML = '<div class="calendar-error">No events found</div>';
                return;
            }
            
            // Get today's date at midnight for comparison
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Calculate cutoff date based on CALENDAR_DAYS
            const daysToShow = parseInt(config.CALENDAR_DAYS) || 14;
            const cutoffDate = new Date(today);
            cutoffDate.setDate(today.getDate() + daysToShow);
            
            // Filter events: only today and future within the specified days
            const futureEvents = events.filter(event => {
                const eventDate = new Date(event.startDate);
                eventDate.setHours(0, 0, 0, 0);
                return eventDate >= today && eventDate <= cutoffDate;
            });
            
            if (futureEvents.length === 0) {
                calendarDays.innerHTML = `<div class="calendar-error">No upcoming events in the next ${daysToShow} days</div>`;
                return;
            }
            
            // Sort events by date (closest first)
            futureEvents.sort((a, b) => a.startDate - b.startDate);
            
            // Build calendar HTML
            let calendarHtml = '';
            let currentDate = '';
            
            futureEvents.forEach((event, index) => {
                const eventDate = new Date(event.startDate);
                const dateStr = formatEventDate(eventDate);
                const timeStr = formatEventTime(eventDate);
                
                // Add date header if it's a new date
                if (dateStr !== currentDate) {
                    currentDate = dateStr;
                    calendarHtml += `
                        <div style="color: #b3e2f9; font-size: 1.15rem; font-weight: 600; margin-top: ${index > 0 ? '4px' : '0'}; margin-bottom: 2px; border-bottom: 1px solid #444; padding-bottom: 2px;">
                            ${dateStr}
                        </div>
                    `;
                }
                
                // Determine if it's today
                const isToday = isSameDay(eventDate, new Date());
                const todayStyle = isToday ? 'border-left: 2px solid #b3e2f9; padding-left: 4px;' : '';
                
                calendarHtml += `
                    <div class="calendar-event-item" style="padding: 2px 0; ${todayStyle}">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 500; font-size: 1.05rem;">${escapeHtml(event.summary)}</span>
                            <span style="color: #888; font-size: 0.95rem;">${timeStr}</span>
                        </div>
                        ${event.location ? `<div style="color: #666; font-size: 0.9rem; line-height: 1.2;">📍 ${escapeHtml(event.location)}</div>` : ''}
                    </div>
                `;
            });
            
            calendarDays.innerHTML = calendarHtml;

        } catch (error) {
            console.error('Calendar fetch error:', error);
            calendarDays.innerHTML = `
                <div class="calendar-error">
                    ERROR: Could not load calendar<br><br>
                    ${error.message}
                </div>
            `;
        }
    }

    function isSameDay(date1, date2) {
        return date1.getUTCFullYear() === date2.getUTCFullYear() &&
               date1.getUTCMonth() === date2.getUTCMonth() &&
               date1.getUTCDate() === date2.getUTCDate();
    }

    function parseICal(icalData) {
        const events = [];
        const lines = icalData.split('\n');
        
        let currentEvent = null;
        let inEvent = false;
        
        for (let line of lines) {
            line = line.trim();
            
            if (line === 'BEGIN:VEVENT') {
                inEvent = true;
                currentEvent = {};
            } else if (line === 'END:VEVENT') {
                if (currentEvent && currentEvent.startDate && currentEvent.summary) {
                    events.push(currentEvent);
                }
                inEvent = false;
                currentEvent = null;
            } else if (inEvent && currentEvent) {
                if (line.startsWith('SUMMARY:')) {
                    currentEvent.summary = line.substring(8);
                } else if (line.startsWith('LOCATION:')) {
                    currentEvent.location = line.substring(9);
                } else if (line.startsWith('DTSTART')) {
                    const dateStr = line.split(':')[1];
                    if (dateStr) {
                        if (dateStr.includes('T')) {
                            const year = dateStr.substring(0, 4);
                            const month = dateStr.substring(4, 6);
                            const day = dateStr.substring(6, 8);
                            const hour = dateStr.substring(9, 11);
                            const minute = dateStr.substring(11, 13);
                            currentEvent.startDate = new Date(Date.UTC(year, month-1, day, hour, minute));
                        } else {
                            const year = dateStr.substring(0, 4);
                            const month = dateStr.substring(4, 6);
                            const day = dateStr.substring(6, 8);
                            currentEvent.startDate = new Date(Date.UTC(year, month-1, day));
                        }
                    }
                }
            }
        }
        
        return events;
    }

    function formatEventDate(date) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        if (isSameDay(date, today)) {
            return 'TODAY';
        }
        
        if (isSameDay(date, tomorrow)) {
            return 'TOMORROW';
        }
        
        return date.toLocaleDateString('en-GB', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short',
            timeZone: 'UTC'
        }).toUpperCase();
    }

    function formatEventTime(date) {
        const utcHours = date.getUTCHours();
        const utcMinutes = date.getUTCMinutes();
        const utcSeconds = date.getUTCSeconds();
        
        if (utcHours === 0 && utcMinutes === 0 && utcSeconds === 0) {
            return 'All day';
        }
        return date.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'UTC',
            hour12: false 
        });
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ----- NEWS -----
    function getCategoryClass(category) {
        const catLower = category.toLowerCase();
        
        if (catLower.includes(config.POLITICS?.toLowerCase() || 'politics')) return 'politics';
        if (catLower.includes(config.SPORT?.toLowerCase() || 'sport')) return 'sport';
        if (catLower.includes(config.TRAVEL?.toLowerCase() || 'travel')) return 'travel';
        if (catLower.includes('breaking')) return 'breaking';
        if (catLower.includes(config.WEATHER?.toLowerCase() || 'weather')) return 'weather';
        if (catLower.includes(config.BUSINESS?.toLowerCase() || 'business')) return 'business';
        if (catLower.includes(config.TRUMP?.toLowerCase() || 'trump')) return 'trump';
        
        return 'default';
    }

    function getTimeAgo(timestamp) {
        const now = new Date();
        const diffMs = now - timestamp;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    }

    function updateNewsTicker() {
        if (newsItems.length === 0) {
            newsTicker.innerHTML = '<span class="news-badge">BBC NEWS</span><span class="news-item news-error">No news available</span>';
            return;
        }
        
        const sortedItems = [...newsItems].sort((a, b) => b.timestamp - a.timestamp);
        
        let newsHtml = '<span class="news-badge">BBC UK NEWS</span>';
        
        for (let i = 0; i < 2; i++) {
            sortedItems.forEach(item => {
                const timeAgo = getTimeAgo(item.timestamp);
                const categoryClass = getCategoryClass(item.category);
                
                newsHtml += `
                    <div class="news-item">
                        <span class="news-category ${categoryClass}">${item.category}</span>
                        <span class="news-headline">${item.title}</span>
                        <span class="news-timestamp">${timeAgo}</span>
                    </div>
                `;
            });
        }
        
        newsTicker.innerHTML = newsHtml;
    }

    async function fetchNews() {
        if (!config.NEWSTICKER || !config.NEWSTICKER.startsWith('http')) {
            showNewsError('ERROR: Invalid or missing NEWS URL in config.txt');
            return;
        }

        for (let proxyIndex = 0; proxyIndex < CORS_PROXIES.length; proxyIndex++) {
            try {
                const proxy = CORS_PROXIES[proxyIndex];
                
                const proxyUrl = proxy + encodeURIComponent(config.NEWSTICKER);
                const response = await fetch(proxyUrl, {
                    headers: { 'Origin': window.location.origin }
                });
                
                if (!response.ok) continue;
                
                const xmlText = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                
                const parserError = xmlDoc.querySelector('parsererror');
                if (parserError) continue;
                
                const items = xmlDoc.querySelectorAll('item');
                if (items.length === 0) continue;
                
                newsItems = [];
                const now = new Date();
                
                for (let i = 0; i < Math.min(items.length, 20); i++) {
                    const item = items[i];
                    const title = item.querySelector('title')?.textContent;
                    let category = item.querySelector('category')?.textContent || 'UK';
                    
                    if (!title) continue;
                    
                    let pubDate = item.querySelector('pubDate')?.textContent;
                    let timestamp = now;
                    
                    if (pubDate) {
                        const parsedDate = new Date(pubDate);
                        if (!isNaN(parsedDate)) {
                            timestamp = parsedDate;
                        }
                    }
                    
                    const cleanTitle = title.replace(/^BBC News\s*-\s*/i, '');
                    
                    newsItems.push({
                        title: cleanTitle,
                        category: category,
                        timestamp: timestamp
                    });
                }
                
                if (newsItems.length > 0) {
                    lastNewsFetch = now;
                    updateNewsTicker();
                    return;
                }
                
            } catch (error) {
                console.log(`Proxy ${proxyIndex + 1} failed:`, error.message);
                continue;
            }
        }
        
        showNewsError('ERROR: All CORS proxies failed');
    }

    function showNewsError(message) {
        newsItems = [];
        newsTicker.innerHTML = `
            <span class="news-badge">BBC NEWS</span>
            <span class="news-item news-error">${message}</span>
        `;
    }

    // ----- WEATHER - with TODAY and TOMORROW labels -----
    function getWeatherIcon(iconCode) {
        if (!iconCode) return '❓';
        const iconMap = {
            '01d': '☀️', '01n': '🌙',
            '02d': '⛅', '02n': '☁️',
            '03d': '☁️', '03n': '☁️',
            '04d': '☁️', '04n': '☁️',
            '09d': '🌧️', '09n': '🌧️',
            '10d': '🌦️', '10n': '🌧️',
            '11d': '⛈️', '11n': '⛈️',
            '13d': '🌨️', '13n': '🌨️',
            '50d': '🌫️', '50n': '🌫️'
        };
        return iconMap[iconCode] || '☁️';
    }

    function formatWeatherDate(date) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        if (isSameDay(date, today)) {
            return 'TODAY';
        }
        
        if (isSameDay(date, tomorrow)) {
            return 'TOMORROW';
        }
        
        return date.toLocaleDateString('en-GB', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short'
        }).toUpperCase();
    }

    async function fetchWeather() {
        forecastContainer.innerHTML = '';
        
        if (!config.OPENWEATHER_API_KEY) {
            showWeatherError('ERROR: OpenWeatherMap API key not configured in config.txt');
            return;
        }

        try {
            const cityName = config.LOCATION.split(',')[0].trim();

            const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&units=metric&appid=${config.OPENWEATHER_API_KEY}`;
            const currentResponse = await fetch(currentUrl);

            if (!currentResponse.ok) {
                if (currentResponse.status === 401) {
                    throw new Error('Invalid API key - check your OpenWeatherMap API key');
                } else if (currentResponse.status === 404) {
                    throw new Error(`City "${cityName}" not found - check LOCATION in config.txt`);
                } else {
                    throw new Error(`Weather API error: ${currentResponse.status}`);
                }
            }

            const currentData = await currentResponse.json();

            const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(cityName)}&units=metric&appid=${config.OPENWEATHER_API_KEY}`;
            const forecastResponse = await fetch(forecastUrl);
            
            if (!forecastResponse.ok) {
                throw new Error('Failed to fetch forecast data');
            }
            
            const forecastData = await forecastResponse.json();
            
            weatherLocation.textContent = cityName.toUpperCase();
            currentTempEl.textContent = `${Math.round(currentData.main.temp)}°${config.TEMPERATURE_UNIT}`;
            highTempEl.textContent = `H:${Math.round(currentData.main.temp_max)}°`;
            lowTempEl.textContent = `L:${Math.round(currentData.main.temp_min)}°`;
            currentWeatherIcon.textContent = getWeatherIcon(currentData.weather[0].icon);
            
            const dailyForecasts = [];
            const seenDates = new Set();
            
            forecastData.list.forEach(item => {
                const date = new Date(item.dt * 1000);
                const dateStr = date.toDateString();
                if (!seenDates.has(dateStr) && date.getHours() >= 11 && date.getHours() <= 14) {
                    seenDates.add(dateStr);
                    dailyForecasts.push({
                        date: date,
                        temp_max: item.main.temp_max,
                        temp_min: item.main.temp_min,
                        icon: item.weather[0].icon
                    });
                }
            });
            
            if (dailyForecasts.length === 0) {
                throw new Error('No forecast data available');
            }
            
            const fiveDayForecast = dailyForecasts.slice(0, 5);
            
            let forecastHtml = '';
            fiveDayForecast.forEach(day => {
                const dateStr = formatWeatherDate(day.date);
                
                forecastHtml += `
                    <div class="forecast-day">
                        <span class="forecast-date">${dateStr}</span>
                        <span class="forecast-icon">${getWeatherIcon(day.icon)}</span>
                        <span class="forecast-high">${Math.round(day.temp_max)}°</span>
                        <span class="forecast-low">${Math.round(day.temp_min)}°</span>
                    </div>
                `;
            });
            
            forecastContainer.innerHTML = forecastHtml;

        } catch (error) {
            console.error('Weather fetch error:', error);
            showWeatherError(`ERROR: ${error.message}`);
        }
    }

    function showWeatherError(message) {
        weatherLocation.textContent = 'ERROR';
        currentTempEl.textContent = '--°C';
        highTempEl.textContent = 'H:--°';
        lowTempEl.textContent = 'L:--°';
        currentWeatherIcon.textContent = '⚠️';
        forecastContainer.innerHTML = `<div class="weather-error">${message}</div>`;
    }

    // ----- CONFIG parsing -----
    function parseConfig(text) {
        const lines = text.split('\n');
        lines.forEach(line => {
            const cleanLine = line.split('#')[0].trim();
            if (cleanLine && cleanLine.includes('=')) {
                const [key, value] = cleanLine.split('=').map(s => s.trim());
                if (key && value && config.hasOwnProperty(key)) {
                    if (key === 'CALENDAR_DAYS' || key === 'CALENDAR_REFRESH') {
                        config[key] = parseInt(value) || (key === 'CALENDAR_DAYS' ? 14 : 30);
                    } else {
                        config[key] = value;
                    }
                }
            }
        });

        const refreshMinutes = parseInt(config.CALENDAR_REFRESH) || 30;
        const refreshMs = refreshMinutes * 60 * 1000;
        
        fetchCalendar();
        fetchNews();
        fetchWeather();

        setInterval(fetchNews, 5 * 60 * 1000);
        setInterval(() => {
            if (newsItems.length > 0) {
                updateNewsTicker();
            }
        }, 60 * 1000);
        setInterval(fetchWeather, 30 * 60 * 1000);
        setInterval(fetchCalendar, refreshMs);
    }

    async function loadConfig() {
        try {
            const response = await fetch('config.txt');
            if (response.ok) {
                const text = await response.text();
                parseConfig(text);
            } else {
                showWeatherError('ERROR: config.txt not found - create config.txt with OPENWEATHER_API_KEY');
                showNewsError('ERROR: config.txt not found - add NEWSTICKER URL');
                calendarDays.innerHTML = `<div class="calendar-error">ERROR: config.txt not found - add CALENDAR1 URL</div>`;
            }
        } catch (error) {
            showWeatherError('ERROR: config.txt not found');
            showNewsError('ERROR: config.txt not found');
            calendarDays.innerHTML = `<div class="calendar-error">ERROR: config.txt not found</div>`;
        }
    }

    function getGMTOffset(timezoneStr) {
        const match = timezoneStr.match(/GMT([+-])(\d+)/i);
        if (match) {
            const sign = match[1] === '+' ? 1 : -1;
            const hours = parseInt(match[2], 10);
            return sign * hours;
        }
        return 0;
    }

    function initClock() {
        const now = new Date();
        const offsetHours = getGMTOffset(config.TIMEZONE);
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const timezoneTime = new Date(utc + (3600000 * offsetHours));
        
        const hours = timezoneTime.getUTCHours().toString().padStart(2, '0');
        const minutes = timezoneTime.getUTCMinutes().toString().padStart(2, '0');
        const seconds = timezoneTime.getUTCSeconds().toString().padStart(2, '0');
        
        hour1.textContent = hours[0];
        hour2.textContent = hours[1];
        min1.textContent = minutes[0];
        min2.textContent = minutes[1];
        sec1.textContent = seconds[0];
        sec2.textContent = seconds[1];
    }

    // Start
    loadConfig().then(() => {
        initClock();
        updateTime();
        setInterval(updateTime, 100);
    });
})();