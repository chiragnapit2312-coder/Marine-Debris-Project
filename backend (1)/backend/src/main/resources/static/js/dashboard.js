const allScans = JSON.parse(localStorage.getItem("scanResults")) || [];
let currentIndex = 0;

const scannedImage = document.getElementById("scannedImage");
const prevBtn = document.getElementById("prevImageBtn");
const nextBtn = document.getElementById("nextImageBtn");
const imageCounter = document.getElementById("imageCounter");

function showScan(index) {
    if (allScans.length === 0) return;
    currentIndex = index;
    const scan = allScans[currentIndex];
    const result = scan.result;

    scannedImage.src = scan.image;

    renderDetections(result.detections || []);
    updateHighestConfidence(result.detections || []);
    updateDetectionSpeed(result);

    if (scannedImage.complete) {
        renderBoxesOnImage(result.detections || []);
    } else {
        scannedImage.onload = function () {
            renderBoxesOnImage(result.detections || []);
        };
    }

    imageCounter.innerText = allScans.length > 1 ? "(" + (currentIndex + 1) + " of " + allScans.length + ")" : "";
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === allScans.length - 1;
}

if (allScans.length > 0) {
    showScan(0);

    // Heatmap mein is poore batch ke SAARE images ke detections ek saath dikhao
    const combinedDetections = [];
    allScans.forEach(function (scan) {
        if (scan.result && scan.result.detections) {
            combinedDetections.push(...scan.result.detections);
        }
    });
    renderHeatmap(combinedDetections);
} else {
    imageCounter.innerText = "";
}

prevBtn.addEventListener("click", function () {
    if (currentIndex > 0) showScan(currentIndex - 1);
});

nextBtn.addEventListener("click", function () {
    if (currentIndex < allScans.length - 1) showScan(currentIndex + 1);
});

// savedResult ab "current scan" ko refer karta hai - baaki functions (PDF, Share) isi ko use karte hain
function getCurrentResult() {
    return allScans.length > 0 ? allScans[currentIndex].result : null;
}

// Real processing time dikhao (Python model se aayi hai, fixed nahi hai)
function updateDetectionSpeed(result) {
    const el = document.getElementById("detectionSpeed");
    if (!el) return;
    if (result.processing_time_seconds !== undefined && result.processing_time_seconds !== null) {
        el.innerText = result.processing_time_seconds + "s";
    } else {
        el.innerText = "N/A";
    }
}

// 0. Real historical stats seedha database (backend) se
fetch("http://localhost:8080/reports")
    .then(response => response.json())
    .then(data => {
        updateAggregateStats(data);
    })
    .catch(error => {
        console.log("Could not load aggregate stats:", error);
        document.getElementById("avgConfidence").innerText = "--";
    });

function updateAggregateStats(allRecords) {
    // Sirf confirmed (shadow-check passed) detections ka average confidence
    const confirmed = allRecords.filter(r => r.shadowCheckPassed);
    if (confirmed.length === 0) {
        document.getElementById("avgConfidence").innerText = "--";
        return;
    }
    const avg = confirmed.reduce((sum, r) => sum + r.confidence, 0) / confirmed.length;
    document.getElementById("avgConfidence").innerText = Math.round(avg * 100) + "%";
}

// 2. Detection list cards (jaisa pehle tha)
function renderDetections(detections) {
    const container = document.getElementById("detectionsContainer");
    container.innerHTML = "";

    let validCount = 0;

    detections.forEach(function (item) {
        const confidencePercent = Math.round(item.confidence * 100);
        const isFiltered = item.shadow_check_passed === false;

        if (!isFiltered) {
            validCount++;
        }

        const div = document.createElement("div");
        div.className = "detection-item";
        if (isFiltered) {
            div.style.opacity = "0.5";
        }

        div.innerHTML =
            '<div class="detection-header">' +
                '<span>' + item.class + '</span>' +
                '<span>' + confidencePercent + '%</span>' +
            '</div>' +
            '<div class="progress-bar"><div class="progress-fill" style="width:' + confidencePercent + '%"></div></div>' +
            '<p style="font-size:12px;color:#888;margin-top:4px;">' +
                (isFiltered ? "Filtered out (shadow check failed)" : item.lat + ", " + item.lon) +
            '</p>';

        container.appendChild(div);
    });

    const countEl = document.getElementById("debrisFoundCount");
    if (countEl) {
        countEl.innerText = validCount;
    }
}

// 3. Uploaded image ke upar bounding boxes banao, jaha bhi debris mila
// (image "contain" ke saath fit hoti hai, isliye letterbox space bhi calculate karna padta hai)
function renderBoxesOnImage(detections) {
    const overlay = document.getElementById("boxOverlay");
    const frame = document.getElementById("imageFrame");
    overlay.innerHTML = "";

    const containerW = frame.clientWidth;
    const containerH = frame.clientHeight;
    const naturalW = scannedImage.naturalWidth || containerW;
    const naturalH = scannedImage.naturalHeight || containerH;

    const scale = Math.min(containerW / naturalW, containerH / naturalH);
    const renderedW = naturalW * scale;
    const renderedH = naturalH * scale;
    const offsetX = (containerW - renderedW) / 2;
    const offsetY = (containerH - renderedH) / 2;

    detections.forEach(function (item) {
        const isFiltered = item.shadow_check_passed === false;
        const confidencePercent = Math.round(item.confidence * 100);

        const boxLeft = offsetX + (item.bbox.x_center - item.bbox.width / 2) * renderedW;
        const boxTop = offsetY + (item.bbox.y_center - item.bbox.height / 2) * renderedH;
        const boxWidth = item.bbox.width * renderedW;
        const boxHeight = item.bbox.height * renderedH;

        const box = document.createElement("div");
        box.className = "detection-box" + (isFiltered ? " filtered" : "");
        box.style.left = boxLeft + "px";
        box.style.top = boxTop + "px";
        box.style.width = boxWidth + "px";
        box.style.height = boxHeight + "px";

        const label = document.createElement("span");
        label.className = "detection-box-label";
        label.innerText = item.class + " " + confidencePercent + "%";
        box.appendChild(label);

        overlay.appendChild(box);
    });
}

