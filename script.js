document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');

    const uploadSection = document.getElementById('uploadSection');
    const resultsSection = document.getElementById('resultsSection');
    const summaryCard = document.getElementById('summaryCard');
    const errorsContainer = document.getElementById('errorsContainer');
    const resetBtn = document.getElementById('resetBtn');

    // --- Drag and Drop Logic ---
    dropZone.addEventListener('click', () => fileInput.click());
    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-active');
    });

    ['dragleave', 'dragend'].forEach(type => {
        dropZone.addEventListener(type, () => {
            dropZone.classList.remove('drag-active');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    resetBtn.addEventListener('click', () => {
        resultsSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        fileInput.value = '';
    });

    function handleFile(file) {
        errorsContainer.innerHTML = ''; // Clear previous errors immediately

        if (file.type !== "application/json" && !file.name.endsWith('.json')) {
            showSummary("Error", "Invalid file type. Please upload a JSON file.", "error");
            showResults();
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                validateJson(data, file.name);
            } catch (error) {
                showSummary("Parsing Error", `Failed to parse JSON: ${error.message}`, "error");
                errorsContainer.innerHTML = `
                    <div class="error-state" style="text-align: center; padding: 3rem 2rem; background: var(--card-bg); border: 1px solid var(--error); border-radius: 16px; backdrop-filter: blur(12px); box-shadow: 0 0 20px rgba(239, 68, 68, 0.15);">
                        <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--error);">Invalid JSON Syntax</h3>
                        <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto; font-size: 1.1rem;">The file contains a JSON syntax error (such as a stray character like <b>},s</b>, missing comma, or invalid bracket). The file must be valid JSON before the validator can inspect individual questions.</p>
                    </div>
                `;
                showResults();
            }
        };
        reader.readAsText(file);
    }

    function validateJson(data, fileName) {
        if (!Array.isArray(data)) {
            showSummary("Format Error", "The root of the JSON file must be an array [ ... ]", "error");
            showResults();
            return;
        }

        const errors = [];
        let totalItems = data.length;

        data.forEach((item, index) => {
            const itemErrors = [];
            const rawId = item["No."] ?? item["id"];
            const no = rawId !== undefined && rawId !== null ? rawId : `Unknown (Index: ${index})`;

            // 1. Strict 7 Parameter Matching
            const requiredKeys = ["No.", "Question", "Option A", "Option B", "Option C", "Option D", "Correct Answer"];
            requiredKeys.forEach(key => {
                if (item[key] === undefined || item[key] === null || item[key].toString().trim() === "") {
                    itemErrors.push(`Missing or empty required parameter: <b>"${key}"</b>`);
                }
            });

            // 2. Dart String Operation Symbols & Letters Check
            const dartSpecialSymbols = [
                { pattern: /\$/g, name: "Dollar sign <code>$</code> (Dart string interpolation)" },
                { pattern: /\\n/g, name: "Escaped newline <code>\\n</code>" },
                { pattern: /\\t/g, name: "Escaped tab <code>\\t</code>" },
                { pattern: /\\r/g, name: "Escaped carriage return <code>\\r</code>" },
                { pattern: /\\b/g, name: "Escaped backspace <code>\\b</code>" },
                { pattern: /\\f/g, name: "Escaped form feed <code>\\f</code>" },
                { pattern: /\\u[0-9a-fA-F]{4}/g, name: "Unicode escape sequence <code>\\uXXXX</code>" },
                { pattern: /[\u200B\u00A0]/g, name: "Zero-width or non-breaking space (breaks Dart trim/matching)" }
            ];

            Object.keys(item).forEach(key => {
                const val = (item[key] || '').toString();
                dartSpecialSymbols.forEach(sym => {
                    if (sym.pattern.test(val)) {
                        itemErrors.push(`Invalid Dart symbol/sequence in <b>"${key}"</b>: ${sym.name}`);
                    }
                });
            });

            // Extract options matching Question.fromJson logic
            let options = [];
            if (item.hasOwnProperty('options') && Array.isArray(item.options)) {
                options = item.options.map(o => (o || '').toString().trim());
            } else {
                options = Object.keys(item)
                    .filter(k => k.startsWith('Option '))
                    .map(k => (item[k] || '').toString().trim())
                    .filter(v => v.length > 0);
            }

            const correctAnswer = (item['Correct Answer'] ?? item['correctAnswer'] ?? '').toString().trim();

            if (correctAnswer.length > 0 && options.length > 0) {
                // Validation: Correct Answer must match one of the options (case-insensitive)
                const matchFound = options.some(opt => opt.toLowerCase() === correctAnswer.toLowerCase());

                if (!matchFound) {
                    let errorMsg = `Logical Error: Correct Answer <b>"${correctAnswer}"</b> not found in options: ${options.map(o => '"' + o + '"').join(', ')}`;
                    
                    // Check if removing trailing dot makes it match
                    for (let opt of options) {
                        if (opt.replace(/\.+$/, '') === correctAnswer.replace(/\.+$/, '')) {
                            errorMsg += `<br><span style="color:var(--warning); margin-top:4px; display:inline-block;">&#x21B3; <b>Note:</b> Option "${opt}" matches Correct Answer if trailing dot/period is removed!</span>`;
                            break;
                        }
                    }
                    itemErrors.push(errorMsg);
                }
            }

            if (itemErrors.length > 0) {
                errors.push({ no, issues: itemErrors });
            }
        });

        if (errors.length === 0) {
            showSummary("Perfect!", `Successfully validated ${totalItems} questions. No issues found.`, "success");

            errorsContainer.innerHTML = `
                <div class="success-state" style="text-align: center; padding: 4rem 2rem; background: var(--card-bg); border: 1px solid var(--success); border-radius: 16px; backdrop-filter: blur(12px); animation: fadeUp 0.5s ease-out; box-shadow: 0 0 20px rgba(16, 185, 129, 0.15);">
                    <div style="width: 80px; height: 80px; background: rgba(16, 185, 129, 0.2); color: var(--success); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto; box-shadow: 0 0 30px rgba(16, 185, 129, 0.3);">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    </div>
                    <h3 style="font-size: 1.8rem; margin-bottom: 0.5rem; color: var(--success);">File is 100% Correct!</h3>
                    <p style="color: var(--text-secondary); max-width: 450px; margin: 0 auto; font-size: 1.1rem;">All questions perfectly match the validation logic of the Krushi Kalp mock test engine. This JSON file is ready to be imported.</p>
                </div>
            `;
        } else {
            showSummary("Issues Found", `Found errors in ${errors.length} out of ${totalItems} questions.`, "error");
            renderErrors(errors);
        }

        showResults();
    }

    function showSummary(title, message, type) {
        const iconSvg = type === 'success'
            ? `<svg class="summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
            : `<svg class="summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

        summaryCard.className = `summary-card ${type}`;
        summaryCard.innerHTML = `
            ${iconSvg}
            <div class="summary-text">
                <h3>${title}</h3>
                <p>${message}</p>
            </div>
        `;
    }

    function renderErrors(errors) {
        errorsContainer.innerHTML = '';
        errors.forEach((err, idx) => {
            const card = document.createElement('div');
            card.className = 'error-card';
            card.style.animationDelay = `${idx * 0.1}s`;

            const listItems = err.issues.map(issue => `<li>${issue}</li>`).join('');

            card.innerHTML = `
                <div class="error-card-header">
                    <h4>Question No. ${err.no}</h4>
                </div>
                <ul class="error-list">
                    ${listItems}
                </ul>
            `;
            errorsContainer.appendChild(card);
        });
    }

    function showResults() {
        uploadSection.classList.add('hidden');
        resultsSection.classList.remove('hidden');
    }
});

