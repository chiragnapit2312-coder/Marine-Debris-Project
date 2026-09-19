// Simple reusable toast notification system
// Usage: showToast("Message here", "success" | "error" | "info")

function ensureToastContainer() {
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        document.body.appendChild(container);
    }
    return container;
}

function showToast(message, type) {
    type = type || "info";
    const icons = {
        success: "fa-circle-check",
        error: "fa-circle-exclamation",
        info: "fa-circle-info"
    };

    const container = ensureToastContainer();

    const toast = document.createElement("div");
    toast.className = "toast " + type;
    toast.innerHTML = '<i class="fa-solid ' + icons[type] + '"></i><span>' + message + '</span>';

    container.appendChild(toast);

    setTimeout(function () {
        toast.classList.add("hide");
        setTimeout(function () {
            toast.remove();
        }, 250);
    }, 3000);
}