// Dashboard JavaScript - Real-time monitoring of rate limiter stats
class RateLimiterDashboard {
    constructor() {
        this.updateInterval = null;
        this.isUpdating = false;
        this.chart = null;
        this.trafficData = [];
        this.init();
    }

    init() {
        this.startPolling();
        this.initChart();
        console.log('Rate Limiter Dashboard initialized');
    }

    initChart() {
        const ctx = document.getElementById('trafficChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({length: 30}, (_, i) => `${(29 - i) * 2}s ago`),
                datasets: [{
                    label: 'Total Requests in Queues',
                    data: this.trafficData,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    startPolling() {
        // Update immediately
        this.updateStats();

        // Then poll every 2 seconds
        this.updateInterval = setInterval(() => {
            this.updateStats();
        }, 2000);
    }

    stopPolling() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    async updateStats() {
        if (this.isUpdating) return;

        try {
            this.isUpdating = true;
            const response = await fetch('/api/admin/stats');
            const data = await response.json();

            this.updateUI(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
            this.showError('Failed to connect to server');
        } finally {
            this.isUpdating = false;
        }
    }

    updateUI(data) {
        // Update stat cards
        this.updateStatCard('activeUsers', data.totalActiveUsers);
        this.updateStatCard('totalRequests', data.totalRequestsInQueues);
        this.updateStatCard('freeLimit', data.tierLimits.FREE_TIER);
        this.updateStatCard('proLimit', data.tierLimits.PRO_TIER);

        // Update traffic chart
        this.trafficData.push(data.totalRequestsInQueues);
        if (this.trafficData.length > 30) {
            this.trafficData.shift();
        }
        if (this.chart) {
            this.chart.data.datasets[0].data = this.trafficData;
            this.chart.update();
        }

        const proLimitInput = document.getElementById('proLimitInput');
        if (proLimitInput) {
            proLimitInput.value = data.tierLimits.PRO_TIER;
        }

        // Update active users table
        this.updateActiveUsersTable(data.activeUsers);

        // Update violations table
        this.updateViolationsTable(data.recentLogs);

        // Update blacklist table
        this.updateBlacklistTable(data.blockedIPs);
    }

    updateStatCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = Number(value).toLocaleString();
        }
    }

    updateActiveUsersTable(users) {
        const tbody = document.querySelector('#activeUsersTable tbody');

        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="no-data">No active users</td></tr>';
            return;
        }

        const rows = users.map(user => `
            <tr>
                <td>${this.escapeHtml(user.identifier)}</td>
                <td>${user.queueSize}</td>
                <td>${user.lastRequest ? new Date(user.lastRequest).toLocaleTimeString() : 'N/A'}</td>
            </tr>
        `).join('');

        tbody.innerHTML = rows;
    }

    updateViolationsTable(logs) {
        const tbody = document.querySelector('#violationsTable tbody');

        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="no-data">No violations</td></tr>';
            return;
        }

        const rows = logs.map(log => `
            <tr>
                <td>${this.escapeHtml(log.identifier)}</td>
                <td><span class="violation-type ${log.violationType.toLowerCase().replace('_', '-')}">${log.violationType.replace('_', ' ')}</span></td>
                <td>${this.escapeHtml(log.endpoint)}</td>
                <td>${new Date(log.timestamp).toLocaleString()}</td>
            </tr>
        `).join('');

        tbody.innerHTML = rows;
    }

    updateBlacklistTable(blockedIPs) {
        const tbody = document.querySelector('#blacklistTable tbody');

        if (!blockedIPs || blockedIPs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" class="no-data">No blocked IPs</td></tr>';
            return;
        }

        const rows = blockedIPs.map(ip => `
            <tr>
                <td>${this.escapeHtml(ip)}</td>
                <td><button class="unblock-btn" data-ip="${this.escapeHtml(ip)}">Unblock</button></td>
            </tr>
        `).join('');

        tbody.innerHTML = rows;

        // Re-bind unblock buttons
        this.bindUnblockButtons();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        this.showMessage(message, 'error');
        console.error(message);
    }

    async bindSettingsControls() {
        const button = document.getElementById('updateProLimitBtn');
        const input = document.getElementById('proLimitInput');

        if (!button || !input) return;

        button.addEventListener('click', async () => {
            const newLimit = parseInt(input.value, 10);
            if (!Number.isInteger(newLimit) || newLimit <= 0) {
                this.showMessage('Please enter a positive integer', 'error');
                return;
            }

            try {
                const response = await fetch('/api/admin/settings', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ proTierLimit: newLimit })
                });

                const result = await response.json();
                if (!response.ok) {
                    this.showMessage(result.error || 'Update failed', 'error');
                    return;
                }

                this.showMessage(result.message || 'PRO tier limit updated', 'success');
                this.updateStatCard('proLimit', result.tierLimits.PRO_TIER);
            } catch (error) {
                console.error('Failed to update PRO tier limit:', error);
                this.showMessage('Failed to update limit', 'error');
            }
        });
    }

    showMessage(message, type = 'success') {
        const messageEl = document.getElementById('settingsMessage');
        if (!messageEl) return;

        messageEl.textContent = message;
        messageEl.className = `settings-message ${type}`;

        setTimeout(() => {
            messageEl.textContent = '';
            messageEl.className = 'settings-message';
        }, 3000);
    }

    async bindBlacklistControls() {
        const button = document.getElementById('blockIPBtn');
        const input = document.getElementById('blockIPInput');

        if (!button || !input) return;

        button.addEventListener('click', async () => {
            const ipAddress = input.value.trim();
            if (!ipAddress) {
                this.showMessage('Please enter an IP address', 'error');
                return;
            }

            try {
                const response = await fetch('/api/admin/blacklist', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ipAddress })
                });

                const result = await response.json();
                if (!response.ok) {
                    this.showMessage(result.error || 'Failed to block IP', 'error');
                    return;
                }

                this.showMessage(result.message || 'IP blocked successfully', 'success');
                input.value = '';
                this.updateBlacklistTable(result.blockedIPs);
            } catch (error) {
                console.error('Failed to block IP:', error);
                this.showMessage('Failed to block IP', 'error');
            }
        });
    }

    bindUnblockButtons() {
        const buttons = document.querySelectorAll('.unblock-btn');
        buttons.forEach(button => {
            button.addEventListener('click', async (e) => {
                const ipAddress = e.target.dataset.ip;
                if (!ipAddress) return;

                try {
                    const response = await fetch('/api/admin/blacklist', {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ ipAddress })
                    });

                    const result = await response.json();
                    if (!response.ok) {
                        this.showMessage(result.error || 'Failed to unblock IP', 'error');
                        return;
                    }

                    this.showMessage(result.message || 'IP unblocked successfully', 'success');
                    this.updateBlacklistTable(result.blockedIPs);
                } catch (error) {
                    console.error('Failed to unblock IP:', error);
                    this.showMessage('Failed to unblock IP', 'error');
                }
            });
        });
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new RateLimiterDashboard();
    if (window.dashboard) {
        window.dashboard.bindSettingsControls();
        window.dashboard.bindBlacklistControls();
    }
});

// Handle page visibility changes to pause/resume polling
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (window.dashboard) {
            window.dashboard.stopPolling();
        }
    } else {
        if (window.dashboard) {
            window.dashboard.startPolling();
        }
    }
});