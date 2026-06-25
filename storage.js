// storage.js
// Supabase-first now; this is the seam to replace with local-first later.
window.Storage={
  async requireUserId(){
    const userId=window.Auth.getUserId();
    if(!userId) throw new Error('You must be logged in.');
    return userId;
  },
  async loadEntries(){
    await this.requireUserId();
    const {data,error}=await window.supabaseClient
      .from('momentum_entries')
      .select('date,answers,updated_at')
      .order('date',{ascending:true});
    if(error) throw error;
    return data||[];
  },
  async saveEntry(date,answers){
    const userId=await this.requireUserId();
    const {data,error}=await window.supabaseClient
      .from('momentum_entries')
      .upsert({user_id:userId,date,answers},{onConflict:'user_id,date'})
      .select('date,answers,updated_at')
      .single();
    if(error) throw error;
    return data;
  },
  async deleteEntries(){
    await this.requireUserId();
    const {error}=await window.supabaseClient
      .from('momentum_entries')
      .delete()
      .neq('date','0000-00-00');
    if(error) throw error;
    return true;
  },
  async exportEntries(){return await this.loadEntries();},
  async importEntries(rows){
    const userId=await this.requireUserId();
    const normalized=(rows||[])
      .filter(row=>row&&row.date)
      .map(row=>({user_id:userId,date:row.date,answers:row.answers||{}}));
    if(!normalized.length) return [];
    const {data,error}=await window.supabaseClient
      .from('momentum_entries')
      .upsert(normalized,{onConflict:'user_id,date'})
      .select('date,answers,updated_at');
    if(error) throw error;
    return data||[];
  },

  // ============================================================
  // USER QUESTIONS — replaces the old hardcoded QS constant.
  // Each user owns their own question set, stored in user_questions.
  // ============================================================
  async loadQuestions(){
    await this.requireUserId();
    const {data,error}=await window.supabaseClient
      .from('user_questions')
      .select('id,key,text,opts,polarity,tier,is_fixed,source,sort_order')
      .order('sort_order',{ascending:true});
    if(error) throw error;
    return data||[];
  },
  async saveQuestion(q){
    const userId=await this.requireUserId();
    const row={
      user_id:userId,
      key:q.key,
      text:q.text,
      opts:q.opts,
      polarity:q.polarity,
      tier:q.tier,
      is_fixed:!!q.is_fixed,
      source:q.source||'custom',
      sort_order:q.sort_order||0,
    };
    const {data,error}=await window.supabaseClient
      .from('user_questions')
      .upsert(row,{onConflict:'user_id,key'})
      .select('id,key,text,opts,polarity,tier,is_fixed,source,sort_order')
      .single();
    if(error) throw error;
    return data;
  },
  async saveQuestions(questions){
    const userId=await this.requireUserId();
    const rows=(questions||[]).map(q=>({
      user_id:userId,
      key:q.key,
      text:q.text,
      opts:q.opts,
      polarity:q.polarity,
      tier:q.tier,
      is_fixed:!!q.is_fixed,
      source:q.source||'custom',
      sort_order:q.sort_order||0,
    }));
    if(!rows.length) return [];
    const {data,error}=await window.supabaseClient
      .from('user_questions')
      .upsert(rows,{onConflict:'user_id,key'})
      .select('id,key,text,opts,polarity,tier,is_fixed,source,sort_order');
    if(error) throw error;
    return data||[];
  },
  async deleteQuestion(key){
    const userId=await this.requireUserId();
    const {error}=await window.supabaseClient
      .from('user_questions')
      .delete()
      .eq('user_id',userId)
      .eq('key',key);
    if(error) throw error;
    return true;
  },

  // ============================================================
  // USER SETTINGS — currently just the legacy-migration flag.
  // Kept minimal on purpose: once legacy_migrated is true, the
  // one-time migration code path in app.js is dead and can be
  // deleted outright in a future cleanup pass.
  // ============================================================
  async getSettings(){
    const userId=await this.requireUserId();
    const {data,error}=await window.supabaseClient
      .from('user_settings')
      .select('legacy_migrated,migrated_at')
      .eq('user_id',userId)
      .maybeSingle();
    if(error) throw error;
    return data||{legacy_migrated:false,migrated_at:null};
  },
  async markLegacyMigrated(){
    const userId=await this.requireUserId();
    const {error}=await window.supabaseClient
      .from('user_settings')
      .upsert({user_id:userId,legacy_migrated:true,migrated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(error) throw error;
    return true;
  }
};
