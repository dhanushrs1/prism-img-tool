/*
    PRISM / CORE LOGIC v2.2
    Cleaned & De-duplicated
*/

// --- State Variables ---
let filesQueue = []; 
let globalQuality = 0.85;

// --- Global Actions (Attached to window for inline HTML onclicks) ---

window.removeFile = (id) => {
    filesQueue = filesQueue.filter(f => f.id !== id);
    renderQueue();
};

window.downloadSingle = (id) => {
    const item = filesQueue.find(f => f.id === id);
    if (item && item.resultBlob) {
        const url = URL.createObjectURL(item.resultBlob);
        const a = document.createElement('a');
        a.href = url;
        const originalName = item.file.name.substring(0, item.file.name.lastIndexOf('.')) || item.file.name;
        a.download = originalName + '.webp';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
};

window.reconvertItem = async (id) => {
    const item = filesQueue.find(f => f.id === id);
    if (!item) return;

    item.status = 'converting';
    renderQueue();

    try {
        const result = await convertImageToWebP(item.file, globalQuality);
        item.resultBlob = result.blob;
        item.resultSize = result.blob.size;
        item.currentQuality = globalQuality;
        item.status = 'done';
        showToast('Re-conversion complete');
    } catch (err) {
        console.error(err);
        item.status = 'error';
        showToast('Re-conversion failed', 'error');
    }
    renderQueue();
};

// --- Modal & Preview Logic ---

window.openPreview = (id) => {
    const item = filesQueue.find(f => f.id === id);
    if (!item || !item.resultBlob) return;

    const previewModal = document.getElementById('previewModal');
    const compOriginal = document.getElementById('compOriginal');
    const compResult = document.getElementById('compResult');
    const compOverlay = document.getElementById('compOverlay');
    const compSlider = document.getElementById('compSlider');
    const previewSize = document.getElementById('previewSize');
    const previewQuality = document.getElementById('previewQuality');

    // URLs
    const origUrl = URL.createObjectURL(item.file);
    const resUrl = URL.createObjectURL(item.resultBlob);

    // Set Sources
    compOriginal.src = origUrl;
    compResult.src = resUrl;

    // Meta
    previewSize.textContent = formatBytes(item.resultSize);
    previewQuality.textContent = (item.currentQuality * 100).toFixed(0) + '%'; 
    
    previewModal.classList.add('active');

    // Reset Slider
    compOverlay.style.width = '50%';
    compSlider.style.left = '50%';

    // Sync Dimensions after load
    compOriginal.onload = () => {
        compResult.style.width = compOriginal.offsetWidth + 'px';
    };
};

window.closePreview = () => {
    const previewModal = document.getElementById('previewModal');
    previewModal.classList.remove('active');
    setTimeout(() => { 
        const orig = document.getElementById('compOriginal');
        const res = document.getElementById('compResult');
        if (orig) orig.src = '';
        if (res) res.src = '';
    }, 200);
};

function initComparisonSlider() {
    const wrapper = document.getElementById('comparisonWrapper');
    const overlay = document.getElementById('compOverlay');
    const slider = document.getElementById('compSlider');
    const originalImg = document.getElementById('compOriginal');
    const resultImg = document.getElementById('compResult');

    if (!wrapper || !overlay || !slider) return;

    let active = false;

    const start = (e) => { 
        // e.preventDefault(); // Sometimes prevents touch scroll, careful
        active = true; 
    };
    const end = () => active = false;
    
    const move = (e) => {
        if (!active) return;
        
        // Sync width logic safety
        if (originalImg && resultImg) {
            const w = originalImg.offsetWidth;
            if (w > 0) resultImg.style.width = w + 'px';
        }

        let clientX;
        if (e.type.startsWith('touch')) {
            clientX = e.touches[0].clientX;
        } else {
            clientX = e.clientX;
        }

        const rect = wrapper.getBoundingClientRect();
        let position = clientX - rect.left;

        // Clamp
        if (position < 0) position = 0;
        if (position > rect.width) position = rect.width;

        const percentage = (position / rect.width) * 100;
        
        overlay.style.width = percentage + '%';
        slider.style.left = percentage + '%';
    };

    slider.addEventListener('mousedown', start);
    slider.addEventListener('touchstart', start, {passive: true});

    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end);
    
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move);
    
    wrapper.addEventListener('click', (e) => {
        // Quick jump
        const rect = wrapper.getBoundingClientRect();
        const position = e.clientX - rect.left;
        const percentage = (position / rect.width) * 100;
        overlay.style.width = percentage + '%';
        slider.style.left = percentage + '%';
    });
}

