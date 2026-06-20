// auth.js
const SB_URL='https://ejrlskbemmdxomznmutx.supabase.co';
const SB_KEY='sb_publishable_weoYF06na2nVB4WAkdhI5A_5BoESARI';

window.supabaseClient=supabase.createClient(SB_URL,SB_KEY);

window.Auth={
  session:null,
  user:null,
  async init(onChange){
    const {data,error}=await window.supabaseClient.auth.getSession();
    if(error) console.error('Auth session error:',error.message);
    this.session=data&&data.session?data.session:null;
    this.user=this.session&&this.session.user?this.session.user:null;
    if(typeof onChange==='function') await onChange(this.session,'INITIAL_SESSION');
    window.supabaseClient.auth.onAuthStateChange(async(event,session)=>{
      this.session=session||null;
      this.user=session&&session.user?session.user:null;
      if(typeof onChange==='function') await onChange(this.session,event);
    });
  },
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
    this.session=null;this.user=null;
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
  setAuthMessage('Logging in...','var(--slate2)');
  try{await window.Auth.signInWithPassword(authEmail(),authPassword());setAuthMessage('Logged in.','var(--green)');}
  catch(e){setAuthMessage(e.message||'Login failed.','var(--negred)');}
}
async function handlePasswordSignup(){
  setAuthMessage('Creating account...','var(--slate2)');
  try{
    const data=await window.Auth.signUpWithPassword(authEmail(),authPassword());
    if(data&&data.session) setAuthMessage('Account created.','var(--green)');
    else setAuthMessage('Account created. If email confirmation is enabled, confirm your email before logging in.','var(--gold)');
  }catch(e){setAuthMessage(e.message||'Signup failed.','var(--negred)');}
}
async function handleGoogleLogin(){
  setAuthMessage('Redirecting to Google...','var(--slate2)');
  try{await window.Auth.signInWithGoogle();}
  catch(e){setAuthMessage(e.message||'Google login failed.','var(--negred)');}
}
async function handleSignOut(){
  try{await window.Auth.signOut();}
  catch(e){alert(e.message||'Sign out failed.');}
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
