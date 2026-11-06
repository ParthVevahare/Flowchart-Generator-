import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import * as firestore from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

export function connect(config){
  const app=initializeApp(config),auth=getAuth(app),db=firestore.getFirestore(app);
  const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
  return {
    store:globalThis.CodeLibraryStore.createStore(db,firestore),
    watch:callback=>onAuthStateChanged(auth,callback),
    signIn:()=>signInWithPopup(auth,provider),
    signOut:()=>signOut(auth)
  };
}
