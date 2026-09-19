fetch("http://localhost:8080/reports")
    .then(response => response.json())
    .then(data => {
        renderStats(data);
        renderBigHeatmap(data);
    })
    .catch(error => {
        document.getElementById("bigHeatmapBox").innerHTML =
            "<p class='note' style='padding:20px;'>Could not load data. Is backend running?</p>";
    });

function renderStats(data) {
    document.getElementById("totalDetections").innerText = data.length;

    const confirmed = data.filter(r => r.shadowCheckPassed);
    document.getElementById("totalConfirmed").innerText = confirmed.length;

    if (data.length === 0) {
        document.getElementById("topClass").innerText = "--";
        return;
    }

    const counts = {};
    data.forEach(r => {
        counts[r.className] = (counts[r.className] || 0) + 1;
    });
    const topClass = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    document.getElementById("topClass").innerText = topClass;
}

function renderBigHeatmap(data) {
    const box = document.getElementById("bigHeatmapBox");
    box.innerHTML = "";

    if (data.length === 0) {
        box.innerHTML = "<p class='note' style='padding:20px;'>No scans yet — go upload an image first.</p>";
        return;
    }

    // Note: abhi lat/lon ko simple 0-1 range mein normalize kar rahe hain taaki map par dikh sake.
    // Real deployment mein ye actual GPS bounding box ke against plot hoga.
    const lats = data.map(r => r.lat);
    const lons = data.map(r => r.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);

    data.forEach(function (r) {
        const dot = document.createElement("div");
        const level = r.shadowCheckPassed === false ? "low" : (r.confidence >= 0.7 ? "high" : "medium");
        dot.className = "heat-dot big " + level;

        const xPercent = maxLon === minLon ? 50 : ((r.lon - minLon) / (maxLon - minLon)) * 90 + 5;
        const yPercent = maxLat === minLat ? 50 : (1 - (r.lat - minLat) / (maxLat - minLat)) * 90 + 5;

        dot.style.left = xPercent + "%";
        dot.style.top = yPercent + "%";
        dot.title = r.className + " - " + Math.round(r.confidence * 100) + "%";

        box.appendChild(dot);
    });
}

const darkModeSwitch = document.getElementById("darkModeSwitch");
darkModeSwitch.addEventListener("change", function () {
    document.body.classList.toggle("dark", darkModeSwitch.checked);
});