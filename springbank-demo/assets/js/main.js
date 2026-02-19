/* ============================================================================
   MAIN JAVASCRIPT
   Core functionality for SpringBank Demo
   Created by: Stephen Chijioke Okoronkwo, Shadowspark Technologies
   ============================================================================ */

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Main initialization function
function initializeApp() {
    initNavigation();
    initThemeToggle();
    initScrollAnimations();
    initCounters();
    initTransferForm();
    initSecurityScore();
    loadThemePreference();
}

// ============================================================================
// NAVIGATION
// ============================================================================

function initNavigation() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    const header = document.getElementById('header');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Hamburger menu toggle
    if (hamburger) {
        hamburger.addEventListener('click', function() {
            this.classList.toggle('active');
            navMenu.classList.toggle('active');
            document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
        });
    }
    
    // Close menu when clicking nav links
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
    
    // Sticky header on scroll
    let lastScroll = 0;
    window.addEventListener('scroll', function() {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        lastScroll = currentScroll;
    });
}

// ============================================================================
// THEME TOGGLE
// ============================================================================

function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            
            // Update icon
            const icon = this.querySelector('i');
            icon.className = isLight ? 'fas fa-sun' : 'fas fa-moon';
            
            // Save preference
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
        });
    }
}

function loadThemePreference() {
    const savedTheme = localStorage.getItem('theme');
    const themeToggle = document.getElementById('themeToggle');
    
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            icon.className = 'fas fa-sun';
        }
    }
}

// ============================================================================
// SCROLL ANIMATIONS
// ============================================================================

function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe all fade-in-up elements
    document.querySelectorAll('.fade-in-up').forEach(element => {
        observer.observe(element);
    });
}

// ============================================================================
// ANIMATED COUNTERS
// ============================================================================

function initCounters() {
    const counters = document.querySelectorAll('.stat-number[data-target]');
    
    const observerOptions = {
        threshold: 0.5
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
                entry.target.classList.add('counted');
                animateCounter(entry.target);
            }
        });
    }, observerOptions);
    
    counters.forEach(counter => observer.observe(counter));
}

function animateCounter(element) {
    const target = parseInt(element.getAttribute('data-target'));
    const duration = 2000; // 2 seconds
    const increment = target / (duration / 16); // 60fps
    let current = 0;
    
    const timer = setInterval(function() {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = formatNumber(Math.floor(current));
    }, 16);
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M+';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(0) + 'K+';
    }
    return num.toString();
}

// ============================================================================
// TRANSFER FORM
// ============================================================================

let currentStep = 1;
let transferData = {
    recipient: '',
    amount: '',
    note: ''
};

function initTransferForm() {
    // Initialize first step
    showStep(1);
}

function selectRecipient(name) {
    transferData.recipient = name;
    
    // Show selected recipient
    const selectedDiv = document.getElementById('selectedRecipient');
    if (selectedDiv) {
        selectedDiv.innerHTML = `
            <div class="contact-avatar">${name.split(' ').map(n => n[0]).join('')}</div>
            <div>
                <div class="contact-name">${name}</div>
                <div class="contact-account">Selected recipient</div>
            </div>
        `;
    }
    
    nextStep();
}

function setAmount(amount) {
    const amountInput = document.getElementById('transferAmount');
    if (amountInput) {
        amountInput.value = amount.toFixed(2);
        transferData.amount = amount;
    }
}

function nextStep() {
    // Validate current step
    if (currentStep === 2) {
        const amount = document.getElementById('transferAmount').value;
        const note = document.getElementById('transferNote').value;
        
        if (!amount || parseFloat(amount) <= 0) {
            if (typeof showNotification === 'function') {
                showNotification('Please enter a valid amount', 'error');
            }
            return;
        }
        
        transferData.amount = parseFloat(amount);
        transferData.note = note;
        
        // Update confirmation
        document.getElementById('confirmRecipient').textContent = transferData.recipient;
        document.getElementById('confirmAmount').textContent = '$' + transferData.amount.toFixed(2);
        document.getElementById('confirmTotal').textContent = '$' + transferData.amount.toFixed(2);
        document.getElementById('confirmNote').textContent = transferData.note || 'No note';
    }
    
    if (currentStep < 3) {
        currentStep++;
        showStep(currentStep);
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
    }
}

