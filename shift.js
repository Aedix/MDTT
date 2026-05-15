const shiftButton = document.querySelector('#shiftButton');
const shiftStatus = document.querySelector('#shiftStatus');
const shiftTimer = document.querySelector('#shiftTimer');

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function updateShiftTimer() {
  if (!shiftStatus || !shiftTimer) return;

  const startedAt = shiftStatus.dataset.startedAt;

  if (!startedAt) {
    return;
  }

  const startedDate = new Date(startedAt.replace(' ', 'T'));
  const diffSeconds = Math.max(0, Math.floor((Date.now() - startedDate.getTime()) / 1000));
  shiftTimer.textContent = `En service depuis ${formatDuration(diffSeconds)}`;
}

if (shiftStatus?.dataset.startedAt) {
  updateShiftTimer();
  window.setInterval(updateShiftTimer, 1000);
}

if (shiftButton) {
  shiftButton.addEventListener('click', async () => {
    shiftButton.disabled = true;
    shiftButton.textContent = 'Mise à jour...';

    try {
      const response = await fetch('/api/toggle-shift.php', {
        method: 'POST',
        credentials: 'same-origin'
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        window.alert(result.message || 'Action refusée.');
        shiftButton.disabled = false;
        shiftButton.textContent = shiftButton.dataset.onDuty === '1' ? 'Fin de service' : 'Prise de service';
        return;
      }

      window.location.reload();
    } catch (error) {
      window.alert('Erreur serveur ou réponse invalide.');
      shiftButton.disabled = false;
      shiftButton.textContent = shiftButton.dataset.onDuty === '1' ? 'Fin de service' : 'Prise de service';
    }
  });
}
