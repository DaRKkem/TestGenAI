// TestGen AI — landing page script
// Everything on this page is static except the "Start generating" buttons,
// which are plain links to index.html (the app). This file only exists to
// give a small, honest bit of feedback on click — no other interactivity.
 
document.querySelectorAll(".btn-start").forEach((btn) => {
  // On sauvegarde le texte original du bouton
  const originalText = btn.textContent;

  btn.addEventListener("click", () => {
    btn.textContent = "Loading the app…";

    // Après 0,5 seconde, on remet le texte original
    setTimeout(() => {
      btn.textContent = originalText;
    }, 500);
  });
});