// 4. Heatmap - asli detection positions ke dots dikhao
function renderHeatmap(detections) {
    const heatmapBox = document.getElementById("heatmapBox");
    heatmapBox.innerHTML = "";

    if (detections.length === 0) {
        heatmapBox.innerHTML = "<p class='note' style='padding:20px;'>No detections to plot</p>";
        return;
    }

    detections.forEach(function (item) {
        const isFiltered = item.shadow_check_passed === false;
        const dot = document.createElement("div");
        dot.className = "heat-dot" + (isFiltered ? " low" : item.confidence >= 0.7 ? " high" : " medium");
        dot.style.left = (item.bbox.x_center * 100) + "%";
        dot.style.top = (item.bbox.y_center * 100) + "%";
        heatmapBox.appendChild(dot);
    });
}

// 5. Sabse zyada confidence wala detection dikhao stat card mein
function updateHighestConfidence(detections) {
    const el = document.getElementById("highestConfidence");
    if (!el || detections.length === 0) {
        if (el) el.innerText = "--";
        return;
    }
    const highest = Math.max.apply(null, detections.map(d => d.confidence));
    el.innerText = Math.round(highest * 100) + "%";
}

const darkModeSwitch = document.getElementById("darkModeSwitch");

darkModeSwitch.addEventListener("change", function () {
    document.body.classList.toggle("dark", darkModeSwitch.checked);
});

// 6. Export PDF - scanned image (boxes ke saath) + detection list ko real PDF mein download karo
document.getElementById("exportPdfBtn").addEventListener("click", function () {
    const frame = document.getElementById("imageFrame");
    const savedResult = getCurrentResult();

    html2canvas(frame).then(function (canvas) {
        const imgData = canvas.toDataURL("image/png");
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: "landscape" });

        pdf.setFontSize(16);
        pdf.text("DeepScan AI - Debris Detection Report", 14, 15);

        const imgWidth = 260;
        const imgHeight = (canvas.height / canvas.width) * imgWidth;
        pdf.addImage(imgData, "PNG", 14, 22, imgWidth, imgHeight);

        let y = 22 + imgHeight + 10;
        pdf.setFontSize(11);

        if (savedResult && savedResult.detections) {
            savedResult.detections.forEach(function (item) {
                const status = item.shadow_check_passed === false ? "Filtered (noise)" : "Confirmed";
                const line = item.class + " - " + Math.round(item.confidence * 100) + "% - " +
                             item.lat + ", " + item.lon + " - " + status;
                pdf.text(line, 14, y);
                y += 7;
            });
        }

        const fileName = (savedResult && savedResult.image_id ? savedResult.image_id : "scan") + "_report.pdf";
        pdf.save(fileName);
        showToast("PDF report downloaded", "success");
    });
});

// 7. Share - dropdown menu with 3 real options
function buildReportSummary() {
    const savedResult = getCurrentResult();
    let summary = "DeepScan AI - Debris Detection Report\n";
    summary += "Image: " + (savedResult ? savedResult.image_id : "unknown") + "\n\n";

    if (savedResult && savedResult.detections) {
        savedResult.detections.forEach(function (item) {
            const status = item.shadow_check_passed === false ? "Filtered" : "Confirmed";
            summary += "- " + item.class + " (" + Math.round(item.confidence * 100) + "%) at " +
                       item.lat + ", " + item.lon + " [" + status + "]\n";
        });
    }
    return summary;
}

const shareBtn = document.getElementById("shareBtn");
const shareMenu = document.getElementById("shareMenu");

shareBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    shareMenu.style.display = shareMenu.style.display === "none" ? "block" : "none";
});

document.addEventListener("click", function () {
    shareMenu.style.display = "none";
});

// Option 1: Email report - opens the user's email app with everything pre-filled
document.getElementById("shareEmail").addEventListener("click", function () {
    const savedResult = getCurrentResult();
    const subject = "DeepScan AI Report - " + (savedResult ? savedResult.image_id : "");
    const body = buildReportSummary();
    window.location.href = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    shareMenu.style.display = "none";
});

// Option 2: Copy report as plain text
document.getElementById("shareCopyText").addEventListener("click", function () {
    navigator.clipboard.writeText(buildReportSummary()).then(function () {
        showToast("Report text copied - paste it in WhatsApp or Email", "success");
    });
    shareMenu.style.display = "none";
});

// Option 3: Copy a shareable link - anyone on the same network can open it
// and it will pull this exact scan's data live from the backend
document.getElementById("shareCopyLink").addEventListener("click", function () {
    const savedResult = getCurrentResult();
    if (!savedResult || !savedResult.processed_at) {
        showToast("No scan data to share yet", "error");
        shareMenu.style.display = "none";
        return;
    }
    const basePath = window.location.href.substring(0, window.location.href.lastIndexOf("/"));
    const link = basePath + "/report.html?time=" + encodeURIComponent(savedResult.processed_at);

    navigator.clipboard.writeText(link).then(function () {
        showToast("Link copied! Share it with anyone on the same network", "success");
    }).catch(function () {
        prompt("Copy this link manually:", link);
    });
    shareMenu.style.display = "none";
});