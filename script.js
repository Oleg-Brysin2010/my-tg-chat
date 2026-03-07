import { injectSpeedInsights } from 'https://unpkg.com/@vercel/speed-insights/dist/index.mjs';
import { inject } from 'https://unpkg.com/@vercel/analytics/dist/index.mjs';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, push, onChildAdded, onChildRemoved, remove, serverTimestamp, set, onDisconnect, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

injectSpeedInsights();
inject();

const firebaseConfig = { 
    apiKey: "AIzaSyCiduYZfuWiAoJOuTuhmdDRbPWlpL1jmw4", 
    authDomain: "telegram-clone-roskamnadzor.firebaseapp.com", 
    projectId: "telegram-clone-роскамнадзор", 
    databaseURL: "https://telegram-clone-roskamnadzor-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GoogleAuthProvider();
const IMGBB_KEY = "b0ae43a6f86ace22817aa2f7b101fa31";

const msgsDiv = document.getElementById('messages');
const msgInput = document.getElementById('msgInput');
const statusDiv = document.getElementById('status');

// --- ТЕМА ---
const themeBtn = document.getElementById('themeBtn');
if (localStorage.getItem('theme') === 'light') { document.body.setAttribute('data-theme', 'light'); themeBtn.innerText = '🌙'; }
themeBtn.onclick = () => {
    let isLight = document.body.getAttribute('data-theme') === 'light';
    document.body.toggleAttribute('data-theme', !isLight);
    themeBtn.innerText = isLight ? '☀️' : '🌙';
    localStorage.setItem('theme', isLight ? 'dark' : 'light');
};

// --- ОНЛАЙН СТАТУС ---
function setOnlineStatus(user) {
    const userStatusRef = ref(db, `status/${user.uid}`);
    set(userStatusRef, { online: true, name: user.displayName });
    onDisconnect(userStatusRef).remove();
}

// --- УВЕДОМЛЕНИЯ ---
if (Notification.permission !== "granted") Notification.requestPermission();

// --- АВТОРИЗАЦИЯ ---
onAuthStateChanged(auth, (user) => {
    document.getElementById('authSection').style.display = user ? 'none' : 'flex';
    if(user) { setOnlineStatus(user); loadMessages(); }
});

document.getElementById('googleBtn').onclick = () => signInWithPopup(auth, provider);
window.logout = () => signOut(auth);

// --- ЧАТ ---
function loadMessages() {
    msgsDiv.innerHTML = '';
    onChildAdded(ref(db, 'messages'), (snap) => {
        const d = snap.val();
        const isMine = d.uid === auth.currentUser.uid;
        const time = d.time ? new Date(d.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
        
        const div = document.createElement('div');
        div.id = 'msg-' + snap.key;
        div.className = `msg-row ${isMine ? 'mine' : ''}`;
        
        div.innerHTML = `
            <div class="avatar-container">
                <img src="${d.photo || 'https://via.placeholder.com/40'}" class="avatar">
                <div class="online-badge" id="online-${d.uid}" style="display:none;"></div>
            </div>
            <div class="bubble-wrap">
                <div class="u-info">
                    ${d.name} <span class="time">${time}</span>
                    ${isMine ? `<span class="del-btn" onclick="deleteMsg('${snap.key}')">🗑️</span>` : ''}
                </div>
                <div class="msg">
                    ${d.text ? `<div>${d.text}</div>` : ''}
                    ${d.image ? `<img src="${d.image}" class="chat-img">` : ''}
                </div>
                <div class="reactions-bar">
                    <span class="reaction-btn" onclick="addReaction(event, '${snap.key}', '❤️')">❤️ <span id="count-❤️-${snap.key}">0</span></span>
                    <span class="reaction-btn" onclick="addReaction(event, '${snap.key}', '🔥')">🔥 <span id="count-🔥-${snap.key}">0</span></span>
                </div>
            </div>
        `;
        msgsDiv.appendChild(div);
        msgsDiv.scrollTop = msgsDiv.scrollHeight;

        onValue(ref(db, `status/${d.uid}`), (s) => {
            const badge = document.getElementById(`online-${d.uid}`);
            if(badge) badge.style.display = s.exists() ? 'block' : 'none';
        });

        onValue(ref(db, `messages/${snap.key}/reactions`), (s) => {
            const reacts = s.val() || {};
            ['❤️', '🔥'].forEach(emoji => {
                const count = Object.values(reacts).filter(v => v === emoji).length;
                const el = document.getElementById(`count-${emoji}-${snap.key}`);
                if(el) el.innerText = count;
            });
        });

        if (!isMine && d.time > Date.now() - 2000) {
            new Notification("Mlyn: " + d.name, { body: d.text || "Картинка 🖼️" });
        }
    });
    onChildRemoved(ref(db, 'messages'), (snap) => document.getElementById('msg-' + snap.key)?.remove());
}

// ФУНКЦИЯ УДАЛЕНИЯ (Теперь отдельная)
window.deleteMsg = (id) => {
    if(confirm("Удалить это сообщение?")) remove(ref(db, `messages/${id}`));
};

// ФУНКЦИЯ РЕАКЦИИ (С защитой от срабатывания клика по сообщению)
window.addReaction = (event, msgId, emoji) => {
    event.stopPropagation(); // Остановка клика, чтобы не вылезло удаление
    const reactRef = ref(db, `messages/${msgId}/reactions/${auth.currentUser.uid}`);
    set(reactRef, emoji);
};

const sendMessage = (data) => {
    push(ref(db, 'messages'), { 
        ...data, name: auth.currentUser.displayName, 
        photo: auth.currentUser.photoURL, uid: auth.currentUser.uid, 
        time: serverTimestamp() 
    });
};

document.getElementById('sendBtn').onclick = () => {
    const val = msgInput.value.trim();
    if(val) { sendMessage({ text: val }); msgInput.value = ''; }
};

msgInput.onkeypress = (e) => e.key === 'Enter' && document.getElementById('sendBtn').click();

document.getElementById('fileInput').onchange = async (e) => {
    const f = e.target.files[0]; if(!f) return;
    statusDiv.innerText = "☁️ Загрузка фото...";
    const fd = new FormData(); fd.append("image", f);
    try {
        const r = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd });
        const res = await r.json();
        if(res.success) sendMessage({ image: res.data.url });
    } catch(err) { alert("Ошибка загрузки"); }
    statusDiv.innerText = "";
    e.target.value = '';
};
