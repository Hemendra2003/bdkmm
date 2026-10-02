// auth.js
const SB_URL='https://ejrlskbemmdxomznmutx.supabase.co';
const SB_KEY='sb_publishable_weoYF06na2nVB4WAkdhI5A_5BoESARI';

window.supabaseClient=supabase.createClient(SB_URL,SB_KEY);

// BEGIN GENERATED SESSION BUNDLE — node src/state/build-legacy.mjs
const MomentumSession=(()=>{const exports={};
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSessionController = createSessionController;
// No browser/client/clock dependencies. The scheduler must defer work until
// after the synchronous auth notification returns (a task, not an awaited callback).
function createSessionController(deps) {
    let userId = null, generation = 0, initialized = false;
    let notifications = 0, startPromise = null;
    let unsubscribe = null;
    let disposed = false;
    const snapshot = () => ({ userId, generation });
    const isCurrent = (context) => !disposed && context.generation === generation && context.userId === userId;
    function receive(event, session) {
        if (disposed)
            return;
        notifications++;
        const next = session?.user.id ?? null;
        deps.publish(session);
        // A repeated SIGNED_IN/INITIAL_SESSION and TOKEN_REFRESHED update the
        // credential snapshot but never restart boot or clear the current UI.
        if (initialized && next === userId)
            return;
        const previous = userId;
        initialized = true;
        userId = next;
        generation++;
        deps.clear(previous, next);
        const context = snapshot();
        deps.schedule(() => {
            if (!isCurrent(context))
                return;
            Promise.resolve()
                .then(() => {
                if (isCurrent(context))
                    return deps.boot(session, event, context);
            })
                .catch((error) => {
                if (isCurrent(context))
                    deps.onError(error);
            });
        });
    }
    function start() {
        if (startPromise)
            return startPromise;
        if (disposed)
            return Promise.reject(new Error('Session controller disposed.'));
        // Subscribe once before loading the snapshot; a newer auth event wins over
        // an old getSession result, even if it switches away and back to the same ID.
        const version = notifications;
        unsubscribe = deps.subscribe(receive);
        startPromise = deps
            .readSession()
            .then((session) => {
            if (!disposed && notifications === version)
                receive('INITIAL_SESSION', session);
        })
            .catch((error) => {
            if (!disposed && notifications === version)
                deps.onError(error);
        });
        return startPromise;
    }
    function dispose() {
        if (disposed)
            return;
        disposed = true;
        generation++;
        unsubscribe?.();
        unsubscribe = null;
    }
    return { start, snapshot, isCurrent, dispose };
}

return exports;})();
// END GENERATED SESSION BUNDLE
window.Auth={
  session:null,
  user:null,
  _controller:null,
  _onChange:null,
  onBoundary:null,
  init(onChange){
    if(typeof onChange==='function')this._onChange=onChange;
    if(!this._controller){
      this._controller=MomentumSession.createSessionController({
        subscribe:receive=>{
          const {data}=window.supabaseClient.auth.onAuthStateChange((event,session)=>receive(event,session));
          return ()=>data.subscription.unsubscribe();
        },
        readSession:async()=>{
          const {data,error}=await window.supabaseClient.auth.getSession();
          if(error)throw error;
          return data&&data.session?data.session:null;
        },
        publish:session=>{this.session=session;this.user=session?session.user:null;},
        clear:()=>{if(typeof this.onBoundary==='function')this.onBoundary(this.getUserId());},
        boot:(session,event,context)=>{if(this._onChange)return this._onChange(session,event,context);},
        schedule:work=>setTimeout(work,0),
        onError:error=>{
          console.error('Auth session error:',error);
          if(!this.getUserId()){document.body.classList.add('app-auth-locked');window.AuthUI.show();}
          setAuthMessage('Could not load your session. Reload to retry.','var(--negred)');
        },
      });
    }
    return this._controller.start();
  },
  getGeneration(){return this._controller?this._controller.snapshot().generation:0;},
  getUserId(){return this.user&&this.user.id?this.user.id:null;},
  isLoggedIn(){return Boolean(this.getUserId());},
  async signInWithPassword(email,password){
    const cleanEmail=String(email||'').trim().toLowerCase();
    if(!cleanEmail) throw new Error('Enter your email.');
    if(!password) throw new Error('Enter your password.');
    const {data,error}=await window.supabaseClient.auth.signInWithPassword({email:cleanEmail,password});
    if(error) throw error;
    return data;
  },
  async signUpWithPassword(email,password){
    const cleanEmail=String(email||'').trim().toLowerCase();
    if(!cleanEmail) throw new Error('Enter your email.');
    if(!password||password.length<6) throw new Error('Password must be at least 6 characters.');
    const {data,error}=await window.supabaseClient.auth.signUp({email:cleanEmail,password});
    if(error) throw error;
    return data;
  },
  async signInWithGoogle(){
    const {error}=await window.supabaseClient.auth.signInWithOAuth({
      provider:'google',
      options:{redirectTo:window.location.origin+window.location.pathname}
    });
    if(error) throw error;
  },
  async signOut(){
    const {error}=await window.supabaseClient.auth.signOut();
    if(error) throw error;
    // The subscribed SIGNED_OUT event owns session transitions; a late signOut
    // response must never clear a newly signed-in account.
  }
};

