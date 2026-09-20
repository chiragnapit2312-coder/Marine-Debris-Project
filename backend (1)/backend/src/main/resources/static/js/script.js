const darkModeSwitch = document.getElementById("darkModeSwitch");

darkModeSwitch.addEventListener("change", function () {
    document.body.classList.toggle("dark", darkModeSwitch.checked);
});

const uploadBox = document.getElementById("uploadBox");
const fileInput = document.getElementById("fileInput");
const previewGrid = document.getElementById("previewGrid");
const scanBtn = document.getElementById("scanBtn");

uploadBox.addEventListener("click", function () {
    fileInput.click();
});

fileInput.addEventListener("change", function () {
    const files = fileInput.files;
    previewGrid.innerHTML = "";

    if (files.length > 0) {
        Array.from(files).forEach(function (file) {
            const img = document.createElement("img");
            img.src = URL.createObjectURL(file);
            previewGrid.appendChild(img);
        });
        scanBtn.disabled = false;
        scanBtn.innerText = files.length > 1 ? "Scan " + files.length + " Images" : "Scan Image";
    } else {
        scanBtn.disabled = true;
        scanBtn.innerText = "Scan Image";
    }
});

// Ek file ko base64 mein convert karna (Promise se, taaki multiple files ke liye await kar sakein)
function fileToBase64(file) {
    return new Promise(function (resolve) {
        const reader = new FileReader();
        reader.onload = function () {
            resolve(reader.result);
        };
        reader.readAsDataURL(file);
    });
}

// Ek image ko backend ko bhejna aur result lena
function scanOneImage(file) {
    const formData = new FormData();
    formData.append("image", file);

    return fetch("/detect", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .catch(error => {
        console.log("Backend not connected for this image, using dummy result");
        return dummyData;
    });
}

scanBtn.addEventListener("click", async function () {
    const files = Array.from(fileInput.files);
    if (files.length === 0) return;

    scanBtn.disabled = true;
    scanBtn.style.display = "none";
    document.getElementById("scanSpinner").style.display = "block";

    const allResults = [];

    // Ek-ek karke sab images scan karo (sequential, taaki backend overload na ho)
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        showToast("Scanning image " + (i + 1) + " of " + files.length + "...", "info");

        const imageBase64 = await fileToBase64(file);
        const detectionData = await scanOneImage(file);

        allResults.push({
            image: imageBase64,
            result: detectionData
        });
    }

    localStorage.setItem("scanResults", JSON.stringify(allResults));
    showToast("All scans complete! Redirecting to dashboard...", "success");

    setTimeout(function () {
        window.location.href = "dashboard.html";
    }, 800);
});

const dummyData = {
    image_id: "sample.jpg",
    processing_time_seconds: 0.6555,
    detections: [
        {
            detection_id: 1,
            class: "fishing_net",
            confidence: 0.87,
            bbox: { x_center: 0.452, y_center: 0.318, width: 0.09, height: 0.14 },
            lat: 11.0168,
            lon: 76.9558,
            shadow_check_passed: true
        },
        {
            detection_id: 2,
            class: "iron_pipeline",
            confidence: 0.63,
            bbox: { x_center: 0.71, y_center: 0.55, width: 0.05, height: 0.22 },
            lat: 11.0171,
            lon: 76.9561,
            shadow_check_passed: false
        }
    ]
};