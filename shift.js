let shiftButton = document.querySelector('#shiftButton');
let shiftStatus = document.querySelector('#shiftStatus');
let shiftTimer = document.querySelector('#shiftTimer');
let shiftTimerInterval = null;

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function updateShiftTimer() {
  shiftStatus = document.querySelector('#shiftStatus');
  shiftTimer = document.querySelector('#shiftTimer');

  if (!shiftStatus || !shiftTimer) return;

  const startedAt = shiftStatus.dataset.startedAt;

  if (!startedAt) {
    shiftTimer.textContent = 'Aucune prise de service active.';
    return;
  }

  const startedDate = new Date(startedAt.replace(' ', 'T'));
  const diffSeconds = Math.max(0, Math.floor((Date.now() - startedDate.getTime()) / 1000));
  shiftTimer.textContent = `En service depuis ${formatDuration(diffSeconds)}`;
}

function restartShiftTimer() {
  if (shiftTimerInterval) window.clearInterval(shiftTimerInterval);
  updateShiftTimer();
  shiftTimerInterval = window.setInterval(updateShiftTimer, 1000);
}

function applyShiftState(shift) {
  shiftButton = document.querySelector('#shiftButton');
  shiftStatus = document.querySelector('#shiftStatus');

  if (shiftButton) {
    shiftButton.disabled = false;
    shiftButton.dataset.onDuty = shift.is_on_duty ? '1' : '0';
    shiftButton.textContent = shift.is_on_duty ? 'Fin de service' : 'Prise de service';
    shiftButton.classList.toggle('on-duty', Boolean(shift.is_on_duty));
    shiftButton.classList.toggle('off-duty', !shift.is_on_duty);
  }

  if (shiftStatus) {
    shiftStatus.dataset.startedAt = shift.started_at || '';
    shiftStatus.textContent = shift.is_on_duty ? 'En service' : 'Hors service';
    shiftStatus.classList.toggle('on', Boolean(shift.is_on_duty));
    shiftStatus.classList.toggle('off', !shift.is_on_duty);
  }

  restartShiftTimer();
}

window.applyShiftState = applyShiftState;
window.restartShiftTimer = restartShiftTimer;

restartShiftTimer();

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

      if (window.syncDashboardState) {
        await window.syncDashboardState(true);
      } else {
        shiftButton.disabled = false;
      }
    } catch (error) {
      window.alert('Erreur serveur ou réponse invalide.');
      shiftButton.disabled = false;
      shiftButton.textContent = shiftButton.dataset.onDuty === '1' ? 'Fin de service' : 'Prise de service';
    }
  });
}
