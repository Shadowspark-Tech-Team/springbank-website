/* ============================================================================
   UI.JS
   UI interactions and enhancements for SpringBank Demo
   Created by: Stephen Chijioke Okoronkwo, Shadowspark Technologies
   ============================================================================ */

document.addEventListener('DOMContentLoaded', function() {
    initUIFeatures();
});

// Main UI initialization
function initUIFeatures() {
    initTooltips();
    initLoadingStates();
    initFormValidation();
    initInteractiveElements();
    initAccessibility();
}

// ============================================================================
// TOOLTIPS
// ============================================================================

function initTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
    });
}

function showTooltip(e) {
    const text = e.target.getAttribute('data-tooltip');
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    tooltip.id = 'active-tooltip';
    
    document.body.appendChild(tooltip);
    
    const rect = e.target.getBoundingClientRect();
    tooltip.style.top = (rect.top - tooltip.offsetHeight - 8) + 'px';
    tooltip.style.left = (rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)) + 'px';
    
    setTimeout(() => tooltip.classList.add('visible'), 10);
}

function hideTooltip() {
    const tooltip = document.getElementById('active-tooltip');
    if (tooltip) {
        tooltip.classList.remove('visible');
        setTimeout(() => tooltip.remove(), 200);
    }
}

// ============================================================================
// LOADING STATES
// ============================================================================

function initLoadingStates() {
    // Add loading class to images until they load
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
        if (!img.complete) {
            img.classList.add('loading');
            img.addEventListener('load', function() {
                this.classList.remove('loading');
                this.classList.add('loaded');
            });
        }
    });
}

function showLoading(element) {
    element.classList.add('loading');
    element.disabled = true;
    
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    element.appendChild(spinner);
}

function hideLoading(element) {
    element.classList.remove('loading');
    element.disabled = false;
    
    const spinner = element.querySelector('.loading-spinner');
    if (spinner) spinner.remove();
}

// ============================================================================
// FORM VALIDATION
// ============================================================================

function initFormValidation() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        const inputs = form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            input.addEventListener('blur', function() {
                validateInput(this);
            });
            
            input.addEventListener('input', function() {
                if (this.classList.contains('error')) {
                    validateInput(this);
                }
            });
        });
    });
}

function validateInput(input) {
    const value = input.value.trim();
    let isValid = true;
    let errorMessage = '';
    
    // Required validation
    if (input.hasAttribute('required') && !value) {
        isValid = false;
        errorMessage = 'This field is required';
    }
    
    // Email validation
    if (input.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid email address';
        }
    }
    
    // Number validation
    if (input.type === 'number' && value) {
        const num = parseFloat(value);
        if (isNaN(num)) {
            isValid = false;
            errorMessage = 'Please enter a valid number';
        }
        
        if (input.hasAttribute('min') && num < parseFloat(input.getAttribute('min'))) {
            isValid = false;
            errorMessage = `Minimum value is ${input.getAttribute('min')}`;
        }
        
        if (input.hasAttribute('max') && num > parseFloat(input.getAttribute('max'))) {
            isValid = false;
            errorMessage = `Maximum value is ${input.getAttribute('max')}`;
        }
    }
    
    // Update UI
    if (isValid) {
        input.classList.remove('error');
        removeError(input);
    } else {
        input.classList.add('error');
        showError(input, errorMessage);
    }
    
    return isValid;
}

function showError(input, message) {
    removeError(input);
    
    const error = document.createElement('div');
    error.className = 'input-error';
    error.textContent = message;
    
    input.parentElement.appendChild(error);
}

function removeError(input) {
    const error = input.parentElement.querySelector('.input-error');
    if (error) error.remove();
}

// ============================================================================
// INTERACTIVE ELEMENTS
// ============================================================================