function showStep(step) {
    // Update steps indicator
    document.querySelectorAll('.step').forEach((el, index) => {
        if (index + 1 <= step) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
    
    // Show correct form step
    document.querySelectorAll('.form-step').forEach((el, index) => {
        if (index + 1 === step) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}

function submitTransfer() {
    // Show success modal
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.classList.add('active');
        
        // Reset form after delay
        setTimeout(function() {
            resetTransferForm();
        }, 2000);
    }
}

function closeModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function resetTransferForm() {
    currentStep = 1;
    transferData = {
        recipient: '',
        amount: '',
        note: ''
    };
    
    // Clear inputs
    const amountInput = document.getElementById('transferAmount');
    const noteInput = document.getElementById('transferNote');
    if (amountInput) amountInput.value = '';
    if (noteInput) noteInput.value = '';
    
    showStep(1);
}

// ============================================================================
// SECURITY SCORE
// ============================================================================

function initSecurityScore() {
    const scoreElement = document.getElementById('securityScore');
    const scoreRing = document.getElementById('scoreRing');
    
    if (scoreElement && scoreRing) {
        const observerOptions = {
            threshold: 0.5
        };
        
        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
                    entry.target.classList.add('animated');
                    animateSecurityScore();
                }
            });
        }, observerOptions);
        
        observer.observe(scoreElement);
    }
}

function animateSecurityScore() {
    const scoreElement = document.getElementById('securityScore');
    const scoreRing = document.getElementById('scoreRing');
    const target = parseInt(scoreElement.getAttribute('data-target'));
    
    // Animate number
    let current = 0;
    const duration = 2000;
    const increment = target / (duration / 16);
    
    const timer = setInterval(function() {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        scoreElement.textContent = Math.floor(current);
    }, 16);
    
    // Animate ring
    const circumference = 2 * Math.PI * 85; // radius = 85
    const offset = circumference - (target / 100) * circumference;
    scoreRing.style.strokeDashoffset = offset;
}

// ============================================================================
// INVESTMENT CALCULATOR
// ============================================================================

function calculateInvestment() {
    const initial = parseFloat(document.getElementById('initialInvestment').value) || 0;
    const monthly = parseFloat(document.getElementById('monthlyContribution').value) || 0;
    const rate = parseFloat(document.getElementById('returnRate').value) || 0;
    const years = parseFloat(document.getElementById('timePeriod').value) || 0;
    
    // Compound interest formula
    const monthlyRate = rate / 100 / 12;
    const months = years * 12;
    
    // Future value of initial investment
    const fvInitial = initial * Math.pow(1 + monthlyRate, months);
    
    // Future value of monthly contributions
    const fvMonthly = monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    
    const totalValue = fvInitial + fvMonthly;
    
    // Display result
    const resultElement = document.querySelector('.result-value');
    if (resultElement) {
        resultElement.textContent = '$' + totalValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        
        // Animate result
        resultElement.parentElement.style.animation = 'scaleIn 0.5s ease';
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Format currency
function formatCurrency(amount) {
    return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Smooth scroll to section
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================================================
// GLOBAL EVENT LISTENERS
// ============================================================================

// Close modal on overlay click
window.addEventListener('click', function(e) {
    const modal = document.getElementById('successModal');
    if (e.target === modal) {
        closeModal();
    }
});

// Handle form submissions
document.addEventListener('submit', function(e) {
    e.preventDefault();
});

// Handle keyboard navigation
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
        
        // Close mobile menu
        const hamburger = document.getElementById('hamburger');
        const navMenu = document.getElementById('navMenu');
        if (hamburger && navMenu.classList.contains('active')) {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
});

// Console message
console.log('%c🏦 SpringBank Demo', 'color: #00D4AA; font-size: 20px; font-weight: bold;');
console.log('%cDesigned by Stephen Chijioke Okoronkwo', 'color: #C9A227; font-size: 14px;');
console.log('%cShadowspark Technologies', 'color: #C9A227; font-size: 14px;');
console.log('%chttps://shadowspark-tech.org', 'color: #00D4AA; font-size: 12px;');
