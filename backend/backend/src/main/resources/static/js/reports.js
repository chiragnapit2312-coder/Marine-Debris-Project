fetch("/reports")
    .then(response => response.json())
    .then(data => {
        renderTable(data);
    })
    .catch(error => {
        document.getElementById("reportsBody").innerHTML =
            "<tr><td colspan='6'>Could not load reports. Is backend running?</td></tr>";
    });

function deleteReport(id, rowElement) {
    fetch("/reports/" + id, {
        method: "DELETE"
    })
    .then(response => response.json())
    .then(result => {
        if (result.deleted) {
            rowElement.remove();
            showToast("Entry deleted successfully", "success");
        } else {
            showToast("Could not delete - entry not found", "error");
        }
    })
    .catch(error => {
        showToast("Could not delete. Is the backend running?", "error");
    });
}

function renderTable(data) {
    const tbody = document.getElementById("reportsBody");
    tbody.innerHTML = "";

    if (data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6'>No scans yet.</td></tr>";
        return;
    }

    data.forEach(function (row) {
        const tr = document.createElement("tr");

        const confidencePercent = Math.round(row.confidence * 100) + "%";
        const statusText = row.shadowCheckPassed ? "Confirmed" : "Filtered (noise)";
        const statusClass = row.shadowCheckPassed ? "status-passed" : "status-filtered";

        tr.innerHTML =
            "<td>" + row.imageId + "</td>" +
            "<td>" + row.className + "</td>" +
            "<td>" + confidencePercent + "</td>" +
            "<td>" + row.lat + ", " + row.lon + "</td>" +
            "<td class='" + statusClass + "'>" + statusText + "</td>" +
            "<td>" + new Date(row.processedAt).toLocaleString() + "</td>" +
            "<td><button class='delete-btn' title='Delete this entry'><i class='fa-solid fa-trash'></i></button></td>";

        tr.querySelector(".delete-btn").addEventListener("click", function () {
            deleteReport(row.id, tr);
        });

        tbody.appendChild(tr);
    });
}

document.getElementById("downloadCsvBtn").addEventListener("click", function () {
    fetch("/reports")
        .then(response => response.json())
        .then(data => downloadAsCsv(data));
});

function downloadAsCsv(data) {
    let csv = "Image,Class,Confidence,Latitude,Longitude,Status,Time\n";

    data.forEach(function (row) {
        const status = row.shadowCheckPassed ? "Confirmed" : "Filtered";
        csv += row.imageId + "," + row.className + "," + row.confidence + "," +
               row.lat + "," + row.lon + "," + status + "," + row.processedAt + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = data.length === 1 ? data[0].imageId + "_report.csv" : "debris_report.csv";
    link.click();
}