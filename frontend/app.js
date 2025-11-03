const API_BASE = 'http://localhost:5000/api';

async function analyzeSummoner() {
    const input = document.getElementById('summonerInput').value.trim();
    const region = document.getElementById('regionSelect').value;
    
    if (!input.includes('#')) {
        showError('Please enter summoner name in format: Name#TAG');
        return;
    }
    
    const [gameName, tagLine] = input.split('#');
    
    showLoading();
    hideError();
    hideResults();
    
    try {
        const response = await fetch(`${API_BASE}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameName, tagLine, region })
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch summoner data');
        }
        
        const data = await response.json();
        displayResults(data);
    } catch (error) {
        showError(error.message);
    } finally {
        hideLoading();
    }
}

function displayResults(data) {
    document.getElementById('mbtiType').textContent = data.profile.archetype;
    document.getElementById('archetypeName').textContent = data.profile.archetype_name;
    document.getElementById('summary').textContent = data.profile.summary;
    document.getElementById('seasonStory').textContent = data.profile.season_story;
    
    const strengthsList = document.getElementById('strengthsList');
    strengthsList.innerHTML = data.profile.strengths.map(s => `<li>${s}</li>`).join('');
    
    const growthList = document.getElementById('growthList');
    growthList.innerHTML = data.profile.growth_areas.map(g => `<li>${g}</li>`).join('');
    
    displayChampions(data.champions);
    displayRadarChart(data.metrics);
    
    document.getElementById('results').classList.remove('hidden');
}

function displayChampions(champions) {
    const list = document.getElementById('championList');
    list.innerHTML = champions.slice(0, 5).map(c => `
        <div class="champion-item">
            <span>${c.name}</span>
            <span>${c.games} games</span>
        </div>
    `).join('');
}

function displayRadarChart(metrics) {
    const ctx = document.getElementById('radarChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: Object.keys(metrics).map(k => k.replace('_', ' ')),
            datasets: [{
                label: 'Your Playstyle',
                data: Object.values(metrics).map(v => v * 10),
                backgroundColor: 'rgba(102, 126, 234, 0.2)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { color: '#a0aec0' },
                    grid: { color: '#2d3748' },
                    pointLabels: { color: '#e0e6ed' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

function hideError() {
    document.getElementById('error').classList.add('hidden');
}

function hideResults() {
    document.getElementById('results').classList.add('hidden');
}
