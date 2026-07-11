document.addEventListener('DOMContentLoaded', () => {
    
    // Tab switching logic
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked item
            item.classList.add('active');

            // Hide all tab contents
            tabContents.forEach(tab => {
                tab.classList.remove('active');
            });

            // Show target tab content
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            
            // Scroll to top when switching tabs for better UX
            window.scrollTo(0, 0);
        });
    });

    // Modal logic for Info tab
    const infoCards = document.querySelectorAll('.info-card');
    const modal = document.getElementById('info-modal');
    const modalClose = document.querySelector('.modal-close');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    const infoData = {
        'slub': {
            title: 'Ślub',
            text: '<p>15 Sierpnia 2026, godz. 16:00</p><p class="sub-text">Kościół św. Anny, Warszawa</p>'
        },
        'wesele': {
            title: 'Wesele',
            text: '<p>Rozpoczęcie ok. godz. 18:00</p><p class="sub-text">Sala "Kryształowa", ul. Weselna 10</p>'
        },
        'transport': {
            title: 'Transport',
            text: '<p>Dla gości przewidziany jest autobus spod kościoła pod salę weselną.</p>'
        },
        'nocleg': {
            title: 'Nocleg',
            text: '<p>Osoby potrzebujące noclegu prosimy o kontakt do 1 sierpnia.</p>'
        }
    };

    infoCards.forEach(card => {
        card.addEventListener('click', () => {
            const type = card.getAttribute('data-type');
            if (infoData[type]) {
                modalTitle.textContent = infoData[type].title;
                modalBody.innerHTML = infoData[type].text;
                modal.classList.add('active');
            }
        });
    });

    if (modalClose && modal) {
        modalClose.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }

    // Story Viewer Logic
    const stories = document.querySelectorAll('.story');
    const storyViewer = document.getElementById('story-viewer');
    const storyProgressContainer = document.getElementById('story-progress-container');
    const storyAvatar = document.getElementById('story-viewer-avatar');
    const storyName = document.getElementById('story-viewer-name');
    const storyCloseBtn = document.getElementById('story-close-btn');
    const storyPrevArea = document.getElementById('story-prev-area');
    const storyNextArea = document.getElementById('story-next-area');
    const storyImage = document.getElementById('story-viewer-image');
    const storyPlaceholder = document.getElementById('story-viewer-placeholder');

    let currentStoryIndex = 0;
    let storyProgressInterval;
    let currentProgress = 0;
    const storyDuration = 5000; // 5 seconds per story
    const progressUpdateInterval = 50; // update every 50ms

    // Collect story data from DOM
    const storyData = Array.from(stories).map((storyEl, index) => {
        const imgEl = storyEl.querySelector('img');
        const nameEl = storyEl.querySelector('.story-name');
        return {
            index: index,
            avatar: imgEl ? imgEl.src : '',
            name: nameEl ? nameEl.textContent : 'Gość',
            // Mock content - for now just empty to show placeholder
            contentUrl: '' 
        };
    });

    function initProgressBars() {
        storyProgressContainer.innerHTML = '';
        storyData.forEach(() => {
            const segment = document.createElement('div');
            segment.className = 'story-progress-segment';
            segment.innerHTML = '<div class="story-progress-fill"></div>';
            storyProgressContainer.appendChild(segment);
        });
    }

    function updateProgressBars() {
        const segments = document.querySelectorAll('.story-progress-fill');
        segments.forEach((segment, index) => {
            if (index < currentStoryIndex) {
                segment.style.width = '100%';
            } else if (index === currentStoryIndex) {
                segment.style.width = `${currentProgress}%`;
            } else {
                segment.style.width = '0%';
            }
        });
    }

    function startStoryProgress() {
        clearInterval(storyProgressInterval);
        currentProgress = 0;
        
        storyProgressInterval = setInterval(() => {
            currentProgress += (progressUpdateInterval / storyDuration) * 100;
            updateProgressBars();

            if (currentProgress >= 100) {
                clearInterval(storyProgressInterval);
                nextStory();
            }
        }, progressUpdateInterval);
    }

    function showStory(index) {
        if (index < 0 || index >= storyData.length) {
            closeStory();
            return;
        }

        currentStoryIndex = index;
        const data = storyData[currentStoryIndex];

        // Update UI
        storyAvatar.src = data.avatar;
        storyName.textContent = data.name;

        // If there is real content, show image, else placeholder
        if (data.contentUrl) {
            storyImage.src = data.contentUrl;
            storyImage.style.display = 'block';
            storyPlaceholder.style.display = 'none';
        } else {
            storyImage.style.display = 'none';
            storyPlaceholder.style.display = 'flex';
        }

        storyViewer.classList.add('active');
        
        // Remove 'new' ring if present
        const ring = stories[currentStoryIndex].querySelector('.story-ring');
        if (ring) ring.classList.remove('new');

        updateProgressBars();
        startStoryProgress();
    }

    function nextStory() {
        if (currentStoryIndex + 1 < storyData.length) {
            showStory(currentStoryIndex + 1);
        } else {
            closeStory();
        }
    }

    function prevStory() {
        if (currentStoryIndex > 0) {
            showStory(currentStoryIndex - 1);
        } else {
            // Restart current if first
            showStory(0);
        }
    }

    function closeStory() {
        storyViewer.classList.remove('active');
        clearInterval(storyProgressInterval);
    }

    // Event Listeners
    stories.forEach(story => {
        story.addEventListener('click', (e) => {
            const index = parseInt(story.getAttribute('data-story-index'));
            initProgressBars();
            showStory(index);
        });
    });

    storyCloseBtn.addEventListener('click', closeStory);
    storyPrevArea.addEventListener('click', prevStory);
    storyNextArea.addEventListener('click', nextStory);

    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
});
