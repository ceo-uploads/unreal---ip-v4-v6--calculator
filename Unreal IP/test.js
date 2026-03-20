// Put your normal Google Drive share link here:
const googleDriveShareLink = "https://drive.google.com/file/d/1p51CoaPNPnUol5gIEAlfEOk_VzxXcZee/view?usp=sharing";

// Extract file ID from any valid Google Drive link
function extractFileId(url) {
  const match = url.match(/\/d\/([^/]+)\//);
  return match ? match[1] : null;
}

document.addEventListener("DOMContentLoaded", () => {
  const fileId = extractFileId(googleDriveShareLink);
  const img = document.getElementById("driveImage");
  const fallback = document.getElementById("fallbackIcon");
  const downloadBtn = document.getElementById("downloadBtn");

  if (fileId) {
    // Set correct embed & download URLs
    const viewUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    img.src = viewUrl;
    downloadBtn.href = downloadUrl;
  } else {
    console.error("Invalid Google Drive link.");
    fallback.classList.remove("hidden");
  }

  // Show fallback if image fails to load
  img.onerror = () => {
    img.style.display = "none";
    fallback.classList.remove("hidden");
  };
});
