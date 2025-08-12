
  // const sections = document.querySelectorAll('.page');
  // let current = 0;
  // let scrolling = false;
  // const duration = 600; // czas animacji w ms

  // function smoothScrollTo(targetY, callback) {
  //   const startY = window.scrollY;
  //   const startTime = performance.now();

  //   function animate(time) {
  //     const elapsed = time - startTime;
  //     const progress = Math.min(elapsed / duration, 1);
  //     const ease = 0.5 - Math.cos(progress * Math.PI) / 2; // easeInOut
  //     window.scrollTo(0, startY + (targetY - startY) * ease);

  //     if (progress < 1) {
  //       requestAnimationFrame(animate);
  //     } else {
  //       callback && callback();
  //     }
  //   }
  //   requestAnimationFrame(animate);
  // }

  // window.addEventListener('wheel', (e) => {
  //   e.preventDefault();
  //   if (scrolling) return;
  //   scrolling = true;

  //   if (e.deltaY > 0 && current < sections.length - 1) {
  //     current++;
  //   } else if (e.deltaY < 0 && current > 0) {
  //     current--;
  //   }

  //   const targetY = sections[current].offsetTop;
  //   smoothScrollTo(targetY, () => scrolling = false);
  // }, { passive: false });