// --- Main Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Theme Handling ---
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        const themeIcon = themeToggleBtn.querySelector('i');
        
        // Init Theme
        const savedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (themeIcon) themeIcon.classList.replace('ph-moon', 'ph-sun');
        }

        // Toggle Event
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            
            if (themeIcon) {
                if (newTheme === 'dark') {
                    themeIcon.classList.replace('ph-moon', 'ph-sun');
                } else {
                    themeIcon.classList.replace('ph-sun', 'ph-moon');
                }
            }
        });
    }

    // Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const qualitySlider = document.getElementById('qualitySlider');
    const qualityValue = document.getElementById('qualityValue');
    const convertAllBtn = document.getElementById('convertAllBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const previewModal = document.getElementById('previewModal');
    const closeModalBtn = document.getElementById('closeModalBtn');

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        fileInput.value = '';
    });

    // Controls
    qualitySlider.addEventListener('input', (e) => {
        const val = e.target.value;
        qualityValue.textContent = val + '%';
        globalQuality = val / 100;
    });

    // Global Buttons
    convertAllBtn.addEventListener('click', startConversion);
    downloadAllBtn.addEventListener('click', downloadAllAsZip);
    clearAllBtn.addEventListener('click', () => {
        filesQueue.forEach(f => {
            if (f.resultBlob) URL.revokeObjectURL(URL.createObjectURL(f.resultBlob));
        });
        filesQueue = [];
        const fileList = document.getElementById('fileList');
        if (fileList) fileList.innerHTML = '';
        updateUI();
    });

    // Modal Events
    if (closeModalBtn) closeModalBtn.addEventListener('click', window.closePreview);
    if (previewModal) {
        previewModal.addEventListener('click', (e) => {
            if (e.target === previewModal) window.closePreview();
        });
    }

    // Initialize Components
    initComparisonSlider();
    updateUI();
});

// --- Helper Functions ---

function handleFiles(fileListItems) {
    if (!fileListItems.length) return;
    
    let rejectedCount = 0;
    let newItemsAdded = false;

    Array.from(fileListItems).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        
        if (file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp')) {
            rejectedCount++;
            return;
        }

        const fileId = Date.now() + Math.random().toString(36).substring(2);
        filesQueue.push({
            id: fileId,
            file: file,
            status: 'waiting', 
            resultBlob: null,
            resultSize: 0,
            currentQuality: null
        });
        newItemsAdded = true;
    });

    if (rejectedCount > 0) {
        showToast(`Skipped ${rejectedCount} WEBP file(s). Input must be PNG/JPG/BMP.`, 'error');
    }

    renderQueue();
    
    // Auto-Start Check
    const autoConvertToggle = document.getElementById('autoConvertToggle');
    if (newItemsAdded && autoConvertToggle && autoConvertToggle.checked) {
        startConversion();
    }
}

function updateUI() {
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const convertAllBtn = document.getElementById('convertAllBtn');
    
    // Safety check if elements exist
    if (!downloadAllBtn || !convertAllBtn) return;

    const anyDone = filesQueue.some(f => f.status === 'done');
    downloadAllBtn.disabled = !anyDone;
    
    const nothingToConvert = !filesQueue.some(f => f.status === 'waiting');
    convertAllBtn.disabled = filesQueue.length === 0 || nothingToConvert;
    
    if (filesQueue.length === 0) {
        convertAllBtn.textContent = 'INITIALIZE_CONVERSION';
    }
}

