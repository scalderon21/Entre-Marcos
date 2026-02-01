(async function initStackedCarousel() {
    'use strict';
    // Funciones auxiliares
    function shuffle(arr) {
        const array = [...arr];
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Intentar cargar imágenes desde manifest.json
    async function tryManifest() {
        try {
            const res = await fetch('images/frames/manifest.json');
            if (res.ok) {
                const list = await res.json();
                if (Array.isArray(list) && list.length) {
                    return list.map(f => 'images/frames/' + f);
                }
            }
        } catch (e) {
            console.log('No manifest.json found');
        }
        return null;
    }

    // Intentar obtener listado de directorio
    async function tryDirectoryListing() {
        try {
            const res = await fetch('images/frames/');
            if (res.ok) {
                const text = await res.text();
                const matches = [...text.matchAll(/href="([^"]+\.(?:jpe?g|jpg))"/gi)];
                const files = matches.map(m => m[1]).filter(Boolean);
                if (files.length) {
                    return files.map(f => {
                        if (f.startsWith('http')) return f;
                        return 'images/frames/' + f.replace(/^\/+/, '').split('/').pop();
                    });
                }
            }
        } catch (e) {
            console.log('Directory listing failed');
        }
        return null;
    }

    // Intentar encontrar imágenes numeradas
    async function tryNumbered() {
        const found = [];
        const exts = ['jpg', 'jpeg'];

        for (let i = 1; i <= 50; i++) {
            for (const ext of exts) {
                const url = `images/frames/frame-${i}.${ext}`;
                try {
                    const r = await fetch(url, { method: 'HEAD' });
                    if (r.ok) {
                        found.push(url);
                        break;
                    }
                } catch (e) {}
            }
            if (found.length >= 50) break;
        }

        return found.length ? found : null;
    }

    // Intentar con nombres comunes
    async function tryCommonNames() {
        const found = [];
        const exts = ['jpg', 'jpeg'];
        const names = ['frame', 'image', 'photo', 'pic', 'img', '1', '2', '3', '4', '5'];

        for (const name of names) {
            for (const ext of exts) {
                const url = `images/frames/${name}.${ext}`;
                try {
                    const r = await fetch(url, { method: 'HEAD' });
                    if (r.ok) {
                        found.push(url);
                        break;
                    }
                } catch (e) {}
            }
        }

        return found.length ? found : null;
    }

    // Buscar todas las imágenes disponibles
    async function findAllImages() {
        let imgs = await tryManifest();
        if (imgs && imgs.length) return imgs;

        imgs = await tryDirectoryListing();
        if (imgs && imgs.length) return imgs;

        imgs = await tryNumbered();
        if (imgs && imgs.length) return imgs;

        imgs = await tryCommonNames();
        if (imgs && imgs.length) return imgs;

        return [];
    }

    // Cargar imágenes
    const allImages = await findAllImages();

    // Filtrar solo imágenes JPEG
    const jpegImages = allImages.filter(src => /\.jpe?g$/i.test(src));
    const imagesToUse = jpegImages.length > 0 ? jpegImages : allImages;

    const containers = document.querySelectorAll('#carouselContainer');
    if (!containers || containers.length === 0) return;

    containers.forEach(container => {
        const prevBtn = container.parentElement.querySelector('#prevBtn');
        const nextBtn = container.parentElement.querySelector('#nextBtn');

        // Si no hay imágenes, dejar el placeholder
        if (!imagesToUse || imagesToUse.length === 0) {
            console.log('No se encontraron imágenes JPEG en images/frames/');
            return;
        }

        // Limpiar contenedor y preparar
        container.style.position = 'relative';
        container.style.minHeight = '340px';
        container.innerHTML = '';

        // Selección impar preferente (5 si hay, sino 3)
        let desiredCount = imagesToUse.length >= 5 ? 5 : (imagesToUse.length >= 3 ? 3 : imagesToUse.length);
        if (desiredCount % 2 === 0) desiredCount = Math.max(1, desiredCount - 1);
        const selected = shuffle(imagesToUse).slice(0, Math.min(desiredCount, imagesToUse.length));

        // Crear slides
        const slides = [];
        selected.forEach((src, index) => {
            const slide = document.createElement('div');
            slide.className = 'carousel-slide';
            slide.dataset.index = index;

            slide.style.position = 'absolute';
            slide.style.top = '50%';
            slide.style.left = '50%';
            slide.style.transform = 'translate(-50%, -50%)';

            const inner = document.createElement('div');
            inner.className = 'slide-inner';

            const img = document.createElement('img');
            img.src = src;
            img.alt = `Marco ${index + 1}`;
            img.loading = 'lazy';

            img.addEventListener('error', () => {
                console.error(`Error loading image: ${src}`);
                slide.remove();
            });

            inner.appendChild(img);
            slide.appendChild(inner);
            container.appendChild(slide);
            slides.push(slide);
        });

        if (slides.length === 0) return;

        let currentIndex = 0;
        let autoplayInterval = null;

        function clamp(val, min, max) {
            return Math.max(min, Math.min(max, val));
        }

        function updateSlides() {
            const total = slides.length;
            if (!total) return;

            const sample = slides[0].getBoundingClientRect();
            const slideW = sample.width || slides[0].offsetWidth || 260;
            const overlapFactor = clamp(0.58, 0.45, 0.7);
            const step = slideW * overlapFactor;

            const visibleRange = 1;

            slides.forEach((slide, i) => {
                let pos = i - currentIndex;
                if (pos < -Math.floor(total / 2)) pos += total;
                if (pos > Math.floor(total / 2)) pos -= total;

                let offsetX = 0;
                let tz = 0;
                let rotateY = 0;
                let scale = 1;
                let opacity = 1;
                let z = 0;

                if (Math.abs(pos) <= visibleRange) {
                    offsetX = pos * step;
                    tz = pos === 0 ? 0 : -180;
                    rotateY = -pos * 30;
                    scale = pos === 0 ? 1 : 0.86;
                    opacity = pos === 0 ? 1 : 0.95;
                    z = pos === 0 ? 100 : 90;
                    slide.style.pointerEvents = 'auto';
                } else {
                    offsetX = pos > 0 ? step * 3.2 : -step * 3.2;
                    tz = -600;
                    rotateY = pos > 0 ? -55 : 55;
                    scale = 0.5;
                    opacity = 0;
                    z = 10;
                    slide.style.pointerEvents = 'none';
                }

                slide.style.transition = 'transform 600ms cubic-bezier(0.2,0.8,0.2,1), opacity 300ms';
                slide.style.transform = `translate(-50%, -50%) translateX(${Math.round(offsetX)}px) translateZ(${tz}px) rotateY(${rotateY}deg) scale(${scale})`;
                slide.style.opacity = opacity;
                slide.style.zIndex = z;
                slide.setAttribute('aria-hidden', opacity === 0 ? 'true' : 'false');
            });
        }

        function nextSlide() {
            currentIndex = (currentIndex + 1) % slides.length;
            updateSlides();
        }

        function prevSlide() {
            currentIndex = (currentIndex - 1 + slides.length) % slides.length;
            updateSlides();
        }

        if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); restartAutoplay(); });
        if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); restartAutoplay(); });

        slides.forEach((slide, idx) => {
            slide.addEventListener('click', () => {
                if (idx === currentIndex) return;
                currentIndex = idx;
                updateSlides();
                restartAutoplay();
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') prevSlide();
            if (e.key === 'ArrowRight') nextSlide();
        });

        function startAutoplay() {
            if (autoplayInterval) clearInterval(autoplayInterval);
            autoplayInterval = setInterval(nextSlide, 3500);
        }

        function stopAutoplay() {
            if (autoplayInterval) { clearInterval(autoplayInterval); autoplayInterval = null; }
        }

        function restartAutoplay() { stopAutoplay(); startAutoplay(); }

        container.addEventListener('mouseenter', stopAutoplay);
        container.addEventListener('mouseleave', startAutoplay);

        let rTO;
        window.addEventListener('resize', () => { clearTimeout(rTO); rTO = setTimeout(() => updateSlides(), 120); });

        updateSlides();
        startAutoplay();
    });
})();