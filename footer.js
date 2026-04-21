(function () {
  const container = document.getElementById('footer-placeholder');
  if (!container) return;

  fetch('footer.html')
    .then(response => response.text())
    .then(html => {
      const footerElement = document.createElement('footer');
      footerElement.className = 'footer';
      footerElement.innerHTML = html;
      container.appendChild(footerElement);
    })
    .catch(error => console.error('Error loading footer:', error));
})();