function authEmail(){return document.getElementById('auth-email').value;}
function authPassword(){return document.getElementById('auth-password').value;}
function setAuthMessage(text,color){
  const el=document.getElementById('auth-message');
  if(!el) return;
  el.textContent=text||'';
  el.style.color=color||'var(--slate2)';
}

window.AuthUI={
  show(){document.getElementById('auth-screen').classList.add('active');},
  hide(){document.getElementById('auth-screen').classList.remove('active');setAuthMessage('');ensureSignOutButton();}
};

async function handlePasswordLogin(){
  const generation=window.Auth.getGeneration();
  setAuthMessage('Logging in...','var(--slate2)');
  try{await window.Auth.signInWithPassword(authEmail(),authPassword());if(generation!==window.Auth.getGeneration())return;setAuthMessage('Logged in.','var(--green)');}
  catch(e){if(generation!==window.Auth.getGeneration())return;setAuthMessage(e.message||'Login failed.','var(--negred)');}
}
async function handlePasswordSignup(){
  const generation=window.Auth.getGeneration();
  setAuthMessage('Creating account...','var(--slate2)');
  try{
    const data=await window.Auth.signUpWithPassword(authEmail(),authPassword());if(generation!==window.Auth.getGeneration())return;
    if(data&&data.session) setAuthMessage('Account created.','var(--green)');
    else setAuthMessage('Account created. If email confirmation is enabled, confirm your email before logging in.','var(--gold)');
  }catch(e){if(generation!==window.Auth.getGeneration())return;setAuthMessage(e.message||'Signup failed.','var(--negred)');}
}
async function handleGoogleLogin(){
  const generation=window.Auth.getGeneration();
  setAuthMessage('Redirecting to Google...','var(--slate2)');
  try{await window.Auth.signInWithGoogle();}
  catch(e){if(generation!==window.Auth.getGeneration())return;setAuthMessage(e.message||'Google login failed.','var(--negred)');}
}
async function handleSignOut(){
  const generation=window.Auth.getGeneration();
  try{await window.Auth.signOut();}
  catch(e){if(generation!==window.Auth.getGeneration())return;alert(e.message||'Sign out failed.');}
}
function ensureSignOutButton(){
  if(document.getElementById('auth-signout-btn')) return;
  const btn=document.createElement('button');
  btn.id='auth-signout-btn';
  btn.className='auth-floating-signout';
  btn.textContent='Sign out';
  btn.onclick=handleSignOut;
  document.body.appendChild(btn);
}

document.addEventListener('keydown',e=>{
  const auth=document.getElementById('auth-screen');
  if(auth&&auth.classList.contains('active')&&e.key==='Enter'){
    e.preventDefault();handlePasswordLogin();
  }
});