function renderQueue() {
    const fileList = document.getElementById('fileList');
    if (!fileList) return;
    
    fileList.innerHTML = '';
    updateUI(); 
    
    if (filesQueue.length === 0) return;

    filesQueue.forEach(item => {
        const el = document.createElement('div');
        el.className = 'file-item';
        
        const thumbUrl = URL.createObjectURL(item.file);
        
        // Actions
        let actionsHtml = '';
        const safeId = `'${item.id}'`;
        
        if (item.status === 'done') {
            actionsHtml = `
                <button class="btn-icon" onclick="openPreview(${safeId})" title="Preview">
                    <i class="ph-bold ph-eye"></i>
                </button>
                <button class="btn-icon" onclick="reconvertItem(${safeId})" title="Redo with Current Quality">
                    <i class="ph-bold ph-arrows-clockwise"></i>
                </button>
                <button class="btn-icon" onclick="downloadSingle(${safeId})" title="Download">
                    <i class="ph-bold ph-download-simple"></i>
                </button>
                <button class="btn-icon" onclick="removeFile(${safeId})" title="Remove">
                    <i class="ph-bold ph-x"></i>
                </button>
            `;
        } else {
             actionsHtml = `
                <button class="btn-icon" onclick="removeFile(${safeId})">
                    <i class="ph-bold ph-x"></i>
                </button>
            `;
        }

        el.innerHTML = `
            <div class="file-item-name">
                <img src="${thumbUrl}" class="file-thumb">
                <span class="name-text" title="${item.file.name}">${item.file.name}</span>
            </div>
            <div class="file-item-size">
                ${item.status === 'done' 
                    ? `<span style="text-decoration: line-through; opacity: 0.6;">${formatBytes(item.file.size)}</span> <i class="ph-bold ph-arrow-right"></i> <strong>${formatBytes(item.resultSize)}</strong>` 
                    : formatBytes(item.file.size)}
            </div>
            <div class="file-item-status">
                ${getStatusLabel(item)}
            </div>
            <div class="item-actions">
                ${actionsHtml}
            </div>
        `;
        
        fileList.appendChild(el);
    });
}

function getStatusLabel(item) {
    if (item.status === 'waiting') return '<span class="status-badge status-waiting">READY</span>';
    if (item.status === 'converting') return '<span class="status-badge status-converting">PROCESSING...</span>';
    if (item.status === 'done') {
        const savings = calculateSavings(item.file.size, item.resultSize);
        return `<span class="status-badge status-done">DONE (-${savings}%)</span>`;
    }
    if (item.status === 'error') return '<span class="status-badge status-error">ERROR</span>';
    return '';
}

function calculateSavings(oldSize, newSize) {
    if (oldSize === 0) return 0;
    const savings = ((oldSize - newSize) / oldSize) * 100;
    return Math.max(0, savings).toFixed(0);
}

function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return; 
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = type === 'error' ? '<i class="ph-bold ph-warning"></i>' : '<i class="ph-bold ph-info"></i>';
    
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Core Async Conversion Loop
async function startConversion() {
    const convertAllBtn = document.getElementById('convertAllBtn');
    if (!convertAllBtn) return;

    const itemsToConvert = filesQueue.filter(f => f.status === 'waiting');
    if (itemsToConvert.length === 0) return;

    convertAllBtn.disabled = true;
    convertAllBtn.textContent = 'PROCESSING...';

    for (const item of itemsToConvert) {
        item.status = 'converting';
        renderQueue(); 
        
        try {
            const q = globalQuality;
            const result = await convertImageToWebP(item.file, q);
            item.resultBlob = result.blob;
            item.resultSize = result.blob.size;
            item.currentQuality = q;
            item.status = 'done';
        } catch (err) {
            console.error("Conversion failed", err);
            item.status = 'error';
        }
        renderQueue();
    }

    convertAllBtn.disabled = false;
    convertAllBtn.textContent = 'INITIALIZE_CONVERSION';
    updateUI();
    
    // Celebration
    if (filesQueue.every(f => f.status === 'done')) {
        if (window.confetti) {
            window.confetti({
                particleCount: 150,
                spread: 60,
                colors: ['#FF4D00', '#111111']
            });
        }
    }
}

function convertImageToWebP(file, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve({ blob: blob });
                    } else {
                        reject(new Error('Canvas toBlob failed'));
                    }
                }, 'image/webp', quality);
            };
            img.onerror = reject;
            img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function downloadAllAsZip() {
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const doneItems = filesQueue.filter(f => f.status === 'done');
    if (doneItems.length === 0) return;

    downloadAllBtn.textContent = 'ZIPPING...';
    
    try {
        const zip = new JSZip();
        
        doneItems.forEach(item => {
            const originalName = item.file.name.substring(0, item.file.name.lastIndexOf('.')) || item.file.name;
            zip.file(`${originalName}.webp`, item.resultBlob);
        });
        
        const content = await zip.generateAsync({type:"blob"});
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = "prism_output_pkg.zip";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);

    } catch(e) {
        console.error(e);
        showToast('ZIP creation failed', 'error');
    }
    
    downloadAllBtn.textContent = 'ARCHIVE_ZIP';
}
