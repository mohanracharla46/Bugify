document.addEventListener('DOMContentLoaded', () => {
    const bugInput = document.getElementById('bugInput');
    const generateBtn = document.getElementById('generateBtn');
    const clearBtn = document.getElementById('clearBtn');
    const resultSection = document.getElementById('resultSection');
    const reportContent = document.getElementById('reportContent');
    const copyBtn = document.getElementById('copyBtn');
    const voiceBtn = document.getElementById('voiceBtn');
    const imageBtn = document.getElementById('imageBtn');
    const imageInput = document.getElementById('imageInput');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imageThumbnail = document.getElementById('imageThumbnail');
    const fileIconContainer = document.getElementById('fileIconContainer');
    const removeImageBtn = document.getElementById('removeImageBtn');
    const loadingStatusText = document.getElementById('loadingStatusText');
    const statusMessages = ['Thinking...', 'Analyzing bug...', 'Generating...', 'Writing report...'];

    let currentImageBase64 = null;

    // --- Image Input Logic ---
    imageBtn.addEventListener('click', () => {
        imageInput.click();
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const isImage = file.type.startsWith('image/');
            const reader = new FileReader();
            reader.onload = (event) => {
                currentImageBase64 = event.target.result;
                
                if (isImage) {
                    imageThumbnail.src = currentImageBase64;
                    imageThumbnail.classList.remove('hidden');
                    fileIconContainer.classList.add('hidden');
                } else {
                    imageThumbnail.classList.add('hidden');
                    fileIconContainer.classList.remove('hidden');
                }
                
                imagePreviewContainer.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    removeImageBtn.addEventListener('click', () => {
        currentImageBase64 = null;
        imageInput.value = '';
        imagePreviewContainer.classList.add('hidden');
    });

    // --- Voice Input Logic ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    let isListening = false;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isListening = true;
            voiceBtn.classList.add('listening');
            voiceBtn.title = 'Stop Listening';
            bugInput.placeholder = 'Listening...';
        };

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');

            bugInput.value = transcript;
        };

        recognition.onerror = (event) => {
            console.error('Speech Recognition Error:', event.error);
            stopListening();
        };

        recognition.onend = () => {
            stopListening();
        };
    } else {
        voiceBtn.style.display = 'none'; // Hide if not supported
        console.warn('Speech recognition not supported in this browser.');
    }

    function stopListening() {
        isListening = false;
        voiceBtn.classList.remove('listening');
        voiceBtn.title = 'Voice Input';
        bugInput.placeholder = 'Describe the bug and let Bugify do the rest...';
        if (recognition) recognition.stop();
    }

    voiceBtn.addEventListener('click', () => {
        if (!recognition) return;

        if (isListening) {
            stopListening();
        } else {
            try {
                recognition.start();
            } catch (err) {
                console.error('Could not start recognition:', err);
            }
        }
    });


    generateBtn.addEventListener('click', async () => {
        const bugDescription = bugInput.value.trim();

        if (!bugDescription) {
            alert('Please provide a raw bug description first.');
            return;
        }

        console.log('Generating report for:', bugDescription);

        // --- Start Loading ---
        generateBtn.classList.add('btn-loading');
        generateBtn.disabled = true;

        loadingStatusText.style.display = 'block';
        let statusIdx = 0;
        loadingStatusText.textContent = statusMessages[statusIdx];
        const statusInterval = setInterval(() => {
            statusIdx = (statusIdx + 1) % statusMessages.length;
            loadingStatusText.textContent = statusMessages[statusIdx];
        }, 1200);

        try {
            // CALLING THE FLASK BACKEND
            // Using relative path for production compatibility (Render)
            const response = await fetch('/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    bug: bugDescription,
                    image: currentImageBase64 ? currentImageBase64.split(',')[1] : null // Send only the base64 part
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Backend failed to respond.');
            }

            const report = await response.json();
            console.log('Received report:', report);
            renderReport(report);

            // --- Show Result ---
            resultSection.classList.remove('hidden');
            resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
            console.error('Generation Error:', error);
            alert(`Error: ${error.message}. Is the backend running?`);
        } finally {
            clearInterval(statusInterval);
            loadingStatusText.style.display = 'none';
            generateBtn.classList.remove('btn-loading');
            generateBtn.disabled = false;
        }
    });

    clearBtn.addEventListener('click', () => {
        bugInput.value = '';
        resultSection.classList.add('hidden');
        bugInput.focus();
    });

    copyBtn.addEventListener('click', () => {
        const textToCopy = reportToText();
        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied! ✅';
            copyBtn.style.color = '#10b981';
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.color = '';
            }, 2000);
        });
    });

    /**
     * Converts the rendered UI back to Markdown or structured text for copying.
     */
    function reportToText() {
        const items = reportContent.querySelectorAll('.report-item');
        let text = '';
        items.forEach(item => {
            const labelEl = item.querySelector('.report-label');
            const valueEl = item.querySelector('.report-value');

            if (labelEl && valueEl) {
                const label = labelEl.textContent.trim();
                const value = valueEl.innerText.trim();
                text += `${label}\n${value}\n\n`;
            } else {
                // Fallback for items that don't have label/value classes (like the Reason paragraph)
                const textContent = item.innerText.trim();
                if (textContent) {
                    text += `${textContent}\n\n`;
                }
            }
        });
        return text.trim();
    }

    /**
     * Updated: Renders the structured report based on the new backend JSON schema.
     */
    function renderReport(report) {
        const severityClass = `severity-${(report.severity || 'Medium').toLowerCase()}`;
        const priorityClass = `severity-${(report.priority || 'Medium').toLowerCase()}`;

        reportContent.innerHTML = `
            <div class="report-item">
                <span class="report-label">🔹 Improved Bug Description</span>
                <div class="report-value" style="font-style: italic; color: var(--text-secondary);">${report.improved_description}</div>
            </div>

            <div class="report-item">
                <span class="report-label">🔹 Title</span>
                <div class="report-value" style="font-weight: 700; font-size: 1.1rem; color: #fff;">${report.title}</div>
            </div>

            <div class="report-item">
                <span class="report-label">🔹 Summary</span>
                <div class="report-value">${report.summary}</div>
            </div>

            <div class="report-item">
                <span class="report-label">🔹 Steps to Reproduce</span>
                <div class="report-value">
                    <ol style="padding-left: 1.25rem;">
                        ${(report.steps || []).map(step => `<li>${step}</li>`).join('')}
                    </ol>
                </div>
            </div>

            <div class="report-item">
                <span class="report-label">🔹 Expected Result</span>
                <div class="report-value">${report.expected_result}</div>
            </div>

            <div class="report-item">
                <span class="report-label">🔹 Actual Result</span>
                <div class="report-value">${report.actual_result}</div>
            </div>

            <div class="report-item">
                <span class="report-label">🔹 Possible Root Causes</span>
                <div class="report-value">
                    <ul style="padding-left: 1.25rem; list-style-type: '⚡ ';">
                        ${(report.possible_root_causes || []).map(c => `<li>${c}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <div class="report-item">
                <span class="report-label">🔹 Debugging Steps</span>
                <div class="report-value">
                    <ul style="padding-left: 1.25rem; list-style-type: '🔍 ';">
                        ${(report.debugging_steps || []).map(s => `<li>${s}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <div class="report-item">
                <span class="report-label">🔹 Suggested Fixes</span>
                <div class="report-value">
                    <ul style="padding-left: 1.25rem; list-style-type: '🔧 ';">
                        ${(report.suggested_fixes || []).map(f => `<li>${f}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <div class="report-item report-item-flex">
                <div>
                    <span class="report-label">🔹 Severity Level</span>
                    <div class="report-value">
                        <span class="severity ${severityClass}">${report.severity}</span>
                    </div>
                </div>
                <div>
                    <span class="report-label">🔹 Priority Level</span>
                    <div class="report-value">
                        <span class="severity ${priorityClass}">${report.priority}</span>
                    </div>
                </div>
            </div>
            
            <div class="report-item" style="margin-top: -1rem;">
                <p style="font-size: 0.9rem; color: var(--text-secondary);">Reason: ${report.impact_reason}</p>
            </div>
        `;
    }
});
