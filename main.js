document.addEventListener('DOMContentLoaded', () => {
    const bugInput = document.getElementById('bugInput');
    const generateBtn = document.getElementById('generateBtn');
    const clearBtn = document.getElementById('clearBtn');
    const resultSection = document.getElementById('resultSection');
    const reportContent = document.getElementById('reportContent');
    const copyBtn = document.getElementById('copyBtn');
    const loadingStatusText = document.getElementById('loadingStatusText');
    const statusMessages = ['Thinking...', 'Analyzing bug...', 'Running diagnostics...', 'Writing report...'];

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
            // Using 127.0.0.1 for local communication
            const response = await fetch('http://127.0.0.1:5000/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ bug: bugDescription }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Backend failed to respond. Make sure app.py is running.');
            }

            const report = await response.json();
            console.log('Received report:', report);
            renderReport(report);
            
            // --- Show Result ---
            resultSection.classList.remove('hidden');
            resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
            console.error('Generation Error:', error);
            alert(`Error: ${error.message}. Is the backend running at http://127.0.0.1:5000?`);
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
