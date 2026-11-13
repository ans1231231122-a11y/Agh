/**
 * شُرَاك | SHURAK - إعدادات Firebase الحقيقية
 * المشروع: shurak-c6912
 */

const firebaseConfig = {
  apiKey: "AIzaSyCKwdyDksdX3qvBWAHP54UPj-cbVSaEeXs",
  authDomain: "shurak-c6912.firebaseapp.com",
  projectId: "shurak-c6912",
  storageBucket: "shurak-c6912.firebasestorage.app",
  messagingSenderId: "850177515843",
  appId: "1:850177515843:web:39511ed6a0821acef14ff6",
  measurementId: "G-KLK1SL4GRN"
};

let app, auth, db, storage;

try {
  app = firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  storage = firebase.storage();
  console.log("✅ Firebase + Storage متصل - shurak-c6912");
} catch (e) {
  console.error("خطأ Firebase:", e);
}

window.SHURAK = {
  auth,
  db,
  storage,
  isFirebaseConfigured: true,
  googleProvider: new firebase.auth.GoogleAuthProvider()
};
