// 1. Импорт аналитики Vercel (Скорость и Посетители)
import { injectSpeedInsights } from 'https://unpkg.com/@vercel/speed-insights/dist/index.mjs';
import { inject } from 'https://unpkg.com/@vercel/analytics/dist/index.mjs';

// 2. Импорты Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, push, onChildAdded, onChildRemoved, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Запуск инструментов Vercel
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

// --- ЛОГИКА ТЕМЫ ---
const themeBtn = document.getElementById('themeBtn');
if (localStorage.getItem('theme') === 'light') {
    document.body.setAttribute('data-theme', 'light');
    themeBtn.innerText = '🌙';
}

themeBtn.onclick = () => {
    let isLight = document.body.getAttribute('data-theme') === 'light';
    document.body.toggleAttribute('data-theme', !isLight);
    themeBtn.innerText = isLight ? '☀️' : '🌙';
    localStorage.setItem('theme', isLight ? 'dark' : 'light');
};

// --- АВТОРИЗАЦИЯ ---
onAuthStateChanged(auth, (user) => {
    document.getElementById('authSection').style.display = user ? 'none' : 'flex';
    if(user) loadMessages();
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
        if(isMine) div.onclick = () => confirm("Удалить сообщение?") && remove(ref(db, `messages/${snap.key}`));
        
        div.innerHTML = `
            <img src="${d.photo || 'https://via.placeholder.com/40'}" class="avatar">
            <div class="bubble-wrap">
                <div class="u-info">${d.name} <span class="time">${time}</span></div>
                <div class="msg">
                    ${d.text ? `<div>${d.text}</div>` : ''}
                    ${d.image ? `<img src="${d.image}" class="chat-img">` : ''}
                </div>
            </div>
        `;
        msgsDiv.appendChild(div);
        msgsDiv.scrollTop = msgsDiv.scrollHeight;
    });
    onChildRemoved(ref(db, 'messages'), (snap) => document.getElementById('msg-' + snap.key)?.remove());
}

const sendMessage = (data) => {
    push(ref(db, 'messages'), { 
        ...data,
        name: auth.currentUser.displayName, 
        photo: auth.currentUser.photoURL,
        uid: auth.currentUser.uid, 
        time: serverTimestamp() 
    });
};

document.getElementById('sendBtn').onclick = () => {
    const val = msgInput.value.trim();
    if(val) { sendMessage({ text: val }); msgInput.value = ''; }
};

msgInput.onkeypress = (e) => e.key === 'Enter' && document.getElementById('sendBtn').click();

// --- ЗАГРУЗКА ФОТО ---
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
