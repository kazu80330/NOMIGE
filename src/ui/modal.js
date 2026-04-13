// ==================== MODAL & TOAST ====================

export function showModal(title, sub, tableHTML, btns) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-sub').textContent = sub;
  document.getElementById('result-table').innerHTML = tableHTML;
  const btnDiv = document.getElementById('modal-btns');
  btnDiv.innerHTML = '';
  btns.forEach(b => {
    const el = document.createElement('button');
    el.className = b.cls;
    el.textContent = b.label;
    el.onclick = b.action;
    btnDiv.appendChild(el);
  });
  document.getElementById('modal-overlay').classList.add('active');
}

export function hideModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

export function showToast(msg, duration = 1800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}
