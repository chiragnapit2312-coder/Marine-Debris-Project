// URL se ?time= parameter nikalo (jo scan share kiya gaya tha uska timestamp)
const params = new URLSearchParams(window.location.search);
const sharedTime = params.get("time");

const container = document.getElementById("reportContent");

if (!sharedTime) {
    container.innerHTML = "<p class='note' style='padding:20px;'>No report specified in this link.</p>";
} else {
    fetch("http://localhost:8080/reports")
        .then(response => response.json())
        .then(allRecords => {
            const matched = allRecords.filter(r => r.processedAt === sharedTime);
            renderSharedReport(matched);
        })
        .catch(error => {
            container.innerHTML = "<p class='note' style='padding:20px;'>Could not reach the DeepScan AI server. " +
                "Make sure you're on the same network as the person who shared this, and their backend is running.</p>";
        });
}

function renderSharedReport(records) {
    if (records.length === 0) {
        container.innerHTML = "<p class='note' style='padding:20px;'>This report is no longer available (it may have been deleted).</p>";
        return;
    }

    let html = '<div class="card"><h4>Image: ' + records[0].imageId + '</h4>';
    html += '<p class="note">Scanned at: ' + new Date(records[0].processedAt).toLocaleString() + '</p></div>';
    html += '<div class="card"><h4>Detections</h4>';

    records.forEach(function (item) {
        const confidencePercent = Math.round(item.confidence * 100);
        const isFiltered = item.shadowCheckPassed === false;

        html += '<div class="detection-item"' + (isFiltered ? ' style="opacity:0.5"' : '') + '>' +
            '<div class="detection-header"><span>' + item.className + '</span><span>' + confidencePercent + '%</span></div>' +
            '<div class="progress-bar"><div class="progress-fill" style="width:' + confidencePercent + '%"></div></div>' +
            '<p style="font-size:12px;color:#888;margin-top:4px;">' +
                (isFiltered ? "Filtered out (shadow check failed)" : item.lat + ", " + item.lon) +
            '</p></div>';
    });

    html += '</div>';
    container.innerHTML = html;
}