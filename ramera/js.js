document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const captureView = document.getElementById('captureView');
    const reviewView = document.getElementById('reviewView');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const captureStrip = document.getElementById('captureStrip');
    const reviewStrip = document.getElementById('reviewStrip');
    const reviewStripContainer = document.getElementById('reviewStripContainer'); // Get the container
    const photosCountSelect = document.getElementById('photosCount');
    const countdownDelaySelect = document.getElementById('countdownDelay');
    const uploadBtnTrigger = document.getElementById('uploadBtnTrigger');
    const uploadInput = document.getElementById('uploadInput');
    const filterList = document.getElementById('filterList');
    const frameList = document.getElementById('frameList');
    const mainActionBtn = document.getElementById('mainActionBtn'); // Combined Start/Next
    const downloadBtn = document.getElementById('downloadBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    const flashOverlay = document.getElementById('flash');
    const countdownOverlay = document.getElementById('countdown');
    const captureIndicator = document.getElementById('captureIndicator');
    const captureIndicatorNumber = captureIndicator.querySelector('span');
    const videoContainer = document.getElementById('videoContainer');
    const startMessage = document.getElementById('startMessage');

    // --- State Variables ---
    let stream = null;
    let photos = [];
    let currentPhotoIndex = 0;
    let photosToTake = parseInt(photosCountSelect.value, 10);
    let countdownDelay = parseInt(countdownDelaySelect.value, 10);
    let currentFilter = 'none';
    let currentFrameColor = 'rainbow'; // Default frame color
    let isCapturing = false;
    let stickerFeatureEnabled = false; // Keep sticker logic minimal for now
    let currentSticker = 'none'; // If stickers were implemented

    // --- Initialization ---
    function init() {
        updatePhotoStripPlaceholders(photosToTake);
        setupEventListeners();
        requestCameraAccess();
        updateFrameSelection(document.querySelector('.frame-color[data-color="rainbow"]')); // Set initial active frame button
    }

    // --- Camera Access ---
    async function requestCameraAccess() {
        try {
            if (stream) { // Stop existing stream first
                stream.getTracks().forEach(track => track.stop());
            }
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            video.srcObject = stream;
            video.style.display = 'block'; // Show video element
            startMessage.classList.add('active'); // Show click to start message
            mainActionBtn.disabled = false; // Enable start button once camera is ready
            mainActionBtn.textContent = 'Start';
        } catch (err) {
            console.error("Error accessing camera: ", err);
            startMessage.textContent = "Camera access denied or unavailable. Please check permissions.";
            startMessage.style.cursor = 'default';
            startMessage.classList.add('active'); // Keep message visible
            mainActionBtn.disabled = true;
            // Display error message to user
            alert("Could not access the camera. Please ensure you have a webcam connected and have granted permission in your browser settings.");
        }
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        photosCountSelect.addEventListener('change', handleSettingsChange);
        countdownDelaySelect.addEventListener('change', handleSettingsChange);
        filterList.addEventListener('click', handleFilterChange);
        frameList.addEventListener('click', handleFrameChange);
        mainActionBtn.addEventListener('click', handleMainAction);
        videoContainer.addEventListener('click', handleVideoClick); // Click video to start
        downloadBtn.addEventListener('click', handleDownload);
        retakeBtn.addEventListener('click', handleRetake);
        uploadBtnTrigger.addEventListener('click', () => uploadInput.click());
        uploadInput.addEventListener('change', handlePhotoUpload);
    }

    // --- Settings Handling ---
    function handleSettingsChange() {
        photosToTake = parseInt(photosCountSelect.value, 10);
        countdownDelay = parseInt(countdownDelaySelect.value, 10);
        updatePhotoStripPlaceholders(photosToTake);
        // Reset if settings change before starting
        if (!isCapturing && photos.length === 0) {
             mainActionBtn.textContent = 'Start';
             mainActionBtn.disabled = !stream; // Disable if stream isn't ready
        }
    }

    // --- UI Updates ---
    function updatePhotoStripPlaceholders(count) {
        captureStrip.innerHTML = ''; // Clear existing
        photos = new Array(count).fill(null); // Reset photos array
        for (let i = 0; i < count; i++) {
            const slot = document.createElement('div');
            slot.classList.add('strip-photo', 'empty');
            slot.innerHTML = `<div class="empty-indicator">Photo ${i + 1}</div>`;
            slot.dataset.index = i;
            captureStrip.appendChild(slot);
        }
    }

    function updateCaptureStripPhoto(index, dataUrl) {
        const slot = captureStrip.querySelector(`.strip-photo[data-index="${index}"]`);
        if (slot) {
            slot.classList.remove('empty');
            slot.innerHTML = `<img src="${dataUrl}" alt="Photo ${index + 1}">`;
        }
    }

    function populateReviewStrip() {
        reviewStrip.innerHTML = ''; // Clear previous
        photos.forEach((dataUrl, index) => {
             if (dataUrl) { // Only add if photo was taken
                 const slot = document.createElement('div');
                 slot.classList.add('strip-photo');
                 slot.innerHTML = `<img src="${dataUrl}" alt="Photo ${index + 1}">`;
                 reviewStrip.appendChild(slot);
             } else {
                 // Optionally add an empty placeholder if a photo is missing
                 const slot = document.createElement('div');
                 slot.classList.add('strip-photo', 'empty');
                 slot.innerHTML = `<div class="empty-indicator">Missing</div>`;
                 reviewStrip.appendChild(slot);
             }
        });
        applyFrameStyle(); // Apply initial frame style
    }

    function switchView(viewToShow) {
        captureView.classList.remove('active');
        reviewView.classList.remove('active');
        if (viewToShow === 'capture') {
            captureView.classList.add('active');
        } else if (viewToShow === 'review') {
            reviewView.classList.add('active');
        }
    }

    function setUIDisabledState(disabled) {
         photosCountSelect.disabled = disabled;
         countdownDelaySelect.disabled = disabled;
         uploadBtnTrigger.disabled = disabled;
         mainActionBtn.disabled = disabled && mainActionBtn.textContent === 'Start'; // Only disable start if capturing
         filterList.querySelectorAll('.filter-item').forEach(btn => btn.disabled = disabled);
         retakeBtn.disabled = disabled;
         downloadBtn.disabled = disabled;
    }


    // --- Capture Logic ---
    function handleVideoClick() {
        // Start capture only if not already capturing and the button says "Start"
        if (!isCapturing && mainActionBtn.textContent === 'Start') {
            startCaptureSequence();
        }
    }

    function handleMainAction() {
        if (mainActionBtn.textContent === 'Start') {
            startCaptureSequence();
        } else if (mainActionBtn.textContent === 'Next') {
            goToReview();
        }
    }

    async function startCaptureSequence() {
        if (isCapturing || !stream) return; // Prevent multiple starts or starting without camera

        isCapturing = true;
        setUIDisabledState(true); // Disable UI
        startMessage.classList.remove('active'); // Hide start message
        photos = new Array(photosToTake).fill(null); // Reset photos
        updatePhotoStripPlaceholders(photosToTake); // Show fresh placeholders
        currentPhotoIndex = 0;
        mainActionBtn.textContent = 'Capturing...';
        mainActionBtn.disabled = true;

        await captureLoop();

        isCapturing = false;
        setUIDisabledState(false); // Re-enable UI (except Next button)
        mainActionBtn.textContent = 'Next';
        mainActionBtn.disabled = false; // Enable Next button
        // Optionally stop the stream here if desired, or keep it running
        // if (stream) {
        //     stream.getTracks().forEach(track => track.stop());
        //     stream = null;
        //     video.srcObject = null;
        // }
    }

    async function captureLoop() {
        if (currentPhotoIndex >= photosToTake) {
            return; // All photos taken
        }

        captureIndicatorNumber.textContent = currentPhotoIndex + 1;
        captureIndicator.classList.add('active');

        // Countdown
        if (countdownDelay > 0) {
            await runCountdown(countdownDelay);
        } else {
             await new Promise(resolve => setTimeout(resolve, 100)); // Short delay even without countdown
        }

        captureIndicator.classList.remove('active');

        // Flash Effect
        flashOverlay.classList.add('active');
        await new Promise(resolve => setTimeout(resolve, 80)); // Flash duration

        // Capture Photo
        takePhoto();
        flashOverlay.classList.remove('active');

        currentPhotoIndex++;
        await new Promise(resolve => setTimeout(resolve, 500)); // Delay between photos

        await captureLoop(); // Recursive call for next photo
    }

    async function runCountdown(seconds) {
        countdownOverlay.classList.add('active');
        for (let i = seconds; i > 0; i--) {
            countdownOverlay.textContent = i;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        countdownOverlay.classList.remove('active');
        countdownOverlay.textContent = ''; // Clear number
    }

    function takePhoto() {
        const context = canvas.getContext('2d');
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        canvas.width = videoWidth;
        canvas.height = videoHeight;

        // Apply mirroring and filter directly to canvas draw
        context.save();
        context.translate(videoWidth, 0);
        context.scale(-1, 1); // Mirror horizontally
        context.filter = video.style.filter; // Apply current CSS filter
        context.drawImage(video, 0, 0, videoWidth, videoHeight);
        context.restore(); // Restore context to normal

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9); // Use JPEG for smaller size
        photos[currentPhotoIndex] = dataUrl;
        updateCaptureStripPhoto(currentPhotoIndex, dataUrl);

        // Clear filter from canvas context if needed (though restore should handle it)
        context.filter = 'none';
    }

    // --- Filter Handling ---
    function handleFilterChange(event) {
        if (isCapturing || !event.target.classList.contains('filter-item')) return;

        const selectedFilter = event.target.dataset.filter;
        if (selectedFilter === currentFilter) return; // No change

        // Update active class
        filterList.querySelector('.filter-item.active')?.classList.remove('active');
        event.target.classList.add('active');

        currentFilter = selectedFilter;
        video.style.filter = currentFilter; // Apply filter to live video
    }

    // --- Review View Logic ---
    function goToReview() {
        if (photos.some(p => p === null)) {
            alert("Please capture all photos before proceeding.");
            return;
        }
        populateReviewStrip();
        switchView('review');
        // Optionally stop the stream when going to review
         if (stream) {
             stream.getTracks().forEach(track => track.stop());
             stream = null;
             video.srcObject = null;
             video.style.display = 'none'; // Hide video element to prevent blank box
         }
    }

    function handleRetake() {
        switchView('capture');
        photos = [];
        currentPhotoIndex = 0;
        isCapturing = false;
        updatePhotoStripPlaceholders(photosToTake); // Reset capture strip
        mainActionBtn.textContent = 'Start';
        mainActionBtn.disabled = true; // Will be enabled by requestCameraAccess
        setUIDisabledState(false); // Ensure UI is enabled
        requestCameraAccess(); // Restart camera
    }

    // --- Frame Handling ---
    function handleFrameChange(event) {
        const target = event.target.closest('.frame-color');
        if (!target) return;

        updateFrameSelection(target);
        applyFrameStyle();
    }

     function updateFrameSelection(targetElement) {
        frameList.querySelector('.frame-color.active')?.classList.remove('active');
        targetElement.classList.add('active');
        currentFrameColor = targetElement.dataset.color;
    }

    function applyFrameStyle() {
        const stripPhotos = reviewStrip.querySelectorAll('.strip-photo');
        stripPhotos.forEach(photo => {
            photo.style.border = '3px solid'; // Ensure border width is set
            photo.style.backgroundColor = 'transparent'; // Reset background just in case

            if (currentFrameColor === 'none') {
                photo.style.borderColor = 'transparent'; // No visible border
                photo.style.borderWidth = '0px'; // Remove border width
            } else if (currentFrameColor === 'rainbow') {
                photo.style.borderImage = 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet) 1';
                 photo.style.borderColor = 'transparent'; // Need transparent border for image fallback
                 photo.style.borderWidth = '3px';
            } else {
                 photo.style.borderImage = 'none'; // Remove border image if switching from rainbow
                 photo.style.borderColor = currentFrameColor;
                 photo.style.borderWidth = '3px';
            }
        });
    }


    // --- Download Logic ---
    async function handleDownload() {
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Preparing...';

        try {
             // Use a temporary canvas to composite the final strip
             const finalCanvas = document.createElement('canvas');
             const ctx = finalCanvas.getContext('2d');

             // --- Calculate final strip dimensions ---
             const photoCount = photos.length;
             if (photoCount === 0 || !photos[0]) {
                 alert("No photos to download.");
                 return;
             }

             const firstImage = await loadImage(photos[0]);
             const aspectRatio = firstImage.width / firstImage.height;

             // Define output photo size (can be adjusted)
             const outputPhotoWidth = 300;
             const outputPhotoHeight = outputPhotoWidth / aspectRatio;
             const padding = 10; // Padding around photos and between them
             const borderThickness = currentFrameColor === 'none' ? 0 : 6; // Adjust border thickness drawn on canvas

             // Calculate canvas size
             const canvasWidth = outputPhotoWidth + 2 * padding + 2 * borderThickness;
             const canvasHeight = (outputPhotoHeight + 2 * borderThickness) * photoCount + padding * (photoCount + 1);

             finalCanvas.width = canvasWidth;
             finalCanvas.height = canvasHeight;

             // --- Draw background/borders first ---
             ctx.fillStyle = '#ffffff'; // White background for the whole strip (optional)
             ctx.fillRect(0, 0, canvasWidth, canvasHeight);

             for (let i = 0; i < photoCount; i++) {
                 const img = await loadImage(photos[i]);
                 const yPos = padding * (i + 1) + (outputPhotoHeight + 2 * borderThickness) * i;

                 // Draw frame/border
                 if (currentFrameColor !== 'none') {
                     ctx.fillStyle = currentFrameColor === 'rainbow' ? '#ccc' : currentFrameColor; // Simple fallback for rainbow
                     if (currentFrameColor === 'rainbow') {
                         // Drawing a complex gradient border is tricky; fill with a placeholder or omit
                          // For simplicity, draw a gray border as placeholder
                          ctx.fillStyle = '#cccccc';
                          ctx.fillRect(padding, yPos, outputPhotoWidth + 2 * borderThickness, outputPhotoHeight + 2 * borderThickness);
                     } else {
                          ctx.fillStyle = currentFrameColor;
                          ctx.fillRect(padding, yPos, outputPhotoWidth + 2 * borderThickness, outputPhotoHeight + 2 * borderThickness);
                     }
                 }

                 // Draw photo on top
                 ctx.drawImage(img, padding + borderThickness, yPos + borderThickness, outputPhotoWidth, outputPhotoHeight);
             }


             // --- Trigger download ---
             const dataUrl = finalCanvas.toDataURL('image/png');
             const link = document.createElement('a');
             link.href = dataUrl;
             link.download = `photobooth_strip_${Date.now()}.png`;
             document.body.appendChild(link);
             link.click();
             document.body.removeChild(link);

        } catch (error) {
            console.error("Error during download:", error);
            alert("An error occurred while preparing the download.");
        } finally {
             downloadBtn.disabled = false;
             downloadBtn.textContent = 'Download';
        }
    }

    // Helper function to load an image and return a promise
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    // --- Upload Logic (Basic Placeholder) ---
    function handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('image/')) {
            alert("Please select a valid image file.");
            return;
        }
        if (isCapturing) {
            alert("Cannot upload photos while capturing.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;

            // Decide how to handle the uploaded photo:
            // Option 1: Add to the next available slot in the current strip
            const emptySlotIndex = photos.findIndex(p => p === null);
            if (emptySlotIndex !== -1) {
                photos[emptySlotIndex] = dataUrl;
                updateCaptureStripPhoto(emptySlotIndex, dataUrl);
                // Check if all photos are now filled
                if (!photos.some(p => p === null)) {
                    mainActionBtn.textContent = 'Next';
                    mainActionBtn.disabled = false;
                }
            } else {
                 // Option 2: Replace the first photo (or prompt user)
                 // photos[0] = dataUrl;
                 // updateCaptureStripPhoto(0, dataUrl);
                 alert("Photo strip is full. Retake or start over to add uploaded photos.");
            }
             // Reset file input to allow uploading the same file again
             uploadInput.value = null;
        };
        reader.readAsDataURL(file);
        console.log("Upload feature triggered. File:", file.name);
        // Further implementation needed for actual integration
        alert("Photo upload feature is under development.");
    }


    // --- Start the application ---
    init();
});