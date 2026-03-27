/* ============================================================================
   CHARTS.JS
   Chart.js configurations for investment dashboard
   Created by: Stephen Chijioke Okoronkwo, Shadowspark Technologies
   ============================================================================ */

// Initialize charts when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait for Chart.js to load
    if (typeof Chart !== 'undefined') {
        initCharts();
    } else {
        console.error('Chart.js not loaded');
    }
});

// Main initialization function
function initCharts() {
    initAssetChart();
    initGrowthChart();
}

// ============================================================================
// ASSET ALLOCATION PIE CHART
// ============================================================================

function initAssetChart() {
    const ctx = document.getElementById('assetChart');
    if (!ctx) return;
    
    // Create gradient
    const gradient1 = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient1.addColorStop(0, '#00D4AA');
    gradient1.addColorStop(1, '#00FFD0');
    
    const gradient2 = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient2.addColorStop(0, '#C9A227');
    gradient2.addColorStop(1, '#E5C76B');
    
    const gradient3 = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient3.addColorStop(0, '#2E5A8B');
    gradient3.addColorStop(1, '#1E3A5F');
    
    const gradient4 = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient4.addColorStop(0, '#FF5252');
    gradient4.addColorStop(1, '#FF8A80');
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Stocks', 'Bonds', 'Cash', 'Crypto'],
            datasets: [{
                data: [40, 30, 20, 10],
                backgroundColor: [
                    gradient1,
                    gradient2,
                    gradient3,
                    gradient4
                ],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(13, 27, 42, 0.9)',
                    padding: 12,
                    cornerRadius: 8,
                    titleColor: '#FFFFFF',
                    bodyColor: '#94A3B8',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed + '%';
                        }
                    }
                }
            },
            cutout: '70%',
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1500,
                easing: 'easeInOutQuart'
            }
        }
    });
}

// ============================================================================
// PORTFOLIO GROWTH LINE CHART
// ============================================================================

function initGrowthChart() {
    const ctx = document.getElementById('growthChart');
    if (!ctx) return;
    
    // Generate sample data for 12 months
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = [85000, 87500, 89200, 92000, 95500, 98200, 102000, 106500, 110200, 115000, 118500, 124589];
    
    // Create gradient
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(0, 212, 170, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 212, 170, 0)');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Portfolio Value',
                data: data,
                borderColor: '#00D4AA',
                backgroundColor: gradient,
                borderWidth: 3,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#00D4AA',
                pointHoverBorderColor: '#FFFFFF',
                pointHoverBorderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(13, 27, 42, 0.9)',
                    padding: 12,
                    cornerRadius: 8,
                    titleColor: '#FFFFFF',
                    bodyColor: '#94A3B8',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return '$' + context.parsed.y.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        color: '#64748B',
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#64748B',
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            return '$' + (value / 1000) + 'k';
                        }
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

// ============================================================================
// CHART UPDATE FUNCTIONS
// ============================================================================

// Update charts based on time filter
function updateChartsTimeframe(event, timeframe) {
    // This would typically fetch new data from an API
    // For demo purposes, we'll just update the active filter button
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // In a real application, you would:
    // 1. Fetch new data based on timeframe
    // 2. Update chart data
    // 3. Call chart.update()
    
    console.log('Chart timeframe updated to:', timeframe);
}

// ============================================================================
// STOCK TICKER ANIMATION
// ============================================================================

function animateStockPrices() {
    const stockItems = document.querySelectorAll('.stock-item');
    
    stockItems.forEach(item => {
        setInterval(() => {
            const priceElement = item.querySelector('.stock-price');
            const changeElement = item.querySelector('.stock-change');
            
            if (priceElement && changeElement) {
                // Generate random price change (-2% to +2%)
                const changePercent = (Math.random() * 4 - 2).toFixed(2);
                const currentPrice = parseFloat(priceElement.textContent.replace('$', ''));
                const newPrice = currentPrice * (1 + changePercent / 100);
                
                // Update price
                priceElement.textContent = '$' + newPrice.toFixed(2);
                
                // Update change indicator
                changeElement.textContent = (changePercent > 0 ? '+' : '') + changePercent + '%';
                changeElement.className = 'stock-change ' + (changePercent > 0 ? 'positive' : 'negative');
                
                // Add pulse animation
                item.style.animation = 'pulse 0.5s ease';
                setTimeout(() => {
                    item.style.animation = '';
                }, 500);
            }
        }, 5000); // Update every 5 seconds
    });
}

// Initialize stock ticker animation
document.addEventListener('DOMContentLoaded', function() {
    animateStockPrices();
});

// ============================================================================
// CHART UTILITIES
// ============================================================================

// Format large numbers
function formatChartNumber(num) {
    if (num >= 1000000) {
        return '$' + (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return '$' + (num / 1000).toFixed(0) + 'K';
    }
    return '$' + num.toString();
}

// Generate gradient for charts
function createChartGradient(ctx, color1, color2) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
}

// ============================================================================
// CHART THEME SUPPORT
// ============================================================================

// Update chart colors when theme changes
function updateChartTheme(theme) {
    const textColor = theme === 'light' ? '#0A2540' : '#FFFFFF';
    const gridColor = theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
    
    // Update all charts with new theme colors
    Chart.helpers.each(Chart.instances, function(instance) {
        if (instance.options.scales) {
            // Update axis colors
            if (instance.options.scales.x) {
                instance.options.scales.x.ticks.color = textColor;
                instance.options.scales.x.grid.color = gridColor;
            }
            if (instance.options.scales.y) {
                instance.options.scales.y.ticks.color = textColor;
                instance.options.scales.y.grid.color = gridColor;
            }
        }
        
        instance.update();
    });
}

// Listen for theme changes
window.addEventListener('themechange', function(e) {
    updateChartTheme(e.detail.theme);
});

// ============================================================================
// RESPONSIVE CHART HANDLING
// ============================================================================

// Handle window resize
let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        // Charts automatically resize with Chart.js responsive: true
        console.log('Charts resized');
    }, 250);
});

// ============================================================================
// CHART DATA EXPORT (Optional)
// ============================================================================

function exportChartData(chartId) {
    const chart = Chart.getChart(chartId);
    if (chart) {
        const data = {
            labels: chart.data.labels,
            datasets: chart.data.datasets.map(dataset => ({
                label: dataset.label,
                data: dataset.data
            }))
        };
        
        console.log('Chart data:', JSON.stringify(data, null, 2));
        return data;
    }
    return null;
}

// Console message
console.log('%c📊 Charts initialized', 'color: #00D4AA; font-size: 12px;');