function initInteractiveElements() {
    // Add ripple effect to buttons
    const buttons = document.querySelectorAll('.btn, .action-btn, .quick-amount');
    
    buttons.forEach(button => {
        button.addEventListener('click', createRipple);
    });
    
    // Animate numbers on scroll
    initNumberAnimations();
    
    // Init card hover effects
    initCardEffects();
}

function createRipple(e) {
    const button = e.currentTarget;
    const ripple = document.createElement('span');
    
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple-effect');
    
    button.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
}

function initNumberAnimations() {
    const numbers = document.querySelectorAll('[data-animate-number]');
    
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
                entry.target.classList.add('animated');
                animateNumber(entry.target);
            }
        });
    }, { threshold: 0.5 });
    
    numbers.forEach(num => observer.observe(num));
}

function animateNumber(element) {
    const target = parseFloat(element.textContent.replace(/[^0-9.-]+/g, ''));
    const duration = 1500;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    let step = 0;
    
    const timer = setInterval(() => {
        current += increment;
        step++;
        
        if (step >= steps) {
            current = target;
            clearInterval(timer);
        }
        
        element.textContent = formatAnimatedNumber(current, element);
    }, duration / steps);
}

function formatAnimatedNumber(num, element) {
    const originalText = element.getAttribute('data-animate-number');
    
    if (originalText.includes('$')) {
        return '$' + num.toFixed(2);
    } else if (originalText.includes('%')) {
        return num.toFixed(1) + '%';
    }
    
    return Math.round(num).toString();
}

function initCardEffects() {
    const cards = document.querySelectorAll('.feature-card, .investment-card, .security-card, .testimonial-card');
    
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
}

// ============================================================================
// ACCESSIBILITY
// ============================================================================

function initAccessibility() {
    // Add skip to main content link
    addSkipLink();
    
    // Improve keyboard navigation
    improveKeyboardNav();
    
    // Add ARIA labels where missing
    addAriaLabels();
}

function addSkipLink() {
    const skipLink = document.createElement('a');
    skipLink.href = '#main';
    skipLink.className = 'skip-link';
    skipLink.textContent = 'Skip to main content';
    
    document.body.insertBefore(skipLink, document.body.firstChild);
}

function improveKeyboardNav() {
    // Make all interactive elements keyboard accessible
    const interactiveElements = document.querySelectorAll('.action-btn, .contact-card, .device-item, .stock-item');
    
    interactiveElements.forEach(element => {
        if (!element.hasAttribute('tabindex')) {
            element.setAttribute('tabindex', '0');
        }
        
        element.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    });
}

function addAriaLabels() {
    // Add ARIA labels to icon buttons
    const iconButtons = document.querySelectorAll('.icon-btn');
    
    iconButtons.forEach(button => {
        if (!button.hasAttribute('aria-label')) {
            button.setAttribute('aria-label', 'More options');
        }
    });
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icon = getNotificationIcon(type);
    notification.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
        <button class="notification-close" aria-label="Close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Auto remove after 5 seconds
    setTimeout(() => removeNotification(notification), 5000);
    
    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
        removeNotification(notification);
    });
}

function removeNotification(notification) {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
}

function getNotificationIcon(type) {
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    return icons[type] || icons.info;
}

// ============================================================================
// COPY TO CLIPBOARD
// ============================================================================

function copyToClipboard(text, successMessage = 'Copied to clipboard!') {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification(successMessage, 'success');
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
        document.execCommand('copy');
        showNotification('Copied to clipboard!', 'success');
    } catch (err) {
        showNotification('Failed to copy', 'error');
    }
    
    document.body.removeChild(textArea);
}

// ============================================================================
// SMOOTH REVEAL ON SCROLL
// ============================================================================

function initScrollReveal() {
    const elements = document.querySelectorAll('.scroll-reveal');
    
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    elements.forEach(element => observer.observe(element));
}

// Initialize scroll reveal
initScrollReveal();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Detect if element is in viewport
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Console message
console.log('%c✨ UI features loaded', 'color: #C9A227; font-size: 12px;');
